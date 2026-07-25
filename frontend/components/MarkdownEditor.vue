<script setup lang="ts">
import { Braces, FileText } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  content: string;
  name: string;
  disabled: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  "update:content": [content: string];
  "update:name": [name: string];
}>();

const lineCount = computed(() =>
  props.content.length === 0 ? 1 : props.content.split("\n").length,
);
const nameInputWidth = computed(
  () => `${Math.min(220, Math.max(72, [...props.name].length * 13 + 12))}px`,
);
</script>

<template>
  <section class="markdown-editor" aria-label="Markdown 文本编辑器">
    <header class="markdown-editor__header">
      <div class="markdown-editor__identity">
        <span class="markdown-editor__document" aria-hidden="true">
          <FileText :size="15" stroke-width="1.7" />
        </span>
        <label class="markdown-editor__name">
          <span class="sr-only">文档名称</span>
          <input
            :value="name"
            type="text"
            maxlength="80"
            placeholder="未命名"
            :disabled="disabled"
            :style="{ width: nameInputWidth }"
            aria-label="文档名称"
            @input="emit('update:name', ($event.target as HTMLInputElement).value)"
          />
          <span>.md</span>
        </label>
      </div>
      <div class="markdown-editor__metrics" aria-live="polite">
        <span>{{ lineCount }} 行</span>
        <span>{{ content.length }} 字符</span>
      </div>
    </header>

    <div class="markdown-editor__body">
      <div class="markdown-editor__gutter" aria-hidden="true">
        <Braces :size="15" stroke-width="1.5" />
      </div>
      <textarea
        :value="content"
        :disabled="disabled"
        aria-label="Markdown 内容"
        spellcheck="false"
        placeholder="# 文档标题&#10;&#10;在这里粘贴或输入 Markdown 内容…"
        @input="emit('update:content', ($event.target as HTMLTextAreaElement).value)"
      />
      <p v-if="error" class="markdown-editor__error" role="alert">{{ error }}</p>
    </div>
  </section>
</template>

<style scoped>
.markdown-editor {
  display: flex;
  width: 100%;
  max-width: 720px;
  min-height: 390px;
  max-height: 100%;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 14px;
  background: color-mix(in srgb, var(--app-surface) 96%, transparent);
  box-shadow: var(--app-shadow-card);
}

.markdown-editor__header {
  display: flex;
  min-height: 48px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 13px;
  border-bottom: 0.5px solid var(--app-border);
  background: color-mix(in srgb, var(--app-surface) 88%, transparent);
}

.markdown-editor__identity,
.markdown-editor__name,
.markdown-editor__metrics {
  display: flex;
  align-items: center;
}

.markdown-editor__identity {
  min-width: 0;
  gap: 8px;
}

.markdown-editor__document {
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
  color: var(--app-accent);
}

.markdown-editor__name {
  min-width: 0;
  color: var(--app-tertiary);
  font-size: 12px;
}

.markdown-editor__name input {
  min-width: 70px;
  max-width: min(220px, 28vw);
  padding: 4px 2px;
  border: none;
  border-radius: 4px;
  outline: none;
  background: transparent;
  color: var(--app-text);
  font: inherit;
  font-weight: 600;
}

.markdown-editor__name input:focus {
  background: var(--app-fill);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 24%, transparent);
}

.markdown-editor__metrics {
  flex: 0 0 auto;
  gap: 10px;
  color: var(--app-tertiary);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}

.markdown-editor__body {
  position: relative;
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 38px minmax(0, 1fr);
}

.markdown-editor__gutter {
  display: flex;
  justify-content: center;
  padding-top: 16px;
  border-right: 0.5px solid var(--app-border);
  background: color-mix(in srgb, var(--app-bg) 44%, transparent);
  color: var(--app-tertiary);
}

.markdown-editor textarea {
  width: 100%;
  min-height: 300px;
  resize: none;
  padding: 15px 18px 24px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--app-text);
  font-family: "SFMono-Regular", "Cascadia Code", "JetBrains Mono", Consolas, monospace;
  font-size: 15px;
  line-height: 1.7;
  tab-size: 2;
}

.markdown-editor textarea::placeholder {
  color: var(--app-tertiary);
}

.markdown-editor textarea:disabled,
.markdown-editor__name input:disabled {
  opacity: 0.72;
}

.markdown-editor__error {
  position: absolute;
  right: 12px;
  bottom: 12px;
  max-width: calc(100% - 62px);
  margin: 0;
  padding: 6px 9px;
  border-radius: 7px;
  background: color-mix(in srgb, #ff453a 10%, var(--app-surface));
  color: #ff453a;
  font-size: 11px;
  box-shadow: var(--app-shadow-popover);
}

@media (prefers-reduced-motion: reduce) {
  .markdown-editor *,
  .markdown-editor *::before,
  .markdown-editor *::after {
    scroll-behavior: auto !important;
  }
}
</style>
