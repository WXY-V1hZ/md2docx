<script setup lang="ts">
import { Files, PanelRight, SquarePen } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import AppTitleBar from "./components/AppTitleBar.vue";
import BottomActionBar from "./components/BottomActionBar.vue";
import ConversionInspector from "./components/ConversionInspector.vue";
import ConversionFlight from "./components/ConversionFlight.vue";
import ConversionHistoryPopover from "./components/ConversionHistoryPopover.vue";
import FileDropZone from "./components/FileDropZone.vue";
import FileQueue from "./components/FileQueue.vue";
import MarkdownEditor from "./components/MarkdownEditor.vue";
import PandocStatusCard from "./components/PandocStatusCard.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import UpdateBanner from "./components/UpdateBanner.vue";
import { useAutoUpdate } from "./composables/useAutoUpdate";
import { useConversionManager } from "./composables/useConversionManager";
import type { ConversionWorkspaceSettings } from "./conversion-settings";

const showHistory = ref(false);

const {
  queue,
  history,
  flights,
  showPandocDialog,
  readyCount,
  isConverting,
  unreadCount,
  addFiles,
  removeFile,
  clearQueue,
  retryFile,
  startConversion,
  startEditorConversion,
  markHistoryRead,
  requeueRecord,
  removeRecord,
  clearHistory,
} = useConversionManager(showHistory);

const {
  update,
  visible: updateVisible,
  download: downloadUpdate,
  retry: retryUpdate,
  install: installUpdate,
  dismiss: dismissUpdate,
} = useAutoUpdate();

const dragOver = ref(false);
const showSettings = ref(false);
const settingsInitialSection = ref<"presets" | undefined>();
const conversionSettings = ref<ConversionWorkspaceSettings | null>(null);
const conversionSettingsValid = ref(false);
const inspectorCollapsed = ref(true);
const editorMode = ref(false);
const editorContent = ref("");
const editorName = ref("未命名");
const editorError = ref("");
const editorStarting = ref(false);

const editorHasContent = computed(() => editorContent.value.trim().length > 0);
const conversionBusy = computed(() => isConverting.value || editorStarting.value);

function toggleHistory() {
  showSettings.value = false;
  showHistory.value = !showHistory.value;
  if (showHistory.value) markHistoryRead();
}

function closeHistory() {
  showHistory.value = false;
}

function focusHistoryButton() {
  document.querySelector<HTMLElement>("[data-history-btn]")?.focus();
}

function openSettings(section?: "presets") {
  if (showSettings.value) {
    showSettings.value = false;
    return;
  }
  showHistory.value = false;
  settingsInitialSection.value = section;
  showSettings.value = true;
}

async function openFile(path: string) {
  try {
    await window.md2docx?.openFile(path);
  } catch {
    // 文件操作失败时保留记录，用户仍可尝试显示位置。
  }
}

async function showInFolder(path: string) {
  try {
    await window.md2docx?.showInFolder(path);
  } catch {
    // 文件操作失败时不关闭记录面板。
  }
}

async function selectFiles() {
  const paths = await window.md2docx?.selectFiles();
  if (paths && paths.length > 0) addFiles(paths);
}

async function handleConvert(options: { openAfterConvert: boolean }) {
  if (!conversionSettings.value || !conversionSettingsValid.value) return;
  if (editorMode.value) {
    if (!editorHasContent.value || conversionBusy.value) return;
    editorError.value = "";
    editorStarting.value = true;
    const result = await startEditorConversion(
      editorContent.value,
      editorName.value,
      conversionSettings.value,
      options.openAfterConvert,
    );
    editorStarting.value = false;
    editorError.value = result.error ?? "";
    return;
  }
  await startConversion(conversionSettings.value, options.openAfterConvert);
}

function updateConversionSettings(settings: ConversionWorkspaceSettings | null, valid: boolean) {
  conversionSettings.value = settings;
  conversionSettingsValid.value = valid;
}

function toggleInspector() {
  inspectorCollapsed.value = !inspectorCollapsed.value;
}

function toggleEditor() {
  if (conversionBusy.value) return;
  editorMode.value = !editorMode.value;
  editorError.value = "";
}

function handleRequeue(recordId: string) {
  if (!requeueRecord(recordId)) return;
  editorMode.value = false;
  closeHistory();
}

function onListDragOver(e: DragEvent) {
  e.preventDefault();
  dragOver.value = true;
}

function onListDragLeave(e: DragEvent) {
  const container = e.currentTarget;
  if (!(container instanceof HTMLElement)) return;
  if (e.relatedTarget instanceof Node && container.contains(e.relatedTarget)) return;
  dragOver.value = false;
}

function onListDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  const paths: string[] = [];
  for (const file of e.dataTransfer?.files ?? []) {
    if (!/\.(md|markdown)$/i.test(file.name)) continue;
    const path = window.md2docx?.getPathForFile(file) ?? "";
    if (path) paths.push(path);
  }
  addFiles(paths);
  if (paths.length > 0) editorMode.value = false;
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (
    event.ctrlKey &&
    event.altKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "b"
  ) {
    event.preventDefault();
    toggleInspector();
    return;
  }
  if (event.key !== "Escape" || !showHistory.value) return;
  closeHistory();
  focusHistoryButton();
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!showHistory.value || !(event.target instanceof Element)) return;
  if (event.target.closest("[data-history-btn], [data-history-surface]")) return;
  closeHistory();
}

onMounted(() => {
  document.addEventListener("keydown", onDocumentKeydown);
  document.addEventListener("pointerdown", onDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onDocumentKeydown);
  document.removeEventListener("pointerdown", onDocumentPointerDown);
});
</script>

<template>
  <div
    class="grid h-full w-full grid-rows-[var(--app-titlebar-height)_1fr_auto] overflow-hidden bg-app-bg font-sans text-app-text"
  >
    <AppTitleBar
      :unread-count="unreadCount"
      :history-expanded="showHistory"
      :settings-expanded="showSettings"
      @open-settings="openSettings"
      @toggle-history="toggleHistory"
    />

    <div class="flex min-h-0 flex-col">
      <Transition name="update-banner">
        <UpdateBanner
          v-if="updateVisible"
          :update="update"
          @download="downloadUpdate"
          @retry="retryUpdate"
          @install="installUpdate"
          @dismiss="dismissUpdate"
        />
      </Transition>

      <div class="workspace-shell flex min-h-0 flex-1">
        <button
          type="button"
          class="workspace-inspector-toggle"
          :title="`${inspectorCollapsed ? '显示' : '隐藏'}侧边栏  Ctrl+Alt+B`"
          :aria-label="`${inspectorCollapsed ? '显示' : '隐藏'}转换设置侧边栏`"
          :aria-pressed="!inspectorCollapsed"
          aria-controls="conversion-inspector"
          data-inspector-btn
          @click="toggleInspector"
        >
          <PanelRight :size="17" stroke-width="1.6" />
        </button>

        <main
          class="workspace flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-auto px-7 pt-14 pb-8"
          :class="{ 'justify-center': !editorMode && queue.length === 0 }"
          @dragover="onListDragOver"
          @dragleave="onListDragLeave"
          @drop="onListDrop"
        >
          <button
            type="button"
            class="workspace-editor-toggle"
            :class="{ 'workspace-editor-toggle--active': editorMode }"
            :disabled="conversionBusy"
            :title="editorMode ? '返回文件列表' : '粘贴 Markdown 文本'"
            :aria-label="editorMode ? '返回文件列表' : '打开 Markdown 文本编辑器'"
            :aria-pressed="editorMode"
            @click="toggleEditor"
          >
            <Files v-if="editorMode" :size="15" stroke-width="1.7" />
            <SquarePen v-else :size="15" stroke-width="1.7" />
          </button>

          <Transition name="popover">
            <div v-if="showHistory" class="history-anchor" data-history-surface>
              <ConversionHistoryPopover
                :records="history"
                @open-file="openFile"
                @show-in-folder="showInFolder"
                @requeue="handleRequeue"
                @remove-record="removeRecord"
                @clear="clearHistory"
              />
            </div>
          </Transition>

          <Transition name="fade-scale" mode="out-in">
            <MarkdownEditor
              v-if="editorMode"
              key="editor"
              v-model:content="editorContent"
              v-model:name="editorName"
              :disabled="conversionBusy"
              :error="editorError"
            />
            <FileDropZone v-else-if="queue.length === 0" key="empty" @files-added="addFiles" />
            <FileQueue
              v-else
              key="queue"
              :files="queue"
              :drag-over="dragOver"
              :is-converting="isConverting"
              @select-files="selectFiles"
              @clear="clearQueue"
              @remove="removeFile"
              @retry="retryFile"
            />
          </Transition>
        </main>

        <ConversionInspector
          v-model:collapsed="inspectorCollapsed"
          @change="updateConversionSettings"
          @manage-presets="openSettings('presets')"
        />
      </div>
    </div>

    <BottomActionBar
      :can-convert="conversionSettingsValid && (editorMode ? editorHasContent : readyCount > 0)"
      :file-count="editorMode ? (editorHasContent ? 1 : 0) : readyCount"
      :source-label="editorMode ? `${editorContent.length} 个字符` : undefined"
      :is-converting="conversionBusy"
      @convert="handleConvert"
    />

    <ConversionFlight :flights="flights" />

    <Transition name="settings">
      <SettingsPanel
        v-if="showSettings"
        :initial-section="settingsInitialSection"
        @close="showSettings = false"
      />
    </Transition>

    <Transition name="preset-dialog">
      <div
        v-if="showPandocDialog"
        class="pandoc-error-overlay"
        @mousedown.self="showPandocDialog = false"
      >
        <div
          class="pandoc-error-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="pandoc-error-title"
        >
          <strong id="pandoc-error-title">转换失败：未检测到 Pandoc</strong>
          <p>转换需要 Pandoc，请安装后重新检测。</p>
          <PandocStatusCard />
          <div>
            <button type="button" class="app-button" @click="showPandocDialog = false">
              我知道了
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition:
    opacity 0.16s ease-out,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.985);
}

.workspace {
  position: relative;
  background:
    radial-gradient(
      circle at 50% 28%,
      color-mix(in srgb, var(--app-accent) 4%, transparent),
      transparent 38%
    ),
    var(--app-bg);
}

.workspace-shell {
  position: relative;
}

.workspace-inspector-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 16;
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--app-secondary);
  cursor: default;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    opacity 0.2s ease;
}

.workspace-inspector-toggle:hover {
  background: color-mix(in srgb, var(--app-text) 5%, transparent);
  color: var(--app-text);
}

.workspace-inspector-toggle:active {
  background: color-mix(in srgb, var(--app-text) 10%, transparent);
}

.workspace-inspector-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--app-accent) 72%, transparent);
  outline-offset: 1px;
}

.workspace-editor-toggle {
  position: absolute;
  top: 12px;
  right: 44px;
  z-index: 15;
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--app-secondary);
  cursor: default;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.workspace-editor-toggle:hover {
  background: var(--app-fill);
  color: var(--app-text);
}

.workspace-editor-toggle--active {
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
  color: var(--app-accent);
}

.workspace-editor-toggle:active {
  background: color-mix(in srgb, var(--app-text) 10%, transparent);
}

.workspace-editor-toggle:disabled {
  opacity: 0.42;
}

.workspace-editor-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--app-accent) 72%, transparent);
  outline-offset: 1px;
}

.history-anchor {
  position: fixed;
  top: calc(var(--app-titlebar-height) + 10px);
  right: 12px;
  z-index: 25;
}

.popover-enter-active,
.popover-leave-active {
  transition:
    opacity 0.14s ease-out,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: top right;
}
.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(-4px);
}

.update-banner-enter-active,
.update-banner-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s ease;
}
.update-banner-enter-from,
.update-banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.pandoc-error-overlay {
  position: fixed;
  inset: var(--app-titlebar-height) 0 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.pandoc-error-dialog {
  display: flex;
  width: 320px;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 15px;
  background: var(--app-surface-raised);
  box-shadow: var(--app-shadow-floating);
  transition:
    opacity 0.18s ease-out,
    transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.pandoc-error-dialog strong {
  color: var(--app-text);
  font-size: 14px;
}

.pandoc-error-dialog p {
  margin: 0;
  color: var(--app-secondary);
  font-size: 12px;
}

.pandoc-error-dialog > div {
  display: flex;
  justify-content: flex-end;
}

.pandoc-error-dialog .app-button {
  display: inline-flex;
  height: 30px;
  align-items: center;
  padding: 0 14px;
  border: none;
  border-radius: 7px;
  background: color-mix(in srgb, var(--app-accent) 66%, transparent);
  color: #fff;
  font-size: 12.5px;
  font-weight: 550;
  cursor: default;
  transition: background 0.12s ease;
}

.pandoc-error-dialog .app-button:hover {
  background: var(--app-accent);
}

/* === Overlay enter/leave (matches SettingsPanel) === */
.preset-dialog-enter-from,
.preset-dialog-leave-to {
  background: transparent;
  backdrop-filter: blur(0);
  -webkit-backdrop-filter: blur(0);
}

.preset-dialog-enter-active {
  animation: pandoc-overlay-in 0.32s ease-out forwards;
}
.preset-dialog-leave-active {
  animation: pandoc-overlay-out 0.2s ease-in forwards;
}

@keyframes pandoc-overlay-in {
  from {
    background: transparent;
    backdrop-filter: blur(0);
    -webkit-backdrop-filter: blur(0);
  }
}
@keyframes pandoc-overlay-out {
  to {
    background: transparent;
    backdrop-filter: blur(0);
    -webkit-backdrop-filter: blur(0);
  }
}

/* === Dialog enter: slide up + scale === */
.preset-dialog-enter-from .pandoc-error-dialog {
  opacity: 0;
  transform: translateY(14px) scale(0.965);
}
.preset-dialog-enter-active .pandoc-error-dialog {
  animation: pandoc-dialog-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes pandoc-dialog-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.965);
  }
}

/* === Dialog leave: fade + shrink === */
.preset-dialog-leave-to .pandoc-error-dialog {
  opacity: 0;
  transform: translateY(10px) scale(0.975);
}
.preset-dialog-leave-active .pandoc-error-dialog {
  animation: pandoc-dialog-out 0.2s ease-in forwards;
}
@keyframes pandoc-dialog-out {
  to {
    opacity: 0;
    transform: translateY(10px) scale(0.975);
  }
}

@media (prefers-color-scheme: dark) {
  .pandoc-error-overlay {
    background: rgba(0, 0, 0, 0.46);
  }
}

@media (prefers-reduced-motion: reduce) {
  .preset-dialog-enter-active,
  .preset-dialog-leave-active,
  .preset-dialog-enter-active .pandoc-error-dialog,
  .preset-dialog-leave-active .pandoc-error-dialog {
    animation: none !important;
  }
}
</style>
