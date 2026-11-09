<script setup lang="ts">
import { onMounted, ref } from 'vue'
import LibraryView from './components/LibraryView.vue'
import ReaderView from './components/ReaderView.vue'
import { getBook } from './lib/db'
import { useLibraryStore } from './stores/library'
import { useReaderStore } from './stores/reader'
import { useSyncStore } from './stores/sync'

const library = useLibraryStore()
const reader = useReaderStore()
const sync = useSyncStore()
const view = ref<'library' | 'reader'>('library')

onMounted(async () => {
  void library.loadAll()
  if (sync.configured) {
    await sync.init()
    if (sync.signedIn) await library.loadLibraryFromCloud()
  }
})

async function openBook(id: string) {
  const book = await getBook(id)
  if (!book) return
  // Stash for ReaderView mount (it creates foliate-view on mount)
  ;(window as unknown as { __pendingBook: Parameters<typeof reader.openBook>[0] }).__pendingBook = {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    data: book.data,
    fileName: book.fileName,
  }
  view.value = 'reader'
}

function backToLibrary() {
  view.value = 'library'
  void library.loadAll()
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white">
      Skip to content
    </a>
    <div id="main" class="flex min-h-0 flex-1 flex-col">
      <LibraryView v-if="view === 'library'" @open="openBook" />
      <ReaderView v-else @back="backToLibrary" />
    </div>
    <footer class="border-t border-zinc-200 px-4 py-2 text-center text-[11px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
      OpenBook · EPUBs render locally via foliate-js · Books &amp; notes stay in your browser (IndexedDB) · Optional cloud sync via Supabase
    </footer>
  </div>
</template>
