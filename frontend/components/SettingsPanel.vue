<script setup lang="ts">
import { FolderOutput, ShieldCheck, SlidersHorizontal, SquareTerminal, X } from "lucide-vue-next";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

const emit = defineEmits<{
  close: [];
}>();

const closeButton = ref<HTMLButtonElement | null>(null);
let previousFocus: HTMLElement | null = null;

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener("keydown", onKeydown);
  void nextTick(() => closeButton.value?.focus());
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  previousFocus?.focus();
});
</script>

<template>
  <div class="settings-overlay" @click.self="emit('close')">
    <aside class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="settings-panel__header">
        <h2 id="settings-title" class="settings-panel__title">设置</h2>
        <button
          ref="closeButton"
          type="button"
          class="app-icon-button"
          title="关闭"
          aria-label="关闭设置"
          @click="emit('close')"
        >
          <X :size="18" stroke-width="1.5" />
        </button>
      </div>

      <div class="settings-panel__body">
        <section class="settings-section" aria-labelledby="conversion-settings">
          <div class="settings-section__heading">
            <h3 id="conversion-settings" class="settings-section__label">转换</h3>
            <span>即将推出</span>
          </div>
          <div class="settings-group">
            <div class="settings-row">
              <span class="settings-row__icon settings-row__icon--blue" aria-hidden="true">
                <SlidersHorizontal :size="16" stroke-width="1.8" />
              </span>
              <span class="settings-row__copy">
                <strong>预设</strong>
                <small>管理文档结构与 Word 样式</small>
              </span>
            </div>
            <div class="settings-row">
              <span class="settings-row__icon settings-row__icon--purple" aria-hidden="true">
                <SquareTerminal :size="16" stroke-width="1.8" />
              </span>
              <span class="settings-row__copy">
                <strong>Pandoc</strong>
                <small>检测版本与程序位置</small>
              </span>
            </div>
            <div class="settings-row">
              <span class="settings-row__icon settings-row__icon--orange" aria-hidden="true">
                <FolderOutput :size="16" stroke-width="1.8" />
              </span>
              <span class="settings-row__copy">
                <strong>输出</strong>
                <small>位置与同名文件处理策略</small>
              </span>
            </div>
          </div>
        </section>

        <section class="settings-section" aria-labelledby="privacy-settings">
          <h3 id="privacy-settings" class="settings-section__label">隐私</h3>
          <div class="privacy-card">
            <span class="privacy-card__icon" aria-hidden="true">
              <ShieldCheck :size="18" stroke-width="1.8" />
            </span>
            <div>
              <strong>文件仅在本机处理</strong>
            </div>
          </div>
        </section>

        <section class="settings-about" aria-labelledby="about-settings">
          <h3 id="about-settings">md2docx</h3>
          <span>2.6.0</span>
        </section>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: var(--app-titlebar-height) 0 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.24);
  transition: background 0.18s ease-out;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

@media (prefers-color-scheme: dark) {
  .settings-overlay {
    background: rgba(0, 0, 0, 0.46);
  }
}

.settings-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 380px;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--app-surface-raised) 94%, transparent);
  border-left: 0.5px solid var(--app-border-strong);
  box-shadow: -24px 0 64px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(28px) saturate(1.25);
  -webkit-backdrop-filter: blur(28px) saturate(1.25);
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.settings-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 11px 14px 10px 18px;
  border-bottom: 0.5px solid var(--app-border);
  flex-shrink: 0;
}

.settings-panel__title {
  margin: 0;
  font-family:
    -apple-system, "SF Pro Display", "Segoe UI Variable Display", "Microsoft YaHei UI",
    "PingFang SC", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--app-text);
}

.settings-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 18px 18px;
}

.settings-section {
  margin-bottom: 22px;
}

.settings-section__label {
  margin: 0;
  color: var(--app-secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.settings-section__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 6px 8px;
}

.settings-section__heading > span {
  color: var(--app-tertiary);
  font-size: 10px;
}

.settings-group {
  overflow: hidden;
  border: 0.5px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-fill);
}

.settings-row {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 62px;
  padding: 9px 12px;
}

.settings-row + .settings-row::before {
  position: absolute;
  top: 0;
  right: 12px;
  left: 46px;
  height: 0.5px;
  background: var(--app-border);
  content: "";
}

.settings-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  color: white;
  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.3);
}

.settings-row__icon--blue {
  background: #0a84ff;
}

.settings-row__icon--purple {
  background: #bf5af2;
}

.settings-row__icon--orange {
  background: #ff9f0a;
}

.settings-row__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.settings-row__copy strong,
.privacy-card strong {
  color: var(--app-text);
  font-size: 13px;
  font-weight: 550;
}

.settings-row__copy small {
  overflow: hidden;
  color: var(--app-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.privacy-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 0.5px solid color-mix(in srgb, var(--app-success) 18%, var(--app-border));
  border-radius: 12px;
  background: color-mix(in srgb, var(--app-success) 6%, var(--app-fill));
}

.privacy-card__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--app-success) 14%, transparent);
  color: var(--app-success);
}

.settings-about {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 0;
}

.settings-about h3 {
  margin: 0;
  color: var(--app-text);
  font-size: 12px;
  font-weight: 600;
}

.settings-about > span {
  color: var(--app-tertiary);
  font-size: 11px;
}

.settings-enter-from,
.settings-leave-to {
  background: transparent;
  backdrop-filter: blur(0);
  -webkit-backdrop-filter: blur(0);
}

.settings-enter-from .settings-panel,
.settings-leave-to .settings-panel {
  transform: translateX(100%);
}

.settings-leave-active,
.settings-leave-active .settings-panel {
  transition-duration: 0.2s;
  transition-timing-function: ease-in;
}
</style>
