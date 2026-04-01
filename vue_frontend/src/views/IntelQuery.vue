<template>
  <div class="intel-page">
    <FuiCard title="THREAT INTEL QUERY" class="intel-filter-card" :glow="true">
      <div class="intel-filter-grid">
        <NInput
          v-model:value="filters.q"
          clearable
          placeholder="关键字 / IOC / CVE / Payload"
          @keyup.enter="handleSearch"
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
          v-model:value="dateRange"
          type="datetimerange"
          clearable
          placeholder="时间范围"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 100%;"
        />

        <NSelect
          v-model:value="sortBy"
          :options="sortByOptions"
          placeholder="排序字段"
        />

        <NSelect
          v-model:value="sortOrder"
          :options="sortOrderOptions"
          placeholder="排序方向"
        />

        <div class="intel-filter-actions">
          <NButton type="primary" ghost @click="handleSearch">检索</NButton>
          <NButton quaternary @click="handleReset">重置</NButton>
          <NButton :loading="exporting" quaternary @click="openExportPanel">导出</NButton>
        </div>
      </div>
    </FuiCard>

    <div class="intel-main">
      <Splitpanes class="intel-split" :dbl-click-splitter="false">
        <Pane :size="62" min-size="40">
          <FuiCard title="QUERY RESULT" class="intel-result-card">
            <NDataTable
              remote
              size="small"
              :loading="listLoading"
              :columns="columns"
              :data="rows"
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
                @update:page="handlePageChange"
                @update:page-size="handlePageSizeChange"
              />
            </div>
          </FuiCard>
        </Pane>

        <Pane :size="38" min-size="28">
          <FuiCard title="RECORD DETAIL" class="intel-detail-card" variant="primary">
            <NSpin :show="detailLoading" class="detail-spin">
              <template v-if="selectedRecord">
                <NScrollbar class="detail-content-scroll">
                  <div class="detail-actions">
                    <NButton type="primary" ghost @click="sendToChat">发送到分析终端</NButton>
                  </div>

                  <div class="detail-grid">
                    <div class="detail-item"><span>记录ID</span><strong>{{ selectedRecord.record_id }}</strong></div>
                    <div class="detail-item"><span>类型</span><strong>{{ selectedRecord.metadata.db_type }}</strong></div>
                    <div class="detail-item"><span>风险</span><strong>{{ selectedRecord.metadata.risk_level }}</strong></div>
                    <div class="detail-item"><span>来源</span><strong>{{ selectedRecord.metadata.source }}</strong></div>
                    <div class="detail-item"><span>时间</span><strong>{{ selectedRecord.metadata.fetched_at || '-' }}</strong></div>
                    <div class="detail-item"><span>置信度</span><strong>{{ selectedRecord.metadata.confidence ?? '-' }}</strong></div>
                    <div class="detail-item"><span>CVE</span><strong>{{ selectedRecord.metadata.cve_id || '-' }}</strong></div>
                    <div class="detail-item"><span>IOC</span><strong>{{ selectedRecord.metadata.ioc_value || '-' }}</strong></div>
                  </div>

                  <div class="detail-section">
                    <div class="detail-section-title">标签</div>
                    <div class="chips">
                      <NTag v-for="tag in selectedRecord.metadata.tags || []" :key="tag" size="small" type="info" round>
                        {{ tag }}
                      </NTag>
                      <span v-if="!(selectedRecord.metadata.tags || []).length" class="detail-empty-inline">无</span>
                    </div>
                  </div>

                  <div class="detail-section">
                    <div class="detail-section-title">MITRE ATT&CK</div>
                    <div class="chips">
                      <NTag
                        v-for="attackId in selectedRecord.metadata.mitre_attack_id || []"
                        :key="attackId"
                        size="small"
                        type="warning"
                        round
                      >
                        {{ attackId }}
                      </NTag>
                      <span v-if="!(selectedRecord.metadata.mitre_attack_id || []).length" class="detail-empty-inline">无</span>
                    </div>
                  </div>

                  <div class="detail-section">
                    <div class="detail-section-title">检索文本</div>
                    <NScrollbar class="detail-scroll">
                      <pre class="detail-pre">{{ selectedRecord.search_content || '-' }}</pre>
                    </NScrollbar>
                  </div>

                  <div class="detail-section">
                    <div class="detail-section-title">原始详情</div>
                    <NScrollbar class="detail-scroll detail-scroll--small">
                      <pre class="detail-pre">{{ detailJson }}</pre>
                    </NScrollbar>
                  </div>
                </NScrollbar>
              </template>

              <NEmpty v-else description="请选择一条记录查看详情" />
            </NSpin>
          </FuiCard>
        </Pane>
      </Splitpanes>
    </div>

    <NModal :show="showExportPanel" :mask-closable="false" @close="closeExportPanel">
      <NCard class="export-center-panel" :bordered="false" title="导出配置" role="dialog" aria-modal="true">
        <template #header-extra>
          <NButton class="export-ghost-btn" quaternary size="small" @click="closeExportPanel">关闭</NButton>
        </template>

        <div class="export-panel-body">
          <div class="export-option-group">
            <div class="export-option-title">导出格式</div>
            <NRadioGroup v-model:value="exportOptions.format" name="export-format">
              <NRadio value="csv">CSV 文件</NRadio>
              <NRadio value="json">JSON 文件</NRadio>
            </NRadioGroup>
          </div>

          <div class="export-option-group">
            <div class="export-option-title">导出范围</div>
            <NRadioGroup v-model:value="exportOptions.scope" name="export-scope">
              <NRadio value="all">全部检索结果</NRadio>
              <NRadio value="current_page">仅当前页</NRadio>
            </NRadioGroup>
          </div>

          <div class="export-option-group">
            <div class="export-option-title">文件名前缀</div>
            <NInput
              v-model:value="exportOptions.filenamePrefix"
              placeholder="deepsoc_query"
              clearable
            />
          </div>

          <div class="export-option-group export-option-group--switch">
            <div class="export-option-title">包含原始详情</div>
            <NSwitch v-model:value="exportOptions.includeDetails" />
          </div>

          <div class="export-option-group">
            <div class="export-option-title-row">
              <div class="export-option-title">导出字段</div>
              <div class="export-field-actions">
                <NButton class="export-ghost-btn" quaternary size="small" @click="selectDefaultExportFields">推荐字段</NButton>
                <NButton class="export-ghost-btn" quaternary size="small" @click="selectAllExportFields">全选</NButton>
              </div>
            </div>

            <NCheckboxGroup v-model:value="exportOptions.fields">
              <div class="export-fields-grid">
                <NCheckbox
                  v-for="field in exportFieldOptions"
                  :key="field.value"
                  :value="field.value"
                >
                  {{ field.label }}
                </NCheckbox>
              </div>
            </NCheckboxGroup>
          </div>
        </div>

        <div class="export-panel-footer">
          <span class="export-selected-tip">已选择 {{ exportSelectedCount }} 个字段</span>
          <div class="export-footer-actions">
            <NButton quaternary @click="closeExportPanel">取消</NButton>
            <NButton type="primary" :loading="exporting" @click="submitExport">导出</NButton>
          </div>
        </div>
      </NCard>
    </NModal>
  </div>
</template>

<script setup>
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NDataTable,
  NDatePicker,
  NEmpty,
  NInput,
  NModal,
  NPagination,
  NRadio,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
} from 'naive-ui'
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

import api from '../api'
import FuiCard from '../components/FuiCard.vue'
import { buildAnalysisJumpEntry } from '../composables/useAnalysisJump'
import { useChatStore } from '../stores/chatStore'

const router = useRouter()
const chatStore = useChatStore()

const listLoading = ref(false)
const detailLoading = ref(false)
const exporting = ref(false)
const rows = ref([])
const selectedRecord = ref(null)
const selectedRecordId = ref('')
const dateRange = ref(null)
const sortBy = ref('fetched_at')
const sortOrder = ref('desc')
const showExportPanel = ref(false)
const tableScrollX = 1160

const filters = reactive({
  q: '',
  db_type: '',
  risk_level: '',
  source: '',
})

const facets = reactive({
  db_type: [],
  risk_level: [],
  source: [],
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const sortByOptions = [
  { label: '时间', value: 'fetched_at' },
  { label: '置信度', value: 'confidence' },
  { label: '风险等级', value: 'risk_level' },
  { label: '来源', value: 'source' },
  { label: '类型', value: 'db_type' },
]

const sortOrderOptions = [
  { label: '降序', value: 'desc' },
  { label: '升序', value: 'asc' },
]

const defaultExportFields = [
  'record_id',
  'db_type',
  'risk_level',
  'source',
  'fetched_at',
  'confidence',
  'verified',
  'cve_id',
  'ioc_value',
  'affected_product',
  'payload',
  'tags',
  'mitre_attack_id',
  'raw_content_hash',
  'search_content',
]

const exportFieldOptions = [
  { label: '记录ID(record_id)', value: 'record_id' },
  { label: '原始ID(_id)', value: '_id' },
  { label: '情报类型(db_type)', value: 'db_type' },
  { label: '风险等级(risk_level)', value: 'risk_level' },
  { label: '来源(source)', value: 'source' },
  { label: '来源数据集(source_dataset)', value: 'source_dataset' },
  { label: '来源链接(source_url)', value: 'source_url' },
  { label: '时间(fetched_at)', value: 'fetched_at' },
  { label: '置信度(confidence)', value: 'confidence' },
  { label: '是否验证(verified)', value: 'verified' },
  { label: 'CVE ID(cve_id)', value: 'cve_id' },
  { label: 'IOC 值(ioc_value)', value: 'ioc_value' },
  { label: '受影响产品(affected_product)', value: 'affected_product' },
  { label: '载荷(payload)', value: 'payload' },
  { label: '标签(tags)', value: 'tags' },
  { label: 'ATT&CK(mitre_attack_id)', value: 'mitre_attack_id' },
  { label: '内容哈希(raw_content_hash)', value: 'raw_content_hash' },
  { label: '检索摘要(search_content)', value: 'search_content' },
  { label: '记录文件(record_file)', value: 'record_file' },
  { label: '记录行号(record_line)', value: 'record_line' },
]

const exportOptions = reactive({
  format: 'csv',
  scope: 'all',
  includeDetails: false,
  filenamePrefix: 'deepsoc_query',
  fields: [...defaultExportFields],
})

const fixedRiskLevels = ['Critical', 'High', 'Medium', 'Low', 'Info']

const dbTypeOptions = computed(() => [
  { label: '全部类型', value: '' },
  ...facets.db_type.map((item) => ({
    label: `${item.name} (${item.count})`,
    value: item.name,
  })),
])

const riskLevelOptions = computed(() => {
  const fromFacet = facets.risk_level.map((item) => item.name)
  const merged = Array.from(new Set([...fixedRiskLevels, ...fromFacet]))
  return [
    { label: '全部风险', value: '' },
    ...merged.map((item) => ({ label: item, value: item })),
  ]
})

const sourceOptions = computed(() => [
  { label: '全部来源', value: '' },
  ...facets.source.map((item) => ({
    label: `${item.name} (${item.count})`,
    value: item.name,
  })),
])

const detailJson = computed(() => {
  if (!selectedRecord.value) return ''
  return JSON.stringify(selectedRecord.value.details || {}, null, 2)
})

const exportSelectedCount = computed(() => {
  let count = exportOptions.fields.length
  if (exportOptions.includeDetails && !exportOptions.fields.includes('details')) {
    count += 1
  }
  return count
})

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
    ellipsis: { tooltip: true },
  },
]

function normalizeTimeRange() {
  if (!Array.isArray(dateRange.value) || dateRange.value.length !== 2) {
    return { start_time: '', end_time: '' }
  }
  return {
    start_time: new Date(dateRange.value[0]).toISOString(),
    end_time: new Date(dateRange.value[1]).toISOString(),
  }
}

function buildQueryParams(includePagination = true) {
  const { start_time, end_time } = normalizeTimeRange()
  const params = {
    q: filters.q,
    db_type: filters.db_type,
    risk_level: filters.risk_level,
    source: filters.source,
    start_time,
    end_time,
    sort_by: sortBy.value,
    sort_order: sortOrder.value,
  }

  if (includePagination) {
    params.page = pagination.page
    params.page_size = pagination.pageSize
  }

  return params
}

async function fetchRows() {
  listLoading.value = true
  try {
    const response = await api.queryLogs(buildQueryParams(true))
    const data = response?.data || {}
    rows.value = data.items || []
    pagination.total = Number(data.total || 0)

    facets.db_type = data.facets?.db_type || []
    facets.risk_level = data.facets?.risk_level || []
    facets.source = data.facets?.source || []

    if (!rows.value.length) {
      selectedRecord.value = null
      selectedRecordId.value = ''
      return
    }

    const hasSelected = rows.value.some((item) => item.record_id === selectedRecordId.value)
    if (!hasSelected) {
      await handleSelectRow(rows.value[0])
    }
  } finally {
    listLoading.value = false
  }
}

async function handleSelectRow(row) {
  if (!row?.record_id) return
  selectedRecordId.value = row.record_id
  detailLoading.value = true
  try {
    const response = await api.getQueryLogDetail(row.record_id)
    selectedRecord.value = response?.data || null
  } finally {
    detailLoading.value = false
  }
}

function rowProps(row) {
  return {
    class: row.record_id === selectedRecordId.value ? 'intel-row intel-row--active' : 'intel-row',
    onClick: () => {
      handleSelectRow(row)
    },
  }
}

function handleSearch() {
  pagination.page = 1
  fetchRows()
}

function handleReset() {
  filters.q = ''
  filters.db_type = ''
  filters.risk_level = ''
  filters.source = ''
  dateRange.value = null
  sortBy.value = 'fetched_at'
  sortOrder.value = 'desc'
  pagination.page = 1
  pagination.pageSize = 20
  fetchRows()
}

function handlePageChange(page) {
  pagination.page = page
  fetchRows()
}

function handlePageSizeChange(pageSize) {
  pagination.pageSize = pageSize
  pagination.page = 1
  fetchRows()
}

async function handleExport(exportFormat, extraParams = {}) {
  exporting.value = true
  try {
    const { blob, filename } = await api.exportQueryLogs({
      ...buildQueryParams(false),
      export_format: exportFormat,
      ...extraParams,
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

function openExportPanel() {
  showExportPanel.value = true
}

function closeExportPanel() {
  showExportPanel.value = false
}

function selectDefaultExportFields() {
  exportOptions.fields = [...defaultExportFields]
}

function selectAllExportFields() {
  exportOptions.fields = exportFieldOptions.map((item) => item.value)
}

async function submitExport() {
  const selected = Array.from(new Set(exportOptions.fields.filter(Boolean)))
  if (!selected.length) {
    selected.push(...defaultExportFields)
  }

  await handleExport(exportOptions.format, {
    export_scope: exportOptions.scope,
    page: pagination.page,
    page_size: pagination.pageSize,
    fields: selected.join(','),
    include_details: exportOptions.includeDetails ? 'true' : 'false',
    filename_prefix: (exportOptions.filenamePrefix || '').trim() || 'deepsoc_query',
  })
  closeExportPanel()
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
})
</script>

<style scoped>
.intel-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.intel-filter-card {
  flex-shrink: 0;
}

.intel-filter-card :deep(.fui-card-body) {
  padding: 0.8rem 0.95rem;
}

.intel-filter-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.2fr 2fr 1fr 1fr auto;
  gap: 0.55rem;
  align-items: center;
}

.intel-filter-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.intel-main {
  flex: 1;
  min-height: 0;
}

.export-center-panel {
  width: min(780px, 94vw);
  background: linear-gradient(160deg, rgba(7, 20, 38, 0.98), rgba(4, 14, 30, 0.98));
  border: 1px solid rgba(0, 229, 255, 0.3);
}

.export-center-panel :deep(.n-card-header) {
  overflow: visible;
  padding: 0.85rem 0.95rem 0.55rem;
}

.export-center-panel :deep(.n-card-header__main),
.export-center-panel :deep(.n-card-header__extra),
.export-center-panel :deep(.n-card__content) {
  overflow: visible;
}

.export-center-panel :deep(.n-card__content) {
  padding: 0 0.95rem 0.95rem;
}

.export-panel-body {
  max-height: min(62vh, 620px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.12rem 0.22rem 0.35rem;
  box-sizing: border-box;
}

.export-option-group {
  border: 1px solid rgba(0, 229, 255, 0.2);
  background: rgba(3, 10, 24, 0.7);
  padding: 0.58rem 0.65rem;
}

.export-option-group--switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.export-option-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.45rem;
}

.export-option-title {
  margin-bottom: 0.45rem;
  color: var(--neon-cyan);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
}

.export-option-group--switch .export-option-title {
  margin-bottom: 0;
}

.export-field-actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.08rem 0.08rem 0.1rem;
}

.export-ghost-btn {
  line-height: 1.35;
}

.export-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 0.75rem;
}

.export-panel-footer {
  margin-top: 0.8rem;
  padding-top: 0.55rem;
  border-top: 1px solid rgba(0, 229, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.export-selected-tip {
  color: #7ba7bc;
  font-size: 0.72rem;
}

.export-footer-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.intel-split {
  height: 100%;
  background: transparent;
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

.intel-result-card,
.intel-detail-card {
  flex: 1;
  min-height: 0;
}

.intel-result-card :deep(.fui-card-body),
.intel-detail-card :deep(.fui-card-body) {
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
  font-family: var(--font-mono);
  font-size: 0.72rem;
}

.intel-result-card :deep(.n-data-table-tr.intel-row) {
  cursor: pointer;
}

.intel-result-card :deep(.n-data-table-tr.intel-row--active > td) {
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.16), rgba(0, 229, 255, 0.06)) !important;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.55rem;
}

.detail-spin {
  flex: 1;
  min-height: 0;
}

.detail-spin :deep(.n-spin-content) {
  height: 100%;
}

.detail-content-scroll {
  height: 100%;
}

.detail-content-scroll :deep(.n-scrollbar-content) {
  padding-right: 0.15rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.detail-item {
  border: 1px solid rgba(0, 229, 255, 0.2);
  background: rgba(4, 12, 28, 0.72);
  padding: 0.48rem 0.6rem;
}

.detail-item span {
  display: block;
  color: #7ba7bc;
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  margin-bottom: 0.2rem;
}

.detail-item strong {
  display: block;
  color: #d8efff;
  font-size: 0.75rem;
  line-height: 1.35;
  word-break: break-all;
}

.detail-section {
  margin-top: 0.7rem;
}

.detail-section-title {
  color: var(--neon-cyan);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  margin-bottom: 0.35rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.detail-empty-inline {
  color: #6f8fa3;
  font-size: 0.72rem;
}

.detail-scroll {
  max-height: 120px;
  border: 1px solid rgba(0, 229, 255, 0.2);
  background: rgba(3, 10, 24, 0.74);
}

.detail-scroll--small {
  max-height: 170px;
}

.detail-pre {
  margin: 0;
  padding: 0.5rem 0.6rem;
  font-size: 0.7rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  color: #d6efff;
}

@media (max-width: 1460px) {
  .intel-filter-grid {
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
  }

  .intel-filter-actions {
    grid-column: 1 / -1;
  }

  .export-fields-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1024px) {
  .intel-main {
    overflow: auto;
  }

  .intel-split {
    min-height: 840px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
