<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ChevronDown, ArrowRight } from "lucide-vue-next";

defineProps<{
  canConvert: boolean;
}>();

const emit = defineEmits<{
  convert: [];
}>();

const autoOpen = ref(true);
const presets = ref<{ name: string; current: boolean }[]>([{ name: "default", current: true }]);
const currentPreset = ref("default");

onMounted(async () => {
  try {
    if (window.md2docx?.getPresets) {
      const list = await window.md2docx.getPresets();
      if (list && list.length > 0) {
        presets.value = list;
        const active = list.find((p: { current: boolean }) => p.current);
        if (active) currentPreset.value = active.name;
      }
    }
  } catch {
    // IPC not available, use defaults
  }
});
</script>

<template>
  <div class="action-bar">
    <div class="action-bar__left">
      <div class="app-select">
        <span>{{ currentPreset }}</span>
        <ChevronDown :size="14" stroke-width="1.5" />
      </div>
    </div>

    <div class="action-bar__center">
      <label class="app-toggle">
        <div
          class="app-toggle__track"
          :class="{ 'app-toggle__track--on': autoOpen }"
          @click="autoOpen = !autoOpen"
        >
          <div class="app-toggle__thumb" />
        </div>
        <span class="app-toggle__label">转换后打开</span>
      </label>
    </div>

    <div class="action-bar__right">
      <button
        type="button"
        class="app-button app-button--primary action-bar__convert"
        :disabled="!canConvert"
        @click="emit('convert')"
      >
        转换
        <ArrowRight :size="16" stroke-width="2" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--app-surface);
  border-top: 0.5px solid var(--app-border);
  gap: 16px;
}

.action-bar__left {
  flex: 1;
  display: flex;
  align-items: center;
}

.action-bar__center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-bar__right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.action-bar__convert {
  padding: 0 20px;
  height: 34px;
  font-size: 13px;
  font-weight: 600;
  gap: 6px;
}
</style>
