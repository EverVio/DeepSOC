/**
 * 模块职责：定义路由表与导航守卫。
 * 业务模块：路由模块
 * 主要数据流：URL/导航事件 -> 路由匹配 -> 页面组件
 */

import { createRouter, createWebHistory } from 'vue-router'
import api from './api'
import { useAuthStore } from './stores/authStore'
import { useAppStore } from './stores/appStore'

const Login = () => import('./views/Login.vue')
const GlobalLayout = () => import('./layouts/GlobalLayout.vue')
const Dashboard = () => import('./views/Dashboard.vue')
const ChatPage = () => import('./views/ChatPage.vue')
const IntelQuery = () => import('./views/IntelQuery.vue')
const Settings = () => import('./views/Settings.vue')

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/',
    component: GlobalLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: Dashboard,
      },
      {
        path: 'chat',
        name: 'Chat',
        component: ChatPage,
      },
      {
        path: 'intel',
        name: 'IntelQuery',
        component: IntelQuery,
      },
      {
        path: 'settings',
        name: 'Settings',
        component: Settings,
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const appStore = useAppStore()
  authStore.syncFromStorage()
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (authStore.isAuthenticated && !appStore.runtimeConfigLoaded) {
    try {
      await appStore.syncRuntimeConfig(api)
    } catch {
      // ignore runtime config hydration failures
    }
  }

  if (to.path === '/login' && authStore.isAuthenticated) {
    return '/dashboard'
  }

  if (requiresAuth && !authStore.isAuthenticated) {
    return '/login'
  }
})

router.afterEach(() => {
  // 全局后置路由守卫：在路由切换完成后，强行清理从上一个图表页面残留挂载在 body 下的 ECharts Tooltip DOM，防止牛皮癣式悬浮残留
  if (typeof document !== 'undefined') {
    const tooltips = document.querySelectorAll('.cyber-tooltip, .echarts-tooltip')
    tooltips.forEach((el) => {
      try {
        el.parentNode?.removeChild(el)
      } catch {
        // ignore
      }
    })
  }
})

export default router
