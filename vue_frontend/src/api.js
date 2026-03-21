/**
 * 模块职责：统一封装前端到后端 API 调用入口。
 * 业务模块：网络请求层
 * 主要数据流：页面/Store 调用 -> API 封装 -> 后端响应
 */

import axios from 'axios';

const axiosApi = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('apiKey');
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
      localStorage.removeItem('apiKey');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

function toReadableErrorMessage(data, fallback = '请求失败') {
  if (!data || typeof data !== 'object') return fallback;

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
      onData?.({
        type: 'error',
        chunk: toReadableErrorMessage(data, '智能体执行失败'),
        error_detail: data.error_detail,
      });
    }
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
  context = null,
  useDbSearch,
  useWebSearch,
  modelOptions = {},
  streamOptions = {}
) {
  const token = localStorage.getItem('apiKey');

  try {
    const body = {
      session_id: sessionId,
      user_input: userInput,
      use_db_search: useDbSearch,
      use_web_search: useWebSearch,
    };

    if (context && Array.isArray(context) && context.length > 0) {
      body.context = context;
    }

    const provider = modelOptions.provider?.trim();
    const modelName = modelOptions.modelName?.trim();
    const providerApiKey = modelOptions.providerApiKey?.trim();
    const webSearchApiKey = modelOptions.webSearchApiKey?.trim();

    if (provider) body.provider = provider;
    if (modelName) body.model_name = modelName;
    if (providerApiKey) body.provider_api_key = providerApiKey;
    if (webSearchApiKey) body.web_search_api_key = webSearchApiKey;

    const mode = streamOptions.mode?.trim();
    const agentConfigs = streamOptions.agentConfigs;
    if (mode) body.mode = mode;
    if (mode === 'multi_agent' && agentConfigs) body.agent_configs = agentConfigs;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

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
      throw new Error('Response body is null');
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let completed = false;
    let streamClosed = false;

    const notifyComplete = (duration) => {
      if (completed) return;
      completed = true;
      onComplete?.(duration);
    };

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        notifyComplete();
        break;
      }

      buffer += value;

      let eolIndex;
      while ((eolIndex = buffer.indexOf('\n\n')) !== -1) {
        const line = buffer.substring(0, eolIndex).trim();
        buffer = buffer.substring(eolIndex + 2);

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
    console.error('Fetch stream chat failed:', err);
    onError?.(err.message || 'Failed to send message');
  }
}

export default {
  login(username, password) {
    return axiosApi.post('/login', { username, password });
  },

  streamChat,

  getHistory(sessionId) {
    return axiosApi.get('/history', { params: { session_id: sessionId } });
  },

  clearHistory(sessionId) {
    return axiosApi.delete('/history', { params: { session_id: sessionId } });
  },

  getDashboardStats() {
    return axiosApi.get('/dashboard/stats');
  },
};

export async function uploadFile(file) {
  const token = localStorage.getItem('apiKey');
  const form = new FormData();
  form.append('file', file);

  const resp = await fetch('/api/upload_file', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    try {
      const data = JSON.parse(txt);
      throw new Error(data.error || '文件上传失败');
    } catch {
      throw new Error('文件上传失败');
    }
  }

  return resp.json();
}
