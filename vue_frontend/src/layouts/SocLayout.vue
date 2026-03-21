<!--
  组件职责：定义 SOC 主工作台布局结构并承载仪表盘/会话页面。
  业务模块：业务布局模块
  主要数据流：业务路由 -> SOC 布局壳层 -> 具体视图
-->

<template>
  <GlobalLayout />
</template>

<script setup>
import GlobalLayout from './GlobalLayout.vue'
</script>
