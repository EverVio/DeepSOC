<template>
  <div class="agent-config">
    <div class="toggle-mode">
      <label>
        <input type="checkbox" v-model="store.isMultiAgentMode" />
        多智能体协作模式
      </label>
    </div>
    
    <div v-if="store.isMultiAgentMode" class="model-selectors">
      <div class="selector">
        <label>知识库检索 (RAG Agent):</label>
        <select v-model="store.agentConfigs.ragAgent.model">
          <option value="deepseek-chat">DeepSeek Chat</option>
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
        </select>
      </div>
      <div class="selector">
        <label>全网搜索 (Web Agent):</label>
        <select v-model="store.agentConfigs.webAgent.model">
          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          <option value="deepseek-chat">DeepSeek Chat</option>
        </select>
      </div>
      <div class="selector">
        <label>综合分析 (Synthesis Agent):</label>
        <select v-model="store.agentConfigs.synthesisAgent.model">
          <option value="deepseek-reasoner">DeepSeek Reasoner</option>
          <option value="gpt-4">GPT-4</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useChatStore } from '../stores/chatStore';

const store = useChatStore();
</script>

<style scoped>
/* 简单样式 */
.agent-config { margin-bottom: 10px; }
.model-selectors { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
</style>