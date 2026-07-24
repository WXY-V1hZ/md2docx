<script setup lang="ts">
import AppTitleBar from "./components/AppTitleBar.vue";
</script>

<template>
  <div
    class="grid h-full w-full grid-rows-[var(--app-titlebar-height)_minmax(0,1fr)] bg-app-background font-sans text-app-text"
  >
    <AppTitleBar />

    <main class="min-h-0 overflow-auto p-8">
      <h1 class="m-0 font-display text-[clamp(26px,3vw,34px)] font-[650] tracking-[-0.025em]">
        md2docx
      </h1>
    </main>
  </div>
</template>
