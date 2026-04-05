import { computed, onBeforeUnmount, reactive, ref, shallowRef } from 'vue'
import api from '../api'

const DEFAULT_SORT_BY = 'fetched_at'
const DEFAULT_SORT_ORDER = 'desc'
const DEFAULT_PAGE_SIZE = 20

const FIXED_RISK_LEVELS = ['Critical', 'High', 'Medium', 'Low', 'Info']

const DEFAULT_EXPORT_FIELDS = [
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

const EXPORT_FIELD_OPTIONS = [
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

const SORT_BY_OPTIONS = [
    { label: '时间', value: 'fetched_at' },
    { label: '置信度', value: 'confidence' },
    { label: '风险等级', value: 'risk_level' },
    { label: '来源', value: 'source' },
    { label: '类型', value: 'db_type' },
]

const SORT_ORDER_OPTIONS = [
    { label: '降序', value: 'desc' },
    { label: '升序', value: 'asc' },
]

export function useIntelQuery() {
    const listLoading = ref(false)
    const detailLoading = ref(false)
    const exporting = ref(false)

    const rows = shallowRef([])
    const selectedRecord = shallowRef(null)
    const selectedRecordId = ref('')

    const dateRange = ref(null)
    const sortBy = ref(DEFAULT_SORT_BY)
    const sortOrder = ref(DEFAULT_SORT_ORDER)

    const showExportPanel = ref(false)

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
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
    })

    const exportOptions = reactive({
        format: 'csv',
        scope: 'all',
        includeDetails: false,
        filenamePrefix: 'deepsoc_query',
        fields: [...DEFAULT_EXPORT_FIELDS],
    })

    let listAbortController = null
    let detailAbortController = null

    const abortListRequest = () => {
        if (!listAbortController) return
        listAbortController.abort()
        listAbortController = null
    }

    const abortDetailRequest = () => {
        if (!detailAbortController) return
        detailAbortController.abort()
        detailAbortController = null
    }

    onBeforeUnmount(() => {
        abortListRequest()
        abortDetailRequest()
    })

    const dbTypeOptions = computed(() => [
        { label: '全部类型', value: '' },
        ...facets.db_type.map((item) => ({
            label: `${item.name} (${item.count})`,
            value: item.name,
        })),
    ])

    const riskLevelOptions = computed(() => {
        const fromFacet = facets.risk_level.map((item) => item.name)
        const merged = Array.from(new Set([...FIXED_RISK_LEVELS, ...fromFacet]))
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

    const normalizeTimeRange = () => {
        if (!Array.isArray(dateRange.value) || dateRange.value.length !== 2) {
            return { start_time: '', end_time: '' }
        }

        return {
            start_time: new Date(dateRange.value[0]).toISOString(),
            end_time: new Date(dateRange.value[1]).toISOString(),
        }
    }

    const buildQueryParams = (includePagination = true) => {
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

    const fetchRows = async () => {
        abortListRequest()
        const currentController = new AbortController()
        listAbortController = currentController
        listLoading.value = true

        const result = await api.queryLogsSafe(buildQueryParams(true), {
            signal: currentController.signal,
        })

        if (listAbortController !== currentController) return

        if (result.ok) {
            const data = result.response?.data || {}
            rows.value = data.items || []
            pagination.total = Number(data.total || 0)

            facets.db_type = data.facets?.db_type || []
            facets.risk_level = data.facets?.risk_level || []
            facets.source = data.facets?.source || []

            if (!rows.value.length) {
                selectedRecord.value = null
                selectedRecordId.value = ''
            }
        }

        if (listAbortController === currentController) {
            listAbortController = null
            listLoading.value = false
        }
    }

    const handleSelectRow = async (row) => {
        const recordId = row?.record_id
        if (!recordId) return

        if (selectedRecordId.value === recordId && selectedRecord.value) return

        selectedRecordId.value = recordId
        abortDetailRequest()
        const currentController = new AbortController()
        detailAbortController = currentController
        detailLoading.value = true

        const result = await api.getQueryLogDetailSafe(recordId, {
            signal: currentController.signal,
        })

        if (detailAbortController !== currentController) return

        if (result.ok) {
            selectedRecord.value = result.response?.data || null
        }

        if (detailAbortController === currentController) {
            detailAbortController = null
            detailLoading.value = false
        }
    }

    const handleSearch = () => {
        pagination.page = 1
        fetchRows()
    }

    const handleReset = () => {
        filters.q = ''
        filters.db_type = ''
        filters.risk_level = ''
        filters.source = ''
        dateRange.value = null
        sortBy.value = DEFAULT_SORT_BY
        sortOrder.value = DEFAULT_SORT_ORDER
        pagination.page = 1
        pagination.pageSize = DEFAULT_PAGE_SIZE
        fetchRows()
    }

    const handlePageChange = (page) => {
        pagination.page = page
        fetchRows()
    }

    const handlePageSizeChange = (pageSize) => {
        pagination.pageSize = pageSize
        pagination.page = 1
        fetchRows()
    }

    const handleExport = async (exportFormat, extraParams = {}) => {
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

    const openExportPanel = () => {
        showExportPanel.value = true
    }

    const closeExportPanel = () => {
        showExportPanel.value = false
    }

    const selectDefaultExportFields = () => {
        exportOptions.fields = [...DEFAULT_EXPORT_FIELDS]
    }

    const selectAllExportFields = () => {
        exportOptions.fields = EXPORT_FIELD_OPTIONS.map((item) => item.value)
    }

    const submitExport = async () => {
        const selected = Array.from(new Set(exportOptions.fields.filter(Boolean)))
        if (!selected.length) {
            selected.push(...DEFAULT_EXPORT_FIELDS)
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

    return {
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
        sortByOptions: SORT_BY_OPTIONS,
        sortOrderOptions: SORT_ORDER_OPTIONS,
        defaultExportFields: DEFAULT_EXPORT_FIELDS,
        exportFieldOptions: EXPORT_FIELD_OPTIONS,
        exportOptions,
        dbTypeOptions,
        riskLevelOptions,
        sourceOptions,
        detailJson,
        exportSelectedCount,
        buildQueryParams,
        fetchRows,
        handleSelectRow,
        handleSearch,
        handleReset,
        handlePageChange,
        handlePageSizeChange,
        handleExport,
        openExportPanel,
        closeExportPanel,
        selectDefaultExportFields,
        selectAllExportFields,
        submitExport,
    }
}
