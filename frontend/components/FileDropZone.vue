<script setup lang="ts">
import { ref } from "vue";
import { Plus, FileText } from "lucide-vue-next";

const emit = defineEmits<{
  filesAdded: [paths: string[]];
}>();

const isDragOver = ref(false);

async function handleSelectFiles() {
  if (window.md2docx?.selectFiles) {
    const paths = await window.md2docx.selectFiles();
    if (paths && paths.length > 0) {
      emit("filesAdded", paths);
    }
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}

function onDragLeave() {
  isDragOver.value = false;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const paths: string[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      if (!/\.(md|markdown)$/i.test(file.name)) continue;
      const p = window.md2docx?.getPathForFile(file) ?? "";
      if (p) paths.push(p);
    }
    if (paths.length > 0) emit("filesAdded", paths);
  }
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'dropzone--active': isDragOver }"
    @dragover.stop="onDragOver"
    @dragleave.stop="onDragLeave"
    @drop.stop="onDrop"
  >
    <div class="dropzone__document" aria-hidden="true">
      <span class="dropzone__paper dropzone__paper--back" />
      <span class="dropzone__paper dropzone__paper--front">
        <FileText :size="42" stroke-width="1.15" />
        <span class="dropzone__format">DOCX</span>
      </span>
    </div>
    <div class="dropzone__copy">
      <h2 class="dropzone__title">
        {{ isDragOver ? "松开即可添加" : "将 Markdown 转为 Word" }}
      </h2>
      <p class="dropzone__subtitle">支持 .md 和 .markdown，可一次选择多个</p>
    </div>
    <button class="app-button app-button--primary dropzone__button" @click="handleSelectFiles">
      <Plus :size="16" stroke-width="2" />
      选择 Markdown 文件
    </button>
  </div>
</template>

<style scoped>
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  max-width: 460px;
  min-height: 288px;
  padding: 42px 32px 38px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 18px;
  background:
    radial-gradient(
      circle at 50% 16%,
      color-mix(in srgb, var(--app-accent) 9%, transparent),
      transparent 44%
    ),
    color-mix(in srgb, var(--app-surface) 94%, transparent);
  box-shadow: var(--app-shadow-card);
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.24s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  cursor: default;
}

.dropzone:hover {
  border-color: color-mix(in srgb, var(--app-accent) 24%, var(--app-border-strong));
  box-shadow:
    var(--app-shadow-card),
    0 0 0 1px color-mix(in srgb, var(--app-accent) 5%, transparent);
}

.dropzone--active {
  border-color: color-mix(in srgb, var(--app-accent) 68%, transparent);
  background:
    radial-gradient(
      circle at 50% 16%,
      color-mix(in srgb, var(--app-accent) 16%, transparent),
      transparent 52%
    ),
    color-mix(in srgb, var(--app-surface) 92%, var(--app-accent) 8%);
  box-shadow:
    var(--app-shadow-card),
    0 0 0 3px color-mix(in srgb, var(--app-accent) 13%, transparent);
  transform: translateY(-2px) scale(1.008);
}

.dropzone__document {
  position: relative;
  width: 84px;
  height: 88px;
  margin-bottom: 2px;
}

.dropzone__paper {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 78px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 14px;
  background: var(--app-surface-raised);
}

.dropzone__paper--back {
  top: 0;
  left: 7px;
  transform: rotate(-7deg);
  opacity: 0.62;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
}

.dropzone__paper--front {
  right: 5px;
  bottom: 0;
  flex-direction: column;
  gap: 2px;
  color: var(--app-accent);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.dropzone--active .dropzone__paper--front {
  transform: translateY(-4px) rotate(2deg);
}

.dropzone__format {
  padding: 1px 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--app-accent) 12%, transparent);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.dropzone__copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.dropzone__title {
  margin: 0;
  font-family:
    -apple-system, "SF Pro Display", "Segoe UI Variable Display", "Microsoft YaHei UI",
    "PingFang SC", system-ui, sans-serif;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--app-text);
  text-align: center;
}

.dropzone__button {
  height: 34px;
  margin-top: 7px;
  padding-inline: 16px;
}

.dropzone__subtitle {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--app-secondary);
  text-align: center;
}
</style>
