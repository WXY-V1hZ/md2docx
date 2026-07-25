<script setup lang="ts">
import { PanelRight } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

import AppTitleBar from "./components/AppTitleBar.vue";
import BottomActionBar from "./components/BottomActionBar.vue";
import ConversionInspector from "./components/ConversionInspector.vue";
import ConversionFlight from "./components/ConversionFlight.vue";
import ConversionHistoryPopover from "./components/ConversionHistoryPopover.vue";
import FileDropZone from "./components/FileDropZone.vue";
import FileQueue from "./components/FileQueue.vue";
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
  readyCount,
  isConverting,
  unreadCount,
  addFiles,
  removeFile,
  clearQueue,
  retryFile,
  startConversion,
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
  await startConversion(conversionSettings.value, options.openAfterConvert);
}

function updateConversionSettings(settings: ConversionWorkspaceSettings | null, valid: boolean) {
  conversionSettings.value = settings;
  conversionSettingsValid.value = valid;
}

function toggleInspector() {
  inspectorCollapsed.value = !inspectorCollapsed.value;
}

function handleRequeue(recordId: string) {
  if (!requeueRecord(recordId)) return;
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
          class="workspace flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-auto px-7 py-8"
          :class="{ 'justify-center': queue.length === 0 }"
          @dragover="onListDragOver"
          @dragleave="onListDragLeave"
          @drop="onListDrop"
        >
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
            <FileDropZone v-if="queue.length === 0" key="empty" @files-added="addFiles" />
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
      :can-convert="readyCount > 0 && conversionSettingsValid"
      :file-count="readyCount"
      :is-converting="isConverting"
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
</style>
