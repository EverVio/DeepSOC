/**
 * 模块职责：维护聊天消息、会话参数与草稿持久化。
 * 业务模块：对话状态模块
 * 主要数据流：输入/响应事件 -> 消息与草稿状态 -> 视图渲染
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

const DEFAULT_SESSION = '默认对话';
const DRAFT_INPUTS_KEY = 'draftInputs';
const ANALYSIS_JUMP_PENDING_KEY = 'analysisJumpPending';
const ANALYSIS_JUMP_HISTORY_KEY = 'analysisJumpHistory';
const ANALYSIS_JUMP_HISTORY_LIMIT = 50;
/** 与系统设置「导出会话」下拉同步，重命名时需改写，避免选中项失效 */
export const EXPORT_TARGET_SESSION_KEY = 'deepsoc_exportTargetSessionId';

const readStoredJson = (storage, key, fallback) => {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
};

const writeStoredJson = (storage, key, value) => {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
  } catch {
    // ignore storage quota / serialization failures
  }
};

const normalizeAnalysisJumpEntry = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
  const createdAt = payload.createdAt || new Date().toISOString();

  return {
    ...payload,
    id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    sessionId,
    createdAt,
  };
};

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
  const analysisJumpDraft = ref(readStoredJson(sessionStorage, ANALYSIS_JUMP_PENDING_KEY, null));
  const analysisJumpHistory = ref(readStoredJson(localStorage, ANALYSIS_JUMP_HISTORY_KEY, []));

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

  const persistAnalysisJumpDraft = () => {
    if (!analysisJumpDraft.value) {
      sessionStorage.removeItem(ANALYSIS_JUMP_PENDING_KEY);
      return;
    }

    writeStoredJson(sessionStorage, ANALYSIS_JUMP_PENDING_KEY, analysisJumpDraft.value);
  };

  const persistAnalysisJumpHistory = () => {
    writeStoredJson(localStorage, ANALYSIS_JUMP_HISTORY_KEY, analysisJumpHistory.value);
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

  const setAnalysisJumpDraft = (payload) => {
    const normalized = normalizeAnalysisJumpEntry(payload);
    if (!normalized) return null;

    analysisJumpDraft.value = normalized;
    persistAnalysisJumpDraft();
    return normalized;
  };

  const clearAnalysisJumpDraft = () => {
    analysisJumpDraft.value = null;
    persistAnalysisJumpDraft();
  };

  const appendAnalysisJumpHistory = (payload) => {
    const normalized = normalizeAnalysisJumpEntry(payload);
    if (!normalized) return null;

    const nextHistory = [
      normalized,
      ...analysisJumpHistory.value.filter((item) => item?.id !== normalized.id),
    ].slice(0, ANALYSIS_JUMP_HISTORY_LIMIT);

    analysisJumpHistory.value = nextHistory;
    persistAnalysisJumpHistory();
    return normalized;
  };

  const consumeAnalysisJumpDraft = () => {
    const pending = analysisJumpDraft.value;
    if (!pending) return null;

    appendAnalysisJumpHistory(pending);
    clearAnalysisJumpDraft();
    return pending;
  };

  const clearAnalysisJumpHistory = (sessionId = '') => {
    if (!sessionId) {
      analysisJumpHistory.value = [];
      persistAnalysisJumpHistory();
      return;
    }

    analysisJumpHistory.value = analysisJumpHistory.value.filter((item) => item?.sessionId !== sessionId);
    persistAnalysisJumpHistory();
  };

  const getAnalysisJumpHistory = (sessionId = '', limit = 5) => {
    const history = sessionId
      ? analysisJumpHistory.value.filter((item) => item?.sessionId === sessionId)
      : analysisJumpHistory.value;

    return history.slice(0, limit);
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
    clearAnalysisJumpHistory(sessionId);

    if (analysisJumpDraft.value?.sessionId === sessionId) {
      clearAnalysisJumpDraft();
    }

    if (sessionId === currentSession.value) {
      const nextSession = sessions.value.length > 0 ? sessions.value[0] : DEFAULT_SESSION;
      if (sessions.value.length === 0) {
        sessions.value = [DEFAULT_SESSION];
        persistSessions();
      }
      setCurrentSession(nextSession);
    }
  };

  const renameSession = (oldId, newId) => {
    const oldTrim = (oldId || '').trim();
    const nextTrim = (newId || '').trim();
    if (!oldTrim || !nextTrim || oldTrim === nextTrim) return;
    const idx = sessions.value.indexOf(oldTrim);
    if (idx === -1) return;
    if (sessions.value.includes(nextTrim)) return;

    sessions.value = sessions.value.map((id) => (id === oldTrim ? nextTrim : id));
    persistSessions();

    if (messages.value[oldTrim]) {
      messages.value[nextTrim] = messages.value[oldTrim];
      delete messages.value[oldTrim];
    }

    if (oldTrim in draftInputs.value) {
      const nextDrafts = { ...draftInputs.value };
      nextDrafts[nextTrim] = nextDrafts[oldTrim];
      delete nextDrafts[oldTrim];
      draftInputs.value = nextDrafts;
      persistDraftInputs();
    }

    analysisJumpHistory.value = analysisJumpHistory.value.map((item) =>
      item?.sessionId === oldTrim ? { ...item, sessionId: nextTrim } : item
    );
    persistAnalysisJumpHistory();

    if (analysisJumpDraft.value?.sessionId === oldTrim) {
      analysisJumpDraft.value = { ...analysisJumpDraft.value, sessionId: nextTrim };
      persistAnalysisJumpDraft();
    }

    if (currentSession.value === oldTrim) {
      currentSession.value = nextTrim;
      persistCurrentSession();
    }

    try {
      const stored = localStorage.getItem(EXPORT_TARGET_SESSION_KEY);
      if (stored === oldTrim) {
        localStorage.setItem(EXPORT_TARGET_SESSION_KEY, nextTrim);
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('deepsoc:session-renamed', {
          detail: { oldSessionId: oldTrim, newSessionId: nextTrim },
        })
      );
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

  const resetToSingleDefaultSession = () => {
    sessions.value = [DEFAULT_SESSION];
    persistSessions();
    currentSession.value = DEFAULT_SESSION;
    persistCurrentSession();
    messages.value = {};
    draftInputs.value = {};
    persistDraftInputs();
    analysisJumpHistory.value = [];
    persistAnalysisJumpHistory();
    clearAnalysisJumpDraft();
  };

  return {
    currentSession,
    sessions,
    messages,
    draftInputs,
    analysisJumpDraft,
    analysisJumpHistory,
    persistSessions,
    persistCurrentSession,
    persistDraftInputs,
    persistAnalysisJumpDraft,
    persistAnalysisJumpHistory,
    setSessionDraft,
    clearSessionDraft,
    setAnalysisJumpDraft,
    clearAnalysisJumpDraft,
    appendAnalysisJumpHistory,
    consumeAnalysisJumpDraft,
    clearAnalysisJumpHistory,
    getAnalysisJumpHistory,
    addSession,
    setCurrentSession,
    removeSession,
    renameSession,
    addMessage,
    updateLastMessage,
    updateMessageAtIndex,
    updateAgentChunk,
    updateAgentStatus,
    removeLastMessage,
    loadHistory,
    clearSessionMessages,
    resetToSingleDefaultSession,
  };
});
