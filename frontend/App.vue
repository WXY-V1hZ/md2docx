<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import AppTitleBar from "./components/AppTitleBar.vue";
import BottomActionBar from "./components/BottomActionBar.vue";
import FileDropZone from "./components/FileDropZone.vue";
import FileQueue from "./components/FileQueue.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { type FileEntry } from "./file-entry";

const files = ref<FileEntry[]>([]);
const dragOver = ref(false);
const showSettings = ref(false);

const readyCount = computed(() => files.value.filter((file) => file.status === "idle").length);
const isConverting = computed(() => files.value.some((file) => file.status === "converting"));

let cleanupDone: (() => void) | undefined;
let cleanupError: (() => void) | undefined;

onMounted(() => {
  cleanupDone = window.md2docx?.onFileDone((data) => {
    const file = files.value.find((entry) => entry.path === data.path);
    if (!file) return;
    file.status = "done";
    file.outputPath = data.outputPath;
    file.error = undefined;
  });

  cleanupError = window.md2docx?.onFileError((data) => {
    const file = files.value.find((entry) => entry.path === data.path);
    if (!file) return;
    file.status = "error";
    file.error = data.error;
    file.outputPath = undefined;
  });
});

onBeforeUnmount(() => {
  cleanupDone?.();
  cleanupError?.();
});

function addFiles(paths: string[]) {
  const existing = new Set(files.value.map((file) => file.path));
  for (const path of paths) {
    if (existing.has(path)) continue;
    const name = path.split(/[/\\]/).pop() ?? path;
    files.value.push({ path, name, status: "idle" });
    existing.add(path);
  }
}

function removeFile(index: number) {
  files.value.splice(index, 1);
}

function retryFile(index: number) {
  const file = files.value[index];
  if (!file) return;
  file.status = "idle";
  file.error = undefined;
  file.outputPath = undefined;
}

async function selectFiles() {
  const paths = await window.md2docx?.selectFiles();
  if (paths && paths.length > 0) addFiles(paths);
}

async function handleConvert(options: { preset: string; openAfterConvert: boolean }) {
  const idle = files.value.filter((file) => file.status === "idle");
  if (idle.length === 0) return;

  for (const file of idle) {
    file.status = "converting";
    file.error = undefined;
  }

  try {
    if (!window.md2docx?.convert) throw new Error("桌面转换服务不可用");
    await window.md2docx.convert({
      files: idle.map((file) => file.path),
      preset: options.preset,
      openAfterConvert: options.openAfterConvert,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const file of idle) {
      if (file.status !== "converting") continue;
      file.status = "error";
      file.error = message;
    }
  }
}

async function openFile(path: string) {
  await window.md2docx?.openFile(path);
}

async function showInFolder(path: string) {
  await window.md2docx?.showInFolder(path);
}

function onListDragOver(event: DragEvent) {
  event.preventDefault();
  dragOver.value = true;
}

function onListDragLeave(event: DragEvent) {
  const container = event.currentTarget;
  if (!(container instanceof HTMLElement)) return;
  if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
  dragOver.value = false;
}

function onListDrop(event: DragEvent) {
  event.preventDefault();
  dragOver.value = false;

  const paths: string[] = [];
  for (const file of event.dataTransfer?.files ?? []) {
    if (!/\.(md|markdown)$/i.test(file.name)) continue;
    const path = window.md2docx?.getPathForFile(file) ?? "";
    if (path) paths.push(path);
  }
  addFiles(paths);
}
</script>

<template>
  <div
    class="grid h-full w-full grid-rows-[var(--app-titlebar-height)_1fr_auto] overflow-hidden bg-app-bg font-sans text-app-text"
  >
    <AppTitleBar @open-settings="showSettings = true" />

    <main
      class="flex min-h-0 flex-col items-center overflow-auto px-8 py-10"
      :class="{ 'justify-center': files.length === 0 }"
      @dragover="onListDragOver"
      @dragleave="onListDragLeave"
      @drop="onListDrop"
    >
      <Transition name="fade-scale" mode="out-in">
        <FileDropZone v-if="files.length === 0" key="empty" @files-added="addFiles" />
        <FileQueue
          v-else
          key="queue"
          :files="files"
          :drag-over="dragOver"
          :is-converting="isConverting"
          @select-files="selectFiles"
          @clear="files = []"
          @remove="removeFile"
          @retry="retryFile"
          @open-file="openFile"
          @show-in-folder="showInFolder"
        />
      </Transition>
    </main>

    <BottomActionBar
      :can-convert="readyCount > 0"
      :file-count="readyCount"
      :is-converting="isConverting"
      @convert="handleConvert"
    />

    <Transition name="panel-slide">
      <SettingsPanel v-if="showSettings" @close="showSettings = false" />
    </Transition>
  </div>
</template>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: transform 0.25s ease;
}
.panel-slide-enter-from,
.panel-slide-leave-to {
  transform: translateX(100%);
}
</style>
