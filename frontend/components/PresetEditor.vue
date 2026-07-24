<script setup lang="ts">
import { ChevronDown, LoaderCircle } from "lucide-vue-next";
import { computed, nextTick, onMounted, ref, watch } from "vue";

import AppSelect, { type AppSelectOption } from "./AppSelect.vue";

type EditorMode = "edit" | "copy";
type HeadingLevel = "1" | "2" | "3" | "4" | "5" | "6";

interface EditorStyle {
  firstLineIndent: boolean;
  lineSpacing: number;
  startOnNewPage: boolean;
  alignment: "left" | "center";
  bold: Record<HeadingLevel, boolean>;
  italic: Record<HeadingLevel, boolean>;
  inlineCodeBackground: boolean;
  codeBlockBorder: boolean;
}

interface EditorModel {
  config: PresetAppConfig;
  style: EditorStyle;
}

const props = defineProps<{ sourceName: string; mode: EditorMode }>();
const emit = defineEmits<{
  cancel: [];
  saved: [name: string];
  "dirty-change": [dirty: boolean];
}>();

const model = ref<EditorModel | null>(null);
const baseline = ref("");
const loading = ref(true);
const saving = ref(false);
const loadError = ref("");
const saveError = ref("");
const nameDialogOpen = ref(false);
const targetName = ref("");
const nameSubmitted = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

const dirty = computed(
  () => Boolean(model.value) && JSON.stringify(model.value) !== baseline.value,
);
const requiresName = computed(() => props.mode === "copy" || props.sourceName === "default");
const editorTitle = computed(() =>
  requiresName.value ? `自定义 ${props.sourceName}` : props.sourceName,
);
const nameError = computed(() => {
  const value = targetName.value.trim();
  if (!value) return "请输入预设名称";
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return "只允许字母、数字、- 和 _";
  if (value === "default") return "default 是系统保留名称";
  return "";
});
const validationError = computed(() => {
  const value = model.value;
  if (!value) return "";
  if (
    !Number.isInteger(value.config.renderMermaid.density) ||
    value.config.renderMermaid.density < 72
  ) {
    return "图表清晰度必须是不小于 72 的整数";
  }
  if (value.config.imageSize.maxWidthCm <= 0 || value.config.imageSize.maxHeightCm <= 0) {
    return "图片尺寸必须大于 0";
  }
  if (!Number.isFinite(value.style.lineSpacing) || value.style.lineSpacing <= 0) {
    return "正文行距必须大于 0";
  }
  return "";
});
const canSave = computed(
  () =>
    (dirty.value || requiresName.value) &&
    !saving.value &&
    !loading.value &&
    !validationError.value,
);
const figureExample = computed(() => captionExample(model.value?.config.figureCaption, "示例图片"));
const tableExample = computed(() => captionExample(model.value?.config.tableCaption, "示例表格"));

const titleSourceOptions = [
  { value: "first-h1", label: "第一个一级标题" },
  { value: "single-h1", label: "唯一的一级标题" },
  { value: "filename", label: "文件名" },
  { value: "none", label: "不提取" },
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

watch(dirty, (value) => emit("dirty-change", value), { immediate: true });
watch(
  () => model.value?.config.numberHeadings.enabled,
  (enabled) => {
    if (enabled && model.value) model.value.config.normalizeHeadings.enabled = true;
  },
);

onMounted(() => void loadPreset());

async function loadPreset() {
  loading.value = true;
  loadError.value = "";
  try {
    const preset = await window.md2docx?.readPreset(props.sourceName);
    if (!preset) throw new Error("桌面接口不可用");
    const next = toEditorModel(preset);
    model.value = next;
    baseline.value = JSON.stringify(next);
  } catch (error) {
    loadError.value = messageFrom(error, "无法读取预设");
  } finally {
    loading.value = false;
  }
}

function toEditorModel(preset: EditablePreset): EditorModel {
  const headings = preset.styleConfig.options?.headings;
  return {
    config: structuredClone(preset.config),
    style: {
      firstLineIndent: preset.styleConfig.options?.body?.firstLineIndent ?? false,
      lineSpacing: preset.styleConfig.options?.body?.lineSpacing ?? 1.5,
      startOnNewPage: headings?.["1"]?.startOnNewPage ?? false,
      alignment: headings?.["1"]?.alignment ?? "left",
      bold: {
        "1": headings?.["1"]?.bold ?? true,
        "2": headings?.["2"]?.bold ?? true,
        "3": headings?.["3"]?.bold ?? true,
        "4": headings?.["4"]?.bold ?? true,
        "5": headings?.["5"]?.bold ?? true,
        "6": headings?.["6"]?.bold ?? true,
      },
      italic: {
        "1": false,
        "2": false,
        "3": false,
        "4": headings?.["4"]?.italic ?? false,
        "5": headings?.["5"]?.italic ?? false,
        "6": headings?.["6"]?.italic ?? false,
      },
      inlineCodeBackground: preset.styleConfig.options?.inlineCode?.background ?? true,
      codeBlockBorder: preset.styleConfig.options?.codeBlock?.border ?? true,
    },
  };
}

function toStyleConfig(style: EditorStyle): PresetStyleConfig {
  return {
    schemaVersion: 1,
    options: {
      body: {
        firstLineIndent: style.firstLineIndent,
        lineSpacing: style.lineSpacing,
      },
      headings: {
        "1": {
          startOnNewPage: style.startOnNewPage,
          alignment: style.alignment,
          bold: style.bold["1"],
        },
        "2": { bold: style.bold["2"] },
        "3": { bold: style.bold["3"] },
        "4": { bold: style.bold["4"], italic: style.italic["4"] },
        "5": { bold: style.bold["5"], italic: style.italic["5"] },
        "6": { bold: style.bold["6"], italic: style.italic["6"] },
      },
      inlineCode: { background: style.inlineCodeBackground },
      codeBlock: { border: style.codeBlockBorder },
    },
  };
}

function requestSave() {
  saveError.value = "";
  if (!canSave.value) return;
  if (requiresName.value) {
    targetName.value = "";
    nameSubmitted.value = false;
    nameDialogOpen.value = true;
    void nextTick(() => nameInput.value?.focus());
    return;
  }
  void persist();
}

async function persist() {
  if (!model.value || saving.value || validationError.value) return;
  nameSubmitted.value = true;
  if (requiresName.value && nameError.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    const saved = await window.md2docx?.updatePreset({
      sourceName: props.sourceName,
      ...(requiresName.value ? { targetName: targetName.value.trim() } : {}),
      config: JSON.parse(JSON.stringify(model.value.config)) as PresetAppConfig,
      styleConfig: toStyleConfig(model.value.style),
    });
    if (!saved) throw new Error("桌面接口不可用");
    if (requiresName.value) await window.md2docx?.usePreset(saved.name);
    window.dispatchEvent(new CustomEvent("md2docx:preset-changed", { detail: saved.name }));
    baseline.value = JSON.stringify(model.value);
    nameDialogOpen.value = false;
    emit("dirty-change", false);
    emit("saved", saved.name);
  } catch (error) {
    saveError.value = messageFrom(error, "无法保存预设");
  } finally {
    saving.value = false;
  }
}

function closeNameDialog() {
  if (saving.value) return;
  nameDialogOpen.value = false;
}

function onNameDialogKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeNameDialog();
    return;
  }
  if (event.key !== "Tab") return;
  const dialog = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(".editor-dialog");
  if (!dialog) return;
  const focusable = [
    ...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"),
  ];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function captionExample(caption: { format: string; separator: string } | undefined, name: string) {
  if (!caption) return "";
  return `${caption.format.replace("{n}", "1")}${caption.separator}${name}`;
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.split("\n")[0] : fallback;
}
</script>

<template>
  <div class="preset-editor">
    <div v-if="loading" class="preset-editor__state" aria-live="polite">
      <LoaderCircle :size="18" class="is-spinning" />
      正在载入
    </div>
    <div v-else-if="loadError" class="preset-editor__state preset-editor__state--error">
      <span>{{ loadError }}</span>
      <button type="button" class="app-button app-button--secondary" @click="loadPreset">
        重试
      </button>
    </div>

    <template v-else-if="model">
      <div class="preset-editor__intro">
        <strong>{{ editorTitle }}</strong>
        <span>转换规则与 Word 外观</span>
      </div>

      <form class="preset-editor__form" @submit.prevent="requestSave">
        <section class="editor-section">
          <h3>文档结构</h3>
          <div class="editor-group">
            <label class="editor-row">
              <span class="editor-row__copy"><strong>自动设置标题</strong></span>
              <input
                v-model="model.config.detectTitle.enabled"
                class="app-switch"
                type="checkbox"
              />
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
              <span class="editor-row__copy"
                ><strong>修正标题层级</strong><small>消除跳级并从一级标题开始</small></span
              >
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
              <input
                v-model="model.config.numberHeadings.enabled"
                class="app-switch"
                type="checkbox"
              />
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
              <span class="editor-row__copy"
                ><strong>图片题注</strong><small>{{ figureExample }}</small></span
              >
              <input
                v-model="model.config.figureCaption.enabled"
                class="app-switch"
                type="checkbox"
              />
            </label>
            <div
              class="editor-fields"
              :class="{ 'is-disabled': !model.config.figureCaption.enabled }"
            >
              <label
                ><span>编号格式</span
                ><input
                  v-model="model.config.figureCaption.format"
                  :disabled="!model.config.figureCaption.enabled"
              /></label>
              <label
                ><span>分隔符</span
                ><input
                  v-model="model.config.figureCaption.separator"
                  :disabled="!model.config.figureCaption.enabled"
              /></label>
            </div>
            <label class="editor-row">
              <span class="editor-row__copy"
                ><strong>表格题注</strong><small>{{ tableExample }}</small></span
              >
              <input
                v-model="model.config.tableCaption.enabled"
                class="app-switch"
                type="checkbox"
              />
            </label>
            <div
              class="editor-fields"
              :class="{ 'is-disabled': !model.config.tableCaption.enabled }"
            >
              <label
                ><span>编号格式</span
                ><input
                  v-model="model.config.tableCaption.format"
                  :disabled="!model.config.tableCaption.enabled"
              /></label>
              <label
                ><span>分隔符</span
                ><input
                  v-model="model.config.tableCaption.separator"
                  :disabled="!model.config.tableCaption.enabled"
              /></label>
            </div>
          </div>
        </section>

        <section class="editor-section">
          <h3>图表与图片</h3>
          <div class="editor-group">
            <label class="editor-row">
              <span class="editor-row__copy"><strong>渲染 Mermaid 图表</strong></span>
              <input
                v-model="model.config.renderMermaid.enabled"
                class="app-switch"
                type="checkbox"
              />
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
              <span class="editor-number"
                ><input
                  v-model.number="model.config.renderMermaid.density"
                  type="number"
                  min="72"
                  step="1"
                  :disabled="!model.config.renderMermaid.enabled"
                /><small>DPI</small></span
              >
            </label>
            <label class="editor-row">
              <span class="editor-row__copy"
                ><strong>限制图片尺寸</strong><small>只缩小过大的图片</small></span
              >
              <input v-model="model.config.imageSize.enabled" class="app-switch" type="checkbox" />
            </label>
            <div class="editor-fields" :class="{ 'is-disabled': !model.config.imageSize.enabled }">
              <label
                ><span>最大宽度</span
                ><span class="editor-number"
                  ><input
                    v-model.number="model.config.imageSize.maxWidthCm"
                    type="number"
                    min="0.1"
                    step="0.1"
                    :disabled="!model.config.imageSize.enabled"
                  /><small>cm</small></span
                ></label
              >
              <label
                ><span>最大高度</span
                ><span class="editor-number"
                  ><input
                    v-model.number="model.config.imageSize.maxHeightCm"
                    type="number"
                    min="0.1"
                    step="0.1"
                    :disabled="!model.config.imageSize.enabled"
                  /><small>cm</small></span
                ></label
              >
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
              <input
                v-model="model.style.inlineCodeBackground"
                class="app-switch"
                type="checkbox"
              />
            </label>
            <label class="editor-row">
              <span>代码块边框</span>
              <input v-model="model.style.codeBlockBorder" class="app-switch" type="checkbox" />
            </label>
            <details class="heading-details">
              <summary><span>标题细节</span><ChevronDown :size="14" /></summary>
              <div class="heading-grid">
                <span class="heading-grid__head">级别</span
                ><span class="heading-grid__head">粗体</span
                ><span class="heading-grid__head">斜体</span>
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
      </form>

      <footer class="preset-editor__footer">
        <p v-if="validationError || saveError" role="alert">{{ saveError || validationError }}</p>
        <span v-else />
        <button
          type="button"
          class="app-button app-button--secondary"
          :disabled="saving"
          @click="emit('cancel')"
        >
          取消
        </button>
        <button
          type="button"
          class="app-button app-button--primary"
          :disabled="!canSave"
          @click="requestSave"
        >
          {{ saving ? "正在保存…" : "保存" }}
        </button>
      </footer>
    </template>
  </div>

  <Teleport to="body">
    <Transition name="preset-dialog">
      <div
        v-if="nameDialogOpen"
        class="editor-dialog-overlay"
        @mousedown.self="closeNameDialog"
        @keydown="onNameDialogKeydown"
      >
        <div
          class="editor-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editor-name-title"
        >
          <strong id="editor-name-title">存储为新预设</strong>
          <p>为这组设置取一个简短名称。</p>
          <input
            ref="nameInput"
            v-model="targetName"
            :aria-invalid="nameSubmitted && Boolean(nameError)"
            placeholder="例如 academic"
            @keydown.enter="persist"
          />
          <small v-if="nameSubmitted && nameError" role="alert">{{ nameError }}</small>
          <div>
            <button
              type="button"
              class="app-button app-button--secondary"
              :disabled="saving"
              @click="closeNameDialog"
            >
              取消
            </button>
            <button
              type="button"
              class="app-button app-button--primary"
              :disabled="saving || Boolean(nameError)"
              @click="persist"
            >
              {{ saving ? "正在保存…" : "存储" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.preset-editor {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}
.preset-editor__state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--app-secondary);
  font-size: 12px;
}
.preset-editor__state--error {
  flex-direction: column;
}
.preset-editor__intro {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 17px 20px 10px;
}
.preset-editor__intro strong {
  color: var(--app-text);
  font-size: 15px;
  font-weight: 650;
}
.preset-editor__intro span {
  color: var(--app-tertiary);
  font-size: 11px;
}
.preset-editor__form {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding: 8px 18px 22px;
}
.editor-section h3 {
  margin: 0 0 7px 5px;
  color: var(--app-secondary);
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}
.editor-group {
  overflow: hidden;
  border: 0.5px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-fill);
}
.editor-row {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 12px;
  color: var(--app-text);
  font-size: 12.5px;
}
.editor-row + .editor-row,
.editor-fields + .editor-row,
.editor-note + .editor-row,
.heading-details {
  border-top: 0.5px solid var(--app-border);
}
.editor-row--nested {
  min-height: 38px;
  padding-left: 28px;
}
.editor-row__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
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
  height: 28px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 7px;
  background: var(--app-surface-raised);
  color: var(--app-text);
  font-size: 11.5px;
  outline: none;
}
.editor-row :deep(.app-select__trigger) {
  min-width: 166px;
  max-width: 190px;
}
.editor-short-input {
  width: 72px;
  padding: 0 7px;
  text-align: right;
}
.editor-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 12px 10px 28px;
}
.editor-fields label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  color: var(--app-tertiary);
  font-size: 10px;
}
.editor-fields input {
  width: 100%;
  padding: 0 7px;
}
.editor-number {
  display: flex;
  align-items: center;
  gap: 5px;
}
.editor-number input {
  width: 76px;
  padding: 0 7px;
  text-align: right;
}
.editor-number small {
  color: var(--app-tertiary);
  font-size: 10px;
}
.is-disabled {
  opacity: 0.5;
}
.app-switch {
  position: relative;
  appearance: none;
  width: 30px;
  height: 18px;
  flex: 0 0 auto;
  margin: 0;
  border: none;
  border-radius: 9px;
  background: color-mix(in srgb, var(--app-text) 18%, transparent);
  cursor: default;
  transition: background 0.16s ease;
}

.app-switch::after {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  content: "";
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-switch:checked {
  background: var(--app-accent);
}

.app-switch:checked::after {
  transform: translateX(12px);
}

.app-switch:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--app-accent) 55%, transparent);
  outline-offset: 2px;
}

.app-switch:disabled {
  cursor: default;
}
.heading-details summary {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  color: var(--app-text);
  font-size: 12.5px;
  cursor: default;
  list-style: none;
}

.heading-details summary svg {
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.heading-details summary::-webkit-details-marker {
  display: none;
}
.heading-details[open] summary svg {
  transform: rotate(180deg);
}
.heading-grid {
  display: grid;
  grid-template-columns: 1fr 52px 52px;
  align-items: center;
  gap: 0;
  padding: 0 12px 10px;
  color: var(--app-secondary);
  font-size: 11.5px;
  text-align: center;
}
.heading-grid > * {
  min-height: 28px;
}
.heading-grid > span {
  display: flex;
  align-items: center;
}
.heading-grid > input {
  justify-self: center;
  accent-color: var(--app-accent);
}
.heading-grid__head {
  color: var(--app-tertiary);
  font-size: 10px;
}
.heading-grid__unavailable {
  justify-content: center;
  color: var(--app-tertiary);
}
.preset-editor__footer {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 7px;
  min-height: 58px;
  padding: 10px 18px;
  border-top: 0.5px solid var(--app-border);
  background: color-mix(in srgb, var(--app-surface-raised) 94%, transparent);
}
.preset-editor__footer p {
  overflow: hidden;
  margin: 0;
  color: #ff453a;
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-dialog-overlay {
  position: fixed;
  inset: var(--app-titlebar-height) 0 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(5px);
}
.editor-dialog {
  display: flex;
  width: 300px;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 15px;
  background: var(--app-surface-raised);
  box-shadow: var(--app-shadow-floating);
}
.editor-dialog strong {
  color: var(--app-text);
  font-size: 14px;
}
.editor-dialog p {
  margin: 0;
  color: var(--app-secondary);
  font-size: 12px;
}
.editor-dialog input {
  height: 34px;
  padding: 0 10px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 8px;
  background: var(--app-fill);
  color: var(--app-text);
  outline: none;
}
.editor-dialog input:focus,
.editor-row input:not(.app-switch):focus,
.editor-fields input:focus {
  border-color: var(--app-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 18%, transparent);
}
.editor-dialog small {
  color: #ff453a;
}
.editor-dialog > div {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}
.is-spinning {
  animation: editor-spin 0.7s linear infinite;
}
@keyframes editor-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-spinning {
    animation-duration: 1.4s;
  }
  .heading-details summary svg {
    transition: none;
  }
}
</style>
