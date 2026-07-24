<script setup lang="ts">
import { ref } from "vue";
import AppTitleBar from "./components/AppTitleBar.vue";
import FileDropZone from "./components/FileDropZone.vue";
import BottomActionBar from "./components/BottomActionBar.vue";

interface FileEntry {
  path: string;
  name: string;
  status: "idle" | "converting" | "done" | "error";
  error?: string;
}

const files = ref<FileEntry[]>([]);

function addFiles(paths: string[]) {
  const existing = new Set(files.value.map((f) => f.path));
  for (const p of paths) {
    if (!existing.has(p)) {
      const name = p.split(/[/\\]/).pop() ?? p;
      files.value.push({ path: p, name, status: "idle" });
      existing.add(p);
    }
  }
}

function removeFile(index: number) {
  files.value.splice(index, 1);
}

function handleConvert() {
  // 后续实现转换逻辑
  console.log("convert", files.value);
}

function openSettings() {
  // 后续实现设置面板
  console.log("open settings");
}
</script>

<template>
  <div
    class="grid h-full w-full grid-rows-[var(--app-titlebar-height)_1fr_auto] overflow-hidden bg-app-bg font-sans text-app-text"
  >
    <AppTitleBar @open-settings="openSettings" />

    <main
      class="flex min-h-0 flex-col items-center overflow-auto p-8"
      :class="{ 'justify-center': files.length === 0 }"
    >
      <FileDropZone v-if="files.length === 0" @files-added="addFiles" />

      <div v-else class="file-list">
        <div class="file-list__header">
          <h2 class="file-list__title">文件</h2>
          <button class="app-button app-button--secondary" @click="files = []">清除</button>
        </div>

        <div class="file-list__items app-card">
          <div
            v-for="(file, index) in files"
            :key="file.path"
            class="file-item"
            :class="{ 'file-item--done': file.status === 'done' }"
          >
            <div class="file-item__info">
              <span class="file-item__name">{{ file.name }}</span>
              <span class="file-item__path">{{ file.path }}</span>
            </div>
            <div class="file-item__status">
              <span v-if="file.status === 'idle'" class="file-item__badge file-item__badge--idle"
                >待转换</span
              >
              <span
                v-if="file.status === 'converting'"
                class="file-item__badge file-item__badge--active"
                >转换中</span
              >
              <span v-if="file.status === 'done'" class="file-item__badge file-item__badge--done"
                >已完成</span
              >
              <span
                v-if="file.status === 'error'"
                class="file-item__badge file-item__badge--error"
                :title="file.error"
                >失败</span
              >
              <button class="file-item__remove" @click="removeFile(index)" title="移除">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <BottomActionBar :can-convert="files.length > 0" @convert="handleConvert" />
  </div>
</template>

<style scoped>
.file-list {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.file-list__title {
  margin: 0;
  font-family:
    -apple-system, "SF Pro Display", "Segoe UI Variable Display", "Microsoft YaHei UI",
    "PingFang SC", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--app-text);
}

.file-list__items {
  overflow: hidden;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  gap: 12px;
  transition: background 0.15s ease;
}

.file-item + .file-item {
  border-top: 0.5px solid var(--app-border);
}

.file-item:hover {
  background: rgba(0, 0, 0, 0.02);
}

@media (prefers-color-scheme: dark) {
  .file-item:hover {
    background: rgba(255, 255, 255, 0.03);
  }
}

.file-item__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.file-item__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item__path {
  font-size: 11px;
  color: var(--app-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item__status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.file-item__badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
}

.file-item__badge--idle {
  background: rgba(0, 0, 0, 0.05);
  color: var(--app-secondary);
}

@media (prefers-color-scheme: dark) {
  .file-item__badge--idle {
    background: rgba(255, 255, 255, 0.08);
  }
}

.file-item__badge--active {
  background: rgba(52, 120, 246, 0.12);
  color: #3478f6;
}

.file-item__badge--done {
  background: rgba(52, 199, 89, 0.12);
  color: #34c759;
}

.file-item__badge--error {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
}

.file-item__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--app-tertiary);
  cursor: default;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.file-item__remove:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--app-text);
}

@media (prefers-color-scheme: dark) {
  .file-item__remove:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}
</style>
