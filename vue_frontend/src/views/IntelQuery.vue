<template>
  <div class="intel-page">
    <IntelFilterBar
      :keyword-input="keywordInput"
      :filters="filters"
      :date-range="dateRange"
      :sort-by="sortBy"
      :sort-order="sortOrder"
      :db-type-options="dbTypeOptions"
      :risk-level-options="riskLevelOptions"
      :source-options="sourceOptions"
      :sort-by-options="sortByOptions"
      :sort-order-options="sortOrderOptions"
      :show-advanced-filters="showAdvancedFilters"
      :exporting="exporting"
      @update:keyword-input="keywordInput = $event"
      @update:date-range="dateRange = $event"
      @update:sort-by="sortBy = $event"
      @update:sort-order="sortOrder = $event"
      @toggle-advanced="toggleAdvancedFilters"
      @search="handleManualSearch"
      @instant-search="handleInstantKeywordSearch"
      @reset="handleResetFilters"
      @open-export="openExportPanel"
    />

    <div class="intel-main" :class="{ 'intel-main--immersive': isDetailImmersive }">
      <Splitpanes class="intel-split" :class="{ 'intel-split--immersive': isDetailImmersive }" :dbl-click-splitter="false">
        <Pane :size="62" min-size="40">
          <IntelDataGrid
            :list-loading="listLoading"
            :columns="columns"
            :rows="rows"
            :row-props="rowProps"
            :table-scroll-x="tableScrollX"
            :pagination="pagination"
            @page-change="handlePageChange"
            @page-size-change="handlePageSizeChange"
          />
        </Pane>

        <Pane :size="38" min-size="28" class="intel-detail-pane">
          <IntelDetailPanel
            :selected-record="selectedRecord"
            :detail-loading="detailLoading"
            :detail-json="detailJson"
            :is-detail-immersive="isDetailImmersive"
            :copied-field="copiedField"
            :highlight-text="getHighlightedText"
            @toggle-immersive="toggleDetailImmersive"
            @close-immersive="closeDetailImmersive"
            @send-to-chat="sendToChat"
            @copy-field="handleCopyField"
          />
        </Pane>
      </Splitpanes>
    </div>

    <IntelExportModal
      :show="showExportPanel"
      :export-options="exportOptions"
      :export-field-options="exportFieldOptions"
      :export-selected-count="exportSelectedCount"
      :exporting="exporting"
      @close="closeExportPanel"
      @select-default="selectDefaultExportFields"
      @select-all="selectAllExportFields"
      @submit="submitExport"
    />
  </div>
</template>

<script setup>
import { useDebounceFn } from '@vueuse/core'
import { h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createDiscreteApi, NTag } from 'naive-ui'
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

import IntelDataGrid from '../components/intel/IntelDataGrid.vue'
import IntelDetailPanel from '../components/intel/IntelDetailPanel.vue'
import IntelExportModal from '../components/intel/IntelExportModal.vue'
import IntelFilterBar from '../components/intel/IntelFilterBar.vue'
import { buildAnalysisJumpEntry } from '../composables/useAnalysisJump'
import { useIntelQuery } from '../composables/useIntelQuery'
import { useChatStore } from '../stores/chatStore'

const router = useRouter()
const chatStore = useChatStore()
const { message } = createDiscreteApi(['message'])

const {
  listLoading,
  detailLoading,
  exporting,
  rows,
  selectedRecord,
  selectedRecordId,
  dateRange,
  sortBy,
  sortOrder,
  showExportPanel,
  filters,
  facets,
  pagination,
  sortByOptions,
  sortOrderOptions,
  exportFieldOptions,
  exportOptions,
  dbTypeOptions,
  riskLevelOptions,
  sourceOptions,
  detailJson,
  exportSelectedCount,
  fetchRows,
  handleSelectRow,
  handleSearch,
  handleReset,
  handlePageChange,
  handlePageSizeChange,
  openExportPanel,
  closeExportPanel,
  selectDefaultExportFields,
  selectAllExportFields,
  submitExport,
} = useIntelQuery()

const tableScrollX = 1160
const keywordInput = ref(filters.q)
const suppressKeywordAutoSearch = ref(false)
const showAdvancedFilters = ref(false)
const isDetailImmersive = ref(false)
const copiedField = ref('')
const highlightRegex = ref(null)
const highlightSignature = ref('')
const highlightCache = new Map()
const MAX_HIGHLIGHT_CACHE = 500
let copiedFieldTimer = null

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getKeywordTerms(keyword = keywordInput.value) {
  return String(keyword || '')
    .trim()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function syncHighlightMatcher(keyword) {
  const terms = getKeywordTerms(keyword)
  const signature = terms.join('\u0001')
  if (signature === highlightSignature.value) return

  highlightSignature.value = signature
  if (!terms.length) {
    highlightRegex.value = null
    highlightCache.clear()
    return
  }

  const pattern = terms.map(escapeRegExp).join('|')
  highlightRegex.value = pattern ? new RegExp(`(${pattern})`, 'gi') : null
  highlightCache.clear()
}

function getHighlightedText(rawText, cacheId = '') {
  const safeText = escapeHtml(rawText ?? '-')
  if (!highlightRegex.value) return safeText

  const cacheKey = `${highlightSignature.value}|${cacheId}|${safeText}`
  const cached = highlightCache.get(cacheKey)
  if (cached) return cached

  const highlighted = safeText.replace(highlightRegex.value, '<mark class="highlight-cyan">$1</mark>')
  highlightCache.set(cacheKey, highlighted)

  if (highlightCache.size > MAX_HIGHLIGHT_CACHE) {
    const firstKey = highlightCache.keys().next().value
    if (firstKey) {
      highlightCache.delete(firstKey)
    }
  }

  return highlighted
}

watch(
  keywordInput,
  (value) => {
    syncHighlightMatcher(value)
  },
  { immediate: true },
)

watch(
  keywordInput,
  useDebounceFn((value) => {
    if (suppressKeywordAutoSearch.value) return
    filters.q = String(value || '').trim()
    handleSearch()
  }, 260),
)

function handleManualSearch() {
  filters.q = String(keywordInput.value || '').trim()
  handleSearch()
}

function handleInstantKeywordSearch() {
  handleManualSearch()
}

function handleResetFilters() {
  suppressKeywordAutoSearch.value = true
  keywordInput.value = ''
  closeDetailImmersive()
  handleReset()
  requestAnimationFrame(() => {
    suppressKeywordAutoSearch.value = false
  })
}

function toggleAdvancedFilters() {
  showAdvancedFilters.value = !showAdvancedFilters.value
}

function toggleDetailImmersive() {
  if (!selectedRecord.value) return
  isDetailImmersive.value = !isDetailImmersive.value
}

function closeDetailImmersive() {
  isDetailImmersive.value = false
}

async function handleCopyField(fieldKey, value) {
  const text = String(value ?? '').trim()
  if (!text || text === '-') {
    message.warning('无可复制内容')
    return
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', 'true')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    copiedField.value = fieldKey
    if (copiedFieldTimer) {
      window.clearTimeout(copiedFieldTimer)
    }
    copiedFieldTimer = window.setTimeout(() => {
      if (copiedField.value === fieldKey) {
        copiedField.value = ''
      }
    }, 1200)
    message.success('复制成功')
  } catch (error) {
    console.error('Copy field failed:', error)
    message.error('复制失败')
  }
}

function handleReaderKeydown(event) {
  if (!isDetailImmersive.value) return
  if (event.key !== 'Escape') return
  event.preventDefault()
  closeDetailImmersive()
}

watch(selectedRecord, (nextRecord) => {
  if (!nextRecord) {
    closeDetailImmersive()
    copiedField.value = ''
  }
})

function getRiskAccent(level) {
  const normalized = String(level || 'Info').toLowerCase()
  const riskAccentMap = {
    critical: 'rgba(255, 73, 117, 0.95)',
    high: 'rgba(255, 171, 79, 0.92)',
    medium: 'rgba(255, 210, 92, 0.9)',
    low: 'rgba(67, 243, 162, 0.85)',
    info: 'rgba(0, 229, 255, 0.78)',
  }

  return riskAccentMap[normalized] || 'rgba(0, 229, 255, 0.56)'
}

const columns = [
  {
    title: '时间',
    key: 'fetched_at',
    width: 170,
    ellipsis: { tooltip: true },
    render: (row) => row.fetched_at || '-',
  },
  {
    title: '类型',
    key: 'db_type',
    width: 100,
  },
  {
    title: '风险',
    key: 'risk_level',
    width: 96,
    render: (row) => {
      const level = String(row.risk_level || 'Info')
      const typeMap = {
        Critical: 'error',
        High: 'warning',
        Medium: 'warning',
        Low: 'success',
        Info: 'info',
      }
      return h(NTag, { size: 'small', round: true, type: typeMap[level] || 'default' }, { default: () => level })
    },
  },
  {
    title: '来源',
    key: 'source',
    width: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: '指标',
    key: 'indicator',
    width: 210,
    ellipsis: { tooltip: true },
    render: (row) => row.ioc_value || row.cve_id || row.raw_content_hash || '-',
  },
  {
    title: '摘要',
    key: 'search_content',
    minWidth: 360,
    render: (row) => h('span', {
      class: 'intel-highlight-text',
      innerHTML: getHighlightedText(
        row.search_content || '-',
        row.record_id || row._id || row.raw_content_hash || row.ioc_value || row.cve_id || '',
      ),
    }),
  },
]

function rowProps(row) {
  return {
    class: row.record_id === selectedRecordId.value ? 'intel-row intel-row--active' : 'intel-row',
    style: {
      '--intel-row-accent': getRiskAccent(row.risk_level),
    },
    onClick: () => {
      handleSelectRow(row)
    },
  }
}

function sendToChat() {
  if (!selectedRecord.value) return

  const metadata = selectedRecord.value.metadata || {}
  const focusName = metadata.ioc_value || metadata.cve_id || metadata.raw_content_hash || metadata._id || '情报条目'
  const focusValue = metadata.risk_level || metadata.confidence || 'Info'

  const entry = buildAnalysisJumpEntry({
    sourceKey: 'grid',
    params: {
      name: focusName,
      value: focusValue,
      componentType: 'intel-grid-row',
      dataType: metadata.db_type || 'intel',
    },
    stats: {
      summary: {
        total_records: pagination.total,
        total_sources: facets.source.length,
        total_categories: facets.db_type.length,
      },
    },
    sessionId: chatStore.currentSession,
  })

  const contextText = [
    entry.prompt,
    '',
    '补充条目上下文：',
    `record_id: ${selectedRecord.value.record_id}`,
    `db_type: ${metadata.db_type || '-'}`,
    `risk_level: ${metadata.risk_level || '-'}`,
    `source: ${metadata.source || '-'}`,
    `cve_id: ${metadata.cve_id || '-'}`,
    `ioc_value: ${metadata.ioc_value || '-'}`,
    `summary: ${(selectedRecord.value.search_content || '').slice(0, 300)}`,
  ].join('\n')

  chatStore.setSessionDraft(chatStore.currentSession, contextText)
  chatStore.setAnalysisJumpDraft(entry)
  router.push({ path: '/chat', query: { autoSend: 'true' } })
}

onMounted(() => {
  fetchRows()
  window.addEventListener('keydown', handleReaderKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleReaderKeydown)
  if (copiedFieldTimer) {
    window.clearTimeout(copiedFieldTimer)
    copiedFieldTimer = null
  }
  highlightCache.clear()
})
</script>

<style scoped>
.intel-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  animation: intelPageFade 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.intel-main {
  flex: 1;
  min-height: 0;
  position: relative;
}

.intel-main--immersive {
  overflow: hidden;
}

.intel-split {
  height: 100%;
  background: transparent;
}

.intel-split--immersive :deep(.splitpanes__pane:first-child),
.intel-split--immersive :deep(.splitpanes__splitter) {
  opacity: 0.15;   
  pointer-events: none;
  filter: none !important;
}

.intel-split :deep(.splitpanes__pane) {
  display: flex;
  min-height: 0;
}

.intel-split :deep(.splitpanes__splitter) {
  width: 7px;
  background: rgba(0, 229, 255, 0.08);
  border-left: 1px solid rgba(0, 229, 255, 0.22);
  border-right: 1px solid rgba(0, 229, 255, 0.22);
}

.intel-detail-pane {
  position: relative;
}

@keyframes intelPageFade {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .intel-main {
    overflow: auto;
  }

  .intel-split {
    min-height: 840px;
  }
}
</style>
