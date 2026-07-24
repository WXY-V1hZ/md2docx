<script setup lang="ts">
import { Check, ChevronDown } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

export interface AppSelectOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: readonly AppSelectOption[];
    disabled?: boolean;
    ariaLabel: string;
  }>(),
  { disabled: false },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const instanceId = `app-select-${crypto.randomUUID()}`;
const trigger = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const activeIndex = ref(0);
const menuPosition = ref({ top: 0, left: 0, width: 0, maxHeight: 240 });
const opensUpward = ref(false);

const selectedIndex = computed(() => {
  const index = props.options.findIndex(({ value }) => value === props.modelValue);
  return index < 0 ? 0 : index;
});
const selectedLabel = computed(() => props.options[selectedIndex.value]?.label ?? props.modelValue);
const activeOptionId = computed(() =>
  open.value ? `${instanceId}-option-${activeIndex.value}` : undefined,
);
const menuStyle = computed(() => ({
  top: `${menuPosition.value.top}px`,
  left: `${menuPosition.value.left}px`,
  width: `${menuPosition.value.width}px`,
  maxHeight: `${menuPosition.value.maxHeight}px`,
  transformOrigin: opensUpward.value ? "bottom center" : "top center",
}));

function toggleMenu() {
  if (props.disabled) return;
  if (open.value) {
    closeMenu();
    return;
  }
  activeIndex.value = selectedIndex.value;
  updatePosition();
  open.value = true;
  void nextTick(scrollActiveIntoView);
}

function closeMenu() {
  open.value = false;
}

function choose(index: number) {
  const option = props.options[index];
  if (!option) return;
  emit("update:modelValue", option.value);
  activeIndex.value = index;
  closeMenu();
  trigger.value?.focus({ preventScroll: true });
}

function moveActive(offset: number) {
  if (props.options.length === 0) return;
  if (!open.value) {
    toggleMenu();
    return;
  }
  activeIndex.value = (activeIndex.value + offset + props.options.length) % props.options.length;
  void nextTick(scrollActiveIntoView);
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveActive(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveActive(-1);
  } else if (event.key === "Home" && open.value) {
    event.preventDefault();
    activeIndex.value = 0;
    void nextTick(scrollActiveIntoView);
  } else if (event.key === "End" && open.value) {
    event.preventDefault();
    activeIndex.value = Math.max(0, props.options.length - 1);
    void nextTick(scrollActiveIntoView);
  } else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (open.value) choose(activeIndex.value);
    else toggleMenu();
  } else if (event.key === "Escape" && open.value) {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  } else if (event.key === "Tab") {
    closeMenu();
  }
}

function updatePosition() {
  const rect = trigger.value?.getBoundingClientRect();
  if (!rect) return;
  const margin = 8;
  const gap = 5;
  const preferredHeight = Math.min(240, props.options.length * 32 + 8);
  const roomBelow = window.innerHeight - rect.bottom - margin;
  const roomAbove = rect.top - margin;
  opensUpward.value = roomBelow < preferredHeight && roomAbove > roomBelow;
  const maxHeight = Math.max(
    96,
    Math.min(preferredHeight, opensUpward.value ? roomAbove : roomBelow),
  );
  const width = Math.max(rect.width, 156);
  const left = Math.min(Math.max(margin, rect.right - width), window.innerWidth - width - margin);
  const top = opensUpward.value
    ? Math.max(margin, rect.top - maxHeight - gap)
    : Math.min(window.innerHeight - maxHeight - margin, rect.bottom + gap);
  menuPosition.value = { top, left, width, maxHeight };
}

function scrollActiveIntoView() {
  document
    .getElementById(`${instanceId}-option-${activeIndex.value}`)
    ?.scrollIntoView({ block: "nearest" });
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!open.value || !(event.target instanceof Element)) return;
  if (event.target.closest(`[data-app-select="${instanceId}"]`)) return;
  closeMenu();
}

function onWindowScroll(event: Event) {
  if (
    event.target instanceof Element &&
    event.target.closest(`[data-app-select="${instanceId}"]`)
  ) {
    return;
  }
  closeMenu();
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", onWindowScroll, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  window.removeEventListener("resize", closeMenu);
  window.removeEventListener("scroll", onWindowScroll, true);
});
</script>

<template>
  <span class="app-select" :data-app-select="instanceId">
    <button
      ref="trigger"
      type="button"
      class="app-select__trigger"
      :disabled="disabled"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${instanceId}-menu`"
      :aria-activedescendant="activeOptionId"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <span>{{ selectedLabel }}</span>
      <ChevronDown :size="13" stroke-width="1.8" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <Transition name="app-select-menu">
        <div
          v-if="open"
          :id="`${instanceId}-menu`"
          class="app-select__menu"
          :data-app-select="instanceId"
          :style="menuStyle"
          role="listbox"
          :aria-label="ariaLabel"
        >
          <div
            v-for="(option, index) in options"
            :id="`${instanceId}-option-${index}`"
            :key="option.value"
            class="app-select__option"
            :class="{
              'is-selected': option.value === modelValue,
              'is-active': index === activeIndex,
            }"
            role="option"
            :aria-selected="option.value === modelValue"
            @mouseenter="activeIndex = index"
            @mousedown.prevent
            @click="choose(index)"
          >
            <Check
              :size="13"
              stroke-width="2.2"
              :class="{ 'is-hidden': option.value !== modelValue }"
              aria-hidden="true"
            />
            <span>{{ option.label }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.app-select {
  display: inline-flex;
  min-width: 0;
}

.app-select__trigger {
  display: inline-flex;
  min-width: 92px;
  height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  padding: 0 7px 0 9px;
  border: 0.5px solid var(--app-border-strong);
  border-radius: 7px;
  background: color-mix(in srgb, var(--app-surface-raised) 96%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 5%, transparent),
    0 1px 1px rgba(0, 0, 0, 0.05);
  color: var(--app-text);
  font: inherit;
  font-size: 11.5px;
  cursor: default;
  outline: none;
  transition:
    border-color 0.14s ease,
    background 0.14s ease,
    box-shadow 0.14s ease;
}

.app-select__trigger > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select__trigger svg {
  flex: 0 0 auto;
  color: var(--app-tertiary);
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-select__trigger[aria-expanded="true"] {
  border-color: color-mix(in srgb, var(--app-accent) 68%, var(--app-border));
  background: color-mix(in srgb, var(--app-accent) 8%, var(--app-surface-raised));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 18%, transparent);
}

.app-select__trigger[aria-expanded="true"] svg {
  transform: rotate(180deg);
}

.app-select__trigger:focus-visible {
  border-color: var(--app-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent) 22%, transparent);
}

.app-select__trigger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--app-text) 4%, transparent);
}

.app-select__trigger:disabled {
  opacity: 0.42;
}

.app-select__menu {
  position: fixed;
  z-index: 100;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 4px;
  border: 0.5px solid color-mix(in srgb, var(--app-border-strong) 88%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--app-surface-raised) 92%, transparent);
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.3),
    0 3px 10px rgba(0, 0, 0, 0.16),
    inset 0 1px 0 color-mix(in srgb, #fff 7%, transparent);
  color: var(--app-text);
  backdrop-filter: blur(28px) saturate(1.35);
  -webkit-backdrop-filter: blur(28px) saturate(1.35);
  overscroll-behavior: contain;
}

.app-select__option {
  display: grid;
  min-height: 30px;
  grid-template-columns: 16px 1fr;
  align-items: center;
  gap: 5px;
  padding: 4px 8px 4px 6px;
  border-radius: 7px;
  color: var(--app-text);
  font-size: 12px;
  line-height: 1.2;
  cursor: default;
}

.app-select__option.is-active {
  background: color-mix(in srgb, var(--app-text) 7%, transparent);
}

.app-select__option.is-selected {
  background: var(--app-accent);
  color: #fff;
}

.app-select__option .is-hidden {
  visibility: hidden;
}

.app-select-menu-enter-active,
.app-select-menu-leave-active {
  transition:
    opacity 0.12s ease-out,
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-select-menu-enter-from,
.app-select-menu-leave-to {
  opacity: 0;
  transform: translateY(-3px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .app-select__trigger,
  .app-select__trigger svg,
  .app-select-menu-enter-active,
  .app-select-menu-leave-active {
    transition: none;
  }
}
</style>
