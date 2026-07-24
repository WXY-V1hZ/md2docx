<script setup lang="ts">
import { CircleAlert, FileCheck2, FileQuestion, FolderOpen, RefreshCw, X } from "lucide-vue-next";
import { computed } from "vue";

import type { HistoryRecord } from "../composables/useConversionManager";

const props = defineProps<{
  record: HistoryRecord;
}>();

const emit = defineEmits<{
  openFile: [path: string];
  showInFolder: [path: string];
  regenerate: [id: string];
  remove: [id: string];
}>();

const displayName = computed(() => {
  const path = props.record.outputPath;
  if (!path) return props.record.sourceName;
  return path.split(/[/\\]/).pop() ?? props.record.sourceName;
});

const sourceFolder = computed(() => {
  const parts = props.record.sourcePath.split(/[/\\]/).filter(Boolean);
  return parts.slice(Math.max(0, parts.length - 3), -1).join(" / ");
});

const statusText = computed(() => {
  if (props.record.status === "converting") return "正在转换";
  if (props.record.status === "missing") return "源文件不存在";
  if (props.record.status === "error") return props.record.error || "转换失败";
  return formatRelativeTime(props.record.completedAt);
});

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return props.record.preset;
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "刚刚";
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} 小时前`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7 ? `${elapsedDays} 天前` : new Date(timestamp).toLocaleDateString();
}
</script>

<template>
  <article class="item" :class="`item--${record.status}`">
    <span class="item__icon" aria-hidden="true">
      <FileCheck2 v-if="record.status === 'success'" :size="17" stroke-width="1.8" />
      <span v-else-if="record.status === 'converting'" class="item__spinner" />
      <FileQuestion v-else-if="record.status === 'missing'" :size="17" stroke-width="1.7" />
      <CircleAlert v-else :size="17" stroke-width="1.8" />
    </span>

    <div class="item__info">
      <button
        v-if="record.outputPath"
        type="button"
        class="item__name item__name--button"
        :title="record.outputPath"
        @click="emit('openFile', record.outputPath)"
      >
        {{ displayName }}
      </button>
      <span v-else class="item__name" :title="record.sourcePath">{{ displayName }}</span>
      <span class="item__meta" :title="record.error || record.sourcePath">
        {{ sourceFolder ? `${sourceFolder} · ` : "" }}{{ statusText }}
      </span>
    </div>

    <div class="item__actions">
      <button
        v-if="record.outputPath"
        type="button"
        class="item__button"
        title="显示位置"
        aria-label="显示文件位置"
        @click="emit('showInFolder', record.outputPath)"
      >
        <FolderOpen :size="14" stroke-width="1.8" />
      </button>
      <button
        v-if="record.status !== 'converting' && record.status !== 'missing'"
        type="button"
        class="item__button"
        title="使用最新源文件重新生成"
        aria-label="重新生成"
        @click="emit('regenerate', record.id)"
      >
        <RefreshCw :size="14" stroke-width="1.8" />
      </button>
      <button
        v-if="record.status !== 'converting'"
        type="button"
        class="item__button item__button--remove"
        title="删除记录"
        aria-label="删除记录"
        @click="emit('remove', record.id)"
      >
        <X :size="13" stroke-width="1.8" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.item {
  display: flex;
  min-height: 58px;
  align-items: center;
  gap: 10px;
  padding: 9px 10px 9px 12px;
  transition: background 0.12s ease;
}

.item:hover,
.item:focus-within {
  background: var(--app-fill);
}

.item + .item {
  border-top: 0.5px solid var(--app-border);
}

.item__icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--app-success) 10%, transparent);
  color: var(--app-success);
}

.item--converting .item__icon {
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
  color: var(--app-accent);
}

.item--error .item__icon {
  background: color-mix(in srgb, #ff3b30 10%, transparent);
  color: #ff3b30;
}

.item--missing .item__icon {
  background: var(--app-fill);
  color: var(--app-tertiary);
}

.item__spinner {
  width: 15px;
  height: 15px;
  border: 1.5px solid color-mix(in srgb, var(--app-accent) 22%, transparent);
  border-top-color: var(--app-accent);
  border-radius: 50%;
  animation: history-spin 0.7s linear infinite;
}

.item__info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.item__name {
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--app-text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item__name--button:hover {
  color: var(--app-accent);
}

.item__meta {
  overflow: hidden;
  color: var(--app-tertiary);
  font-size: 10.5px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item--error .item__meta {
  color: #ff453a;
}

.item__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
}

.item__button {
  display: inline-flex;
  width: 26px;
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
    color 0.12s ease,
    opacity 0.12s ease;
}

.item__button:hover {
  background: color-mix(in srgb, var(--app-text) 6%, transparent);
  color: var(--app-text);
}

.item__button--remove {
  opacity: 0;
}

.item:hover .item__button--remove,
.item:focus-within .item__button--remove {
  opacity: 1;
}

@keyframes history-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
