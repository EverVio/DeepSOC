<template>
  <FuiCard title="威胁情报检索" class="intel-filter-card" :glow="true">
    <div class="intel-filter-shell">
      <div class="intel-filter-shell__header">
        <div class="intel-filter-shell__title-group">
          <div class="intel-filter-shell__title">基础搜索</div>
        </div>
        <NButton quaternary size="small" class="intel-filter-toggle" @click="$emit('toggle-advanced')">
          {{ showAdvancedFilters ? '收起高级筛选' : '高级筛选' }}
        </NButton>
      </div>

      <div class="intel-filter-grid intel-filter-grid--base">
        <NInput
          v-model:value="keywordModel"
          clearable
          placeholder="关键字 / IOC / CVE / Payload"
          @keyup.enter="$emit('instant-search')"
        />

        <NSelect
          v-model:value="filters.db_type"
          :options="dbTypeOptions"
          clearable
          placeholder="数据类型"
        />

        <NSelect
          v-model:value="filters.risk_level"
          :options="riskLevelOptions"
          clearable
          placeholder="风险等级"
        />

        <NSelect
          v-model:value="filters.source"
          :options="sourceOptions"
          clearable
          placeholder="数据来源"
        />

        <NDatePicker
          v-model:value="dateRangeModel"
          type="datetimerange"
          clearable
          placeholder="时间范围"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 100%;"
        />

        <div class="intel-filter-actions">
          <NButton type="primary" ghost @click="$emit('search')">检索</NButton>
          <NButton quaternary @click="$emit('reset')">重置</NButton>
          <NButton :loading="exporting" quaternary @click="$emit('open-export')">导出</NButton>
        </div>
      </div>
    </div>

    <div class="intel-advanced-panel" :class="{ 'intel-advanced-panel--open': showAdvancedFilters }">
      <div class="intel-advanced-panel__inner">
        <div class="intel-filter-grid intel-filter-grid--advanced">
          <NSelect
            v-model:value="filters.db_type"
            :options="dbTypeOptions"
            clearable
            placeholder="数据类型"
          />

          <NSelect
            v-model:value="filters.risk_level"
            :options="riskLevelOptions"
            clearable
            placeholder="风险等级"
          />

          <NSelect
            v-model:value="filters.source"
            :options="sourceOptions"
            clearable
            placeholder="数据来源"
          />

          <NSelect
            v-model:value="sortByModel"
            :options="sortByOptions"
            placeholder="排序字段"
          />

          <NSelect
            v-model:value="sortOrderModel"
            :options="sortOrderOptions"
            placeholder="排序方向"
          />
        </div>
      </div>
    </div>
  </FuiCard>
</template>

<script setup>
import { computed } from 'vue'
import { NButton, NDatePicker, NInput, NSelect } from 'naive-ui'
import FuiCard from '../FuiCard.vue'

const props = defineProps({
  keywordInput: { type: String, default: '' },
  filters: { type: Object, required: true },
  dateRange: { type: [Array, Number, null], default: null },
  sortBy: { type: String, default: '' },
  sortOrder: { type: String, default: '' },
  dbTypeOptions: { type: Array, default: () => [] },
  riskLevelOptions: { type: Array, default: () => [] },
  sourceOptions: { type: Array, default: () => [] },
  sortByOptions: { type: Array, default: () => [] },
  sortOrderOptions: { type: Array, default: () => [] },
  showAdvancedFilters: { type: Boolean, default: false },
  exporting: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:keywordInput',
  'update:dateRange',
  'update:sortBy',
  'update:sortOrder',
  'toggle-advanced',
  'search',
  'reset',
  'open-export',
  'instant-search',
])

const keywordModel = computed({
  get: () => props.keywordInput,
  set: (value) => emit('update:keywordInput', value),
})

const dateRangeModel = computed({
  get: () => props.dateRange,
  set: (value) => emit('update:dateRange', value),
})

const sortByModel = computed({
  get: () => props.sortBy,
  set: (value) => emit('update:sortBy', value),
})

const sortOrderModel = computed({
  get: () => props.sortOrder,
  set: (value) => emit('update:sortOrder', value),
})
</script>

<style scoped>
.intel-filter-card {
  flex-shrink: 0;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.intel-filter-card :deep(.fui-card-header .fui-card-title) {
  font-size: 1rem;
  line-height: 1.1;
  letter-spacing: 0.12em;
}

.intel-filter-card:hover {
  transform: translateY(-1px);
}

.intel-filter-card :deep(.fui-card-body) {
  padding: 0.8rem 0.95rem;
}

.intel-filter-shell {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.intel-filter-shell__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.8rem;
}

.intel-filter-shell__title-group {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.intel-filter-shell__title {
  color: var(--neon-cyan);
  font-family: var(--font-ui);
  font-size: 1.25rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.intel-filter-toggle {
  flex-shrink: 0;
}

.intel-filter-grid {
  display: grid;
  gap: 0.55rem;
  align-items: center;
}

.intel-filter-grid--base {
  grid-template-columns: 2.2fr 2fr auto;
}

.intel-filter-grid--advanced {
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
}

.intel-advanced-panel {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    max-height 260ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 200ms ease,
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.intel-advanced-panel--open {
  max-height: 180px;
  opacity: 1;
  transform: translateY(0);
}

.intel-advanced-panel__inner {
  padding-top: 0.4rem;
}

.intel-filter-grid--base :deep(.n-input),
.intel-filter-grid--base :deep(.n-date-picker),
.intel-filter-grid--advanced :deep(.n-select) {
  transition:
    box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.intel-filter-grid--base :deep(.n-input:hover),
.intel-filter-grid--base :deep(.n-date-picker:hover),
.intel-filter-grid--advanced :deep(.n-select:hover) {
  transform: translateY(-1px);
}

.intel-filter-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.intel-filter-actions :deep(.n-button) {
  transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.intel-filter-actions :deep(.n-button:hover) {
  transform: translateY(-1px);
}

@media (max-width: 1460px) {
  .intel-filter-grid--base {
    grid-template-columns: 1.4fr 1.2fr auto;
  }

  .intel-filter-actions {
    grid-column: 1 / -1;
  }

  .intel-filter-grid--advanced {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .intel-advanced-panel--open {
    max-height: 220px;
  }
}

@media (max-width: 1024px) {
  .intel-filter-grid--base,
  .intel-filter-grid--advanced {
    grid-template-columns: 1fr;
  }

  .intel-advanced-panel--open {
    max-height: 420px;
  }
}

</style>
