<script setup lang="ts">
import { computed, ref } from 'vue'
import { useReaderStore } from '../stores/reader'

const reader = useReaderStore()
const input = ref('')

const flat = computed(() => reader.flatResults())
const total = computed(() => flat.value.length)

async function submit() {
  await reader.runSearch(input.value)
}

function clear() {
  input.value = ''
  reader.clearSearch()
}
</script>

<template>
  <div class="flex h-full flex-col">
    <form class="flex gap-2" @submit.prevent="submit">
      <label class="sr-only" for="search-input">Search in book</label>
      <input
        id="search-input"
        v-model="input"
        type="search"
        name="search-input"
        placeholder="Search…"
        autocomplete="off"
        class="min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      <button
        type="submit"
        class="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
        :disabled="reader.searching || !input.trim()"
      >
        {{ reader.searching ? '…' : 'Go' }}
      </button>
      <button
        v-if="reader.searchQuery"
        type="button"
        class="shrink-0 rounded-full border border-zinc-200 px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label="Clear search"
        @click="clear"
      >
        Clear
      </button>
    </form>

    <div v-if="reader.searching" class="mt-3" aria-live="polite">
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div class="h-full rounded-full bg-indigo-500 transition-[width]" :style="{ width: `${Math.round(reader.searchProgress * 100)}%` }" />
      </div>
      <p class="mt-1 text-xs text-zinc-500">Searching… {{ Math.round(reader.searchProgress * 100) }}%</p>
    </div>

    <div v-if="reader.searchQuery && !reader.searching" class="mt-3 flex items-center justify-between text-sm" aria-live="polite">
      <p class="text-zinc-600 dark:text-zinc-300">
        <span class="font-medium">{{ total }}</span> result{{ total === 1 ? '' : 's' }} for “{{ reader.searchQuery }}”
      </p>
      <div v-if="total" class="flex items-center gap-1">
        <button
          type="button"
          class="rounded-full border border-zinc-200 p-1.5 text-zinc-600 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Previous result"
          @click="reader.prevSearchResult()"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <span class="tabular-nums text-xs text-zinc-500">{{ reader.searchIndex + 1 }} / {{ total }}</span>
        <button
          type="button"
          class="rounded-full border border-zinc-200 p-1.5 text-zinc-600 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Next result"
          @click="reader.nextSearchResult()"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>

    <div class="mt-3 min-h-0 flex-1 overflow-y-auto" role="list" aria-label="Search results">
      <div v-if="!reader.searchQuery" class="py-8 text-center text-sm text-zinc-400">
        Search across all chapters. Results are highlighted in the text.
      </div>
      <div v-else-if="!reader.searching && total === 0" class="py-8 text-center text-sm text-zinc-400">
        No matches found.
      </div>
      <section v-for="sec in reader.searchResults" :key="sec.label + sec.index" class="mb-4">
        <h4 class="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{{ sec.label }}</h4>
        <ul class="space-y-1">
          <li v-for="item in sec.subitems" :key="item.cfi">
            <button
              type="button"
              role="listitem"
              class="w-full rounded-lg border px-3 py-2 text-left text-[13px] leading-relaxed transition focus-visible:ring-2 focus-visible:ring-indigo-500"
              :class="{
                'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-100':
                  flat.findIndex((f) => f.cfi === item.cfi) === reader.searchIndex,
                'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900':
                  flat.findIndex((f) => f.cfi === item.cfi) !== reader.searchIndex,
              }"
              @click="reader.goToSearchResult(flat.findIndex((f) => f.cfi === item.cfi))"
            >
              <span class="clamp-2">{{ item.excerpt }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
