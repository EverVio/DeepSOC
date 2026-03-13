<template>
  <div class="soc-right-panel">
    <FuiCard title="THREAT RADAR" class="chart-card">
      <ThreatRadarChart :stats="dashboardStats" :loading="statsLoading" />
    </FuiCard>

    <FuiCard title="LOG INGEST STREAM" class="chart-card">
      <LogInflowChart :stats="dashboardStats" :loading="statsLoading" />
    </FuiCard>

    <FuiCard title="CATEGORY DISTRIBUTION" class="chart-card category-card">
      <div class="summary-strip">
        <span>RECORDS {{ dashboardStats.summary?.total_records || 0 }}</span>
        <span>SOURCES {{ dashboardStats.summary?.total_sources || 0 }}</span>
        <span>CAT {{ dashboardStats.summary?.total_categories || 0 }}</span>
      </div>
      <CategoryDonutChart :stats="dashboardStats" :loading="statsLoading" />
    </FuiCard>
  </div>
</template>

<script setup>
import FuiCard from '../FuiCard.vue'
import LogInflowChart from '../charts/LogInflowChart.vue'
import ThreatRadarChart from '../charts/ThreatRadarChart.vue'
import CategoryDonutChart from '../charts/CategoryDonutChart.vue'

defineProps({
  dashboardStats: { type: Object, default: () => ({}) },
  statsLoading: { type: Boolean, default: false },
})
</script>

<style scoped>
.soc-right-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.chart-card {
  min-height: 240px;
}

.chart-card :deep(.fui-card-body) {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.category-card {
  display: flex;
  flex-direction: column;
}

.summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.38rem;
}

.summary-strip span {
  border: 1px solid rgba(0, 229, 255, 0.18);
  padding: 0.2rem 0.44rem;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.07em;
  color: #89a8ba;
}

@media (max-width: 1024px) {
  .chart-card {
    min-height: 280px;
  }
}
</style>
