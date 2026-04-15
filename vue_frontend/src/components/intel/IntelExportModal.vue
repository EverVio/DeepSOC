<template>
  <NModal :show="show" :mask-closable="false" @close="$emit('close')">
    <NCard class="export-center-panel" :bordered="false" title="导出配置" role="dialog" aria-modal="true">
      <template #header-extra>
        <NButton class="export-ghost-btn" quaternary size="small" @click="$emit('close')">关闭</NButton>
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
              <NButton class="export-ghost-btn" quaternary size="small" @click="$emit('select-default')">推荐字段</NButton>
              <NButton class="export-ghost-btn" quaternary size="small" @click="$emit('select-all')">全选</NButton>
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
          <NButton quaternary @click="$emit('close')">取消</NButton>
          <NButton type="primary" :loading="exporting" @click="$emit('submit')">导出</NButton>
        </div>
      </div>
    </NCard>
  </NModal>
</template>

<script setup>
import {
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NInput,
  NModal,
  NRadio,
  NRadioGroup,
  NSwitch,
} from 'naive-ui'

defineProps({
  show: { type: Boolean, default: false },
  exportOptions: { type: Object, required: true },
  exportFieldOptions: { type: Array, default: () => [] },
  exportSelectedCount: { type: Number, default: 0 },
  exporting: { type: Boolean, default: false },
})

defineEmits(['close', 'select-default', 'select-all', 'submit'])
</script>

<style scoped>
.export-center-panel {
  width: min(780px, 94vw);
  background: linear-gradient(160deg, rgba(7, 20, 38, 0.98), rgba(4, 14, 30, 0.98));
  border: 1px solid rgba(0, 229, 255, 0.3);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.46), 0 0 0 1px rgba(0, 229, 255, 0.18);
}

.export-center-panel :deep(.n-card-header) {
  overflow: visible;
  padding: 1rem 1.7rem 1rem;
  font-size: 1.5rem;
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
  background: rgba(3, 10, 24, 0.92);
  padding: 0.58rem 0.65rem;
  transition: border-color 180ms ease, background-color 180ms ease;
}

.export-option-group:hover {
  border-color: rgba(0, 229, 255, 0.32);
  background: rgba(6, 16, 36, 0.96);
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
  font-family: var(--font-ui);
  font-size: 1rem;
  letter-spacing: 0.1em;
  padding-left: 0.3rem;
}

.export-option-group--switch .export-option-title {
  margin-bottom: 0;
}

.export-option-group > :not(.export-option-title):not(.export-option-title-row) {
  padding-left: 0.6rem; 
}

.export-field-actions {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.08rem 0.08rem 0.1rem;
}

.export-ghost-btn {
  line-height: 1.35;
  font-size: 1rem;
}

.export-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 0 0.5rem;
  gap: 0.5rem 8rem;
}

.export-fields-grid :deep(.n-checkbox__label) {
  font-size: 0.9rem;
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
  padding-left: 0.6rem;
  font-size: 1rem;
}

.export-footer-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

@media (max-width: 1460px) {
  .export-fields-grid {
    grid-template-columns: 1fr;
  }
}
</style>
