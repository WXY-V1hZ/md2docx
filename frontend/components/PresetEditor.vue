<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
import { computed, nextTick, onMounted, ref, watch } from "vue";

import {
  type ConversionEditorModel,
  cloneJson,
  toEditorModel,
  toStyleConfig,
  validationMessage,
} from "../conversion-settings";
import ConversionSettingsForm from "./ConversionSettingsForm.vue";

type EditorMode = "edit" | "copy";

const props = defineProps<{ sourceName: string; mode: EditorMode }>();
const emit = defineEmits<{
  cancel: [];
  saved: [name: string];
  "dirty-change": [dirty: boolean];
}>();

const model = ref<ConversionEditorModel | null>(null);
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
const validationError = computed(() => validationMessage(model.value));
const canSave = computed(
  () =>
    (dirty.value || requiresName.value) &&
    !saving.value &&
    !loading.value &&
    !validationError.value,
);

watch(dirty, (value) => emit("dirty-change", value), { immediate: true });

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
      config: cloneJson(model.value.config),
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
        <ConversionSettingsForm :model="model" />
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
          aria-labelledby="editor-dialog-title"
        >
          <strong id="editor-dialog-title">保存为新预设</strong>
          <p>为这套转换规则和 Word 样式命名。</p>
          <input
            ref="nameInput"
            v-model="targetName"
            placeholder="预设名称"
            :aria-invalid="Boolean(nameSubmitted && nameError)"
            @keydown.enter.prevent="persist"
          />
          <small v-if="(nameSubmitted && nameError) || saveError" role="alert">
            {{ saveError || nameError }}
          </small>
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
  overflow-y: auto;
  padding: 8px 18px 22px;
}
.preset-editor__footer {
  display: grid;
  grid-template-columns: 1fr auto auto;
  min-height: 58px;
  align-items: center;
  gap: 7px;
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
  background: color-mix(in srgb, #000 42%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.editor-dialog {
  display: flex;
  width: 300px;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 16px;
  background: color-mix(in srgb, var(--app-surface-raised) 96%, transparent);
  box-shadow: var(--app-shadow-floating);
  backdrop-filter: blur(12px);
}
.editor-dialog strong {
  color: var(--app-text);
  font-size: 14px;
  font-weight: 650;
}
.editor-dialog p {
  margin: 0;
  color: var(--app-secondary);
  font-size: 12px;
}
.editor-dialog input {
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 8px;
  background: var(--app-fill);
  color: var(--app-text);
  font-size: 13px;
  outline: none;
  transition:
    border-color 0.14s ease,
    box-shadow 0.14s ease;
}
.editor-dialog input:focus {
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
.preset-dialog-enter-active,
.preset-dialog-leave-active {
  transition: opacity 0.15s ease-out;
}
.preset-dialog-enter-active .editor-dialog,
.preset-dialog-leave-active .editor-dialog {
  transition:
    opacity 0.15s ease-out,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.preset-dialog-enter-from,
.preset-dialog-leave-to,
.preset-dialog-enter-from .editor-dialog,
.preset-dialog-leave-to .editor-dialog {
  opacity: 0;
}
.preset-dialog-enter-from .editor-dialog {
  transform: scale(0.96) translateY(4px);
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
  .preset-dialog-enter-active,
  .preset-dialog-leave-active,
  .preset-dialog-enter-active .editor-dialog,
  .preset-dialog-leave-active .editor-dialog {
    transition: none;
  }
}
</style>
