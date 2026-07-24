<script setup lang="ts">
import { Plus } from "lucide-vue-next";

import { type FileEntry } from "../file-entry";

defineProps<{
  files: FileEntry[];
  dragOver: boolean;
  isConverting: boolean;
}>();

const emit = defineEmits<{
  selectFiles: [];
  clear: [];
  remove: [index: number];
  retry: [index: number];
}>();
</script>

<template>
  <div class="file-list" :class="{ 'file-list--drag': dragOver }">
    <div class="file-list__header">
      <h2 class="file-list__title">
        转换队列
        <span class="file-list__count">{{ files.length }}</span>
      </h2>
      <div class="file-list__actions">
        <button type="button" class="app-button app-button--secondary" @click="emit('selectFiles')">
          <Plus :size="14" stroke-width="2" />
          添加
        </button>
        <button
          type="button"
          class="app-button app-button--secondary"
          :disabled="isConverting"
          @click="emit('clear')"
        >
          清除
        </button>
      </div>
    </div>

    <div class="file-list__items app-card">
      <TransitionGroup name="list-item" tag="div">
        <div
          v-for="(file, index) in files"
          :key="file.path"
          class="file-item"
          :class="`file-item--${file.status}`"
        >
          <div class="file-item__info">
            <span class="file-item__name">{{ file.name }}</span>
            <span class="file-item__path">{{ file.path }}</span>
            <span v-if="file.status === 'done' && file.outputPath" class="file-item__output">
              输出：{{ file.outputPath }}
            </span>
            <span v-if="file.status === 'error' && file.error" class="file-item__errormsg">
              {{ file.error }}
            </span>
          </div>

          <div class="file-item__status">
            <button
              v-if="file.status === 'idle'"
              type="button"
              class="file-item__remove"
              aria-label="移除此文件"
              @click="emit('remove', index)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                />
              </svg>
            </button>

            <template v-else-if="file.status === 'converting'">
              <span class="file-item__badge file-item__badge--active">转换中</span>
              <div class="file-item__spinner" aria-hidden="true" />
            </template>

            <template v-else>
              <button
                type="button"
                class="file-item__remove"
                aria-label="重试"
                @click="emit('retry', index)"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M2 7a5 5 0 0 1 9.23-2.86M12 7a5 5 0 0 1-9.23 2.86"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                  <path
                    d="M12 2v3H9M2 12V9h3"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <span class="file-item__badge file-item__badge--error">失败</span>
              <button
                type="button"
                class="file-item__remove"
                aria-label="移除此文件"
                @click="emit('remove', index)"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <p class="file-list__tip">可继续拖入 .md 或 .markdown 文件</p>
  </div>
</template>

<style scoped>
.list-item-enter-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
.list-item-leave-active {
  transition:
    opacity 0.14s ease-in,
    transform 0.2s ease-in;
}
.list-item-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
}
.list-item-leave-to {
  opacity: 0;
  transform: translateX(10px) scale(0.985);
}
.list-item-move {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.file-list {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: opacity 0.18s ease;
}
.file-list--drag {
  opacity: 1;
}
.file-list--drag .file-list__items {
  box-shadow:
    var(--app-shadow-card),
    0 0 0 3px color-mix(in srgb, var(--app-accent) 14%, transparent);
  transform: translateY(-1px) scale(0.997);
}
.file-list--drag .file-list__tip {
  color: var(--app-accent);
}
.file-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.file-list__title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family:
    -apple-system, "SF Pro Display", "Segoe UI Variable Display", "Microsoft YaHei UI",
    "PingFang SC", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--app-text);
}
.file-list__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--app-border);
  font-size: 11px;
  font-weight: 600;
  color: var(--app-secondary);
  line-height: 1;
}
.file-list__actions,
.file-item__status {
  display: flex;
  align-items: center;
}
.file-list__actions {
  gap: 6px;
}
.file-list__items {
  overflow: hidden;
  border: 0.5px solid var(--app-border);
  transition:
    box-shadow 0.2s ease,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.file-list__tip {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--app-tertiary);
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
  padding: 11px 14px;
  gap: 12px;
  transition: background 0.12s ease;
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
.file-item--converting {
  pointer-events: none;
}
.file-item__info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.file-item__name,
.file-item__path,
.file-item__output,
.file-item__errormsg {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-item__name {
  font-size: 13px;
  font-weight: 550;
  color: var(--app-text);
}
.file-item__path {
  color: var(--app-tertiary);
}
.file-item__path,
.file-item__errormsg {
  font-size: 11px;
}
.file-item__errormsg {
  color: #ff3b30;
}
.file-item__status {
  flex-shrink: 0;
  gap: 6px;
}
.file-item__badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
}
.file-item__badge--active {
  background: rgba(52, 120, 246, 0.12);
  color: #3478f6;
}
.file-item__badge--error {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
}
.file-item__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(52, 120, 246, 0.2);
  border-top-color: #3478f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
:deep(.app-icon-button),
.file-item__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-secondary);
  cursor: default;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
:deep(.app-icon-button:hover),
.file-item__remove:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--app-text);
}
@media (prefers-color-scheme: dark) {
  :deep(.app-icon-button:hover),
  .file-item__remove:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}
</style>
