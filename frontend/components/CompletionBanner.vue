<script setup lang="ts">
import { Check, FolderOpen, X } from "lucide-vue-next";
import { onBeforeUnmount, watch } from "vue";

const props = defineProps<{
  count: number;
  lastOutputPath: string | null;
}>();

const emit = defineEmits<{
  dismiss: [];
  reveal: [path: string];
}>();

let timer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.count,
  () => {
    clearTimeout(timer);
    timer = setTimeout(() => emit("dismiss"), 4000);
  },
  { immediate: true },
);

onBeforeUnmount(() => clearTimeout(timer));

function revealOutput() {
  if (props.lastOutputPath) emit("reveal", props.lastOutputPath);
  emit("dismiss");
}
</script>

<template>
  <div class="banner-wrap" role="status" aria-live="polite">
    <div class="banner">
      <span class="banner__icon" aria-hidden="true">
        <Check :size="14" stroke-width="2.8" />
      </span>
      <span class="banner__text">已转换 {{ count }} 个文件</span>
      <div class="banner__actions">
        <button
          type="button"
          class="banner__action"
          :disabled="!lastOutputPath"
          @click="revealOutput"
        >
          <FolderOpen :size="13" stroke-width="1.8" />
          显示位置
        </button>
        <button
          type="button"
          class="banner__close"
          aria-label="关闭完成提示"
          @click="emit('dismiss')"
        >
          <X :size="13" stroke-width="1.8" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner-wrap {
  position: absolute;
  top: 0;
  left: 50%;
  z-index: 15;
  max-width: calc(100% - 32px);
  transform: translateX(-50%) translateY(16px);
}

.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px 8px 12px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 12px;
  background: color-mix(in srgb, var(--app-surface-raised) 92%, transparent);
  box-shadow: var(--app-shadow-floating);
  backdrop-filter: blur(24px) saturate(1.35);
  -webkit-backdrop-filter: blur(24px) saturate(1.35);
  white-space: nowrap;
}

.completion-banner-enter-active,
.completion-banner-leave-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
}

.completion-banner-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px) scale(0.97);
}

.completion-banner-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px) scale(0.98);
}

.completion-banner-leave-active {
  transition-duration: 0.16s;
  transition-timing-function: ease-in;
}

.banner__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--app-success);
  color: #ffffff;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--app-success) 30%, transparent);
}

.banner__text {
  color: var(--app-text);
  font-size: 13px;
  font-weight: 550;
}

.banner__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
}

.banner__action,
.banner__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: default;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.banner__action {
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--app-accent);
  font-size: 12px;
  font-weight: 500;
}

.banner__action:hover {
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
}

.banner__action:disabled {
  opacity: 0.45;
  pointer-events: none;
}

.banner__close {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  color: var(--app-tertiary);
}

.banner__close:hover {
  background: var(--app-fill);
  color: var(--app-text);
}
</style>
