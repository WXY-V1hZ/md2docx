<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { ChevronDown, ArrowRight, Check } from "lucide-vue-next";

const props = defineProps<{
  canConvert: boolean;
  fileCount: number;
  isConverting: boolean;
}>();

const emit = defineEmits<{
  convert: [options: { preset: string; openAfterConvert: boolean }];
}>();

const autoOpen = ref(true);
const presets = ref<{ name: string; current: boolean }[]>([{ name: "default", current: true }]);
const currentPreset = ref("default");
const menuOpen = ref(false);

onMounted(async () => {
  try {
    if (window.md2docx?.getPresets) {
      const list = await window.md2docx.getPresets();
      if (list && list.length > 0) {
        presets.value = list;
        const active = list.find((p) => p.current);
        if (active) currentPreset.value = active.name;
      }
    }
  } catch {
    // IPC not available
  }
});

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

function selectPreset(name: string) {
  currentPreset.value = name;
  menuOpen.value = false;
}

function startConversion() {
  emit("convert", {
    preset: currentPreset.value,
    openAfterConvert: autoOpen.value,
  });
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".app-dropdown")) {
    menuOpen.value = false;
  }
}

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
});

// 挂载后注册全局点击监听
onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});
</script>

<template>
  <div class="action-bar">
    <div class="action-bar__left">
      <div class="app-dropdown">
        <button
          type="button"
          class="app-dropdown__trigger"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click.stop="toggleMenu"
        >
          <span>{{ currentPreset }}</span>
          <ChevronDown
            :size="14"
            stroke-width="1.5"
            class="dropdown-chevron"
            :class="{ 'dropdown-chevron--open': menuOpen }"
          />
        </button>
        <div
          class="app-dropdown__menu"
          :class="{ 'app-dropdown__menu--open': menuOpen }"
          role="menu"
        >
          <button
            v-for="p in presets"
            :key="p.name"
            type="button"
            class="app-dropdown__item"
            :class="{ 'app-dropdown__item--active': p.name === currentPreset }"
            role="menuitemradio"
            :aria-checked="p.name === currentPreset"
            @click="selectPreset(p.name)"
          >
            <Check v-if="p.name === currentPreset" :size="14" stroke-width="2" />
            <span v-else style="width: 14px" />
            {{ p.name }}
          </button>
          <div class="app-dropdown__divider" />
          <button type="button" class="app-dropdown__item app-dropdown__item--disabled" disabled>
            管理预设…
          </button>
        </div>
      </div>
    </div>

    <div class="action-bar__center">
      <div class="app-toggle">
        <button
          type="button"
          class="app-toggle__track"
          :class="{ 'app-toggle__track--on': autoOpen }"
          role="switch"
          :aria-checked="autoOpen"
          aria-label="转换后打开"
          @click="autoOpen = !autoOpen"
        >
          <div class="app-toggle__thumb" />
        </button>
        <span class="app-toggle__label">转换后打开</span>
      </div>
    </div>

    <div class="action-bar__right">
      <button
        type="button"
        class="app-button app-button--primary action-bar__convert"
        :disabled="!canConvert || isConverting"
        @click="startConversion"
      >
        <template v-if="isConverting">
          转换中…
          <div class="action-bar__spinner" />
        </template>
        <template v-else>
          <span v-if="fileCount > 0">转换 ({{ fileCount }})</span>
          <span v-else>添加文件开始转换</span>
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

.dropdown-chevron {
  transition: transform 0.15s ease;
}

.dropdown-chevron--open {
  transform: rotate(180deg);
}

.action-bar__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: action-spin 0.6s linear infinite;
}

@keyframes action-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
