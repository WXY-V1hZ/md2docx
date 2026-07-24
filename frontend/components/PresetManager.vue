<script setup lang="ts">
import { Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

interface PresetEntry {
  name: string;
  source: "builtin" | "user";
  current: boolean;
  customFiles: string[];
  valid: boolean;
  error?: string;
}

type DialogMode = "rename" | "copy" | "delete";

const emit = defineEmits<{ edit: [sourceName: string, mode: "edit" | "copy"] }>();

const presets = ref<PresetEntry[]>([]);
const currentPreset = ref("default");
const loading = ref(true);
const presetError = ref("");
const selectingPreset = ref("");
const dialogMode = ref<DialogMode | null>(null);
const dialogPreset = ref("");
const dialogInput = ref("");
const dialogError = ref("");
const dialogBusy = ref(false);
const dialogSubmitted = ref(false);
const presetDialog = ref<HTMLElement | null>(null);
const presetNameInput = ref<HTMLInputElement | null>(null);
const dialogCancelButton = ref<HTMLButtonElement | null>(null);
const openMenu = ref("");

const dialogInputError = computed(() => {
  if (dialogMode.value === "delete") return "";
  const name = dialogInput.value.trim();
  if (!name) return "请输入预设名称";
  if (dialogMode.value === "rename" && name === dialogPreset.value) return "请输入不同的名称";
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return "只允许字母、数字、- 和 _";
  return "";
});

const visibleDialogInputError = computed(() =>
  dialogSubmitted.value || dialogInput.value.trim() ? dialogInputError.value : "",
);

async function loadPresets() {
  loading.value = true;
  presetError.value = "";
  try {
    presets.value = (await window.md2docx?.getPresets()) ?? [];
    currentPreset.value = presets.value.find(({ current }) => current)?.name ?? "default";
  } catch (error) {
    presetError.value = error instanceof Error ? error.message : "无法读取预设";
  } finally {
    loading.value = false;
  }
}

async function selectPreset(preset: PresetEntry) {
  if (!preset.valid || preset.name === currentPreset.value || Boolean(selectingPreset.value)) {
    return;
  }
  const previous = currentPreset.value;
  currentPreset.value = preset.name;
  selectingPreset.value = preset.name;
  presetError.value = "";
  try {
    await window.md2docx?.usePreset(preset.name);
    for (const entry of presets.value) entry.current = entry.name === preset.name;
    notifyPresetChanged();
  } catch (error) {
    currentPreset.value = previous;
    presetError.value = error instanceof Error ? error.message : "无法切换预设";
  } finally {
    selectingPreset.value = "";
  }
}

function openDialog(mode: DialogMode, name: string) {
  openMenu.value = "";
  dialogMode.value = mode;
  dialogPreset.value = name;
  dialogInput.value = mode === "rename" ? name : "";
  dialogError.value = "";
  dialogSubmitted.value = false;
  void nextTick(() => {
    if (mode === "delete") dialogCancelButton.value?.focus();
    else if (mode === "rename") presetNameInput.value?.select();
    else presetNameInput.value?.focus();
  });
}

function closeDialog() {
  if (dialogBusy.value) return;
  resetDialog();
}

async function confirmDialog() {
  const mode = dialogMode.value;
  if (!mode || dialogBusy.value) return;
  dialogSubmitted.value = true;
  if (dialogInputError.value) return;

  dialogBusy.value = true;
  dialogError.value = "";
  const sourceName = dialogPreset.value;
  const targetName = dialogInput.value.trim();
  try {
    if (mode === "delete") {
      await window.md2docx?.deletePreset(sourceName);
    } else if (mode === "rename") {
      await window.md2docx?.renamePreset(sourceName, targetName);
    } else {
      await window.md2docx?.copyPreset(sourceName, targetName);
    }
    await refreshPresets();
    resetDialog();
  } catch (error) {
    dialogError.value = error instanceof Error ? error.message : `${dialogActionLabel(mode)}失败`;
  } finally {
    dialogBusy.value = false;
  }
}

async function refreshPresets() {
  const previous = currentPreset.value;
  presets.value = (await window.md2docx?.getPresets()) ?? [];
  currentPreset.value = presets.value.find(({ current }) => current)?.name ?? "default";
  if (currentPreset.value !== previous) notifyPresetChanged();
  else
    window.dispatchEvent(
      new CustomEvent("md2docx:preset-changed", { detail: currentPreset.value }),
    );
}

function notifyPresetChanged() {
  window.dispatchEvent(new CustomEvent("md2docx:preset-changed", { detail: currentPreset.value }));
}

function resetDialog() {
  dialogMode.value = null;
  dialogPreset.value = "";
  dialogInput.value = "";
  dialogError.value = "";
  dialogSubmitted.value = false;
}

function dialogActionLabel(mode: DialogMode) {
  if (mode === "delete") return "删除";
  if (mode === "rename") return "重命名";
  return "复制";
}

function onDialogKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && openMenu.value) {
    openMenu.value = "";
    return;
  }
  if (!dialogMode.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDialog();
    return;
  }
  if (event.key !== "Tab" || !presetDialog.value) return;

  const focusable = [
    ...presetDialog.value.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled)",
    ),
  ];
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onDocumentClick(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest(".preset-more")) return;
  openMenu.value = "";
}

onMounted(() => {
  document.addEventListener("keydown", onDialogKeydown);
  document.addEventListener("click", onDocumentClick);
  void loadPresets();
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onDialogKeydown);
  document.removeEventListener("click", onDocumentClick);
});
</script>

<template>
  <section
    class="preset-manager"
    aria-labelledby="preset-settings"
    data-preset-manager
    tabindex="-1"
  >
    <div class="preset-manager__heading">
      <h3 id="preset-settings" class="preset-manager__label">预设</h3>
      <button
        type="button"
        class="preset-manager__create"
        :disabled="loading"
        @click="emit('edit', currentPreset, 'copy')"
      >
        <Plus :size="12" stroke-width="2" />
        新建
      </button>
    </div>
    <div class="preset-list" :aria-busy="loading">
      <div
        v-for="preset in presets"
        :key="preset.name"
        class="preset-row"
        :class="{ 'preset-row--invalid': !preset.valid }"
      >
        <label class="preset-row__select">
          <input
            :checked="currentPreset === preset.name"
            type="radio"
            name="desktop-preset"
            :disabled="!preset.valid || Boolean(selectingPreset)"
            @change="selectPreset(preset)"
          />
          <span class="preset-row__copy">
            <strong>{{ preset.name }}</strong>
            <small v-if="!preset.valid">{{ preset.error || "预设无效" }}</small>
            <small v-else-if="selectingPreset === preset.name">正在切换…</small>
            <small v-else-if="currentPreset === preset.name">当前使用</small>
            <small v-else-if="preset.source === 'builtin'">内置</small>
          </span>
        </label>
        <span class="preset-row__actions">
          <button
            type="button"
            class="preset-edit-button"
            :disabled="!preset.valid"
            @click="emit('edit', preset.name, preset.source === 'builtin' ? 'copy' : 'edit')"
          >
            {{ preset.source === "builtin" ? "自定义" : "编辑" }}
          </button>
          <span v-if="preset.source === 'user'" class="preset-more">
            <button
              type="button"
              class="preset-action"
              :aria-label="`更多 ${preset.name}`"
              :aria-expanded="openMenu === preset.name"
              @click="openMenu = openMenu === preset.name ? '' : preset.name"
            >
              <MoreHorizontal :size="14" stroke-width="1.8" />
            </button>
            <span v-if="openMenu === preset.name" class="preset-more__menu">
              <button type="button" @click="openDialog('copy', preset.name)">
                <Copy :size="13" />复制
              </button>
              <button type="button" @click="openDialog('rename', preset.name)">
                <Pencil :size="13" />重命名
              </button>
              <button type="button" class="is-danger" @click="openDialog('delete', preset.name)">
                <Trash2 :size="13" />删除
              </button>
            </span>
          </span>
        </span>
      </div>
      <div v-if="loading" class="preset-empty">正在载入…</div>
      <div v-else-if="presets.length === 0" class="preset-empty">没有可用预设</div>
    </div>
    <p v-if="presetError" class="preset-manager__error" role="alert">{{ presetError }}</p>
  </section>

  <Teleport to="body">
    <Transition name="preset-dialog">
      <div v-if="dialogMode" class="preset-dialog-overlay" @mousedown.self="closeDialog">
        <div
          ref="presetDialog"
          class="preset-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preset-dialog-title"
          aria-describedby="preset-dialog-description"
        >
          <strong id="preset-dialog-title" class="preset-dialog__title">
            {{ dialogActionLabel(dialogMode) }}预设
          </strong>
          <p id="preset-dialog-description" class="preset-dialog__text">
            <template v-if="dialogMode === 'delete'">
              删除「{{ dialogPreset }}」？此操作不可撤销。
            </template>
            <template v-else-if="dialogMode === 'rename'">
              为「{{ dialogPreset }}」输入新名称。
            </template>
            <template v-else>复制「{{ dialogPreset }}」为新预设。</template>
          </p>
          <input
            v-if="dialogMode !== 'delete'"
            ref="presetNameInput"
            v-model="dialogInput"
            class="preset-dialog__input"
            :aria-invalid="Boolean(visibleDialogInputError)"
            aria-describedby="preset-dialog-input-error"
            :placeholder="dialogMode === 'rename' ? '新名称' : '副本名称'"
            @input="dialogError = ''"
            @keydown.enter="confirmDialog"
          />
          <p
            v-if="visibleDialogInputError || dialogError"
            id="preset-dialog-input-error"
            class="preset-dialog__error"
            role="alert"
          >
            {{ dialogError || visibleDialogInputError }}
          </p>
          <div class="preset-dialog__actions">
            <button
              ref="dialogCancelButton"
              type="button"
              class="app-button app-button--secondary"
              :disabled="dialogBusy"
              @click="closeDialog"
            >
              取消
            </button>
            <button
              type="button"
              class="app-button"
              :class="dialogMode === 'delete' ? 'app-button--destructive' : 'app-button--primary'"
              :disabled="dialogBusy || Boolean(dialogInputError)"
              @click="confirmDialog"
            >
              {{ dialogBusy ? "处理中…" : dialogActionLabel(dialogMode) }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.preset-manager {
  outline: none;
}

.preset-manager:focus-visible {
  border-radius: 14px;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 22%, transparent);
}

.preset-manager__heading {
  display: flex;
  min-height: 25px;
  align-items: center;
  justify-content: space-between;
  margin: 0 5px 5px;
}

.preset-manager__label {
  margin: 0;
  color: var(--app-secondary);
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.preset-manager__create {
  display: inline-flex;
  height: 24px;
  align-items: center;
  gap: 3px;
  padding: 0 7px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-accent);
  font-size: 11px;
  font-weight: 550;
  cursor: default;
  transition:
    background 0.12s ease,
    opacity 0.12s ease;
}

.preset-manager__create:hover {
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
}

.preset-manager__create:disabled {
  opacity: 0.4;
}

.preset-manager__create:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--app-accent) 55%, transparent);
  outline-offset: 1px;
}

.preset-list {
  overflow: visible;
  border: 0.5px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-fill);
}

.preset-row {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 7px;
  padding: 0 7px 0 12px;
  color: var(--app-text);
}

.preset-row + .preset-row {
  border-top: 0.5px solid var(--app-border);
}

.preset-row--invalid {
  color: #ff3b30;
}

.preset-row__select {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 0;
}

.preset-row__select input {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  margin: 1px 0 0;
  accent-color: var(--app-accent);
}

.preset-row__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
}

.preset-row__copy strong {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-row__copy small {
  overflow: hidden;
  color: var(--app-tertiary);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-row--invalid .preset-row__copy small {
  color: #ff453a;
}

.preset-row__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
}

.preset-edit-button {
  height: 26px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-accent);
  font-size: 11px;
  font-weight: 550;
}

.preset-edit-button:hover {
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
}

.preset-edit-button:disabled {
  opacity: 0.4;
}

.preset-action {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--app-secondary);
  cursor: default;
  transition:
    background 0.1s ease,
    color 0.1s ease;
}

.preset-action:hover {
  background: var(--app-fill);
  color: var(--app-text);
}

.preset-action--danger:hover {
  color: #ff3b30;
}

.preset-action:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--app-accent) 55%, transparent);
  outline-offset: 1px;
}

.preset-more {
  position: relative;
  display: inline-flex;
}

.preset-more__menu {
  position: absolute;
  z-index: 5;
  top: 29px;
  right: 0;
  display: flex;
  width: 116px;
  flex-direction: column;
  padding: 4px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 9px;
  background: color-mix(in srgb, var(--app-surface-raised) 97%, transparent);
  box-shadow: var(--app-shadow-floating);
}

.preset-more__menu button {
  display: flex;
  height: 29px;
  align-items: center;
  gap: 7px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text);
  font-size: 11.5px;
  text-align: left;
}

.preset-more__menu button:hover {
  background: var(--app-fill);
}

.preset-more__menu .is-danger {
  color: #ff453a;
}

.preset-empty {
  padding: 18px 12px;
  color: var(--app-tertiary);
  font-size: 11px;
  text-align: center;
}

.preset-manager__error {
  margin: 5px 5px 0;
  color: #ff453a;
  font-size: 10.5px;
}

.preset-dialog-overlay {
  position: fixed;
  inset: var(--app-titlebar-height) 0 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.preset-dialog {
  display: flex;
  width: 286px;
  max-width: 100%;
  flex-direction: column;
  gap: 11px;
  padding: 17px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 14px;
  background: color-mix(in srgb, var(--app-surface-raised) 97%, transparent);
  box-shadow: var(--app-shadow-floating);
}

.preset-dialog__title {
  color: var(--app-text);
  font-size: 14px;
  font-weight: 600;
}

.preset-dialog__text {
  margin: 0;
  color: var(--app-secondary);
  font-size: 12.5px;
  line-height: 1.45;
}

.preset-dialog__input {
  height: 32px;
  padding: 6px 10px;
  border: 0.5px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-fill);
  color: var(--app-text);
  font-size: 13px;
  outline: none;
}

.preset-dialog__input:focus {
  border-color: var(--app-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.preset-dialog__input[aria-invalid="true"] {
  border-color: color-mix(in srgb, #ff3b30 62%, var(--app-border));
}

.preset-dialog__error {
  margin: -4px 1px 0;
  color: #ff453a;
  font-size: 10.5px;
  line-height: 1.35;
}

.preset-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.preset-dialog-enter-active,
.preset-dialog-leave-active {
  transition: opacity 0.15s ease-out;
}

.preset-dialog-enter-active .preset-dialog,
.preset-dialog-leave-active .preset-dialog {
  transition:
    opacity 0.15s ease-out,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.preset-dialog-enter-from,
.preset-dialog-leave-to,
.preset-dialog-enter-from .preset-dialog,
.preset-dialog-leave-to .preset-dialog {
  opacity: 0;
}

.preset-dialog-enter-from .preset-dialog {
  transform: scale(0.96) translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .preset-dialog-enter-active,
  .preset-dialog-leave-active,
  .preset-dialog-enter-active .preset-dialog,
  .preset-dialog-leave-active .preset-dialog {
    transition: none;
  }
}
</style>
