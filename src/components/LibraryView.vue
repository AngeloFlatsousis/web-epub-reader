<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLibraryStore } from '../stores/library'
import { useSyncStore } from '../stores/sync'
import BookCard from './BookCard.vue'
import AuthPanel from './AuthPanel.vue'

const emit = defineEmits<{ open: [id: string] }>()

const library = useLibraryStore()
const sync = useSyncStore()
const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const query = ref('')
const sort = ref<'recent' | 'title' | 'progress'>('recent')
const syncOpen = ref(false)

watch(
  () => sync.signedIn,
  (signedIn) => {
    if (signedIn) void library.loadLibraryFromCloud()
  },
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = library.metas
  if (q) {
    list = list.filter(
      (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q),
    )
  }
  const sorted = [...list]
  if (sort.value === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title))
  else if (sort.value === 'progress') sorted.sort((a, b) => b.progress - a.progress)
  else sorted.sort((a, b) => (b.lastReadAt ?? b.addedAt) - (a.lastReadAt ?? a.addedAt))
  return sorted
})

function pickFiles() {
  fileInput.value?.click()
}

function handleOpen(id: string) {
  const book = library.metas.find((b) => b.id === id)
  if (book && !book.hasData) {
    window.alert(
      'This book is mirrored from the cloud. Import its EPUB file on this device to read it here — cloud sync stores notes and progress, not the EPUB bytes.',
    )
    return
  }
  emit('open', id)
}

async function onFiles(files: FileList | null) {
  if (!files?.length) return
  for (const f of Array.from(files)) {
    if (!/\.epub$/i.test(f.name) && f.type !== 'application/epub+zip') continue
    try {
      await library.importFile(f)
    } catch (e) {
      console.error(e)
    }
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  onFiles(e.dataTransfer?.files ?? null)
}

async function loadSample(url: string, name: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const file = new File([blob], name, { type: 'application/epub+zip' })
    await library.importFile(file)
  } catch (e) {
    console.error(e)
    window.alert('Could not load the sample book. Check your connection and try again.')
  }
}
</script>

<template>
  <div
    class="relative flex min-h-0 flex-1 flex-col"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop="onDrop"
  >
    <!-- Header -->
    <header class="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div class="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 6c-1.5-1.5-3.5-2-6-2H4v14h2c2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2h2V4h-2c-2.5 0-4.5.5-6 2Z" stroke-linejoin="round" />
              <path d="M12 6v14" />
            </svg>
          </div>
          <div>
            <h1 class="text-lg font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">OpenBook</h1>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">Your EPUB library · stored locally</p>
          </div>
        </div>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <label class="sr-only" for="library-search">Search library</label>
          <input
            id="library-search"
            v-model="query"
            type="search"
            name="library-search"
            placeholder="Search title or author…"
            autocomplete="off"
            class="w-48 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:w-64 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <label class="sr-only" for="library-sort">Sort library</label>
          <select
            id="library-sort"
            v-model="sort"
            name="library-sort"
            class="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="recent">Recently read</option>
            <option value="title">Title A–Z</option>
            <option value="progress">Progress</option>
          </select>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            :title="sync.configured ? (sync.signedIn ? 'Manage cloud sync' : 'Sign in to sync across devices') : 'Configure Supabase env vars to enable cloud sync'"
            @click="syncOpen = true"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.657 0 3-1.343 3-3m0 0c0-1.657-1.343-3-3-3m0 0a9 9 0 0 1 9-9m0 0a9 9 0 0 0 9 9m0 0V3m0 0c0-1.657-1.343-3-3-3m0 0c0 1.657 1.343 3 3 3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ sync.configured ? (sync.signedIn ? 'Sync' : 'Sign in') : 'Cloud sync' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            :disabled="library.importing"
            @click="pickFiles"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke-linecap="round" />
            </svg>
            {{ library.importing ? 'Importing…' : 'Add EPUB' }}
          </button>
        </div>
      </div>
    </header>

    <input
      ref="fileInput"
      type="file"
      accept=".epub,application/epub+zip"
      multiple
      class="hidden"
      aria-hidden="true"
      tabindex="-1"
      @change="(e) => onFiles((e.target as HTMLInputElement).files)"
    />

    <!-- Content -->
    <main class="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite">
      <div v-if="library.loading" class="py-16 text-center text-sm text-zinc-500">Loading library…</div>

      <div v-else-if="library.error" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
        {{ library.error }}
      </div>

      <div v-else-if="filtered.length === 0 && library.metas.length === 0" class="mx-auto max-w-lg py-16 text-center">
        <svg class="mx-auto h-16 w-16 text-zinc-300 dark:text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
          <path d="M12 6c-1.5-1.5-3.5-2-6-2H4v14h2c2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2h2V4h-2c-2.5 0-4.5.5-6 2Z" stroke-linejoin="round" />
          <path d="M12 6v14" />
        </svg>
        <h2 class="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50" style="text-wrap: balance">Your library is empty</h2>
        <p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Drag &amp; drop EPUB files anywhere on this page, or use the button above. Everything stays in your browser — no uploads.
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            class="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            @click="loadSample('/samples/alice.epub', 'alice.epub')"
          >
            Try sample: Alice (text)
          </button>
          <button
            type="button"
            class="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            @click="loadSample('/samples/illustrated.epub', 'illustrated.epub')"
          >
            Try sample: Illustrated
          </button>
        </div>
        <p class="mt-4 text-xs text-zinc-400">Samples are public-domain excerpts bundled with the app.</p>
      </div>

      <div v-else-if="filtered.length === 0" class="py-16 text-center text-sm text-zinc-500">
        No books match “{{ query }}”.
      </div>

      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <BookCard
          v-for="b in filtered"
          :key="b.id"
          :book="b"
          :has-data="b.hasData"
          @open="handleOpen"
          @remove="(id) => library.removeBook(id)"
        />
      </div>
    </main>

    <!-- Drag overlay -->
    <div
      v-if="dragOver"
      class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-500/10 backdrop-blur-[1px]"
      aria-hidden="true"
    >
      <div class="rounded-2xl bg-white px-8 py-6 text-center shadow-xl dark:bg-zinc-900">
        <p class="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Drop EPUB files to add them</p>
        <p class="mt-1 text-sm text-zinc-500">They’ll be stored locally in IndexedDB</p>
      </div>
    </div>

    <!-- Cloud sync panel -->
    <div v-if="syncOpen" class="fixed inset-0 z-50 flex items-end justify-center" @click.self="syncOpen = false">
      <div class="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        class="relative w-full max-w-md mx-auto mt-10 mb-10 rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
        role="dialog"
        aria-modal="true"
        aria-label="Cloud sync"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Cloud sync</h2>
          <button
            type="button"
            class="rounded-full p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            @click="syncOpen = false"
            aria-label="Close"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <AuthPanel />
      </div>
    </div>
  </div>
</template>
