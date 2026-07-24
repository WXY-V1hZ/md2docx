<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import AppTitleBar from "./components/AppTitleBar.vue";
import BottomActionBar from "./components/BottomActionBar.vue";
import ConversionFlight from "./components/ConversionFlight.vue";
import ConversionHistoryPopover from "./components/ConversionHistoryPopover.vue";
import FileDropZone from "./components/FileDropZone.vue";
import FileQueue from "./components/FileQueue.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { useConversionManager } from "./composables/useConversionManager";

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
  regenerateRecord,
  removeRecord,
  clearHistory,
} = useConversionManager(showHistory);

const dragOver = ref(false);
const showSettings = ref(false);
const settingsInitialSection = ref<"presets" | undefined>();

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
  if (showSettings.value) { showSettings.value = false; return; }
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

async function handleConvert(options: { preset: string; openAfterConvert: boolean }) {
  await startConversion(options.preset, options.openAfterConvert);
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

    <main
      class="workspace flex min-h-0 flex-col items-center overflow-auto px-8 py-10"
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
            @regenerate="regenerateRecord"
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

    <BottomActionBar
      :can-convert="readyCount > 0"
      :file-count="readyCount"
      :is-converting="isConverting"
      @convert="handleConvert"
      @manage-presets="openSettings('presets')"
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
</style>
