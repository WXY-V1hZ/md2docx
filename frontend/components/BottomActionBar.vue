<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{
  canConvert: boolean;
  fileCount: number;
  isConverting: boolean;
}>();

const emit = defineEmits<{
  convert: [options: { openAfterConvert: boolean }];
}>();

const autoOpen = ref(false);

function startConversion() {
  emit("convert", { openAfterConvert: autoOpen.value });
}

function onKeydown(event: KeyboardEvent) {
  if (
    event.key === "Enter" &&
    (event.metaKey || event.ctrlKey) &&
    props.canConvert &&
    !props.isConverting
  ) {
    event.preventDefault();
    startConversion();
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="action-bar">
    <div class="action-bar__info">
      <span v-if="fileCount > 0" class="action-bar__count">{{ fileCount }} 个文件</span>
      <span v-else class="action-bar__count action-bar__count--empty">无文件</span>
      <span v-if="isConverting" class="action-bar__status">转换中…</span>
    </div>

    <div class="action-bar__actions">
      <label class="app-toggle action-bar__toggle">
        <span class="app-toggle__label">转换后打开</span>
        <input v-model="autoOpen" type="checkbox" class="app-toggle__input" />
        <span class="app-toggle__track" :class="{ 'app-toggle__track--on': autoOpen }">
          <span class="app-toggle__thumb" />
        </span>
      </label>

      <button
        type="button"
        class="app-button app-button--primary action-bar__convert"
        :disabled="!canConvert || isConverting"
        title="转换所选文件（Ctrl/⌘ + Enter）"
        @click="startConversion"
      >
        <template v-if="isConverting">
          转换中…
          <span class="action-bar__spinner" />
        </template>
        <template v-else>
          <span>{{ fileCount > 1 ? `转换 ${fileCount} 个文件` : "转换" }}</span>
          <ArrowRight v-if="fileCount > 0" :size="16" stroke-width="2" />
        </template>
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 18px;
  border-top: 0.5px solid var(--app-border);
  background: color-mix(in srgb, var(--app-surface) 92%, transparent);
  backdrop-filter: blur(24px) saturate(1.3);
  -webkit-backdrop-filter: blur(24px) saturate(1.3);
}
.action-bar__info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.action-bar__count {
  font-size: 12px;
  font-weight: 550;
  color: var(--app-secondary);
  letter-spacing: -0.005em;
}
.action-bar__count--empty {
  color: var(--app-tertiary);
  font-weight: 450;
}
.action-bar__status {
  font-size: 11px;
  color: var(--app-accent);
  font-weight: 500;
}
.action-bar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.action-bar__toggle {
  flex-direction: row-reverse;
  gap: 7px;
}
.action-bar__convert {
  min-width: 92px;
  height: 32px;
  gap: 6px;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 600;
}
.action-bar__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: action-spin 0.6s linear infinite;
}
@keyframes action-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
