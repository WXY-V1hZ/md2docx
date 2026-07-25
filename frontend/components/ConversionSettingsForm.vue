<script setup lang="ts">
import { ChevronDown } from "lucide-vue-next";
import { computed, watch } from "vue";

import { type ConversionEditorModel, type HeadingLevel } from "../conversion-settings";
import AppSelect, { type AppSelectOption } from "./AppSelect.vue";

const props = defineProps<{ model: ConversionEditorModel }>();

const titleSourceOptions = [
  { value: "first-h1", label: "第一个一级标题" },
  { value: "single-h1", label: "唯一的一级标题" },
  { value: "filename", label: "文件名" },
] satisfies readonly AppSelectOption[];
const mermaidThemeOptions = [
  { value: "zinc-light", label: "简洁浅色" },
  { value: "zinc-dark", label: "简洁深色" },
  { value: "github-light", label: "GitHub 浅色" },
  { value: "github-dark", label: "GitHub 深色" },
  { value: "tokyo-night", label: "东京夜色" },
  { value: "tokyo-night-storm", label: "东京风暴" },
  { value: "tokyo-night-light", label: "东京浅色" },
  { value: "catppuccin-mocha", label: "摩卡" },
  { value: "catppuccin-latte", label: "拿铁" },
  { value: "nord", label: "北境深色" },
  { value: "nord-light", label: "北境浅色" },
  { value: "dracula", label: "德古拉" },
  { value: "solarized-light", label: "Solarized 浅色" },
  { value: "solarized-dark", label: "Solarized 深色" },
  { value: "one-dark", label: "One Dark" },
] satisfies readonly AppSelectOption[];
const alignmentOptions = [
  { value: "left", label: "左对齐" },
  { value: "center", label: "居中" },
] satisfies readonly AppSelectOption[];

const figureExample = computed(() => captionExample(props.model.config.figureCaption, "示例图片"));
const tableExample = computed(() => captionExample(props.model.config.tableCaption, "示例表格"));

watch(
  () => props.model.config.numberHeadings.enabled,
  (enabled) => {
    if (enabled) props.model.config.normalizeHeadings.enabled = true;
  },
);

function captionExample(caption: { format: string; separator: string }, name: string) {
  return `${caption.format.replace("{n}", "1")}${caption.separator}${name}`;
}
</script>

<template>
  <div class="conversion-settings-form">
    <section class="editor-section">
      <h3>文档结构</h3>
      <div class="editor-group">
        <label class="editor-row">
          <span class="editor-row__copy"><strong>自动设置标题</strong></span>
          <input v-model="model.config.detectTitle.enabled" class="app-switch" type="checkbox" />
        </label>
        <label
          class="editor-row editor-row--nested"
          :class="{ 'is-disabled': !model.config.detectTitle.enabled }"
        >
          <span>标题来源</span>
          <AppSelect
            v-model="model.config.detectTitle.strategy"
            aria-label="标题来源"
            :options="titleSourceOptions"
            :disabled="!model.config.detectTitle.enabled"
          />
        </label>
        <label class="editor-row">
          <span class="editor-row__copy">
            <strong>修正标题层级</strong><small>消除跳级并从一级标题开始</small>
          </span>
          <input
            v-model="model.config.normalizeHeadings.enabled"
            class="app-switch"
            type="checkbox"
            :disabled="model.config.numberHeadings.enabled"
          />
        </label>
        <p v-if="model.config.numberHeadings.enabled" class="editor-note">
          标题编号需要连续层级，已自动启用修正。
        </p>
        <label class="editor-row">
          <span class="editor-row__copy"><strong>标题自动编号</strong></span>
          <input v-model="model.config.numberHeadings.enabled" class="app-switch" type="checkbox" />
        </label>
        <label
          class="editor-row editor-row--nested"
          :class="{ 'is-disabled': !model.config.numberHeadings.enabled }"
        >
          <span>识别已有编号</span>
          <input
            v-model="model.config.numberHeadings.detectExisting"
            class="app-switch"
            type="checkbox"
            :disabled="!model.config.numberHeadings.enabled"
          />
        </label>
        <label
          class="editor-row editor-row--nested"
          :class="{ 'is-disabled': !model.config.numberHeadings.enabled }"
        >
          <span>常见编号规则</span>
          <input
            v-model="model.config.numberHeadings.useBuiltinRules"
            class="app-switch"
            type="checkbox"
            :disabled="!model.config.numberHeadings.enabled"
          />
        </label>
        <label class="editor-row">
          <span class="editor-row__copy"><strong>移除 Markdown 分隔线</strong></span>
          <input
            v-model="model.config.removeThematicBreaks.enabled"
            class="app-switch"
            type="checkbox"
          />
        </label>
      </div>
    </section>

    <section class="editor-section">
      <h3>题注</h3>
      <div class="editor-group">
        <label class="editor-row">
          <span class="editor-row__copy">
            <strong>图片题注</strong><small>{{ figureExample }}</small>
          </span>
          <input v-model="model.config.figureCaption.enabled" class="app-switch" type="checkbox" />
        </label>
        <div class="editor-fields" :class="{ 'is-disabled': !model.config.figureCaption.enabled }">
          <label>
            <span>编号格式</span>
            <input
              v-model="model.config.figureCaption.format"
              :disabled="!model.config.figureCaption.enabled"
            />
          </label>
          <label>
            <span>分隔符</span>
            <input
              v-model="model.config.figureCaption.separator"
              :disabled="!model.config.figureCaption.enabled"
            />
          </label>
        </div>
        <label class="editor-row">
          <span class="editor-row__copy">
            <strong>表格题注</strong><small>{{ tableExample }}</small>
          </span>
          <input v-model="model.config.tableCaption.enabled" class="app-switch" type="checkbox" />
        </label>
        <div class="editor-fields" :class="{ 'is-disabled': !model.config.tableCaption.enabled }">
          <label>
            <span>编号格式</span>
            <input
              v-model="model.config.tableCaption.format"
              :disabled="!model.config.tableCaption.enabled"
            />
          </label>
          <label>
            <span>分隔符</span>
            <input
              v-model="model.config.tableCaption.separator"
              :disabled="!model.config.tableCaption.enabled"
            />
          </label>
        </div>
      </div>
    </section>

    <section class="editor-section">
      <h3>图表与图片</h3>
      <div class="editor-group">
        <label class="editor-row">
          <span class="editor-row__copy"><strong>渲染 Mermaid 图表</strong></span>
          <input v-model="model.config.renderMermaid.enabled" class="app-switch" type="checkbox" />
        </label>
        <label
          class="editor-row editor-row--nested"
          :class="{ 'is-disabled': !model.config.renderMermaid.enabled }"
        >
          <span>主题</span>
          <AppSelect
            v-model="model.config.renderMermaid.theme"
            aria-label="Mermaid 主题"
            :options="mermaidThemeOptions"
            :disabled="!model.config.renderMermaid.enabled"
          />
        </label>
        <label
          class="editor-row editor-row--nested"
          :class="{ 'is-disabled': !model.config.renderMermaid.enabled }"
        >
          <span>清晰度</span>
          <span class="editor-number">
            <input
              v-model.number="model.config.renderMermaid.density"
              type="number"
              min="72"
              step="1"
              :disabled="!model.config.renderMermaid.enabled"
            />
            <small>DPI</small>
          </span>
        </label>
        <label class="editor-row">
          <span class="editor-row__copy">
            <strong>限制图片尺寸</strong><small>只缩小过大的图片</small>
          </span>
          <input v-model="model.config.imageSize.enabled" class="app-switch" type="checkbox" />
        </label>
        <div class="editor-fields" :class="{ 'is-disabled': !model.config.imageSize.enabled }">
          <label>
            <span>最大宽度</span>
            <span class="editor-number">
              <input
                v-model.number="model.config.imageSize.maxWidthCm"
                type="number"
                min="0.1"
                step="0.1"
                :disabled="!model.config.imageSize.enabled"
              />
              <small>cm</small>
            </span>
          </label>
          <label>
            <span>最大高度</span>
            <span class="editor-number">
              <input
                v-model.number="model.config.imageSize.maxHeightCm"
                type="number"
                min="0.1"
                step="0.1"
                :disabled="!model.config.imageSize.enabled"
              />
              <small>cm</small>
            </span>
          </label>
        </div>
      </div>
    </section>

    <section class="editor-section">
      <h3>Word 样式</h3>
      <div class="editor-group">
        <label class="editor-row">
          <span class="editor-row__copy"><strong>正文首行缩进</strong></span>
          <input v-model="model.style.firstLineIndent" class="app-switch" type="checkbox" />
        </label>
        <label class="editor-row">
          <span>正文行距</span>
          <input
            v-model.number="model.style.lineSpacing"
            class="editor-short-input"
            type="number"
            min="0.1"
            step="0.05"
          />
        </label>
        <label class="editor-row">
          <span>一级标题另起一页</span>
          <input v-model="model.style.startOnNewPage" class="app-switch" type="checkbox" />
        </label>
        <label class="editor-row">
          <span>一级标题对齐</span>
          <AppSelect
            v-model="model.style.alignment"
            aria-label="一级标题对齐"
            :options="alignmentOptions"
          />
        </label>
        <label class="editor-row">
          <span>行内代码背景</span>
          <input v-model="model.style.inlineCodeBackground" class="app-switch" type="checkbox" />
        </label>
        <label class="editor-row">
          <span>代码块边框</span>
          <input v-model="model.style.codeBlockBorder" class="app-switch" type="checkbox" />
        </label>
        <details class="heading-details">
          <summary><span>标题细节</span><ChevronDown :size="14" /></summary>
          <div class="heading-grid">
            <span class="heading-grid__head">级别</span>
            <span class="heading-grid__head">粗体</span>
            <span class="heading-grid__head">斜体</span>
            <template
              v-for="level in ['1', '2', '3', '4', '5', '6'] as HeadingLevel[]"
              :key="level"
            >
              <span>{{ level }} 级</span>
              <input
                v-model="model.style.bold[level]"
                type="checkbox"
                :aria-label="`${level} 级标题粗体`"
              />
              <input
                v-if="Number(level) >= 4"
                v-model="model.style.italic[level]"
                type="checkbox"
                :aria-label="`${level} 级标题斜体`"
              />
              <span v-else class="heading-grid__unavailable">—</span>
            </template>
          </div>
        </details>
      </div>
    </section>
  </div>
</template>

<style scoped>
.conversion-settings-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.editor-section h3 {
  margin: 0 0 6px 5px;
  color: var(--app-secondary);
  font-family:
    -apple-system, "SF Pro Display", "Segoe UI Variable Display", "Microsoft YaHei UI",
    "PingFang SC", system-ui, sans-serif;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.editor-group {
  overflow: hidden;
  border: 0.5px solid var(--app-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--app-surface) 60%, var(--app-fill));
}
.editor-row {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 12px;
  color: var(--app-text);
  font-size: 12.5px;
}
.editor-row + .editor-row,
.editor-fields + .editor-row,
.editor-fields + .editor-fields,
.editor-note + .editor-row,
.heading-details {
  border-top: 0.5px solid var(--app-border);
}
.editor-row--nested {
  position: relative;
  min-height: 36px;
  padding-left: 28px;
}
.editor-row--nested::before {
  position: absolute;
  top: 50%;
  left: 16px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--app-tertiary);
  content: "";
  transform: translateY(-50%);
  opacity: 0.6;
}
.editor-row__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}
.editor-row__copy strong {
  font-size: 12.5px;
  font-weight: 550;
}
.editor-row__copy small,
.editor-note {
  color: var(--app-tertiary);
  font-size: 10.5px;
}
.editor-note {
  margin: -3px 12px 7px 28px;
  line-height: 1.4;
}
.editor-row input:not(.app-switch),
.editor-fields input {
  height: 26px;
  padding: 0 7px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 6px;
  background: color-mix(in srgb, var(--app-surface-raised) 80%, var(--app-fill));
  color: var(--app-text);
  font-size: 11px;
  outline: none;
  transition:
    border-color 0.14s ease,
    box-shadow 0.14s ease;
}
.editor-row :deep(.app-select__trigger) {
  min-width: 140px;
  max-width: 176px;
}
.editor-short-input {
  width: 68px;
  padding: 0 7px;
  text-align: right;
}
.editor-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 8px;
  padding: 0 12px 10px 28px;
}
.editor-fields label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  color: var(--app-tertiary);
  font-size: 9.5px;
}
.editor-fields input {
  width: 100%;
  padding: 0 7px;
}
.editor-number {
  display: flex;
  align-items: center;
  gap: 4px;
}
.editor-number input {
  width: 72px;
  padding: 0 6px;
  text-align: right;
}
.editor-number small {
  color: var(--app-tertiary);
  font-size: 9.5px;
}
.is-disabled {
  opacity: 0.5;
}
.app-switch {
  position: relative;
  width: 30px;
  height: 18px;
  flex: 0 0 auto;
  margin: 0;
  appearance: none;
  border: 0.5px solid transparent;
  border-radius: 9px;
  background: color-mix(in srgb, var(--app-text) 16%, transparent);
  cursor: default;
  transition:
    background 0.16s ease,
    border-color 0.16s ease;
}
.app-switch::after {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--app-surface-raised);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  content: "";
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}
.app-switch:checked {
  background: var(--app-accent);
  border-color: color-mix(in srgb, var(--app-accent) 80%, transparent);
}
.app-switch:checked::after {
  transform: translateX(12px);
  background: #ffffff;
}
.app-switch:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--app-accent) 55%, transparent);
  outline-offset: 2px;
}
.heading-details summary {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  color: var(--app-text);
  font-size: 12.5px;
  cursor: default;
  list-style: none;
  user-select: none;
}
.heading-details summary svg {
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
  color: var(--app-tertiary);
}
.heading-details summary::-webkit-details-marker {
  display: none;
}
.heading-details[open] summary svg {
  transform: rotate(180deg);
}
.heading-details[open] summary {
  border-bottom: 0.5px solid var(--app-border);
}
.heading-grid {
  display: grid;
  grid-template-columns: 1fr 52px 52px;
  align-items: center;
  padding: 8px 12px 10px;
  color: var(--app-secondary);
  font-size: 11px;
  text-align: center;
}
.heading-grid > * {
  min-height: 26px;
}
.heading-grid > span {
  display: flex;
  align-items: center;
}
.heading-grid > input {
  justify-self: center;
  width: 16px;
  height: 16px;
  accent-color: var(--app-accent);
  cursor: default;
}
.heading-grid__head {
  color: var(--app-tertiary);
  font-size: 9.5px;
}
.heading-grid__unavailable {
  justify-content: center;
  color: var(--app-tertiary);
}
.editor-row input:not(.app-switch):focus,
.editor-fields input:focus {
  border-color: var(--app-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 18%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .heading-details summary svg,
  .app-switch,
  .app-switch::after {
    transition: none;
  }
}
</style>
