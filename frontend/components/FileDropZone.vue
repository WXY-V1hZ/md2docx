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
      if (
        (file.name.endsWith(".md") || file.name.endsWith(".markdown")) &&
        window.md2docx?.getPathForFile
      ) {
        const path = window.md2docx.getPathForFile(file);
        if (path !== "") {
          paths.push(path);
        }
      }
    }
    if (paths.length > 0) {
      emit("filesAdded", paths);
    }
  }
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'dropzone--active': isDragOver }"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="dropzone__icon">
      <FileText :size="48" stroke-width="1" />
    </div>
    <h2 class="dropzone__title">将 Markdown 文件拖到这里</h2>
    <p class="dropzone__hint">或</p>
    <button class="app-button app-button--primary dropzone__button" @click="handleSelectFiles">
      <Plus :size="16" stroke-width="2" />
      选择文件
    </button>
    <p class="dropzone__subtitle">支持 .md .markdown 格式</p>
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
  padding: 48px 32px;
  border: 1px dashed var(--app-border);
  border-radius: 16px;
  background: var(--app-surface);
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
  cursor: default;
}

.dropzone:hover {
  border-color: var(--app-secondary);
}

.dropzone--active {
  border-color: #3478f6;
  background: rgba(52, 120, 246, 0.04);
  transform: scale(1.01);
}

@media (prefers-color-scheme: dark) {
  .dropzone--active {
    background: rgba(52, 120, 246, 0.08);
  }
}

.dropzone__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: rgba(52, 120, 246, 0.08);
  color: #3478f6;
  margin-bottom: 4px;
}

@media (prefers-color-scheme: dark) {
  .dropzone__icon {
    background: rgba(52, 120, 246, 0.15);
  }
}

.dropzone__title {
  margin: 0;
  font-family:
    -apple-system, "SF Pro Display", "Segoe UI Variable Display", "Microsoft YaHei UI",
    "PingFang SC", system-ui, sans-serif;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--app-text);
  text-align: center;
}

.dropzone__hint {
  margin: 0;
  font-size: 13px;
  color: var(--app-tertiary);
}

.dropzone__button {
  margin-top: 4px;
}

.dropzone__subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--app-tertiary);
}
</style>
