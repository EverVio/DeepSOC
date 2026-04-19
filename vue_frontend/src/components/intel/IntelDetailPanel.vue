<template>
  <FuiCard title="记录详情" class="intel-detail-card" :class="{ 'intel-detail-card--immersive': isDetailImmersive }" variant="primary">
    <template #actions>
      <NButton v-if="selectedRecord" quaternary size="small" class="detail-immersive-btn" @click="$emit('toggle-immersive')">
        {{ isDetailImmersive ? '缩小' : '最大化' }}
      </NButton>
    </template>

    <NSpin :show="detailLoading" class="detail-spin">
      <template v-if="selectedRecord">
        <NScrollbar class="detail-content-scroll">
          <div class="detail-actions">
            <NButton type="primary" ghost @click="$emit('send-to-chat')">发送到分析终端</NButton>
          </div>

          <div class="detail-grid">
            <div class="detail-item detail-item--copyable">
              <span>记录ID</span>
              <div class="detail-item__value-row">
                <strong>{{ selectedRecord.record_id }}</strong>
                <NButton
                  quaternary
                  size="tiny"
                  :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'record_id' }]"
                  @click="$emit('copy-field', 'record_id', selectedRecord.record_id)"
                >
                  <CopyIcon class="detail-copy-icon" />
                </NButton>
              </div>
            </div>
            <div class="detail-item detail-item--copyable">
              <span>类型</span>
              <div class="detail-item__value-row">
                <strong>{{ selectedRecord.metadata.db_type }}</strong>
                <NButton
                  quaternary
                  size="tiny"
                  :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'db_type' }]"
                  @click="$emit('copy-field', 'db_type', selectedRecord.metadata.db_type)"
                >
                  <CopyIcon class="detail-copy-icon" />
                </NButton>
              </div>
            </div>

            <div class="detail-item detail-item--copyable">
              <span>风险</span>
              <div class="detail-item__value-row">
                <strong>{{ selectedRecord.metadata.risk_level }}</strong>
                <NButton
                  quaternary
                  size="tiny"
                  :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'risk_level' }]"
                  @click="$emit('copy-field', 'risk_level', selectedRecord.metadata.risk_level)"
                >
                  <CopyIcon class="detail-copy-icon" />
                </NButton>
              </div>
            </div>

            <div class="detail-item detail-item--copyable">
              <span>来源</span>
              <div class="detail-item__value-row">
                <strong>{{ selectedRecord.metadata.source }}</strong>
                <NButton
                  quaternary
                  size="tiny"
                  :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'source' }]"
                  @click="$emit('copy-field', 'source', selectedRecord.metadata.source)"
                >
                  <CopyIcon class="detail-copy-icon" />
                </NButton>
              </div>
            </div>

            <div class="detail-item detail-item--copyable">
              <span>时间</span>
              <div class="detail-item__value-row">
                <strong>{{ selectedRecord.metadata.fetched_at || '-' }}</strong>
                <NButton
                  quaternary
                  size="tiny"
                  :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'fetched_at' }]"
                  @click="$emit('copy-field', 'fetched_at', selectedRecord.metadata.fetched_at)"
                >
                  <CopyIcon class="detail-copy-icon" />
                </NButton>
              </div>
            </div>

            <div class="detail-item detail-item--copyable">
              <span>置信度</span>
              <div class="detail-item__value-row">
                <strong>{{ selectedRecord.metadata.confidence ?? '-' }}</strong>
                <NButton
                  quaternary
                  size="tiny"
                  :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'confidence' }]"
                  @click="$emit('copy-field', 'confidence', selectedRecord.metadata.confidence)"
                >
                  <CopyIcon class="detail-copy-icon" />
                </NButton>
              </div>
            </div>
            <div class="detail-item detail-item--copyable">
              <span>CVE</span>
              <div class="detail-item__value-row">
                <strong>{{ selectedRecord.metadata.cve_id || '-' }}</strong>
                <NButton
                  quaternary
                  size="tiny"
                  :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'cve_id' }]"
                  @click="$emit('copy-field', 'cve_id', selectedRecord.metadata.cve_id)"
                >
                  <CopyIcon class="detail-copy-icon" />
                </NButton>
              </div>
            </div>
            <div class="detail-item detail-item--copyable">
              <span>IOC</span>
              <div class="detail-item__value-row">
                <strong>{{ selectedRecord.metadata.ioc_value || '-' }}</strong>
                <NButton
                  quaternary
                  size="tiny"
                  :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'ioc_value' }]"
                  @click="$emit('copy-field', 'ioc_value', selectedRecord.metadata.ioc_value)"
                >
                  <CopyIcon class="detail-copy-icon" />
                </NButton>
              </div>
            </div>
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

          <div class="detail-section detail-section--copyable">
            <div class="detail-section-title">检索文本</div>
            <div class="detail-copy-wrapper">
              <NScrollbar class="detail-scroll">
                <div
                  class="detail-pre detail-pre--highlight"
                  v-html="highlightText(selectedRecord.search_content || '-')"
                />
              </NScrollbar>
              <NButton
                quaternary
                size="small"
                :class="['section-copy-btn', { 'detail-copy-btn--done': copiedField === 'search_content' }]"
                @click="$emit('copy-field', 'search_content', selectedRecord.search_content)"
              >
                <CopyIcon class="detail-copy-icon" />
              </NButton>
            </div>
          </div>

          <div class="detail-section detail-section--copyable">
            <div class="detail-section-title">原始详情</div>
            <div class="detail-copy-wrapper">
              <NScrollbar class="detail-scroll detail-scroll--small">
                <pre class="detail-pre">{{ detailJson }}</pre>
              </NScrollbar>
              <NButton
                quaternary
                size="small"
                :class="['section-copy-btn', { 'detail-copy-btn--done': copiedField === 'detail_json' }]"
                @click="$emit('copy-field', 'detail_json', detailJson)"
              >
                <CopyIcon class="detail-copy-icon" />
              </NButton>
            </div>
          </div>
        </NScrollbar>
      </template>

      <div v-else class="detail-empty-wrapper">
        <NEmpty description="请选择一条记录查看详情" />
      </div>
    </NSpin>
  </FuiCard>

  <Transition name="intel-reader-fade">
    <div v-if="isDetailImmersive && selectedRecord" class="intel-reader-overlay" @click.self="$emit('close-immersive')">
      <div class="intel-reader-backdrop" />

      <section class="intel-reader-shell" role="dialog" aria-modal="true" aria-label="情报详情阅读器">
        <FuiCard title="记录详情" class="intel-reader-card" variant="primary">
          <template #actions>
            <div class="intel-reader-toolbar">
              <div class="intel-reader-toolbar__meta">
                <span class="intel-reader-toolbar__label">RECORD READER</span>
                <span class="intel-reader-toolbar__value">{{ selectedRecord.metadata.db_type || 'intel' }}</span>
              </div>
              <div class="intel-reader-toolbar__actions">
                <NButton type="primary" ghost size="small" @click="$emit('send-to-chat')">发送到分析终端</NButton>
                <NButton quaternary size="small" @click="$emit('toggle-immersive')">缩小</NButton>
              </div>
            </div>
          </template>

          <div class="intel-reader-body">
            <NScrollbar class="detail-content-scroll detail-content-scroll--reader" content-style="padding: 2rem 3rem;">
              <div class="reader-section">
                <div class="detail-grid detail-grid--reader">
                  <div class="detail-item detail-item--reader detail-item--copyable">
                    <span>记录ID</span>
                    <div class="detail-item__value-row">
                      <strong>{{ selectedRecord.record_id }}</strong>
                      <NButton
                        quaternary
                        size="tiny"
                        :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'record_id' }]"
                        @click="$emit('copy-field', 'record_id', selectedRecord.record_id)"
                      >
                        <CopyIcon class="detail-copy-icon" />
                      </NButton>
                    </div>
                  </div>
                  <div class="detail-item detail-item--reader detail-item--copyable">
                    <span>类型</span>
                    <div class="detail-item__value-row">
                      <strong>{{ selectedRecord.metadata.db_type }}</strong>
                      <NButton
                        quaternary
                        size="tiny"
                        :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'db_type' }]"
                        @click="$emit('copy-field', 'db_type', selectedRecord.metadata.db_type)"
                      >
                        <CopyIcon class="detail-copy-icon" />
                      </NButton>
                    </div>
                  </div>

                  <div class="detail-item detail-item--reader detail-item--copyable">
                    <span>风险</span>
                    <div class="detail-item__value-row">
                      <strong>{{ selectedRecord.metadata.risk_level }}</strong>
                      <NButton
                        quaternary
                        size="tiny"
                        :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'risk_level' }]"
                        @click="$emit('copy-field', 'risk_level', selectedRecord.metadata.risk_level)"
                      >
                        <CopyIcon class="detail-copy-icon" />
                      </NButton>
                    </div>
                  </div>

                  <div class="detail-item detail-item--reader detail-item--copyable">
                    <span>来源</span>
                    <div class="detail-item__value-row">
                      <strong>{{ selectedRecord.metadata.source }}</strong>
                      <NButton
                        quaternary
                        size="tiny"
                        :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'source' }]"
                        @click="$emit('copy-field', 'source', selectedRecord.metadata.source)"
                      >
                        <CopyIcon class="detail-copy-icon" />
                      </NButton>
                    </div>
                  </div>

                  <div class="detail-item detail-item--reader detail-item--copyable">
                    <span>时间</span>
                    <div class="detail-item__value-row">
                      <strong>{{ selectedRecord.metadata.fetched_at || '-' }}</strong>
                      <NButton
                        quaternary
                        size="tiny"
                        :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'fetched_at' }]"
                        @click="$emit('copy-field', 'fetched_at', selectedRecord.metadata.fetched_at)"
                      >
                        <CopyIcon class="detail-copy-icon" />
                      </NButton>
                    </div>
                  </div>

                  <div class="detail-item detail-item--reader detail-item--copyable">
                    <span>置信度</span>
                    <div class="detail-item__value-row">
                      <strong>{{ selectedRecord.metadata.confidence ?? '-' }}</strong>
                      <NButton
                        quaternary
                        size="tiny"
                        :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'confidence' }]"
                        @click="$emit('copy-field', 'confidence', selectedRecord.metadata.confidence)"
                      >
                        <CopyIcon class="detail-copy-icon" />
                      </NButton>
                    </div>
                  </div>
                  <div class="detail-item detail-item--reader detail-item--copyable">
                    <span>CVE</span>
                    <div class="detail-item__value-row">
                      <strong>{{ selectedRecord.metadata.cve_id || '-' }}</strong>
                      <NButton
                        quaternary
                        size="tiny"
                        :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'cve_id' }]"
                        @click="$emit('copy-field', 'cve_id', selectedRecord.metadata.cve_id)"
                      >
                        <CopyIcon class="detail-copy-icon" />
                      </NButton>
                    </div>
                  </div>
                  <div class="detail-item detail-item--reader detail-item--copyable">
                    <span>IOC</span>
                    <div class="detail-item__value-row">
                      <strong>{{ selectedRecord.metadata.ioc_value || '-' }}</strong>
                      <NButton
                        quaternary
                        size="tiny"
                        :class="['detail-copy-btn', { 'detail-copy-btn--done': copiedField === 'ioc_value' }]"
                        @click="$emit('copy-field', 'ioc_value', selectedRecord.metadata.ioc_value)"
                      >
                        <CopyIcon class="detail-copy-icon" />
                      </NButton>
                    </div>
                  </div>
                </div>
              </div>

              <div class="reader-section">
                <div class="detail-section-title detail-section-title--reader">标签</div>
                <div class="chips chips--reader">
                  <NTag v-for="tag in selectedRecord.metadata.tags || []" :key="tag" size="large" type="info" round>
                    {{ tag }}
                  </NTag>
                  <span v-if="!(selectedRecord.metadata.tags || []).length" class="detail-empty-inline detail-empty-inline--reader">无</span>
                </div>
              </div>

              <div class="reader-section">
                <div class="detail-section-title detail-section-title--reader">MITRE ATT&CK</div>
                <div class="chips chips--reader">
                  <NTag
                    v-for="attackId in selectedRecord.metadata.mitre_attack_id || []"
                    :key="attackId"
                    size="large"
                    type="warning"
                    round
                  >
                    {{ attackId }}
                  </NTag>
                  <span v-if="!(selectedRecord.metadata.mitre_attack_id || []).length" class="detail-empty-inline detail-empty-inline--reader">无</span>
                </div>
              </div>

              <div class="reader-section detail-section--copyable">
                <div class="detail-section-title detail-section-title--reader">检索文本</div>
                <div class="detail-copy-wrapper">
                  <NScrollbar class="detail-scroll detail-scroll--reader">
                    <div
                      class="detail-pre detail-pre--reader detail-pre--highlight"
                      v-html="highlightText(selectedRecord.search_content || '-')"
                    />
                  </NScrollbar>
                  <NButton
                    quaternary
                    size="small"
                    :class="['section-copy-btn', { 'detail-copy-btn--done': copiedField === 'search_content' }]"
                    @click="$emit('copy-field', 'search_content', selectedRecord.search_content)"
                  >
                    <CopyIcon class="detail-copy-icon" />
                  </NButton>
                </div>
              </div>

              <div class="reader-section detail-section--copyable">
                <div class="detail-section-title detail-section-title--reader">原始详情</div>
                <div class="detail-code-wrap detail-scroll--reader">
                  <div class="detail-copy-wrapper">
                    <NCode :code="detailJson" language="json" />
                    <NButton
                      quaternary
                      size="small"
                      :class="['section-copy-btn', { 'detail-copy-btn--done': copiedField === 'detail_json' }]"
                      @click="$emit('copy-field', 'detail_json', detailJson)"
                    >
                      <CopyIcon class="detail-copy-icon" />
                    </NButton>
                  </div>
                </div>
              </div>
            </NScrollbar>
          </div>
        </FuiCard>
      </section>
    </div>
  </Transition>
</template>

<script setup>
import {
  NButton,
  NCode,
  NEmpty,
  NScrollbar,
  NSpin,
  NTag,
} from 'naive-ui'
import { CopyIcon } from 'vue-tabler-icons'
import FuiCard from '../FuiCard.vue'

defineProps({
  selectedRecord: { type: Object, default: null },
  detailLoading: { type: Boolean, default: false },
  detailJson: { type: String, default: '' },
  isDetailImmersive: { type: Boolean, default: false },
  copiedField: { type: String, default: '' },
  highlightText: { type: Function, required: true },
})

defineEmits(['toggle-immersive', 'close-immersive', 'send-to-chat', 'copy-field'])
</script>

<style scoped>
.intel-detail-card {
  flex: 1;
  min-height: 0;
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.intel-detail-card :deep(.fui-card-header .fui-card-title),
.intel-reader-card :deep(.fui-card-header .fui-card-title) {
  font-size: 1rem;
  line-height: 1.1;
  letter-spacing: 0.12em;
}

.intel-detail-card:hover {
  transform: translateY(-1px);
}

.intel-detail-card :deep(.fui-card-body) {
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.detail-immersive-btn {
  margin-left: auto;
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
  padding-right: 0.35rem; /* 从 0.15rem 增大 */
  padding-bottom: 0.5rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  margin-bottom: 1rem; 
}

.detail-item {
  border: 0;
  border-radius: 4px;
  background: rgba(0, 229, 255, 0.12);
  padding: 0.6rem 0.8rem 0.6rem;
  transition: background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.detail-item:hover {
  background: rgba(0, 229, 255, 0.18);
  transform: translateY(-1px);
  box-shadow: inset 0 0 0 1px rgba(0, 229, 255, 0.06);
}

.detail-item span {
  display: block;
  color: #8bb1cc; 
  font-size: 0.75rem;
  font-weight: 500; 
  letter-spacing: 0.08em;
  margin-bottom: 0.24rem;
  text-transform: uppercase;
  
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.detail-item strong {
  display: block;
  color: #ffffff; 
  font-size: 0.8rem; 
  font-weight: 400;
  line-height: 1.4;
  word-break: break-all;
  
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.detail-section {
  margin-top: 1.5rem;
  animation: intelSectionRise 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.detail-section-title {
  color: var(--neon-cyan);
  font-family: var(--font-ui);
  font-size: 1rem;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
  margin-left: 0.2rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem; 
  padding: 0.4rem 0.3rem;
}

.chips .n-tag {
  font-size: 0.82rem !important; 
  padding: 0 0.65rem !important; 
  height: 26px !important;
  line-height: 26px !important;
}
.detail-empty-inline {
  font-size: 0.82rem; 
  padding: 0.3rem 0.5rem;
}

.detail-scroll {
  max-height: 180px;
  padding: 0.3rem;
  border: 0;
  background: rgba(0, 229, 255, 0.12);
  border-radius: 4px;
}

.detail-scroll--small {
  max-height: 240px;
}

.detail-pre {
  margin: 0;
  padding: 0.6rem 0.6rem; 
  font-size: 0.8rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-ui);
  color: #d6efff;
}

.detail-item__value-row {
  display: flex;
  align-items: center; 
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
  width: 100%;
}

.detail-item__value-row strong {
  flex: 1;
  min-width: 0;
}

.detail-item--copyable strong {
  font-family: var(--font-ui);
  letter-spacing: 0.02em;
}

.detail-copy-btn {
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 160ms ease, transform 160ms ease;
  padding: 4px; 
  margin: -4px;
}

.detail-copy-btn--done {
  color: #1ce6ff !important;
}

/* 容器设置为相对定位，便于在右下角放置复制按钮 */
.detail-copy-wrapper {
  position: relative;
}

/* 段落复制按钮（右下角，默认隐藏） */
.section-copy-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  opacity: 0;
  background: rgba(0, 20, 30, 0.96);
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 10;
  padding: 6px;
  border-radius: 6px;
}

.detail-section--copyable:hover .section-copy-btn {
  opacity: 1;
  transform: translateY(-2px);
}

.detail-copy-icon {
  width: 14px;
  height: 14px;
}

.detail-item--copyable:hover .detail-copy-btn,
.detail-item--copyable:focus-within .detail-copy-btn {
  opacity: 1;
}

.detail-pre--highlight {
  line-height: 1.62;
  letter-spacing: 0.01em;
  white-space: pre-wrap;
}

.detail-pre--highlight :deep(mark.highlight-cyan) {
  padding: 0 0.12rem;
  border-radius: 0.14rem;
  background: rgba(0, 229, 255, 0.22);
  color: #e8fdff;
  box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.18);
}

.intel-reader-overlay {
  position: fixed;
  inset: 0;
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  box-sizing: border-box;
  overflow: auto;
}


.intel-reader-shell {
  position: relative;
  z-index: 1;
  width: min(85vw, 1200px); /* 稍微收窄宽度，提升长文本阅读舒适度 */
  height: min(85vh, 900px);
  will-change: transform, opacity; /* 强制启用 GPU 加速 */
  backface-visibility: hidden;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.3), 0 20px 80px rgba(0, 0, 0, 0.8);
}

.intel-reader-backdrop {
  position: absolute;
  inset: 0;
  background: #010712;
}

.intel-reader-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.intel-reader-card :deep(.fui-card-body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.intel-reader-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  min-width: 0;
}

.intel-reader-toolbar__meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.intel-reader-toolbar__label {
  color: #5c7a8f;
  font-family: var(--font-ui);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
}

.intel-reader-toolbar__value {
  color: #e6f5ff;
  font-family: var(--font-ui);
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.intel-reader-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.intel-reader-body {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-bottom: 0.15rem;
}

.detail-content-scroll--reader {
  flex: 1;
  min-height: 0;
  max-height: none;
}

.reader-section {
  margin-bottom: 1.5rem;
}

.detail-grid--reader {
  gap: 1.5rem 2.5rem;
}

.detail-item--reader {
  background: transparent;
  border-bottom: 1px solid rgba(0, 229, 255, 0.12);
  padding: 0.55rem 0 0.7rem;
  pointer-events: auto;
}

.detail-item--reader:hover {
  background: transparent;
  box-shadow: none;
  transform: none;
}

.detail-item--reader span {
  color: #a8c8e0; 
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
  
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
.detail-item--reader strong {
  font-size: 1.1rem;
  line-height: 1.45;
  color: #ffffff;
  font-weight: 100; 
  text-shadow: 0 0 1px rgba(0, 0, 0, 0.5);
  letter-spacing: 0.015em;
  
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

.detail-section-title--reader {
  font-size: 1.25rem;
  margin-bottom: 1.2rem;
  border-left: 3px solid var(--neon-cyan);
  padding-left: 0.8rem;
}

.chips--reader {
  gap: 0.6rem; 
  padding-left: 1.25rem;
}

.chips--reader :deep(.n-tag) {
  font-size: 1.25rem !important;
  height: 32px !important;
  line-height: 32px !important;
  padding: 0 1rem !important;
  border-width: 1px !important;
}


.detail-empty-inline--reader {
  font-size: 1.25rem;
  padding-left: 1rem;
}

.detail-scroll--reader {
  max-height: none;
  min-height: 160px;
}

.detail-pre--reader {
  font-size: 1rem;
  line-height: 1.8; 
  padding: 1.5rem;
  background: rgba(0, 229, 255, 0.04);
  border: 1px solid rgba(0, 229, 255, 0.1);
}

.detail-code-wrap {
  border: 1px solid rgba(0, 229, 255, 0.12);
  border-radius: 6px;
  background: rgba(0, 229, 255, 0.02);
  overflow: hidden;
}

.detail-code-wrap :deep(.n-code) {
  width: 100%;
}

.detail-code-wrap :deep(.n-code__code) {
  padding: 0.8rem 0.95rem;
  font-size: 0.86rem;
  line-height: 1.6;
}

.intel-reader-fade-enter-active,
.intel-reader-fade-leave-active {
  transition: opacity 180ms ease;
}

.intel-reader-fade-enter-from,
.intel-reader-fade-leave-to {
  opacity: 0;
}

.intel-detail-card--immersive {
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 229, 255, 0.22);
}

@keyframes intelSectionRise {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1280px) {
  .intel-reader-shell {
    width: 1100px;
  }

  .detail-item--reader strong {
    font-size: 0.98rem;
  }

  .detail-pre--reader {
    font-size: 0.86rem;
  }

  .detail-code-wrap :deep(.n-code__code) {
    font-size: 0.8rem;
  }
}

@media (max-width: 1024px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .intel-reader-shell {
    width: calc(100vw - 1rem);
    height: calc(100vh - 1rem);
    border-radius: 8px;
  }

  .intel-reader-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .intel-reader-toolbar__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .detail-grid--reader {
    grid-template-columns: 1fr;
  }

  .detail-copy-btn {
    opacity: 1;
  }
}

.detail-empty-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.detail-empty-wrapper :deep(.n-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.detail-empty-wrapper :deep(.n-empty__icon) {
  font-size: 160px; 
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.75;
  transition: transform 0.3s ease;
  margin-bottom: 50px; 
}

.detail-empty-wrapper :deep(.n-empty__icon svg) {
  width: 120px !important;
  height: 120px !important;
}

.detail-empty-wrapper:hover :deep(.n-empty__icon) {
  transform: scale(1.05);
}

.detail-empty-wrapper :deep(.n-empty__description) {
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  margin-top: 1.2rem;
  color: #a8c8e0;
  text-align: center;     
}

</style>
