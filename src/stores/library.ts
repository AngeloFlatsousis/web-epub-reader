import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { deleteBook as dbDeleteBook, getBook, listBooks, putBook, updateBookProgress } from '../lib/db'
import { formatContributor, formatTitle, hashBuffer, sanitizeText } from '../lib/epub'
import { isoToMs } from '../lib/supabase'
import { useSyncStore } from './sync'
import type { BookMeta, BookRecord } from '../types'

export const useLibraryStore = defineStore('library', () => {
  const sync = useSyncStore()
  const books = ref<BookRecord[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const importing = ref(false)

  const metas = computed<BookMeta[]>(() =>
    books.value.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
      fileName: b.fileName,
      fileSize: b.fileSize,
      addedAt: b.addedAt,
      lastReadAt: b.lastReadAt,
      progress: b.progress,
      cfi: b.cfi,
      tocLabel: b.tocLabel,
      hasData: b.hasData,
    })),
  )

  async function loadAll() {
    loading.value = true
    error.value = null
    try {
      books.value = await listBooks()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load library'
    } finally {
      loading.value = false
    }
  }

  /**
   * Import an EPUB file: extract metadata + cover via foliate-js makeBook,
   * sanitize, persist ArrayBuffer to IndexedDB.
   * Returns the stored book id.
   */
  async function importFile(file: File): Promise<string> {
    importing.value = true
    error.value = null
    try {
      const data = await file.arrayBuffer()
      const id = hashBuffer(data)

      // Dedupe: if same hash already in library, just return it
      const existing = await getBook(id)
      if (existing) {
        await updateBookProgress(id, { lastReadAt: Date.now() })
        books.value = await listBooks()
        return id
      }

      // Extract metadata without full render: use foliate-js makeBook
      let title = file.name.replace(/\.epub$/i, '').replace(/[-_]+/g, ' ').trim() || 'Untitled book'
      let author = 'Unknown author'
      let coverUrl: string | null = null

      try {
        const { makeBook } = await import('foliate-js/view.js')
        const book = await makeBook(new File([data], file.name, { type: file.type }))
        title = formatTitle(book.metadata?.title) || title
        author = formatContributor(book.metadata?.author)
        try {
          const coverBlob = await book.getCover?.()
          if (coverBlob) coverUrl = URL.createObjectURL(coverBlob)
        } catch {
          /* cover optional */
        }
        // Free resources if available
        try {
          ;(book as unknown as { destroy?: () => void }).destroy?.()
        } catch {
          /* noop */
        }
      } catch (e) {
        console.warn('[library] metadata extraction fallback', e)
        // Fallback: keep filename-derived title; still store the book
      }

      const record: BookRecord = {
        id,
        title: sanitizeText(title, 300) || 'Untitled book',
        author: sanitizeText(author, 300) || 'Unknown author',
        coverUrl,
        fileName: sanitizeText(file.name, 200),
        fileSize: file.size,
        addedAt: Date.now(),
        lastReadAt: null,
        progress: 0,
        cfi: null,
        tocLabel: null,
        updatedAt: Date.now(),
        data,
        hasData: true,
      }
      await putBook(record)
      // Mirror metadata/progress to the cloud (EPUB bytes stay on-device)
      if (sync.signedIn) {
        try {
          await sync.pushBook(record)
        } catch (e) {
          console.warn('[library] push book to cloud failed', e)
        }
      }
      books.value = await listBooks()
      return id
    } finally {
      importing.value = false
    }
  }

  async function removeBook(id: string) {
    await dbDeleteBook(id)
    const removed = books.value.find((b) => b.id === id)
    if (removed?.coverUrl?.startsWith('blob:')) URL.revokeObjectURL(removed.coverUrl)
    books.value = books.value.filter((b) => b.id !== id)
    if (sync.signedIn) {
      try {
        await sync.deleteRemoteBook(id)
      } catch (e) {
        console.warn('[library] delete remote book failed', e)
      }
    }
  }

  async function recordProgress(
    id: string,
    patch: { progress: number; cfi: string | null; tocLabel: string | null },
  ) {
    await updateBookProgress(id, { ...patch, lastReadAt: Date.now() })
    const b = books.value.find((x) => x.id === id)
    if (b) {
      b.progress = patch.progress
      b.cfi = patch.cfi
      b.tocLabel = patch.tocLabel
      b.lastReadAt = Date.now()
    }
    if (sync.signedIn) {
      try {
        await sync.pushPosition(id, patch.cfi, patch.progress, patch.tocLabel)
      } catch {
        /* sync failures must not break local reading */
      }
    }
  }

  /**
   * Merge cloud books into local IndexedDB (last-write-wins by updated_at).
   * Books whose EPUB bytes are not on this device get hasData = false.
   */
  async function mergePulledBooks() {
    if (!sync.signedIn) return
    let rows: Awaited<ReturnType<typeof sync.pullBooks>>
    try {
      rows = await sync.pullBooks()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to pull library from cloud'
      return
    }
    for (const row of rows) {
      const local = await getBook(row.id)
      const serverMs = isoToMs(row.updated_at) ?? 0
      const localMs = local?.updatedAt ?? 0
      if (!local || serverMs > localMs) {
        await putBook({
          id: row.id,
          title: row.title,
          author: row.author,
          coverUrl: row.cover_url,
          fileName: row.file_name,
          fileSize: row.file_size ?? 0,
          addedAt: isoToMs(row.added_at) ?? Date.now(),
          lastReadAt: isoToMs(row.last_read_at),
          progress: row.progress ?? 0,
          cfi: row.cfi,
          tocLabel: row.toc_label,
          updatedAt: serverMs,
          data: local?.data ?? new ArrayBuffer(0),
          hasData: !!local,
        } satisfies BookRecord)
      }
    }
    books.value = await listBooks()
  }

  async function loadLibraryFromCloud() {
    await loadAll()
    await mergePulledBooks()
  }

  function getMeta(id: string): BookMeta | undefined {
    return metas.value.find((m) => m.id === id)
  }

  return {
    books,
    metas,
    loading,
    error,
    importing,
    loadAll,
    loadLibraryFromCloud,
    importFile,
    removeBook,
    recordProgress,
    getMeta,
  }
})
