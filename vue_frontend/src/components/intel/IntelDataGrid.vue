<template>
  <FuiCard title="QUERY RESULT" class="intel-result-card">
    <NDataTable
      remote
      virtual-scroll
      size="small"
      :loading="listLoading"
      :columns="columns"
      :data="rows"
      :row-key="rowKey"
      :row-props="rowProps"
      :scroll-x="tableScrollX"
      :max-height="460"
    />

    <div class="intel-pagination-wrap">
      <div class="intel-pagination-meta">
        总计 {{ pagination.total }} 条
      </div>
      <NPagination
        :page="pagination.page"
        :page-size="pagination.pageSize"
        :item-count="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        show-size-picker
        @update:page="$emit('page-change', $event)"
        @update:page-size="$emit('page-size-change', $event)"
      />
    </div>
  </FuiCard>
</template>

<script setup>
import { NDataTable, NPagination } from 'naive-ui'
import FuiCard from '../FuiCard.vue'

const rowKey = (row) => row?.record_id || row?._id || row?.id || JSON.stringify(row)

defineProps({
  listLoading: { type: Boolean, default: false },
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  rowProps: { type: Function, required: true },
  tableScrollX: { type: Number, default: 1160 },
  pagination: {
    type: Object,
    required: true,
  },
})

defineEmits(['page-change', 'page-size-change'])
</script>

<style scoped>
.intel-result-card {
  flex: 1;
  min-height: 0;
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.intel-result-card:hover {
  transform: translateY(-1px);
}

.intel-result-card :deep(.fui-card-body) {
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.intel-pagination-wrap {
  margin-top: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.intel-pagination-meta {
  color: #7ba7bc;
  font-family: var(--font-ui);
  font-size: 0.72rem;
}

.intel-result-card :deep(.n-data-table-tr.intel-row) {
  cursor: pointer;
}

.intel-result-card :deep(.n-data-table-tr.intel-row > td) {
  transition: background-color 160ms ease;
  position: relative;
}

.intel-result-card :deep(.n-data-table-tr.intel-row > td:first-child) {
  box-shadow: inset 2px 0 0 var(--intel-row-accent, rgba(0, 229, 255, 0.56));
}

.intel-result-card :deep(.n-data-table-tr.intel-row:hover > td) {
  background: rgba(0, 229, 255, 0.18);
}

.intel-result-card :deep(.n-data-table-tr.intel-row--active) {
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.26), rgba(0, 229, 255, 0.12)) !important;
}

.intel-result-card :deep(.n-data-table-tr.intel-row--active > td) {
  background: transparent !important;
  border-color: transparent !important; 
}

.intel-result-card :deep(.intel-highlight-text) {
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.intel-result-card :deep(mark.highlight-cyan) {
  padding: 0 0.12rem;
  border-radius: 0.14rem;
  background: rgba(0, 229, 255, 0.32);
  color: #e8fdff;
  box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.18);
}
</style>
