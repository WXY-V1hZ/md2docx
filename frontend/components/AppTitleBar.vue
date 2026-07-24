<script setup lang="ts">
import { Settings } from "lucide-vue-next";
import logoSvg from "../../assets/logo.svg";

const emit = defineEmits<{
  openSettings: [];
}>();
</script>

<template>
  <header class="app-titlebar">
    <div class="app-titlebar__safe-area">
      <div class="app-titlebar__brand">
        <img :src="logoSvg" alt="" class="app-titlebar__logo" />
        <span class="app-titlebar__name">md2docx</span>
      </div>
      <div class="app-titlebar__actions">
        <button
          type="button"
          class="app-titlebar__btn"
          title="设置"
          aria-label="打开设置"
          @click="emit('openSettings')"
        >
          <Settings :size="16" stroke-width="1.5" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped src="../styles/titlebar.css"></style>
