<script setup lang="ts">
import { ref } from 'vue'
import type { TocItem } from '../types'

const props = defineProps<{ items: TocItem[]; currentHref?: string | null }>()
const emit = defineEmits<{ select: [href: string] }>()

const expanded = ref<Set<string>>(new Set())

function toggle(href: string) {
  const next = new Set(expanded.value)
  if (next.has(href)) next.delete(href)
  else next.add(href)
  expanded.value = next
}

function isExpanded(href: string) {
  return expanded.value.has(href)
}
</script>

<template>
  <nav aria-label="Table of contents">
    <ul class="space-y-0.5">
      <li v-for="item in props.items" :key="item.href + item.label">
        <div class="flex items-stretch gap-1">
          <button
            v-if="item.subitems?.length"
            type="button"
            class="flex w-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            :aria-expanded="isExpanded(item.href)"
            :aria-label="isExpanded(item.href) ? `Collapse ${item.label}` : `Expand ${item.label}`"
            @click="toggle(item.href)"
          >
            <svg
              class="h-3.5 w-3.5 transition-transform"
              :class="{ 'rotate-90': isExpanded(item.href) }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span v-else class="w-6 shrink-0" aria-hidden="true" />
          <button
            type="button"
            class="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-[13px] leading-snug transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            :class="{
              'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300':
                props.currentHref === item.href,
              'text-zinc-700 dark:text-zinc-200': props.currentHref !== item.href,
            }"
            :aria-current="props.currentHref === item.href ? 'true' : undefined"
            @click="emit('select', item.href)"
          >
            {{ item.label }}
          </button>
        </div>
        <div v-if="item.subitems?.length && isExpanded(item.href)" class="ml-6 border-l border-zinc-200 pl-2 dark:border-zinc-800">
          <TocTree :items="item.subitems" :current-href="props.currentHref" @select="(h) => emit('select', h)" />
        </div>
      </li>
    </ul>
  </nav>
</template>
