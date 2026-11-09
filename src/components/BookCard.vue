<script setup lang="ts">
import { computed } from 'vue'
import type { BookMeta } from '../types'

const props = defineProps<{ book: BookMeta; hasData?: boolean }>()
const emit = defineEmits<{ open: [id: string]; remove: [id: string] }>()
const hasData = computed(() => props.hasData ?? true)

const progressPct = computed(() => Math.round((props.book.progress ?? 0) * 100))
const lastRead = computed(() => {
  if (!props.book.lastReadAt) return 'Not started'
  const d = new Date(props.book.lastReadAt)
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d)
})
const sizeLabel = computed(() => {
  const kb = props.book.fileSize / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
})

function onRemove(e: Event) {
  e.stopPropagation()
  if (window.confirm(`Remove “${props.book.title}” from your library?`)) {
    emit('remove', props.book.id)
  }
}
</script>

<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-900"
  >
    <button
      type="button"
      class="block text-left focus:outline-none"
      :aria-label="`Open ${book.title} by ${book.author}`"
      @click="emit('open', book.id)"
    >
      <div class="relative aspect-[2/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          v-if="book.coverUrl"
          :src="book.coverUrl"
          :alt="`Cover of ${book.title}`"
          width="320"
          height="480"
          loading="lazy"
          class="h-full w-full object-cover"
        />
        <div v-else class="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
          <svg class="h-10 w-10 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M12 6c-1.5-1.5-3.5-2-6-2H4v14h2c2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2h2V4h-2c-2.5 0-4.5.5-6 2Z" stroke-linejoin="round" />
            <path d="M12 6v14" />
          </svg>
          <span class="clamp-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">{{ book.title }}</span>
        </div>
        <span
          v-if="progressPct > 0 && progressPct < 100"
          class="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur"
        >
          {{ progressPct }}%
        </span>
        <span v-if="!hasData" class="absolute top-2 right-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white opacity-80 dark:bg-zinc-300 dark:text-zinc-900" title="Mirrored from cloud — EPUB not on this device">
          Cloud
        </span>
        <span
          v-if="progressPct >= 100"
          class="absolute bottom-2 left-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white"
        >
          Finished
        </span>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <h3 class="clamp-2 min-w-0 text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-50" style="text-wrap: balance">
          {{ book.title }}
        </h3>
        <p class="clamp-1 min-w-0 text-[13px] text-zinc-500 dark:text-zinc-400">{{ book.author }}</p>
        <p class="text-[12px] text-zinc-400 dark:text-zinc-500">{{ lastRead }} · {{ sizeLabel }}</p>

        <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="progressbar" :aria-valuenow="progressPct" aria-valuemin="0" aria-valuemax="100" :aria-label="`Reading progress ${progressPct} percent`">
          <div class="h-full rounded-full bg-indigo-500 transition-[width]" :style="{ width: `${progressPct}%` }" />
        </div>
        <p v-if="book.tocLabel" class="clamp-1 text-[12px] text-zinc-400 dark:text-zinc-500">{{ book.tocLabel }}</p>
      </div>
    </button>

    <button
      type="button"
      class="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-zinc-500 opacity-0 shadow-sm backdrop-blur transition hover:bg-white hover:text-red-600 focus:opacity-100 group-hover:opacity-100 dark:bg-zinc-900/90 dark:hover:bg-zinc-900"
      :aria-label="`Remove ${book.title} from library`"
      @click="onRemove"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
      </svg>
    </button>
  </article>
</template>
