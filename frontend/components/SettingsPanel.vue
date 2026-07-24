<script setup lang="ts">
import { onMounted, onBeforeUnmount } from "vue";
import { X } from "lucide-vue-next";

const emit = defineEmits<{
  close: [];
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="settings-overlay" @click.self="emit('close')">
    <aside class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="settings-panel__header">
        <h2 id="settings-title" class="settings-panel__title">设置</h2>
        <button
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
        <!-- 预设 -->
        <section class="settings-section">
          <h3 class="settings-section__title">预设</h3>
          <p class="settings-section__desc">
            管理配置与样式预设。此处将提供新增、复制、编辑和删除预设的功能。
          </p>
        </section>

        <div class="settings-section__divider" />

        <!-- Pandoc -->
        <section class="settings-section">
          <h3 class="settings-section__title">Pandoc</h3>
          <p class="settings-section__desc">检测 Pandoc 状态、选择程序路径或自动安装。</p>
        </section>

        <div class="settings-section__divider" />

        <!-- 保存 -->
        <section class="settings-section">
          <h3 class="settings-section__title">保存</h3>
          <p class="settings-section__desc">设置默认输出位置和同名文件处理策略。</p>
        </section>

        <div class="settings-section__divider" />

        <!-- 关于 -->
        <section class="settings-section">
          <h3 class="settings-section__title">关于</h3>
          <p class="settings-section__desc">
            md2docx v2.6.0 — 基于 Pandoc 的 Markdown 转 Word 工具。
          </p>
          <p class="settings-section__desc">文档与设置保留在本机，转换过程不上传文件。</p>
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
  background: rgba(0, 0, 0, 0.2);
}

@media (prefers-color-scheme: dark) {
  .settings-overlay {
    background: rgba(0, 0, 0, 0.4);
  }
}

.settings-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 360px;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  background: var(--app-surface);
  border-left: 0.5px solid var(--app-border);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.06);
}

.settings-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
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
  padding: 16px;
}

.settings-section {
  padding: 4px 0;
}

.settings-section__title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
}

.settings-section__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-secondary);
}

.settings-section__desc + .settings-section__desc {
  margin-top: 4px;
}

.settings-section__divider {
  height: 0.5px;
  margin: 16px 0;
  background: var(--app-border);
}
</style>
