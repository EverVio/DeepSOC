import { defineStore } from 'pinia';
import { ref } from 'vue';

const DEFAULT_SESSION = '默认对话';

const createDefaultAgentData = () => ({
  rag: { status: 'idle', content: '' },
  web: { status: 'idle', content: '' },
});

export const useChatStore = defineStore('chat', () => {
  const currentSession = ref(localStorage.getItem('currentSession') || DEFAULT_SESSION);
  const sessions = ref(JSON.parse(localStorage.getItem('sessions') || '["默认对话"]'));
  const messages = ref({});

  const isMultiAgentMode = ref(false);

  const agentConfigs = ref({
    ragAgent: { model: 'deepseek-chat', enabled: true },
    webAgent: { model: 'gpt-3.5-turbo', enabled: true },
    synthesisAgent: { model: 'deepseek-reasoner' }
  });

  const persistSessions = () => {
    localStorage.setItem('sessions', JSON.stringify(sessions.value));
  };

  const persistCurrentSession = () => {
    localStorage.setItem('currentSession', currentSession.value);
  };

  const addSession = (sessionId) => {
    if (!sessions.value.includes(sessionId)) {
      sessions.value.push(sessionId);
      persistSessions();
    }
    setCurrentSession(sessionId);
  };

  const setCurrentSession = (sessionId) => {
    currentSession.value = sessionId;
    persistCurrentSession();
  };

  const removeSession = (sessionId) => {
    sessions.value = sessions.value.filter((id) => id !== sessionId);
    persistSessions();

    if (sessionId === currentSession.value) {
      const nextSession = sessions.value.length > 0 ? sessions.value[0] : DEFAULT_SESSION;
      if (sessions.value.length === 0) {
        sessions.value = [DEFAULT_SESSION];
        persistSessions();
      }
      setCurrentSession(nextSession);
    }
  };

  const addMessage = (sessionId, isUser, payload) => {
    if (!messages.value[sessionId]) {
      messages.value[sessionId] = [];
    }

    const newMessage = {
      id: Date.now() + Math.random(),
      isUser,
      content: '',
      think_process: '',
      duration: null,
      isMultiAgent: false,
      agentData: createDefaultAgentData(),
      ...payload,
      timestamp: new Date(),
    };

    messages.value[sessionId].push(newMessage);
    return newMessage.id;
  };

  const findMessageById = (sessionId, messageId) => {
    const sessionMessages = messages.value[sessionId];
    if (!sessionMessages || sessionMessages.length === 0) return null;
    return sessionMessages.find((message) => message.id === messageId) || null;
  };

  const ensureAgentData = (message) => {
    if (!message.agentData) {
      message.agentData = createDefaultAgentData();
    }
    if (!message.agentData.rag) {
      message.agentData.rag = { status: 'idle', content: '' };
    }
    if (!message.agentData.web) {
      message.agentData.web = { status: 'idle', content: '' };
    }
  };

  const updateAgentChunk = (sessionId, messageId, agentId, chunk) => {
    const message = findMessageById(sessionId, messageId);
    if (!message || message.isUser || !chunk) return;

    if (agentId === 'synthesis') {
      if (!message.content) message.content = '';
      message.content += chunk;
      return;
    }

    if (agentId !== 'rag' && agentId !== 'web') return;

    ensureAgentData(message);
    message.agentData[agentId].content += chunk;
  };

  const updateAgentStatus = (sessionId, messageId, agentId, status) => {
    const message = findMessageById(sessionId, messageId);
    if (!message || message.isUser || !status) return;

    if (agentId === 'synthesis') return;
    if (agentId !== 'rag' && agentId !== 'web') return;

    ensureAgentData(message);
    message.agentData[agentId].status = status;
  };

  const updateLastMessage = (sessionId, payload) => {
    if (!messages.value[sessionId] || messages.value[sessionId].length === 0) return;

    const lastIndex = messages.value[sessionId].length - 1;
    const lastMessage = messages.value[sessionId][lastIndex];

    if (lastMessage.isUser) return;

    if (payload.content_chunk) {
      lastMessage.content += payload.content_chunk;
    }

    if (payload.think_chunk) {
      if (lastMessage.think_process === null || lastMessage.think_process === undefined) {
        lastMessage.think_process = '';
      }
      lastMessage.think_process += payload.think_chunk;
    }

    if (payload.duration) {
      lastMessage.duration = payload.duration;
    }
  };

  const updateMessageAtIndex = (sessionId, messageIndex, payload) => {
    if (!messages.value[sessionId] || !messages.value[sessionId][messageIndex]) return;

    const message = messages.value[sessionId][messageIndex];

    if (payload.content_chunk) {
      if (!message.content) {
        message.content = '';
      }
      message.content += payload.content_chunk;
    }

    if (payload.think_chunk) {
      if (message.think_process === null || message.think_process === undefined) {
        message.think_process = '';
      }
      message.think_process += payload.think_chunk;
    }

    if (payload.duration) {
      message.duration = payload.duration;
    }
  };

  const removeLastMessage = (sessionId) => {
    if (!messages.value[sessionId] || messages.value[sessionId].length === 0) return;
    const lastMessage = messages.value[sessionId][messages.value[sessionId].length - 1];
    if (!lastMessage.isUser) {
      messages.value[sessionId].pop();
    }
  };

  const loadHistory = (sessionId, historyText) => {
    messages.value[sessionId] = [];
    if (!historyText) return;

    const lines = historyText.split('\n');
    let currentMessage = null;

    lines.forEach((line) => {
      if (line.startsWith('用户：')) {
        if (currentMessage) {
          addMessage(sessionId, currentMessage.isUser, {
            content: currentMessage.content,
            think_process: null,
            duration: null,
          });
        }

        currentMessage = {
          isUser: true,
          content: line.replace('用户：', '').trim(),
        };
        return;
      }

      if (line.startsWith('回复：')) {
        if (currentMessage) {
          addMessage(sessionId, currentMessage.isUser, {
            content: currentMessage.content,
            think_process: null,
            duration: null,
          });
        }

        currentMessage = {
          isUser: false,
          content: line.replace('回复：', '').trim(),
        };
      }
    });

    if (currentMessage) {
      addMessage(sessionId, currentMessage.isUser, {
        content: currentMessage.content,
        think_process: null,
        duration: null,
      });
    }
  };

  const clearSessionMessages = (sessionId) => {
    messages.value[sessionId] = [];
  };

  return {
    currentSession,
    sessions,
    messages,
    isMultiAgentMode,
    agentConfigs,
    persistSessions,
    persistCurrentSession,
    addSession,
    setCurrentSession,
    removeSession,
    addMessage,
    updateLastMessage,
    updateMessageAtIndex,
    updateAgentChunk,
    updateAgentStatus,
    removeLastMessage,
    loadHistory,
    clearSessionMessages,
  };
});
