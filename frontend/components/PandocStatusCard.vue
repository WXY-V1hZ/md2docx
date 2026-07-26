<script setup lang="ts">
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw } from "lucide-vue-next";
import { onMounted, ref } from "vue";

const pandocState = ref<{
  available: boolean;
  version: string | null;
  path: string | null;
} | null>(null);
const pandocChecking = ref(false);
const pandocError = ref("");

async function checkPandoc() {
  pandocChecking.value = true;
  pandocError.value = "";
  try {
    pandocState.value = (await window.md2docx?.detectPandoc()) ?? {
      available: false,
      version: null,
      path: null,
    };
  } catch {
    pandocState.value = { available: false, version: null, path: null };
  } finally {
    pandocChecking.value = false;
  }
}

async function openPandocWebsite() {
  try {
    await window.md2docx?.openExternal("https://pandoc.org/installing.html");
    pandocError.value = "";
  } catch {
    pandocError.value = "无法打开安装页面";
  }
}

onMounted(() => {
  void checkPandoc();
});
</script>

<template>
  <div
    class="pandoc-card"
    :class="{
      'pandoc-card--available': pandocState?.available,
      'pandoc-card--missing': pandocState && !pandocState.available,
    }"
    role="status"
    aria-live="polite"
  >
    <span class="pandoc-card__status" aria-hidden="true">
      <span v-if="!pandocState || pandocChecking" class="pandoc-card__spinner" />
      <CheckCircle2 v-else-if="pandocState.available" :size="17" stroke-width="1.8" />
      <AlertCircle v-else :size="17" stroke-width="1.8" />
    </span>
    <div class="pandoc-card__copy">
      <strong v-if="!pandocState">正在检测…</strong>
      <strong v-else-if="pandocState.available">
        Pandoc {{ pandocState.version || "已安装" }}
      </strong>
      <strong v-else>未检测到 Pandoc</strong>
      <small v-if="pandocState?.available">{{ pandocState.path }}</small>
      <small v-else-if="pandocState">安装后重新检测</small>
    </div>
    <div class="pandoc-card__actions">
      <button
        type="button"
        class="settings-icon-button"
        :disabled="pandocChecking"
        aria-label="重新检测 Pandoc"
        title="重新检测"
        @click="checkPandoc"
      >
        <RefreshCw :size="14" stroke-width="1.8" :class="{ 'is-spinning': pandocChecking }" />
      </button>
      <button
        v-if="pandocState && !pandocState.available"
        type="button"
        class="settings-link-button"
        @click="openPandocWebsite"
      >
        安装
        <ExternalLink :size="12" stroke-width="1.8" />
      </button>
    </div>
  </div>
  <p v-if="pandocError" class="pandoc-error" role="alert">{{ pandocError }}</p>
</template>

<style scoped>
.pandoc-card {
  display: flex;
  min-height: 58px;
  align-items: center;
  gap: 10px;
  padding: 10px 11px;
  border: 0.5px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-fill);
}

.pandoc-card--available {
  border-color: color-mix(in srgb, var(--app-success) 20%, var(--app-border));
}

.pandoc-card--missing {
  border-color: color-mix(in srgb, #ff3b30 18%, var(--app-border));
}

.pandoc-card__status {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--app-fill);
  color: var(--app-tertiary);
}

.pandoc-card--available .pandoc-card__status {
  background: color-mix(in srgb, var(--app-success) 12%, transparent);
  color: var(--app-success);
}

.pandoc-card--missing .pandoc-card__status {
  background: color-mix(in srgb, #ff3b30 10%, transparent);
  color: #ff3b30;
}

.pandoc-card__spinner {
  width: 14px;
  height: 14px;
  border: 1.5px solid color-mix(in srgb, var(--app-accent) 18%, transparent);
  border-top-color: var(--app-accent);
  border-radius: 50%;
  animation: pandoc-spin 0.7s linear infinite;
}

.pandoc-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.pandoc-card__copy strong {
  overflow: hidden;
  color: var(--app-text);
  font-size: 12.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pandoc-card__copy small {
  overflow: hidden;
  color: var(--app-secondary);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pandoc-card__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.settings-icon-button {
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
    color 0.12s ease;
}

.settings-icon-button:hover {
  background: color-mix(in srgb, var(--app-text) 6%, transparent);
  color: var(--app-text);
}

.settings-icon-button:disabled {
  opacity: 0.4;
}

.settings-link-button {
  display: inline-flex;
  height: 26px;
  align-items: center;
  gap: 3px;
  padding: 0 7px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-accent);
  cursor: default;
  font-size: 11px;
  font-weight: 550;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}

.settings-link-button:hover {
  background: color-mix(in srgb, var(--app-text) 6%, transparent);
  color: var(--app-text);
}

.pandoc-error {
  margin: 5px 5px 0;
  color: #ff453a;
  font-size: 10.5px;
}

.is-spinning {
  animation: pandoc-spin 0.7s linear infinite;
}

@keyframes pandoc-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
