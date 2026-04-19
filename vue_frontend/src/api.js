/**
 * 模块职责：统一封装前端到后端 API 调用入口。
 * 业务模块：网络请求层
 * 主要数据流：页面/Store 调用 -> API 封装 -> 后端响应
 */

import axios from 'axios';

const TOKEN_KEY = 'apiKey';
const SENSITIVE_KEYS = [TOKEN_KEY, 'providerApiKey', 'webSearchApiKey'];
const DEFAULT_IDLE_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_BUFFER_LIMIT = 1024 * 1024;

const getAuthToken = () => {
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) return storedToken;

  const legacyToken = sessionStorage.getItem(TOKEN_KEY);
  if (!legacyToken) return null;

  localStorage.setItem(TOKEN_KEY, legacyToken);
  sessionStorage.removeItem(TOKEN_KEY);
  return legacyToken;
};

const clearSensitiveSession = () => {
  SENSITIVE_KEYS.forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
};

const emitUnauthorized = () => {
  window.dispatchEvent(new CustomEvent('deepsoc:unauthorized'));
};

const handleUnauthorized = () => {
  clearSensitiveSession();
  emitUnauthorized();
  window.location.href = '/login';
};

const axiosApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosApi.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

function toReadableErrorMessage(data, fallback = '请求失败') {
  if (!data || typeof data !== 'object') return fallback;

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }

  if (typeof data.chunk === 'string' && data.chunk.trim()) {
    return data.chunk.trim();
  }
  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }

  const detail = data.error_detail;
  if (detail && typeof detail === 'object') {
    const provider = detail.provider || 'provider';
    const model = detail.model || 'unknown-model';
    const status = detail.status_code ? `HTTP ${detail.status_code}` : 'HTTP error';
    const code = detail.error_code ? ` (${detail.error_code})` : '';
    const message = detail.message || fallback;
    return `[${provider}/${model}] ${status}${code}: ${message}`;
  }

  return fallback;
}

function createRetryableError(message) {
  const error = new Error(message);
  error.retryable = true;
  return error;
}

function isAbortLike(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  if (err.code === 20) return true;
  if (String(err.code || '').toUpperCase() === 'ERR_CANCELED') return true;
  if (String(err.name || '') === 'CanceledError') return true;
  return false;
}

function normalizeApiError(error, fallbackMessage = '请求失败') {
  if (!error) {
    return {
      message: fallbackMessage,
      status: null,
      code: 'UNKNOWN',
      isCanceled: false,
      original: error,
    };
  }

  const responseData = error.response?.data;
  const normalizedMessage = toReadableErrorMessage(responseData, error.message || fallbackMessage);
  return {
    message: normalizedMessage,
    status: Number(error.response?.status || 0) || null,
    code: error.code || error.response?.status || 'UNKNOWN',
    isCanceled: isAbortLike(error),
    original: error,
  };
}

function emitApiError(detail) {
  window.dispatchEvent(new CustomEvent('deepsoc:api-error', { detail }));
}

async function runSafeRequest(requester, fallbackMessage) {
  try {
    const response = await requester();
    return { ok: true, response };
  } catch (error) {
    const normalized = normalizeApiError(error, fallbackMessage);
    if (!normalized.isCanceled) {
      emitApiError(normalized);
      console.error('[API ERROR]', normalized.message, normalized);
    }
    return {
      ok: false,
      canceled: normalized.isCanceled,
      error: normalized,
    };
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readWithIdleTimeout(reader, timeoutMs) {
  let timeoutId = null;
  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(createRetryableError(`流式响应超时（>${timeoutMs}ms）`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function routeSseEvent(data, onData, streamOptions) {
  if (!data || typeof data !== 'object') return;

  if (data.type === 'agent_chunk') {
    if (data.agent_id === 'rag' || data.agent_id === 'web') {
      streamOptions.onAgentData?.(data);
      return;
    }
    onData?.(data);
    return;
  }

  if (data.type === 'agent_status') {
    streamOptions.onAgentStatus?.(data);
    if (data.status === 'error') {
      const message = toReadableErrorMessage(data, '智能体执行失败');
      onData?.({
        type: 'error',
        message,
        chunk: message,
        error_detail: data.error_detail,
      });
    }
    return;
  }

  if (data.type === 'notice') {
    streamOptions.onNotice?.(data);
    return;
  }

  onData?.(data);
}

async function streamChat(
  sessionId,
  userInput,
  onData,
  onError,
  onComplete,
  context = undefined,
  useDbSearch,
  useWebSearch,
  modelOptions = {},
  streamOptions = {}
) {
  const token = getAuthToken();
  const idleTimeoutMs = Number(streamOptions.idleTimeoutMs) > 0
    ? Number(streamOptions.idleTimeoutMs)
    : DEFAULT_IDLE_TIMEOUT_MS;
  const maxRetries = Number(streamOptions.maxRetries) >= 0
    ? Number(streamOptions.maxRetries)
    : DEFAULT_MAX_RETRIES;
  const bufferLimit = Number(streamOptions.bufferLimitBytes) > 0
    ? Number(streamOptions.bufferLimitBytes)
    : DEFAULT_BUFFER_LIMIT;
  const signal = streamOptions?.signal;

  try {
    const body = {
      session_id: sessionId,
      user_input: userInput,
      use_db_search: useDbSearch,
      use_web_search: useWebSearch,
    };

    if (context !== undefined && Array.isArray(context)) {
      body.context = context;
    }

    const provider = modelOptions.provider?.trim();
    const modelName = modelOptions.modelName?.trim();
    const embeddingMode = modelOptions.embeddingMode?.trim();
    const embeddingModel = modelOptions.embeddingModel?.trim();
    const providerApiKey = modelOptions.providerApiKey?.trim();
    const webSearchApiKey = modelOptions.webSearchApiKey?.trim();

    if (provider) body.provider = provider;
    if (modelName) body.model_name = modelName;
    if (embeddingMode) body.embedding_mode = embeddingMode;
    if (embeddingModel) body.embedding_model = embeddingModel;
    if (providerApiKey) body.provider_api_key = providerApiKey;
    if (webSearchApiKey) body.web_search_api_key = webSearchApiKey;

    const mode = streamOptions.mode?.trim();
    const agentConfigs = streamOptions.agentConfigs;
    if (mode) body.mode = mode;
    if (mode === 'multi_agent' && agentConfigs) body.agent_configs = agentConfigs;

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const executeStream = async () => {
      let reader = null;
      let completed = false;

      streamOptions.onNotice?.({ type: 'notice', scope: 'llm_fallback', message: '' })

      const notifyComplete = (duration) => {
        if (completed) return;
        completed = true;
        onComplete?.(duration);
      };

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        });

        if (response.status === 401) {
          handleUnauthorized();
          throw new Error('登录状态已失效，请重新登录');
        }

        if (!response.ok) {
          const errorText = await response.text();
          let parsed = null;

          try {
            if (errorText.includes('data:')) {
              parsed = JSON.parse(errorText.substring(errorText.indexOf('data:') + 5));
            } else {
              parsed = JSON.parse(errorText);
            }
          } catch {
            parsed = null;
          }

          throw new Error(toReadableErrorMessage(parsed, `HTTP error! status: ${response.status}`));
        }

        if (!response.body) {
          throw createRetryableError('Response body is null');
        }

        reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        let streamClosed = false;

        while (true) {
          let readResult;
          try {
            readResult = await readWithIdleTimeout(reader, idleTimeoutMs);
          } catch (readErr) {
            if (isAbortLike(readErr)) {
              try {
                await reader.cancel();
              } catch {
                // ignore
              }
              notifyComplete();
              return;
            }
            throw readErr;
          }

          const { value, done } = readResult;

          if (done) {
            notifyComplete();
            break;
          }

          buffer += value;
          if (buffer.length > bufferLimit) {
            throw createRetryableError('流式响应缓存超过上限，请重试');
          }

          let separatorMatch;
          while ((separatorMatch = buffer.match(/\r?\n\r?\n/)) !== null) {
            const separator = separatorMatch[0];
            const eolIndex = separatorMatch.index ?? -1;
            if (eolIndex < 0) break;

            const line = buffer.substring(0, eolIndex).trim();
            buffer = buffer.substring(eolIndex + separator.length);

            if (!line.startsWith('data:')) continue;

            const dataStr = line.substring(5).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              routeSseEvent(data, onData, streamOptions);

              if (data.type === 'metadata') {
                notifyComplete(data.duration);
              } else if (data.type === 'done') {
                notifyComplete(data.duration);
                streamClosed = true;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', dataStr, e);
              onError?.('Failed to parse stream data');
            }
          }

          if (streamClosed) {
            try {
              await reader.cancel();
            } catch {
              // ignore cancel errors
            }
            break;
          }
        }
      } catch (err) {
        if (isAbortLike(err)) {
          try {
            if (reader) await reader.cancel();
          } catch {
            // ignore
          }
          notifyComplete();
          return;
        }
        throw err;
      }
    };

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await executeStream();
        return;
      } catch (error) {
        if (isAbortLike(error)) {
          onComplete?.();
          return;
        }
        const isRetryable = Boolean(error?.retryable);
        const canRetry = isRetryable && attempt < maxRetries;
        if (!canRetry) {
          throw error;
        }

        const delayMs = Math.min(1000 * 2 ** attempt, 4000);
        await sleep(delayMs);
      }
    }
  } catch (err) {
    if (isAbortLike(err)) {
      return;
    }
    console.error('Fetch stream chat failed:', err);
    onError?.(err.message || 'Failed to send message');
  }
}

export default {
  login(username, password) {
    return axiosApi.post('/login', { username, password });
  },

  testConnection(data) {
    return axiosApi.post('/test_connection', data);
  },

  getRuntimeConfig() {
    return axiosApi.get('/runtime-config');
  },

  createEmbeddings(data) {
    return axiosApi.post('/embeddings', data);
  },

  streamChat,

  getSessions() {
    return axiosApi.get('/sessions');
  },

  getHistory(sessionId) {
    return axiosApi.get('/history', { params: { session_id: sessionId } });
  },

  clearHistory(sessionId) {
    return axiosApi.delete('/history', { params: { session_id: sessionId } });
  },

  deleteSession(sessionId) {
    return axiosApi.delete('/session', { params: { session_id: sessionId } });
  },

  renameSession(oldSessionId, newSessionId) {
    return axiosApi.post('/session/rename', {
      old_session_id: oldSessionId,
      new_session_id: newSessionId,
    });
  },

  getDashboardStats() {
    return axiosApi.get('/dashboard/stats');
  },

  queryLogsSafe(params = {}, requestConfig = {}) {
    return runSafeRequest(
      () => axiosApi.get('/query/logs', {
        params,
        ...requestConfig,
      }),
      '情报查询失败'
    );
  },

  getQueryLogDetail(recordId, requestConfig = {}) {
    return axiosApi.get(`/query/logs/${encodeURIComponent(recordId)}`, requestConfig);
  },

  getQueryLogDetailSafe(recordId, requestConfig = {}) {
    return runSafeRequest(
      () => axiosApi.get(`/query/logs/${encodeURIComponent(recordId)}`, requestConfig),
      '详情查询失败'
    );
  },

  async exportQueryLogs(params = {}, requestConfig = {}) {
    const response = await axiosApi.get('/query/export', {
      params,
      responseType: 'blob',
      ...requestConfig,
    });

    const disposition = response.headers?.['content-disposition'] || '';
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = match?.[1] || 'deepsoc_export.csv';

    return {
      blob: response.data,
      filename,
      contentType: response.headers?.['content-type'] || 'application/octet-stream',
    };
  },
};

export async function uploadFile(file) {
  const token = getAuthToken();
  const form = new FormData();
  form.append('file', file);

  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch('/api/upload_file', {
    method: 'POST',
    headers,
    body: form,
  });

  if (resp.status === 401) {
    handleUnauthorized();
    throw new Error('登录状态已失效，请重新登录');
  }

  if (!resp.ok) {
    const txt = await resp.text();
    try {
      const data = JSON.parse(txt);
      throw new Error(data.error || data.message || '文件上传失败');
    } catch {
      throw new Error('文件上传失败');
    }
  }

  return resp.json();
}
