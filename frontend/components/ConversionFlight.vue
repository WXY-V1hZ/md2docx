<script setup lang="ts">
import { FileCheck2 } from "lucide-vue-next";

import type { FlightAnimation } from "../composables/useConversionManager";

defineProps<{
  flights: FlightAnimation[];
}>();
</script>

<template>
  <div class="flight-layer" aria-hidden="true">
    <span
      v-for="flight in flights"
      :key="flight.id"
      class="flight"
      :style="{
        left: `${flight.startX}px`,
        top: `${flight.startY}px`,
        '--flight-x': `${flight.endX - flight.startX}px`,
        '--flight-y': `${flight.endY - flight.startY}px`,
      }"
    >
      <FileCheck2 :size="16" stroke-width="1.8" />
    </span>
  </div>
</template>

<style scoped>
.flight-layer {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  pointer-events: none;
}

.flight {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0.5px solid color-mix(in srgb, var(--app-success) 24%, var(--app-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--app-surface-raised) 94%, transparent);
  color: var(--app-success);
  box-shadow: var(--app-shadow-card);
  animation: fly-to-history 0.48s cubic-bezier(0.3, 0.72, 0.2, 1) forwards;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

@keyframes fly-to-history {
  0% {
    opacity: 0;
    transform: translate3d(0, 4px, 0) scale(0.88);
  }
  14% {
    opacity: 1;
    transform: translate3d(0, -3px, 0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--flight-x), var(--flight-y), 0) scale(0.52);
  }
}
</style>
