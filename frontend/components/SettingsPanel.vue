<script setup lang="ts">
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Folder,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-vue-next";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import AppSelect, { type AppSelectOption } from "./AppSelect.vue";
import PresetManager from "./PresetManager.vue";
import PresetEditor from "./PresetEditor.vue";
import pkg from "../../package.json" with { type: "json" };

const emit = defineEmits<{ close: [] }>();
const props = defineProps<{ initialSection?: "presets" }>();

type OutputMode = "source" | "folder" | "ask";
type ConflictAction = "overwrite" | "rename" | "ask";

const conflictActionOptions = [
  { value: "overwrite", label: "覆盖" },
  { value: "rename", label: "自动重命名" },
  { value: "ask", label: "每次询问" },
] satisfies readonly AppSelectOption[];

const panel = ref<HTMLElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const pandocState = ref<{
  available: boolean;
  version: string | null;
  path: string | null;
} | null>(null);
const pandocChecking = ref(false);
const pandocError = ref("");
const outputMode = ref<OutputMode>("source");
const outputFolder = ref("");
const conflictAction = ref<ConflictAction>("overwrite");
const settingsReady = ref(false);
const saveError = ref("");
const editorRequest = ref<{ sourceName: string; mode: "edit" | "copy" } | null>(null);
const editorDirty = ref(false);
const discardDialogOpen = ref(false);
const pendingExit = ref<"back" | "close">("back");

let previousFocus: HTMLElement | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function checkPandoc() {
  pandocChecking.value = true;
  pandocError.value = "";
  try {
    pandocState.value = (await window.md2docx?.detectPandoc()) ?? {
      available: false,
      version: null,
      path: null,
    };
  } catch {
    pandocState.value = { available: false, version: null, path: null };
  } finally {
    pandocChecking.value = false;
  }
}

async function openPandocWebsite() {
  try {
    await window.md2docx?.openExternal("https://pandoc.org/installing.html");
    pandocError.value = "";
  } catch {
    pandocError.value = "无法打开安装页面";
  }
}

async function selectOutputFolder(): Promise<boolean> {
  try {
    const folder = await window.md2docx?.selectFolder();
    if (!folder) return false;
    outputFolder.value = folder;
    return true;
  } catch {
    saveError.value = "无法选择输出文件夹";
    return false;
  }
}

async function onOutputModeChange() {
  if (outputMode.value !== "folder" || outputFolder.value) return;
  clearTimeout(saveTimer);
  const wasReady = settingsReady.value;
  settingsReady.value = false;
  if (!(await selectOutputFolder())) outputMode.value = "source";
  settingsReady.value = wasReady;
  scheduleSettingsSave();
}

async function loadSettings() {
  try {
    const settings = await window.md2docx?.loadSettings();
    if (settings) {
      outputMode.value = settings.outputMode;
      outputFolder.value = settings.outputFolder;
      conflictAction.value = settings.conflictAction;
    }
    await nextTick();
    settingsReady.value = true;
  } catch {
    saveError.value = "无法读取设置";
  }
}

function scheduleSettingsSave() {
  if (!settingsReady.value) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persistSettings(), 180);
}

async function persistSettings() {
  if (!settingsReady.value) return;
  clearTimeout(saveTimer);
  saveError.value = "";
  try {
    await window.md2docx?.saveSettings({
      outputMode: outputMode.value,
      outputFolder: outputFolder.value,
      conflictAction: conflictAction.value,
    });
  } catch {
    saveError.value = "设置未保存";
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    if (discardDialogOpen.value) {
      discardDialogOpen.value = false;
      return;
    }
    requestExit(editorRequest.value ? "back" : "close");
    return;
  }
  if (document.querySelector(".preset-dialog, .editor-dialog, .discard-dialog")) return;
  if (event.key !== "Tab" || !panel.value) return;

  const focusable = [
    ...panel.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]:not([tabindex="-1"])',
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

function openEditor(sourceName: string, mode: "edit" | "copy") {
  editorRequest.value = { sourceName, mode };
  editorDirty.value = false;
}

function requestExit(action: "back" | "close") {
  if (editorRequest.value && editorDirty.value) {
    pendingExit.value = action;
    discardDialogOpen.value = true;
    return;
  }
  finishExit(action);
}

function finishExit(action: "back" | "close") {
  discardDialogOpen.value = false;
  editorDirty.value = false;
  if (action === "back") editorRequest.value = null;
  else emit("close");
}

function onEditorSaved() {
  editorDirty.value = false;
  editorRequest.value = null;
}

watch([outputMode, outputFolder, conflictAction], scheduleSettingsSave);

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener("keydown", onKeydown);
  void nextTick(() => closeButton.value?.focus());
  void Promise.all([checkPandoc(), loadSettings()]);
  if (props.initialSection === "presets") {
    void nextTick(() => {
      const manager = panel.value?.querySelector<HTMLElement>("[data-preset-manager]");
      manager?.scrollIntoView({ block: "center" });
      manager?.focus({ preventScroll: true });
    });
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  if (saveTimer) void persistSettings();
  previousFocus?.focus();
});
</script>

<template>
  <div class="settings-overlay" @mousedown.self="requestExit('close')">
    <aside
      ref="panel"
      class="settings-panel"
      :class="{ 'settings-panel--editor': editorRequest }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <header class="settings-panel__header">
        <div class="settings-panel__heading">
          <button
            v-if="editorRequest"
            type="button"
            class="app-icon-button"
            aria-label="返回预设列表"
            @click="requestExit('back')"
          >
            <ArrowLeft :size="17" stroke-width="1.7" />
          </button>
          <h2 id="settings-title" class="settings-panel__title">
            {{ editorRequest ? "编辑预设" : "设置" }}
          </h2>
        </div>
        <button
          ref="closeButton"
          type="button"
          class="app-icon-button"
          aria-label="关闭设置"
          @click="requestExit('close')"
        >
          <X :size="18" stroke-width="1.5" />
        </button>
      </header>

      <PresetEditor
        v-if="editorRequest"
        :source-name="editorRequest.sourceName"
        :mode="editorRequest.mode"
        @dirty-change="editorDirty = $event"
        @cancel="requestExit('back')"
        @saved="onEditorSaved"
      />
      <div v-else class="settings-panel__body">
        <section class="settings-section" aria-labelledby="pandoc-settings">
          <h3 id="pandoc-settings" class="settings-section__label">Pandoc</h3>
          <div
            class="pandoc-card"
            :class="{
              'pandoc-card--available': pandocState?.available,
              'pandoc-card--missing': pandocState && !pandocState.available,
            }"
            role="status"
            aria-live="polite"
          >
            <span class="pandoc-card__status" aria-hidden="true">
              <span v-if="!pandocState || pandocChecking" class="pandoc-card__spinner" />
              <CheckCircle2 v-else-if="pandocState.available" :size="17" stroke-width="1.8" />
              <AlertCircle v-else :size="17" stroke-width="1.8" />
            </span>
            <div class="pandoc-card__copy">
              <strong v-if="!pandocState">正在检测…</strong>
              <strong v-else-if="pandocState.available">
                Pandoc {{ pandocState.version || "已安装" }}
              </strong>
              <strong v-else>未检测到 Pandoc</strong>
              <small v-if="pandocState?.available">{{ pandocState.path }}</small>
              <small v-else-if="pandocState">安装后重新检测</small>
            </div>
            <div class="pandoc-card__actions">
              <button
                type="button"
                class="settings-icon-button"
                :disabled="pandocChecking"
                aria-label="重新检测 Pandoc"
                title="重新检测"
                @click="checkPandoc"
              >
                <RefreshCw
                  :size="14"
                  stroke-width="1.8"
                  :class="{ 'is-spinning': pandocChecking }"
                />
              </button>
              <button
                v-if="pandocState && !pandocState.available"
                type="button"
                class="settings-link-button"
                @click="openPandocWebsite"
              >
                安装
                <ExternalLink :size="12" stroke-width="1.8" />
              </button>
            </div>
          </div>
          <p v-if="pandocError" class="settings-error" role="alert">{{ pandocError }}</p>
        </section>

        <section class="settings-section" aria-labelledby="output-settings">
          <h3 id="output-settings" class="settings-section__label">输出</h3>
          <div class="settings-group">
            <label class="settings-choice">
              <input
                v-model="outputMode"
                type="radio"
                value="source"
                @change="onOutputModeChange"
              />
              <span>与源文件同目录</span>
            </label>
            <label class="settings-choice">
              <input
                v-model="outputMode"
                type="radio"
                value="folder"
                @change="onOutputModeChange"
              />
              <span>保存到指定文件夹</span>
            </label>
            <div v-if="outputMode === 'folder'" class="settings-folder">
              <span :title="outputFolder">{{ outputFolder || "未选择文件夹" }}</span>
              <button
                type="button"
                class="settings-icon-button"
                aria-label="选择输出文件夹"
                @click="selectOutputFolder"
              >
                <Folder :size="14" stroke-width="1.8" />
              </button>
            </div>
            <label class="settings-choice">
              <input v-model="outputMode" type="radio" value="ask" @change="onOutputModeChange" />
              <span>每次转换前询问</span>
            </label>
            <div class="settings-divider" />
            <label class="settings-select-row">
              <span>同名文件</span>
              <AppSelect
                v-model="conflictAction"
                aria-label="同名文件处理方式"
                :options="conflictActionOptions"
              />
            </label>
          </div>
          <p v-if="saveError" class="settings-error" role="alert">{{ saveError }}</p>
        </section>

        <PresetManager @edit="openEditor" />

        <footer class="settings-footer">md2docx {{ pkg.version }}</footer>
      </div>
    </aside>
  </div>

  <Teleport to="body">
    <Transition name="preset-dialog">
      <div
        v-if="discardDialogOpen"
        class="discard-overlay"
        @mousedown.self="discardDialogOpen = false"
      >
        <div
          class="discard-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="discard-title"
        >
          <strong id="discard-title">放弃更改？</strong>
          <p>尚未保存的预设设置会丢失。</p>
          <div>
            <button
              type="button"
              class="app-button app-button--secondary"
              @click="discardDialogOpen = false"
            >
              继续编辑
            </button>
            <button
              type="button"
              class="app-button app-button--destructive"
              @click="finishExit(pendingExit)"
            >
              放弃
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: var(--app-titlebar-height) 0 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  transition: background 0.18s ease-out;
}

.settings-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  width: 380px;
  max-width: 100vw;
  flex-direction: column;
  border-left: 0.5px solid var(--app-border-strong);
  background: color-mix(in srgb, var(--app-surface-raised) 94%, transparent);
  box-shadow: -24px 0 64px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(28px) saturate(1.25);
  -webkit-backdrop-filter: blur(28px) saturate(1.25);
  transition:
    width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.settings-panel--editor {
  width: 460px;
}

.settings-panel__header {
  display: flex;
  min-height: 58px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 9px 18px;
  border-bottom: 0.5px solid var(--app-border);
}

.settings-panel__title {
  margin: 0;
  color: var(--app-text);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.settings-panel__heading {
  display: flex;
  align-items: center;
  gap: 4px;
}

.settings-panel__heading .app-icon-button {
  margin-left: -7px;
}

.settings-panel__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding: 18px;
}

.settings-section__label {
  margin: 0 0 7px 5px;
  color: var(--app-secondary);
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.pandoc-card {
  display: flex;
  min-height: 58px;
  align-items: center;
  gap: 10px;
  padding: 10px 11px;
  border: 0.5px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-fill);
}

.pandoc-card--available {
  border-color: color-mix(in srgb, var(--app-success) 20%, var(--app-border));
}

.pandoc-card--missing {
  border-color: color-mix(in srgb, #ff3b30 18%, var(--app-border));
}

.pandoc-card__status {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--app-fill);
  color: var(--app-tertiary);
}

.pandoc-card--available .pandoc-card__status {
  background: color-mix(in srgb, var(--app-success) 12%, transparent);
  color: var(--app-success);
}

.pandoc-card--missing .pandoc-card__status {
  background: color-mix(in srgb, #ff3b30 10%, transparent);
  color: #ff3b30;
}

.pandoc-card__spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid color-mix(in srgb, var(--app-accent) 18%, transparent);
  border-top-color: var(--app-accent);
  border-radius: 50%;
  animation: settings-spin 0.7s linear infinite;
}

.pandoc-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.pandoc-card__copy strong,
.privacy-card strong {
  overflow: hidden;
  color: var(--app-text);
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pandoc-card__copy small {
  overflow: hidden;
  color: var(--app-secondary);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pandoc-card__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.settings-group {
  overflow: hidden;
  border: 0.5px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-fill);
}

.settings-choice {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 9px;
  padding: 9px 12px;
  color: var(--app-text);
  font-size: 12.5px;
}

.settings-choice + .settings-choice {
  border-top: 0.5px solid var(--app-border);
}

.settings-choice input[type="radio"] {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  margin: 0;
  accent-color: var(--app-accent);
}

.settings-folder {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 9px 36px;
}

.settings-folder > span {
  overflow: hidden;
  flex: 1;
  color: var(--app-secondary);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-divider {
  height: 0.5px;
  margin: 0 12px;
  background: var(--app-border);
}

.settings-select-row {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px 7px 12px;
  color: var(--app-text);
  font-size: 12.5px;
}

.settings-select-row :deep(.app-select__trigger) {
  min-width: 112px;
  height: 27px;
}

.settings-icon-button,
.settings-link-button {
  display: inline-flex;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-secondary);
  cursor: default;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.settings-icon-button {
  width: 26px;
}

.settings-link-button {
  gap: 3px;
  padding: 0 7px;
  color: var(--app-accent);
  font-size: 11px;
  font-weight: 550;
}

.settings-icon-button:hover,
.settings-link-button:hover {
  background: color-mix(in srgb, var(--app-text) 6%, transparent);
  color: var(--app-text);
}

.settings-icon-button:disabled {
  opacity: 0.4;
}

.settings-error {
  margin: 5px 5px 0;
  color: #ff453a;
  font-size: 10.5px;
}

.privacy-card {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 11px;
  border: 0.5px solid color-mix(in srgb, var(--app-success) 18%, var(--app-border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--app-success) 6%, var(--app-fill));
}

.privacy-card__icon {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--app-success) 13%, transparent);
  color: var(--app-success);
}

.settings-footer {
  padding: 0 5px 3px;
  color: var(--app-tertiary);
  font-size: 10.5px;
  text-align: center;
}

.discard-overlay {
  position: fixed;
  inset: var(--app-titlebar-height) 0 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.discard-dialog {
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

.discard-dialog strong {
  color: var(--app-text);
  font-size: 14px;
}

.discard-dialog p {
  margin: 0;
  color: var(--app-secondary);
  font-size: 12px;
}

.discard-dialog > div {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
}

.is-spinning {
  animation: settings-spin 0.7s linear infinite;
}

.settings-enter-from,
.settings-leave-to {
  background: transparent;
  backdrop-filter: blur(0);
  -webkit-backdrop-filter: blur(0);
}

.settings-enter-from .settings-panel,
.settings-leave-to .settings-panel {
  transform: translateX(100%);
}

.settings-leave-active,
.settings-leave-active .settings-panel {
  transition-duration: 0.2s;
  transition-timing-function: ease-in;
}

@media (prefers-color-scheme: dark) {
  .settings-overlay {
    background: rgba(0, 0, 0, 0.46);
  }
}

@keyframes settings-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-panel {
    transition: none;
  }
}
</style>
