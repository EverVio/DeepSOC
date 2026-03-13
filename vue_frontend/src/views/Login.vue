<template>
  <div class="login-container">
    <div class="login-wrapper">
      <!-- (新增) Logo 或图标占位符 -->
      <div class="logo-container">
<svg height="5em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="5em" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>
      </div>

      <h1 class="title">大模型故障日志诊断分析系统</h1>
      <p class="subtitle">尊敬的用户您好，请登录以使用</p>
      
      <!-- (调整) 使用 card 样式包裹表单 -->
      <div class="login-card card">
        <form @submit.prevent="handleLogin" class="login-form">
          
          <div v-if="error" class="error-message">{{ error }}</div>

          <div class="form-group">
            <label for="username">用户名</label>
            <input
              type="text"
              id="username"
              v-model="username"
              required
              placeholder="例如: admin"
            />
          </div>
          
          <div class="form-group">
            <label for="password">密码</label>
            <input
              type="password"
              id="password"
              v-model="password"
              required
              placeholder="输入密码 (默认: secret)"
            />
          </div>
          
          <button type="submit" class="primary login-button" :disabled="loading">
            <span v-if="loading" class="loading"></span>
            <span v-else>安全登录</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import api from '../api';

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const router = useRouter();
const authStore = useAuthStore();

const handleLogin = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await api.login(username.value, password.value);
    authStore.setApiKey(response.data.api_key);
    router.push('/');
  } catch (err) {
    error.value = err.response?.data?.error || '登录失败，请检查用户名和密码';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center; /* (调整) 垂直居中 */
  justify-content: center;
  min-height: 100vh;
  background-color: var(--bg-color); /* (调整) 使用全局背景色 */
  padding: 1rem;
}

.login-wrapper {
  width: 100%;
  max-width: 800px; /* (调整) 稍宽一点 */
  text-align: center;
}

.logo-container {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
}

.logo-icon {
  width: 48px;
  height: 48px;
  color: var(--primary-color);
}

.title {
  color: var(--text-primary); /* (调整) 颜色 */
  margin-bottom: 0.5rem;
  text-align: center;
  font-size: 3rem; /* (调整) 尺寸 */
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
  padding: 2rem; 
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem; /* (调整) 增加间距 */
}

.form-group {
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.login-button {
  width: 100%;
  padding: 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  margin-top: 0.5rem; /* (调整) */
}

/* (调整) 确保 loading 动画在按钮内居中 */
.loading {
  margin: 0; /* (移除) margin-right */
}
</style>
