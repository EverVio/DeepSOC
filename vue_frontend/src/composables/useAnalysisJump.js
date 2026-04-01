const SOURCE_TEMPLATES = {
    radar: {
        sourceKey: 'radar',
        sourceLabel: '威胁雷达',
        entryLabel: '威胁雷达分析入口',
        focusLabel: '高亮维度',
        promptLead: '请围绕威胁雷达中的关注点展开分析，判断当前风险等级、可能诱因和下一步排查方向。',
        followUps: [
            '是否需要对比最近 7 天的变化趋势？',
            '是否需要关联告警、登录或异常访问记录？',
            '是否需要给出优先级排序和处置建议？',
        ],
    },
    stream: {
        sourceKey: 'stream',
        sourceLabel: '日志流入趋势',
        entryLabel: '日志流入问题模板',
        focusLabel: '时间点或来源',
        promptLead: '请结合日志流入趋势中的关注点展开分析，判断是否存在异常抬升、来源集中或时间波动，并给出排查建议。',
        followUps: [
            '是否需要定位异常峰值对应的时间窗口？',
            '是否需要对比来源、主机或应用维度？',
            '是否需要输出可执行的排查步骤？',
        ],
    },
    category: {
        sourceKey: 'category',
        sourceLabel: '分类分布',
        entryLabel: '分类分布分析入口',
        focusLabel: '分类扇区',
        promptLead: '请围绕分类分布中的关注项展开分析，判断当前占比变化、聚集特征和潜在风险，并给出进一步检查建议。',
        followUps: [
            '是否需要对比历史分布差异？',
            '是否需要关联来源或时间维度进行交叉分析？',
            '是否需要标出最值得优先跟进的分类？',
        ],
    },
    grid: {
        sourceKey: 'grid',
        sourceLabel: '情报查询',
        entryLabel: 'Data Grid 分析入口',
        focusLabel: '选中条目',
        promptLead: '请围绕该情报条目展开研判，给出威胁判断、关联线索、验证步骤与处置建议。',
        followUps: [
            '是否需要关联同源 IOC / CVE 的历史记录？',
            '是否需要按资产范围评估潜在影响面？',
            '是否需要输出可执行的应急处置清单？',
        ],
    },
    topology: {
        sourceKey: 'topology',
        sourceLabel: '攻击拓扑',
        entryLabel: '攻击拓扑分析入口',
        focusLabel: '节点或链路',
        promptLead: '请围绕攻击拓扑中的关注点展开分析，判断传播路径、关键节点和潜在横向移动风险，并给出验证建议。',
        followUps: [
            '是否需要展开关联节点和相邻路径？',
            '是否需要定位可能的入口点或放大器？',
            '是否需要给出切断链路的优先建议？',
        ],
    },
    default: {
        sourceKey: 'default',
        sourceLabel: '图表',
        entryLabel: '图表分析入口',
        focusLabel: '关注点',
        promptLead: '请围绕当前图表中的关注点展开分析，判断是否存在异常变化、风险聚集或值得进一步排查的信号。',
        followUps: [
            '是否需要补充时间范围或对比维度？',
            '是否需要给出可复用的排查路径？',
            '是否需要生成适合汇报的结论摘要？',
        ],
    },
};

const pickText = (candidates, fallback = '') => {
    for (const value of candidates) {
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (text) return text;
    }
    return fallback;
};

const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '未提供';
    if (Array.isArray(value)) {
        return value.map((item) => formatValue(item)).join(' / ') || '未提供';
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return '复杂数据';
        }
    }
    return String(value).trim() || '未提供';
};

const normalizeNumber = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
};

const formatCountSummary = (stats = {}) => {
    const summary = stats?.summary || {};
    const totalRecords = normalizeNumber(summary.total_records);
    const totalSources = normalizeNumber(summary.total_sources);
    const totalCategories = normalizeNumber(summary.total_categories);

    const parts = [];
    if (totalRecords !== null) parts.push(`记录 ${totalRecords}`);
    if (totalSources !== null) parts.push(`来源 ${totalSources}`);
    if (totalCategories !== null) parts.push(`分类 ${totalCategories}`);

    return parts.length > 0 ? parts.join('，') : '暂无汇总信息';
};

const buildRadarSnapshot = (stats = {}) => {
    const threatDistribution = Array.isArray(stats?.threat_distribution) ? stats.threat_distribution : [];
    const high = normalizeNumber(threatDistribution.find((item) => item.level === 'high')?.value);
    const medium = normalizeNumber(threatDistribution.find((item) => item.level === 'medium')?.value);
    const low = normalizeNumber(threatDistribution.find((item) => item.level === 'low')?.value);

    const parts = [];
    if (high !== null || medium !== null || low !== null) {
        parts.push(`高/中/低 ${high ?? 0}/${medium ?? 0}/${low ?? 0}`);
    }

    return parts.length > 0 ? parts.join(' · ') : '';
};

const buildStreamSnapshot = (stats = {}) => {
    const sourceSeries = Array.isArray(stats?.source_counts) ? stats.source_counts : [];
    const timeline = Array.isArray(stats?.timeline) ? stats.timeline : [];
    const topSource = sourceSeries[0];
    const latestTimeline = timeline[timeline.length - 1];

    const parts = [];
    if (topSource?.name !== undefined) {
        parts.push(`来源峰值 ${formatValue(topSource.name)} / ${formatValue(topSource.value)}`);
    }
    if (latestTimeline) {
        parts.push(`最新点 ${formatValue(latestTimeline.updated_text || latestTimeline.file || latestTimeline.label)} / ${formatValue(latestTimeline.value)}`);
    }

    return parts.length > 0 ? parts.join(' · ') : '';
};

const buildCategorySnapshot = (stats = {}) => {
    const categories = Array.isArray(stats?.category_counts) ? stats.category_counts : [];
    const topCategory = categories[0];

    if (!topCategory) return '';

    return `主分类 ${formatValue(topCategory.name)} / ${formatValue(topCategory.value)}`;
};

const resolveSourceMeta = (sourceKey) => SOURCE_TEMPLATES[sourceKey] || SOURCE_TEMPLATES.default;

const resolveFocusLabel = (params, sourceMeta) => {
    return pickText(
        [
            params?.name,
            params?.data?.name,
            params?.seriesName,
            params?.data?.label,
            params?.axisValue,
            params?.data?.x,
            params?.data?.y,
        ],
        sourceMeta.focusLabel
    );
};

const resolveFocusValue = (params) => {
    return pickText(
        [
            params?.value,
            params?.data?.value,
            params?.data?.count,
            params?.data?.score,
            params?.data?.percent,
        ],
        '未提供'
    );
};

const buildSnapshotSummary = (sourceKey, stats) => {
    const countSummary = formatCountSummary(stats);

    if (sourceKey === 'radar') {
        const radarSnapshot = buildRadarSnapshot(stats);
        return radarSnapshot ? `${countSummary} · ${radarSnapshot}` : countSummary;
    }

    if (sourceKey === 'stream') {
        const streamSnapshot = buildStreamSnapshot(stats);
        return streamSnapshot ? `${countSummary} · ${streamSnapshot}` : countSummary;
    }

    if (sourceKey === 'category') {
        const categorySnapshot = buildCategorySnapshot(stats);
        return categorySnapshot ? `${countSummary} · ${categorySnapshot}` : countSummary;
    }

    return countSummary;
};

const buildPrompt = (sourceMeta, focusLabel, focusValue, snapshotSummary) => {
    const focusPart = focusLabel || sourceMeta.focusLabel;
    const valuePart = focusValue && focusValue !== '未提供' ? `，当前点击值为 ${focusValue}` : '';
    const summaryPart = snapshotSummary ? `
当前看板摘要：${snapshotSummary}` : '';

    return `${sourceMeta.promptLead}
当前关注点：${focusPart}${valuePart}。${summaryPart}
请给出风险判断、可能成因、验证路径和下一步建议。`;
};

export function getAnalysisJumpTemplate(sourceKey) {
    return resolveSourceMeta(sourceKey);
}

export function buildAnalysisJumpEntry({ sourceKey, params = {}, stats = {}, sessionId = '' }) {
    const sourceMeta = resolveSourceMeta(sourceKey);
    const focusLabel = resolveFocusLabel(params, sourceMeta);
    const focusValue = resolveFocusValue(params);
    const snapshotSummary = buildSnapshotSummary(sourceMeta.sourceKey, stats);
    const prompt = buildPrompt(sourceMeta, focusLabel, focusValue, snapshotSummary);

    const summaryCards = [
        { label: '来源', value: sourceMeta.sourceLabel },
        { label: '入口', value: sourceMeta.entryLabel },
        { label: '目标', value: focusLabel },
        { label: '数值', value: focusValue },
    ];

    if (snapshotSummary) {
        summaryCards.push({ label: '看板摘要', value: snapshotSummary });
    }

    const dataIndex = typeof params?.dataIndex === 'number' ? params.dataIndex : null;

    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        createdAt: new Date().toISOString(),
        sessionId: sessionId || '',
        sourceKey: sourceMeta.sourceKey,
        sourceLabel: sourceMeta.sourceLabel,
        entryLabel: sourceMeta.entryLabel,
        focusLabel,
        focusValue,
        chartType: params?.seriesType || params?.type || '',
        chartSeries: params?.seriesName || '',
        summaryText: `${sourceMeta.sourceLabel} · ${focusLabel}`,
        prompt,
        followUps: sourceMeta.followUps.slice(),
        summaryCards,
        context: {
            componentType: params?.componentType || '',
            seriesType: params?.seriesType || '',
            seriesName: params?.seriesName || '',
            dataType: params?.dataType || '',
            dataIndex,
            value: params?.value ?? params?.data?.value ?? null,
            name: params?.name || '',
        },
    };
}