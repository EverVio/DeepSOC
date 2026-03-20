import { defineStore } from 'pinia';
import { ref } from 'vue';

const DEFAULT_SESSION = '默认对话';
const DRAFT_INPUTS_KEY = 'draftInputs';

const createDefaultAgentNode = () => ({
  status: 'idle',
  content: '',
  error: '',
  errorDetail: null,
});

const createDefaultAgentData = () => ({
  rag: createDefaultAgentNode(),
  web: createDefaultAgentNode(),
});

export const useChatStore = defineStore('chat', () => {
  const currentSession = ref(localStorage.getItem('currentSession') || DEFAULT_SESSION);
  const sessions = ref(JSON.parse(localStorage.getItem('sessions') || '["默认对话"]'));
  const messages = ref({});
  const draftInputs = ref(JSON.parse(localStorage.getItem(DRAFT_INPUTS_KEY) || '{}'));

  const persistSessions = () => {
    localStorage.setItem('sessions', JSON.stringify(sessions.value));
  };

  const persistCurrentSession = () => {
    localStorage.setItem('currentSession', currentSession.value);
  };

  // 增加防抖定时器变量
  let draftTimeout = null;

  const persistDraftInputs = () => {
    // 使用防抖，避免每次按键都触发 JSON.stringify 和同步磁盘写入
    if (draftTimeout) clearTimeout(draftTimeout);
    draftTimeout = setTimeout(() => {
      localStorage.setItem(DRAFT_INPUTS_KEY, JSON.stringify(draftInputs.value));
    }, 500);
  };

  const setSessionDraft = (sessionId, draftText) => {
    if (!sessionId) return;

    const normalized = typeof draftText === 'string' ? draftText : '';
    if (normalized.length === 0) {
      if (!(sessionId in draftInputs.value)) return;
      const nextDrafts = { ...draftInputs.value };
      delete nextDrafts[sessionId];
      draftInputs.value = nextDrafts;
      persistDraftInputs();
      return;
    }

    draftInputs.value = {
      ...draftInputs.value,
      [sessionId]: normalized,
    };
    persistDraftInputs();
  };

  const clearSessionDraft = (sessionId) => {
    setSessionDraft(sessionId, '');
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
    clearSessionDraft(sessionId);

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
      message.agentData.rag = createDefaultAgentNode();
    }
    if (!message.agentData.web) {
      message.agentData.web = createDefaultAgentNode();
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

  const updateAgentStatus = (sessionId, messageId, agentId, status, error = '', errorDetail = null) => {
    const message = findMessageById(sessionId, messageId);
    if (!message || message.isUser || !status) return;

    if (agentId === 'synthesis') return;
    if (agentId !== 'rag' && agentId !== 'web') return;

    ensureAgentData(message);
    message.agentData[agentId].status = status;

    if (status === 'error') {
      message.agentData[agentId].error = error || '';
      message.agentData[agentId].errorDetail = errorDetail || null;
      return;
    }

    message.agentData[agentId].error = '';
    message.agentData[agentId].errorDetail = null;
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
    draftInputs,
    persistSessions,
    persistCurrentSession,
    persistDraftInputs,
    setSessionDraft,
    clearSessionDraft,
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
