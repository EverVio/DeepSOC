<!--
  组件职责：应用根组件，承载全局布局与路由出口。
  业务模块：应用壳层
  主要数据流：路由状态 -> 布局容器 -> 业务页面组件
-->

<template>
  <!-- FUI 全屏背景（z-index: 0，永远在最底层） -->
  <Background />
  <!-- 路由页面内容叠在背景上（z-index: 1+） -->
  <router-view />
</template>

<script setup>
import Background from './components/Background.vue'
</script>

<style>
/* 确保路由页面内容可以覆盖背景 */
#app > *:not(.fui-bg) {
  position: relative;
  z-index: 1;
}
</style>
