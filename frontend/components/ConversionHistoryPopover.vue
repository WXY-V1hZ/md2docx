<script setup lang="ts">
import { computed } from "vue";

import ConversionHistoryItem from "./ConversionHistoryItem.vue";
import type { HistoryRecord } from "../composables/useConversionManager";

const props = defineProps<{
  records: HistoryRecord[];
}>();

const emit = defineEmits<{
  openFile: [path: string];
  showInFolder: [path: string];
  regenerate: [id: string];
  removeRecord: [id: string];
  clear: [];
}>();

const canClear = computed(() => props.records.some(({ status }) => status !== "converting"));
</script>

<template>
  <section id="conversion-history" class="popover" role="region" aria-label="转换记录">
    <header class="popover__header">
      <h2 class="popover__title">转换记录</h2>
      <button v-if="canClear" type="button" class="popover__clear" @click="emit('clear')">
        清除
      </button>
    </header>

    <div v-if="records.length === 0" class="popover__empty">
      <span>暂无记录</span>
      <span class="popover__empty-hint">转换完成的文件会显示在这里</span>
    </div>

    <TransitionGroup v-else name="history-item" tag="div" class="popover__list">
      <ConversionHistoryItem
        v-for="record in records"
        :key="record.id"
        :record="record"
        @open-file="emit('openFile', $event)"
        @show-in-folder="emit('showInFolder', $event)"
        @regenerate="emit('regenerate', $event)"
        @remove="emit('removeRecord', $event)"
      />
    </TransitionGroup>
  </section>
</template>

<style scoped>
.popover {
  display: flex;
  width: 360px;
  max-width: calc(100vw - 24px);
  max-height: min(430px, calc(100vh - 132px));
  flex-direction: column;
  overflow: hidden;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 14px;
  background: color-mix(in srgb, var(--app-surface-raised) 94%, transparent);
  box-shadow: var(--app-shadow-floating);
  backdrop-filter: blur(28px) saturate(1.25);
  -webkit-backdrop-filter: blur(28px) saturate(1.25);
}

.popover__header {
  display: flex;
  min-height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px 7px 14px;
  border-bottom: 0.5px solid var(--app-border);
}

.popover__title {
  margin: 0;
  color: var(--app-text);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.popover__clear {
  padding: 4px 7px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-secondary);
  font-size: 11px;
  cursor: default;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.popover__clear:hover {
  background: color-mix(in srgb, #ff3b30 9%, transparent);
  color: #ff3b30;
}

.popover__empty {
  display: flex;
  min-height: 116px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 3px;
  color: var(--app-secondary);
  font-size: 13px;
}

.popover__empty small,
.popover__empty-hint {
  color: var(--app-tertiary);
  font-size: 11px;
}

.popover__list {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.history-item-enter-active,
.history-item-move {
  transition:
    opacity 0.14s ease-out,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.history-item-leave-active {
  position: absolute;
  transition:
    opacity 0.14s ease-out,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.history-item-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.history-item-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
</style>
