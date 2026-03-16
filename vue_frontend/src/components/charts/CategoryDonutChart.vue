<template>
  <div class="chart-wrap">
    <div ref="chartRef" class="chart-canvas"></div>
    <div v-if="loading" class="chart-mask">AGGREGATING CATEGORY LOAD...</div>
  </div>
</template>

<script setup>
import { useEcharts } from '../../composables/useEcharts'

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
})

const colorPool = ['#00e5ff', '#00ff9d', '#7b2cbf', '#ff0055', '#ff6a00', '#89a6ff', '#47d3ff']

const { chartRef } = useEcharts(
  () => {
    const categories = (props.stats?.category_counts || []).slice(0, 7)

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(5,8,20,0.92)',
        borderColor: 'rgba(0,229,255,0.35)',
        textStyle: { color: '#d8f5ff', fontFamily: 'Roboto Mono', fontSize: 11 },
      },
      legend: {
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: '#7ba7bc', fontFamily: 'Roboto Mono', fontSize: 10 },
      },
      series: [
        {
          name: 'Category',
          type: 'pie',
          radius: ['36%', '64%'],
          center: ['50%', '42%'],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: {
            borderColor: '#050814',
            borderWidth: 1,
          },
          data: categories.map((item, idx) => ({
            value: item.value,
            name: item.name,
            itemStyle: {
              color: colorPool[idx % colorPool.length],
              shadowBlur: 8,
              shadowColor: `${colorPool[idx % colorPool.length]}80`,
            },
          })),
        },
      ],
      graphic: categories.length
        ? []
        : [
            {
              type: 'text',
              left: 'center',
              top: 'middle',
              style: { text: 'NO CATEGORY DATA', fill: '#6f95a9', font: '12px Roboto Mono' },
            },
          ],
    }
  },
  () => props.stats
)
</script>

<style scoped>
.chart-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  min-height: 220px;
}

.chart-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 8, 20, 0.4);
  color: #7ba7bc;
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
</style>
