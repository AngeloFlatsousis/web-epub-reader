import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  deleteAnnotation as dbDeleteAnnotation,
  deleteBookmark as dbDeleteBookmark,
  getPosition,
  listAnnotations,
  listBookmarks,
  putAnnotation,
  putBookmark,
} from '../lib/db'
import { buildReaderCSS, sanitizeText, uid } from '../lib/epub'
import { useSettingsStore } from './settings'
import type {
  AnnotationColor,
  AnnotationRecord,
  BookmarkRecord,
  SearchSectionResult,
  TocItem,
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyView = any

export const useReaderStore = defineStore('reader', () => {
  const view = ref<AnyView | null>(null)
  const bookId = ref<string | null>(null)
  const bookTitle = ref('')
  const bookAuthor = ref('')
  const coverUrl = ref<string | null>(null)
  const toc = ref<TocItem[]>([])
  const fraction = ref(0)
  const cfi = ref<string | null>(null)
  const tocLabel = ref<string | null>(null)
  const pageLabel = ref<string | null>(null)
  const sectionFractions = ref<number[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  const annotations = ref<AnnotationRecord[]>([])
  const bookmarks = ref<BookmarkRecord[]>([])
  const searchResults = ref<SearchSectionResult[]>([])
  const searchQuery = ref('')
  const searchProgress = ref(0)
  const searching = ref(false)
  const searchIndex = ref(-1) // flat index into flattened results

  const settings = useSettingsStore()

  function attachView(v: AnyView) {
    view.value = v
  }

  function detachView() {
    try {
      view.value?.close?.()
    } catch {
      /* noop */
    }
    view.value = null
  }

  function applySettingsToView() {
    const v = view.value
    if (!v?.renderer) return
    const s = settings.settings
    try {
      v.renderer.setAttribute('flow', s.flow)
      if (s.animated) v.renderer.setAttribute('animated', '')
      else v.renderer.removeAttribute('animated')
      if (s.maxInlineSize > 0) v.renderer.setAttribute('max-inline-size', `${s.maxInlineSize}px`)
      else v.renderer.removeAttribute('max-inline-size')
      v.renderer.setStyles?.(buildReaderCSS(s))
    } catch (e) {
      console.warn('[reader] applySettings', e)
    }
  }

  async function openBook(opts: {
    id: string
    title: string
    author: string
    coverUrl: string | null
    data: ArrayBuffer
    fileName: string
  }) {
    loading.value = true
    loadError.value = null
    bookId.value = opts.id
    bookTitle.value = opts.title
    bookAuthor.value = opts.author
    coverUrl.value = opts.coverUrl
    toc.value = []
    fraction.value = 0
    cfi.value = null
    tocLabel.value = null
    pageLabel.value = null
    searchResults.value = []
    searchQuery.value = ''
    searchIndex.value = -1

    // Load persisted annotations/bookmarks/position
    try {
      annotations.value = await listAnnotations(opts.id)
      bookmarks.value = await listBookmarks(opts.id)
    } catch {
      annotations.value = []
      bookmarks.value = []
    }
    let lastCfi: string | null = null
    try {
      const pos = await getPosition(opts.id)
      lastCfi = pos?.cfi || null
    } catch {
      lastCfi = null
    }

    const v = view.value
    if (!v) {
      loadError.value = 'Reader view not ready'
      loading.value = false
      return
    }

    try {
      // foliate-js accepts File/Blob/URL — we pass a Blob from stored ArrayBuffer
      // (ArrayBuffer loading preferred over URL per epub.js pitfall guidance)
      const blob = new Blob([opts.data], { type: 'application/epub+zip' })
      const file = new File([blob], opts.fileName || 'book.epub', { type: 'application/epub+zip' })
      await v.open(file)

      // TOC + metadata from opened book
      const book = v.book
      toc.value = (book?.toc ?? []) as TocItem[]
      sectionFractions.value = v.getSectionFractions?.() ?? []

      // Apply settings CSS + flow
      applySettingsToView()

      // Restore annotations into view
      for (const a of annotations.value) {
        try {
          await v.addAnnotation({ value: a.cfi, color: a.color, note: a.note })
        } catch {
          /* annotation may reference missing section — skip */
        }
      }

      // Navigate to last position or text start
      if (lastCfi) {
        try {
          await v.goTo(lastCfi)
        } catch {
          await v.goToTextStart?.()
        }
      } else {
        await v.goToTextStart?.()
      }
    } catch (e) {
      console.error('[reader] open failed', e)
      loadError.value = e instanceof Error ? e.message : 'Could not open this EPUB. It may be corrupted or unsupported.'
    } finally {
      loading.value = false
    }
  }

  function onRelocate(detail: {
    fraction: number
    cfi: string
    tocItem?: { label?: string; href?: string }
    pageItem?: { label?: string }
  }) {
    fraction.value = detail.fraction ?? 0
    cfi.value = detail.cfi ?? null
    tocLabel.value = detail.tocItem?.label ?? null
    pageLabel.value = detail.pageItem?.label ?? null
  }

  async function goTo(target: string | number) {
    await view.value?.goTo?.(target)
  }

  async function goToFraction(f: number) {
    await view.value?.goToFraction?.(f)
  }

  async function next() {
    await view.value?.next?.()
  }
  async function prev() {
    await view.value?.prev?.()
  }
  async function goLeft() {
    await view.value?.goLeft?.()
  }
  async function goRight() {
    await view.value?.goRight?.()
  }

  // ---- Search ----
  async function runSearch(query: string) {
    const q = query.trim()
    searchQuery.value = q
    searchResults.value = []
    searchIndex.value = -1
    searchProgress.value = 0
    if (!q || !view.value) return
    searching.value = true
    try {
      const iter = view.value.search({ query: q })
      const results: SearchSectionResult[] = []
      for await (const result of iter) {
        if (result === 'done') break
        if (result && typeof result === 'object' && 'progress' in result && !('subitems' in result)) {
          searchProgress.value = (result as { progress: number }).progress
        } else if (result && 'subitems' in result) {
          results.push(result as SearchSectionResult)
          searchResults.value = [...results]
        }
      }
      searchProgress.value = 1
    } catch (e) {
      console.warn('[reader] search', e)
    } finally {
      searching.value = false
    }
  }

  function clearSearch() {
    try {
      view.value?.clearSearch?.()
    } catch {
      /* noop */
    }
    searchResults.value = []
    searchQuery.value = ''
    searchIndex.value = -1
    searchProgress.value = 0
  }

  function flatResults(): { cfi: string; excerpt: string; label: string }[] {
    const flat: { cfi: string; excerpt: string; label: string }[] = []
    for (const sec of searchResults.value) {
      for (const item of sec.subitems) {
        flat.push({ cfi: item.cfi, excerpt: item.excerpt, label: sec.label })
      }
    }
    return flat
  }

  async function goToSearchResult(flatIdx: number) {
    const flat = flatResults()
    if (flatIdx < 0 || flatIdx >= flat.length) return
    searchIndex.value = flatIdx
    await goTo(flat[flatIdx]!.cfi)
  }

  async function nextSearchResult() {
    const flat = flatResults()
    if (!flat.length) return
    const nextIdx = searchIndex.value + 1 >= flat.length ? 0 : searchIndex.value + 1
    await goToSearchResult(nextIdx)
  }

  async function prevSearchResult() {
    const flat = flatResults()
    if (!flat.length) return
    const prevIdx = searchIndex.value - 1 < 0 ? flat.length - 1 : searchIndex.value - 1
    await goToSearchResult(prevIdx)
  }

  // ---- Annotations ----
  async function addHighlight(opts: { cfi: string; color: AnnotationColor; note: string; excerpt: string }) {
    if (!bookId.value) return
    const rec: AnnotationRecord = {
      id: uid('ann'),
      bookId: bookId.value,
      cfi: opts.cfi,
      color: opts.color,
      note: sanitizeText(opts.note, 2000),
      excerpt: sanitizeText(opts.excerpt, 500),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await putAnnotation(rec)
    annotations.value = [...annotations.value, rec]
    try {
      await view.value?.addAnnotation?.({ value: rec.cfi, color: rec.color, note: rec.note })
    } catch {
      /* noop */
    }
    return rec
  }

  async function updateAnnotationNote(id: string, note: string) {
    const a = annotations.value.find((x) => x.id === id)
    if (!a) return
    const next = { ...a, note: sanitizeText(note, 2000), updatedAt: Date.now() }
    await putAnnotation(next)
    annotations.value = annotations.value.map((x) => (x.id === id ? next : x))
  }

  async function removeAnnotation(id: string) {
    const a = annotations.value.find((x) => x.id === id)
    if (!a) return
    await dbDeleteAnnotation(id)
    annotations.value = annotations.value.filter((x) => x.id !== id)
    try {
      await view.value?.deleteAnnotation?.({ value: a.cfi })
    } catch {
      /* noop */
    }
  }

  async function showAnnotation(cfi: string) {
    try {
      await view.value?.showAnnotation?.({ value: cfi })
    } catch {
      await goTo(cfi)
    }
  }

  // ---- Bookmarks ----
  async function addBookmark(label?: string) {
    if (!bookId.value || !cfi.value) return
    const rec: BookmarkRecord = {
      id: uid('bm'),
      bookId: bookId.value,
      cfi: cfi.value,
      label: sanitizeText(label || tocLabel.value || 'Bookmark', 200),
      createdAt: Date.now(),
    }
    await putBookmark(rec)
    bookmarks.value = [...bookmarks.value, rec]
    return rec
  }

  async function removeBookmark(id: string) {
    await dbDeleteBookmark(id)
    bookmarks.value = bookmarks.value.filter((b) => b.id !== id)
  }

  return {
    view,
    bookId,
    bookTitle,
    bookAuthor,
    coverUrl,
    toc,
    fraction,
    cfi,
    tocLabel,
    pageLabel,
    sectionFractions,
    loading,
    loadError,
    annotations,
    bookmarks,
    searchResults,
    searchQuery,
    searchProgress,
    searching,
    searchIndex,
    attachView,
    detachView,
    applySettingsToView,
    openBook,
    onRelocate,
    goTo,
    goToFraction,
    next,
    prev,
    goLeft,
    goRight,
    runSearch,
    clearSearch,
    flatResults,
    goToSearchResult,
    nextSearchResult,
    prevSearchResult,
    addHighlight,
    updateAnnotationNote,
    removeAnnotation,
    showAnnotation,
    addBookmark,
    removeBookmark,
  }
})
