<script setup lang="ts">
import { History, Settings } from "lucide-vue-next";
import logoSvg from "../../assets/logo.svg";

defineProps<{
  unreadCount: number;
  historyExpanded: boolean;
  settingsExpanded: boolean;
}>();

const emit = defineEmits<{
  openSettings: [];
  toggleHistory: [];
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
          :class="{ 'app-titlebar__btn--active': historyExpanded }"
          data-history-btn
          title="转换记录"
          aria-label="转换记录"
          aria-controls="conversion-history"
          :aria-expanded="historyExpanded"
          @click.stop="emit('toggleHistory')"
        >
          <History :size="16" stroke-width="1.5" />
          <span v-if="unreadCount > 0" class="app-titlebar__badge">
            {{ unreadCount > 99 ? "99+" : unreadCount }}
          </span>
        </button>
        <button
          type="button"
          class="app-titlebar__btn"
          :class="{ 'app-titlebar__btn--active': settingsExpanded }"
          title="设置"
          aria-label="打开设置"
          aria-controls="settings-dialog"
          :aria-expanded="settingsExpanded"
          @click="emit('openSettings')"
        >
          <Settings :size="16" stroke-width="1.5" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped src="../styles/titlebar.css"></style>
