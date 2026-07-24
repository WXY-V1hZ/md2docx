<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowRight, Check, ChevronDown } from "lucide-vue-next";

const props = defineProps<{
  canConvert: boolean;
  fileCount: number;
  isConverting: boolean;
}>();

const emit = defineEmits<{
  convert: [options: { preset: string; openAfterConvert: boolean }];
  managePresets: [];
}>();

const autoOpen = ref(false);
const presets = ref<{ name: string; current: boolean }[]>([{ name: "default", current: true }]);
const currentPreset = ref("default");
const menuOpen = ref(false);

async function loadPresets() {
  try {
    if (window.md2docx?.getPresets) {
      const list = (await window.md2docx.getPresets()).filter(({ valid }) => valid);
      if (list.length > 0) {
        presets.value = list.map(({ name, current }) => ({ name, current }));
        const active = list.find(({ current }) => current);
        if (active) currentPreset.value = active.name;
      }
    }
  } catch {
    // IPC not available
  }
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value;
}

async function selectPreset(name: string) {
  const previous = currentPreset.value;
  currentPreset.value = name;
  menuOpen.value = false;
  try {
    await window.md2docx?.usePreset(name);
    window.dispatchEvent(new CustomEvent("md2docx:preset-changed", { detail: name }));
  } catch {
    currentPreset.value = previous;
  }
}

function onPresetChanged(event: Event) {
  if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;
  currentPreset.value = event.detail;
  void loadPresets();
}

function startConversion() {
  emit("convert", {
    preset: currentPreset.value,
    openAfterConvert: autoOpen.value,
  });
}

function managePresets() {
  menuOpen.value = false;
  emit("managePresets");
}

function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".app-dropdown")) {
    menuOpen.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    menuOpen.value = false;
    return;
  }
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

onMounted(() => {
  void loadPresets();
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("md2docx:preset-changed", onPresetChanged);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("md2docx:preset-changed", onPresetChanged);
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
        <Transition name="menu-pop">
          <div v-if="menuOpen" class="app-dropdown__menu" role="menu">
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
              <span v-else class="app-dropdown__check-space" />
              {{ p.name }}
            </button>
            <div class="app-dropdown__divider" />
            <button type="button" class="app-dropdown__item" role="menuitem" @click="managePresets">
              <span class="app-dropdown__check-space" />
              管理预设…
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <div class="action-bar__center">
      <label class="app-toggle">
        <input v-model="autoOpen" type="checkbox" class="app-toggle__input" />
        <span class="app-toggle__track" :class="{ 'app-toggle__track--on': autoOpen }">
          <span class="app-toggle__thumb" />
        </span>
        <span class="app-toggle__label">转换后打开</span>
      </label>
    </div>

    <div class="action-bar__right">
      <button
        type="button"
        class="app-button app-button--primary action-bar__convert"
        :disabled="!canConvert || isConverting"
        title="转换所选文件（Ctrl/⌘ + Enter）"
        @click="startConversion"
      >
        <template v-if="isConverting">
          转换中…
          <div class="action-bar__spinner" />
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
  padding: 12px 16px;
  background: color-mix(in srgb, var(--app-surface) 88%, transparent);
  border-top: 0.5px solid var(--app-border);
  gap: 16px;
  backdrop-filter: blur(20px) saturate(1.25);
  -webkit-backdrop-filter: blur(20px) saturate(1.25);
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
  min-width: 94px;
  padding: 0 18px;
  height: 34px;
  font-size: 13px;
  font-weight: 600;
  gap: 6px;
}

.dropdown-chevron {
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.menu-pop-enter-active,
.menu-pop-leave-active {
  transition:
    opacity 0.12s ease-out,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: bottom left;
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(5px) scale(0.97);
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

@media (max-width: 760px) {
  .action-bar {
    gap: 10px;
  }

  .action-bar__center {
    justify-content: flex-start;
  }

  .action-bar__convert {
    padding: 0 14px;
  }
}
</style>
