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

    if (provider) {
      body.provider = provider;
    }

    if (modelName) {
      body.model_name = modelName;
    }

    if (providerApiKey) {
      body.provider_api_key = providerApiKey;
    }

    const mode = streamOptions.mode?.trim();
    const agentConfigs = streamOptions.agentConfigs;

    if (mode) {
      body.mode = mode;
    }

    if (mode === 'multi_agent' && agentConfigs) {
      body.agent_configs = agentConfigs;
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      try {
        const errorText = await response.text();
        if (errorText.includes('data:')) {
          const errorData = JSON.parse(errorText.substring(errorText.indexOf('data:') + 5));
          throw new Error(errorData.chunk || `HTTP error! status: ${response.status}`);
        }

        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      } catch (e) {
        throw new Error(e.message || `HTTP error! status: ${response.status}`);
      }
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        if (onComplete) onComplete();
        break;
      }

      buffer += value;

      let eolIndex;
      while ((eolIndex = buffer.indexOf('\n\n')) !== -1) {
        const line = buffer.substring(0, eolIndex).trim();
        buffer = buffer.substring(eolIndex + 2);

        if (!line.startsWith('data:')) {
          continue;
        }

        const dataStr = line.substring(5).trim();
        if (!dataStr) {
          continue;
        }

        try {
          const data = JSON.parse(dataStr);

          if (data.type === 'agent_chunk') {
            if (data.agent_id === 'rag' || data.agent_id === 'web') {
              if (streamOptions.onAgentData) {
                streamOptions.onAgentData(data);
              }
            } else if (onData) {
              onData(data);
            }
          } else if (data.type === 'agent_status') {
            if (streamOptions.onAgentStatus) {
              streamOptions.onAgentStatus(data);
            }
          } else if (onData) {
            // Backward compatible path for single-model stream events.
            onData(data);
          }

          if (data.type === 'metadata') {
            if (onComplete) onComplete(data.duration);
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', dataStr, e);
          if (onError) onError('Failed to parse stream data');
        }
      }
    }
  } catch (err) {
    console.error('Fetch stream chat failed:', err);
    if (onError) onError(err.message || 'Failed to send message');
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
  }
};

export async function uploadFile(file) {
  const token = localStorage.getItem('apiKey');
  const form = new FormData();
  form.append('file', file);

  const resp = await fetch('/api/upload_file', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
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
