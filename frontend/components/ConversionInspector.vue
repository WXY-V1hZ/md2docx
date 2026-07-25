<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import {
  type ConversionEditorModel,
  type ConversionWorkspaceSettings,
  toEditorModel,
  toWorkspaceSettings,
  validationMessage,
} from "../conversion-settings";
import AppSelect, { type AppSelectOption } from "./AppSelect.vue";
import ConversionSettingsForm from "./ConversionSettingsForm.vue";

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
  }>(),
  {
    collapsed: true,
  },
);

const emit = defineEmits<{
  change: [settings: ConversionWorkspaceSettings | null, valid: boolean];
  "manage-presets": [];
  "update:collapsed": [collapsed: boolean];
}>();

const presets = ref<{ name: string; valid: boolean; current: boolean }[]>([]);
const currentPreset = ref("default");
const model = ref<ConversionEditorModel | null>(null);
const loading = ref(true);
const loadError = ref("");
const saveError = ref("");

let initialized = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let suppressPresetEvent = false;

const presetOptions = computed(
  () =>
    presets.value
      .filter(({ valid }) => valid)
      .map(({ name }) => ({ value: name, label: name })) satisfies AppSelectOption[],
);
const validationError = computed(() => validationMessage(model.value));
const valid = computed(
  () => Boolean(model.value) && !loading.value && !loadError.value && !validationError.value,
);
const statusText = computed(() => {
  if (validationError.value) return validationError.value;
  if (saveError.value) return saveError.value;
  return "";
});

watch(
  model,
  () => {
    publish();
    if (initialized && valid.value) scheduleSave();
  },
  { deep: true },
);
watch(
  () => props.collapsed,
  () => {
    publish();
    if (initialized && valid.value) scheduleSave();
  },
);
watch([loading, loadError, validationError], publish);

onMounted(() => {
  window.addEventListener("md2docx:preset-changed", onPresetChanged);
  void loadWorkspace();
});

onBeforeUnmount(() => {
  window.removeEventListener("md2docx:preset-changed", onPresetChanged);
  if (saveTimer) clearTimeout(saveTimer);
  if (valid.value) void persist();
});

async function loadWorkspace() {
  loading.value = true;
  loadError.value = "";
  try {
    await refreshPresets();
    const active = presets.value.find(({ current, valid: entryValid }) => current && entryValid);
    const activeName = active?.name ?? "default";
    const saved = await window.md2docx?.loadConversionSettings();
    emit("update:collapsed", saved?.collapsed ?? true);

    const savedPreset = presets.value.find(
      ({ name, valid: entryValid }) => name === saved?.preset && entryValid,
    );
    if (saved && saved.preset === activeName && savedPreset) {
      currentPreset.value = saved.preset;
      model.value = toEditorModel({
        name: saved.preset,
        source: saved.preset === "default" ? "builtin" : "user",
        config: saved.config,
        styleConfig: saved.styleConfig,
      });
    } else {
      await replaceFromPreset(activeName);
    }
    initialized = true;
    publish();
    if (!saved || saved.preset !== activeName || !savedPreset) await persist();
  } catch (error) {
    loadError.value = messageFrom(error, "无法载入转换设置");
  } finally {
    loading.value = false;
    publish();
  }
}

async function refreshPresets() {
  const list = await window.md2docx?.getPresets();
  if (!list?.length) throw new Error("没有可用预设");
  presets.value = list.map(({ name, valid: entryValid, current }) => ({
    name,
    valid: entryValid,
    current,
  }));
}

async function selectPreset(name: string) {
  if (name === currentPreset.value || loading.value) return;
  loading.value = true;
  loadError.value = "";
  saveError.value = "";
  try {
    await window.md2docx?.usePreset(name);
    await replaceFromPreset(name);
    for (const entry of presets.value) entry.current = entry.name === name;
    suppressPresetEvent = true;
    window.dispatchEvent(new CustomEvent("md2docx:preset-changed", { detail: name }));
    suppressPresetEvent = false;
    await persist();
  } catch (error) {
    loadError.value = messageFrom(error, "无法切换预设");
  } finally {
    loading.value = false;
    publish();
  }
}

async function replaceFromPreset(name: string) {
  const preset = await window.md2docx?.readPreset(name);
  if (!preset) throw new Error("桌面接口不可用");
  currentPreset.value = name;
  model.value = toEditorModel(preset);
}

function onPresetChanged(event: Event) {
  if (suppressPresetEvent) return;
  if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;
  void reloadExternalPreset(event.detail);
}

async function reloadExternalPreset(name: string) {
  loading.value = true;
  loadError.value = "";
  try {
    await refreshPresets();
    const available = presets.value.some(
      ({ name: presetName, valid: entryValid }) => presetName === name && entryValid,
    );
    const nextName = available ? name : "default";
    await replaceFromPreset(nextName);
    await persist();
  } catch (error) {
    loadError.value = messageFrom(error, "无法同步预设");
  } finally {
    loading.value = false;
    publish();
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persist(), 250);
}

async function persist() {
  if (!model.value || validationError.value) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  saveError.value = "";
  try {
    await window.md2docx?.saveConversionSettings(
      toWorkspaceSettings(currentPreset.value, model.value, props.collapsed),
    );
  } catch (error) {
    saveError.value = messageFrom(error, "无法自动保存");
  }
}

function publish() {
  const settings =
    model.value === null
      ? null
      : toWorkspaceSettings(currentPreset.value, model.value, props.collapsed);
  emit("change", settings, valid.value);
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message.split("\n")[0] : fallback;
}
</script>

<template>
  <aside
    id="conversion-inspector"
    class="conversion-inspector"
    :class="{ 'conversion-inspector--collapsed': props.collapsed }"
    aria-label="转换设置"
    :aria-hidden="props.collapsed"
  >
    <template v-if="!props.collapsed">
      <header class="inspector-header">
        <div>
          <strong>转换设置</strong>
          <span>应用于当前文件列表</span>
        </div>
      </header>

      <div class="inspector-preset">
        <div class="inspector-preset__label">
          <span>基准预设</span>
          <button type="button" @click="emit('manage-presets')">管理预设…</button>
        </div>
        <AppSelect
          :model-value="currentPreset"
          aria-label="基准预设"
          :options="presetOptions"
          :disabled="loading"
          @update:model-value="selectPreset"
        />
      </div>

      <div v-if="loading" class="inspector-state" aria-live="polite">
        <LoaderCircle :size="17" class="is-spinning" />
        正在载入
      </div>
      <div v-else-if="loadError" class="inspector-state inspector-state--error">
        <span>{{ loadError }}</span>
        <button type="button" class="app-button app-button--secondary" @click="loadWorkspace">
          重试
        </button>
      </div>
      <div v-else-if="model" class="inspector-scroll">
        <ConversionSettingsForm :model="model" />
      </div>

      <footer v-if="validationError || saveError" class="inspector-footer" aria-live="polite">
        <span>{{ statusText }}</span>
        <button v-if="saveError && valid" type="button" @click="persist">重试</button>
      </footer>
    </template>
  </aside>
</template>

<style scoped>
.conversion-inspector {
  position: relative;
  display: flex;
  width: 340px;
  min-width: 340px;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-left: 0.5px solid var(--app-border-strong);
  background: color-mix(in srgb, var(--app-surface) 92%, transparent);
  box-shadow: -10px 0 28px rgba(0, 0, 0, 0.03);
  backdrop-filter: blur(28px) saturate(1.3);
  -webkit-backdrop-filter: blur(28px) saturate(1.3);
  transition:
    width 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    min-width 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.conversion-inspector--collapsed {
  width: 0;
  min-width: 0;
  border-left-color: transparent;
  box-shadow: none;
  visibility: hidden;
}
.inspector-header {
  display: flex;
  min-height: 52px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px 6px 16px;
}
.inspector-header > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.inspector-header strong {
  font-family:
    -apple-system, "SF Pro Display", "Segoe UI Variable Display", "Microsoft YaHei UI",
    "PingFang SC", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.014em;
}
.inspector-header span {
  color: var(--app-tertiary);
  font-size: 10px;
  letter-spacing: 0.008em;
}
.inspector-preset {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 5px;
  padding: 2px 16px 12px;
  border-bottom: 0.5px solid var(--app-border);
}
.inspector-preset__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.inspector-preset__label button,
.inspector-footer button {
  padding: 1px 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--app-accent);
  font-size: 10.5px;
  transition: background 0.12s ease;
}
.inspector-preset__label button:hover,
.inspector-footer button:hover {
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
}
.inspector-preset :deep(.app-select),
.inspector-preset :deep(.app-select__trigger) {
  width: 100%;
}
.inspector-preset :deep(.app-select__trigger) {
  justify-content: space-between;
  background: var(--app-fill);
}
.inspector-scroll {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 22px;
  scroll-behavior: smooth;
}
.inspector-state {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--app-secondary);
  font-size: 11.5px;
}
.inspector-state--error {
  flex-direction: column;
  padding: 18px;
  color: #ff453a;
  text-align: center;
}
.inspector-footer {
  display: flex;
  min-height: 34px;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-top: 0.5px solid var(--app-border);
  color: #ff453a;
  font-size: 9.5px;
}
.inspector-footer button {
  margin-left: auto;
  padding: 2px 5px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--app-accent);
  font-size: 10px;
  transition: background 0.12s ease;
}
.inspector-footer button:hover {
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
}
.is-spinning {
  animation: inspector-spin 0.7s linear infinite;
}
@keyframes inspector-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-color-scheme: dark) {
  .conversion-inspector {
    box-shadow: -12px 0 34px rgba(0, 0, 0, 0.14);
  }
}
@media (prefers-reduced-motion: reduce) {
  .conversion-inspector {
    transition: none;
  }
  .is-spinning {
    animation-duration: 1.4s;
  }
}
</style>
