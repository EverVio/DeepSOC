<!--
  组件职责：登录页面容器，处理账号输入与登录提交流程。
  业务模块：认证模块
  主要数据流：用户凭据输入 -> 登录请求 -> 鉴权状态更新
-->

<template>
  <div class="login-container">
    <div class="login-wrapper">
      <div class="logo-container">
        <svg height="5em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="5em" xmlns="http://www.w3.org/2000/svg">
          <title>DeepSeek</title>
          <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588z" fill="#4D6BFE"></path>
        </svg>
      </div>

      <h1 class="title">大模型故障日志诊断分析系统</h1>
      <p class="subtitle">尊敬的用户您好，请登录以使用</p>

      <NCard class="login-card" :bordered="false" embedded>
        <NForm class="login-form" label-placement="top" @submit.prevent="handleLogin">
          <NAlert v-if="error" type="error" :show-icon="true" class="error-alert">
            {{ error }}
          </NAlert>

          <NFormItem label="用户名">
            <NInput v-model:value="username" placeholder="例如: admin" :disabled="loading" />
          </NFormItem>

          <NFormItem label="密码">
            <NInput
              v-model:value="password"
              type="password"
              show-password-on="mousedown"
              placeholder="输入密码 (默认: secret)"
              :disabled="loading"
            />
          </NFormItem>

          <NButton type="primary" attr-type="submit" class="login-button" :loading="loading" block>
            安全登录
          </NButton>
        </NForm>
      </NCard>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NAlert, NButton, NCard, NForm, NFormItem, NInput } from 'naive-ui'
import { useAuthStore } from '../stores/authStore'
import api from '../api'

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const router = useRouter()
const authStore = useAuthStore()

const handleLogin = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await api.login(username.value, password.value)
    authStore.setApiKey(response.data.api_key)
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: var(--bg-color);
  padding: 1rem;
}

.login-wrapper {
  width: 100%;
  max-width: 800px;
  text-align: center;
}

.logo-container {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
}

.title {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  text-align: center;
  font-size: 3rem;
  font-weight: 600;
}

.subtitle {
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 5rem;
  font-size: 1.5rem;
}

.login-card {
  margin: -40px 220px 0 auto;
  width: 360px;
  text-align: left;
}

.login-card :deep(.n-card__content) {
  padding: 2rem;
}

.login-form {
  display: flex;
  flex-direction: column;
}

.login-form :deep(.n-form-item-label__text) {
  color: var(--text-primary);
  font-weight: 500;
}

.login-form :deep(.n-input-wrapper) {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid var(--border-dim);
}

.login-button {
  margin-top: 0.35rem;
}

.error-alert {
  margin-bottom: 0.8rem;
}

@media (max-width: 900px) {
  .login-card {
    margin: 0 auto;
    width: min(420px, 100%);
  }

  .subtitle {
    margin-bottom: 2rem;
  }
}
</style>
