<script setup lang="ts">
</script>

<template>
  <header class="app-titlebar">
    <div class="app-titlebar__safe-area">
      <div class="app-titlebar__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped src="../styles/titlebar.css"></style>
