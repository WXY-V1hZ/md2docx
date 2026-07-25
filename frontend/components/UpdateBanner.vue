<script setup lang="ts">
import {
  CheckCircle2,
  CircleAlert,
  Download,
  LoaderCircle,
  RefreshCw,
  RotateCw,
  X,
} from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{ update: UpdateSnapshot }>();
const emit = defineEmits<{
  download: [];
  retry: [];
  install: [];
  dismiss: [];
}>();

const progress = computed(() => Math.round(props.update.progress ?? 0));
const downloadRate = computed(() => formatRate(props.update.bytesPerSecond ?? 0));

function formatRate(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "";
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
  return `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
}
</script>

<template>
  <section
    class="update-banner"
    :class="`update-banner--${update.state}`"
    :role="update.state === 'error' ? 'alert' : 'status'"
    aria-live="polite"
  >
    <span class="update-banner__icon" aria-hidden="true">
      <Download v-if="update.state === 'available'" :size="17" stroke-width="1.8" />
      <LoaderCircle
        v-else-if="update.state === 'downloading'"
        :size="17"
        stroke-width="1.8"
        class="is-spinning"
      />
      <CheckCircle2 v-else-if="update.state === 'downloaded'" :size="17" stroke-width="1.8" />
      <CircleAlert v-else :size="17" stroke-width="1.8" />
    </span>

    <div class="update-banner__content">
      <strong v-if="update.state === 'available'"> md2docx {{ update.version }} 可以下载 </strong>
      <strong v-else-if="update.state === 'downloading'">正在下载更新</strong>
      <strong v-else-if="update.state === 'downloaded'">更新已准备好</strong>
      <strong v-else>更新未完成</strong>

      <span v-if="update.state === 'available'">下载期间可以继续使用应用</span>
      <span v-else-if="update.state === 'downloading'">
        {{ progress }}%<template v-if="downloadRate"> · {{ downloadRate }}</template>
      </span>
      <span v-else-if="update.state === 'downloaded'">重新启动以完成安装</span>
      <span v-else>{{ update.message || "请稍后重试。" }}</span>
    </div>

    <div
      v-if="update.state === 'downloading'"
      class="update-banner__progress"
      role="progressbar"
      aria-label="更新下载进度"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="progress"
    >
      <span :style="{ transform: `scaleX(${progress / 100})` }" />
    </div>

    <div class="update-banner__actions">
      <span v-if="update.preview" class="update-banner__preview">预览</span>
      <button
        v-if="update.state === 'available'"
        type="button"
        class="update-banner__button update-banner__button--primary"
        @click="emit('download')"
      >
        下载
      </button>
      <button
        v-else-if="update.state === 'downloaded'"
        type="button"
        class="update-banner__button update-banner__button--primary"
        @click="emit('install')"
      >
        <RotateCw :size="12" stroke-width="2" />
        重新启动
      </button>
      <button
        v-else-if="update.state === 'error'"
        type="button"
        class="update-banner__button"
        @click="emit('retry')"
      >
        <RefreshCw :size="12" stroke-width="2" />
        重试
      </button>
      <button
        v-if="update.state !== 'downloading'"
        type="button"
        class="update-banner__close"
        :aria-label="update.state === 'downloaded' ? '稍后安装' : '关闭更新提示'"
        @click="emit('dismiss')"
      >
        <X :size="14" stroke-width="1.7" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.update-banner {
  position: relative;
  display: grid;
  min-height: 52px;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  border-bottom: 0.5px solid var(--app-border);
  background: color-mix(in srgb, var(--app-surface-raised) 92%, transparent);
  box-shadow: 0 1px 0 color-mix(in srgb, #fff 4%, transparent);
  color: var(--app-text);
  backdrop-filter: blur(22px) saturate(1.2);
  -webkit-backdrop-filter: blur(22px) saturate(1.2);
}

.update-banner__icon {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: color-mix(in srgb, var(--app-accent) 12%, transparent);
  color: var(--app-accent);
}

.update-banner--downloaded .update-banner__icon {
  background: color-mix(in srgb, var(--app-success) 13%, transparent);
  color: var(--app-success);
}

.update-banner--error .update-banner__icon {
  background: color-mix(in srgb, #ff453a 11%, transparent);
  color: #ff453a;
}

.update-banner__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.update-banner__content strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 620;
  letter-spacing: -0.005em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-banner__content > span {
  overflow: hidden;
  color: var(--app-secondary);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.update-banner__actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.update-banner__preview {
  padding: 2px 6px;
  border: 0.5px solid color-mix(in srgb, var(--app-accent) 28%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--app-accent) 8%, transparent);
  color: var(--app-accent);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.update-banner__button,
.update-banner__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  color: var(--app-text);
  font: inherit;
  cursor: default;
  outline: none;
  transition:
    background 0.12s ease,
    color 0.12s ease,
    box-shadow 0.12s ease;
}

.update-banner__button {
  height: 28px;
  gap: 4px;
  padding: 0 10px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 7px;
  background: var(--app-fill);
  font-size: 11px;
  font-weight: 560;
}

.update-banner__button--primary {
  border-color: transparent;
  background: var(--app-accent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  color: #fff;
}

.update-banner__button:hover {
  background: color-mix(in srgb, var(--app-text) 9%, var(--app-fill));
}

.update-banner__button--primary:hover {
  background: color-mix(in srgb, var(--app-accent) 88%, #000);
}

.update-banner__close {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: transparent;
  color: var(--app-tertiary);
}

.update-banner__close:hover {
  background: var(--app-fill);
  color: var(--app-text);
}

.update-banner__button:focus-visible,
.update-banner__close:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 38%, transparent);
}

.update-banner__progress {
  position: absolute;
  right: 0;
  bottom: -0.5px;
  left: 0;
  height: 2px;
  overflow: hidden;
  background: color-mix(in srgb, var(--app-accent) 11%, transparent);
}

.update-banner__progress > span {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: left;
  background: var(--app-accent);
  transition: transform 0.24s ease-out;
}

.is-spinning {
  animation: update-spin 0.8s linear infinite;
}

@keyframes update-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .update-banner__button,
  .update-banner__close,
  .update-banner__progress > span {
    transition: none;
  }

  .is-spinning {
    animation-duration: 1.6s;
  }
}
</style>
