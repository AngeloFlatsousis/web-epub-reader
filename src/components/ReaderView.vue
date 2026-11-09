<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { THEMES } from '../lib/epub'
import { useLibraryStore } from '../stores/library'
import { useReaderStore } from '../stores/reader'
import { useSettingsStore } from '../stores/settings'
import type { AnnotationColor } from '../types'
import SearchPanel from './SearchPanel.vue'
import SettingsPanel from './SettingsPanel.vue'
import TocTree from './TocTree.vue'

const emit = defineEmits<{ back: [] }>()

const library = useLibraryStore()
const reader = useReaderStore()
const settingsStore = useSettingsStore()

const hostRef = ref<HTMLDivElement | null>(null)
const sidebarOpen = ref(false)
const settingsOpen = ref(false)
const searchOpen = ref(false)
const sideTab = ref<'toc' | 'bookmarks' | 'notes'>('toc')
const chromeVisible = ref(true)
const fullscreen = ref(false)
const highlightMenu = ref<{ cfi: string; excerpt: string; x: number; y: number } | null>(null)
const highlightColor = ref<AnnotationColor>('yellow')
const highlightNote = ref('')
const editingNote = ref<{ id: string; text: string } | null>(null)
const toast = ref<string | null>(null)
let toastTimer: number | undefined

const themeDef = computed(() => THEMES[settingsStore.settings.theme])
const progressPct = computed(() => Math.round(reader.fraction * 100))
const isDarkChrome = computed(() => settingsStore.settings.theme === 'dark')

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.value = null), 2200)
}

function toggleChrome() {
  chromeVisible.value = !chromeVisible.value
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  } catch {
    /* fullscreen may be unavailable in iframe preview */
  }
}

function onFullscreenChange() {
  fullscreen.value = !!document.fullscreenElement
}

// ---- foliate-view lifecycle ----
async function mountView() {
  if (!hostRef.value) return
  // Import registers <foliate-view> custom element
  await import('foliate-js/view.js')
  const view = document.createElement('foliate-view') as unknown as Record<string, unknown> & HTMLElement & {
    addEventListener: HTMLElement['addEventListener']
  }
  hostRef.value.appendChild(view as unknown as Node)
  reader.attachView(view)

  view.addEventListener('relocate', (e: Event) => {
    const detail = (e as CustomEvent).detail as {
      fraction: number
      cfi: string
      tocItem?: { label?: string; href?: string }
      pageItem?: { label?: string }
    }
    reader.onRelocate(detail)
    // Persist progress (debounced via relocate frequency — foliate fires on page change)
    if (reader.bookId) {
      void library.recordProgress(reader.bookId, {
        progress: detail.fraction ?? 0,
        cfi: detail.cfi ?? null,
        tocLabel: detail.tocItem?.label ?? null,
      })
    }
  })

  view.addEventListener('load', (e: Event) => {
    const { doc } = (e as CustomEvent).detail as { doc: Document }
    // Keyboard nav inside iframe document
    doc.addEventListener('keydown', (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowLeft') void reader.goLeft()
      else if (ev.key === 'ArrowRight') void reader.goRight()
    })
    // Selection → highlight menu (capture on mouseup / touchend)
    const onSelectEnd = () => {
      const sel = doc.defaultView?.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) return
      const range = sel.getRangeAt(0)
      const text = range.toString().trim()
      if (!text) return
      // Get CFI for selection via view.getCFI + current index
      try {
        const contents = (view as unknown as { renderer: { getContents: () => { index: number; doc: Document }[] } }).renderer?.getContents?.() ?? []
        const entry = contents.find((c) => c.doc === doc)
        if (!entry) return
        const cfi = (view as unknown as { getCFI: (i: number, r: Range) => string }).getCFI(entry.index, range)
        const rect = range.getBoundingClientRect()
        highlightMenu.value = {
          cfi,
          excerpt: text.slice(0, 500),
          x: rect.left + rect.width / 2,
          y: rect.top,
        }
        highlightNote.value = ''
        highlightColor.value = 'yellow'
      } catch (err) {
        console.warn('[reader] selection CFI', err)
      }
    }
    doc.addEventListener('mouseup', onSelectEnd)
    doc.addEventListener('touchend', onSelectEnd)
  })

  // Annotation drawing: use Overlayer.highlight with color
  view.addEventListener('draw-annotation', async (e: Event) => {
    const { draw, annotation } = (e as CustomEvent).detail as {
      draw: (fn: unknown, opts?: unknown) => void
      annotation: { color?: string }
    }
    try {
      const { Overlayer } = await import('foliate-js/overlayer.js')
      const colorMap: Record<string, string> = {
        yellow: 'rgba(250, 204, 21, 0.45)',
        green: 'rgba(74, 222, 128, 0.45)',
        blue: 'rgba(96, 165, 250, 0.45)',
        pink: 'rgba(244, 114, 182, 0.45)',
        orange: 'rgba(251, 146, 60, 0.45)',
      }
      draw(Overlayer.highlight, { color: colorMap[annotation.color ?? 'yellow'] ?? colorMap.yellow })
    } catch {
      /* fallback: default draw */
    }
  })

  view.addEventListener('show-annotation', (e: Event) => {
    const { value } = (e as CustomEvent).detail as { value: string }
    const ann = reader.annotations.find((a) => a.cfi === value)
    if (ann) {
      sideTab.value = 'notes'
      sidebarOpen.value = true
      showToast(ann.note ? `Note: ${ann.note.slice(0, 80)}` : 'Highlight')
    }
  })

  // External links open in new tab
  view.addEventListener('external-link', (e: Event) => {
    const { href } = (e as CustomEvent).detail as { href: string }
    window.open(href, '_blank', 'noopener,noreferrer')
    e.preventDefault()
  })
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  await mountView()
  // Open current book (App sets pending book before switching view)
  const pending = (window as unknown as { __pendingBook?: Parameters<typeof reader.openBook>[0] }).__pendingBook
  if (pending) {
    await reader.openBook(pending)
    delete (window as unknown as { __pendingBook?: unknown }).__pendingBook
  }
  await nextTick()
  reader.applySettingsToView()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  reader.detachView()
  if (toastTimer) window.clearTimeout(toastTimer)
})

// Apply settings live
watch(
  () => settingsStore.settings,
  () => reader.applySettingsToView(),
  { deep: true },
)

// Keyboard navigation (outer document)
function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
  if (isTyping) return
  if (e.key === 'ArrowLeft') void reader.goLeft()
  else if (e.key === 'ArrowRight') void reader.goRight()
  else if (e.key === 'Escape') {
    highlightMenu.value = null
    if (settingsOpen.value) settingsOpen.value = false
    else if (searchOpen.value) searchOpen.value = false
    else if (sidebarOpen.value) sidebarOpen.value = false
  }
  else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) void toggleFullscreen()
  else if ((e.key === 'b' || e.key === 'B') && !e.metaKey && !e.ctrlKey) void reader.addBookmark().then(() => showToast('Bookmark added'))
  else if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey) toggleChrome()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// Touch swipe on reader surface
let touchStartX: number | null = null
let touchStartY: number | null = null
function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0]?.clientX ?? null
  touchStartY = e.touches[0]?.clientY ?? null
}
function onTouchEnd(e: TouchEvent) {
  if (touchStartX == null || touchStartY == null) return
  const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX
  const dy = (e.changedTouches[0]?.clientY ?? touchStartY) - touchStartY
  // Horizontal swipe > 60px, mostly horizontal
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0) void reader.goRight()
    else void reader.goLeft()
  }
  touchStartX = null
  touchStartY = null
}

async function saveHighlight() {
  if (!highlightMenu.value) return
  await reader.addHighlight({
    cfi: highlightMenu.value.cfi,
    color: highlightColor.value,
    note: highlightNote.value,
    excerpt: highlightMenu.value.excerpt,
  })
  highlightMenu.value = null
  showToast('Highlight saved')
}

async function onProgressInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  await reader.goToFraction(v)
}

const colorSwatches: { name: AnnotationColor; bg: string; label: string }[] = [
  { name: 'yellow', bg: '#facc15', label: 'Yellow' },
  { name: 'green', bg: '#4ade80', label: 'Green' },
  { name: 'blue', bg: '#60a5fa', label: 'Blue' },
  { name: 'pink', bg: '#f472b6', label: 'Pink' },
  { name: 'orange', bg: '#fb923c', label: 'Orange' },
]
</script>

<template>
  <div
    class="relative flex min-h-0 flex-1 flex-col overflow-hidden transition-colors"
    :style="{ background: themeDef.bg, color: themeDef.fg }"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <!-- Top chrome -->
    <header
      class="z-30 flex items-center gap-2 border-b px-3 py-2 transition-all sm:px-4"
      :class="chromeVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'"
      :style="{ borderColor: themeDef.border, background: themeDef.bg }"
      aria-label="Reader toolbar"
    >
      <button
        type="button"
        class="rounded-full p-2 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        aria-label="Back to library"
        @click="emit('back')"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>

      <div class="min-w-0 flex-1">
        <h1 class="clamp-1 text-sm font-semibold leading-tight">{{ reader.bookTitle || 'Reading…' }}</h1>
        <p class="clamp-1 text-xs opacity-60">{{ reader.bookAuthor }}</p>
      </div>

      <button
        type="button"
        class="rounded-full p-2 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        :aria-expanded="sidebarOpen"
        aria-label="Toggle contents panel"
        @click="sidebarOpen = !sidebarOpen"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round" /></svg>
      </button>
      <button
        type="button"
        class="rounded-full p-2 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        :aria-expanded="searchOpen"
        aria-label="Toggle search panel"
        @click="searchOpen = !searchOpen; settingsOpen = false"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" stroke-linecap="round" /></svg>
      </button>
      <button
        type="button"
        class="rounded-full p-2 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        :aria-expanded="settingsOpen"
        aria-label="Toggle reading settings"
        @click="settingsOpen = !settingsOpen; searchOpen = false"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke-linecap="round" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
      </button>
      <button
        type="button"
        class="rounded-full p-2 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        :aria-label="fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        @click="toggleFullscreen"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" stroke-linecap="round" /></svg>
      </button>
      <button
        type="button"
        class="rounded-full p-2 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        aria-label="Hide controls (C)"
        title="Hide controls (C)"
        @click="toggleChrome"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke-linejoin="round" /><circle cx="12" cy="12" r="3" /></svg>
      </button>
    </header>

    <!-- Body: sidebar + reading surface -->
    <div class="relative flex min-h-0 flex-1">
      <!-- Sidebar -->
      <aside
        v-if="sidebarOpen || searchOpen || settingsOpen"
        class="absolute inset-y-0 left-0 z-20 flex w-[320px] max-w-[85vw] flex-col border-r shadow-xl sm:static sm:w-[340px] sm:shadow-none"
        :style="{ background: themeDef.bg, borderColor: themeDef.border }"
        :aria-label="searchOpen ? 'Search panel' : settingsOpen ? 'Settings panel' : 'Contents panel'"
      >
        <div v-if="searchOpen" class="flex min-h-0 flex-1 flex-col p-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold">Search</h2>
            <button type="button" class="rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close search" @click="searchOpen = false">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" /></svg>
            </button>
          </div>
          <SearchPanel />
        </div>

        <div v-else-if="settingsOpen" class="min-h-0 flex-1 overflow-y-auto p-4">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-semibold">Reading settings</h2>
            <button type="button" class="rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close settings" @click="settingsOpen = false">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" /></svg>
            </button>
          </div>
          <SettingsPanel />
        </div>

        <div v-else class="flex min-h-0 flex-1 flex-col">
          <div class="flex items-center gap-1 border-b p-2" :style="{ borderColor: themeDef.border }" role="tablist" aria-label="Sidebar tabs">
            <button
              v-for="tab in (['toc', 'bookmarks', 'notes'] as const)"
              :key="tab"
              type="button"
              role="tab"
              :aria-selected="sideTab === tab"
              class="flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition focus-visible:ring-2 focus-visible:ring-indigo-500"
              :class="sideTab === tab ? 'bg-indigo-600 text-white' : 'opacity-70 hover:opacity-100'"
              @click="sideTab = tab"
            >
              {{ tab === 'toc' ? 'Contents' : tab === 'bookmarks' ? 'Bookmarks' : 'Notes' }}
            </button>
            <button type="button" class="rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close sidebar" @click="sidebarOpen = false">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" /></svg>
            </button>
          </div>

          <div v-if="sideTab === 'toc'" class="min-h-0 flex-1 overflow-y-auto p-3">
            <div v-if="reader.toc.length === 0" class="py-8 text-center text-sm opacity-60">No table of contents in this book.</div>
            <TocTree v-else :items="reader.toc" @select="(href) => { void reader.goTo(href); sidebarOpen = false }" />
          </div>

          <div v-else-if="sideTab === 'bookmarks'" class="min-h-0 flex-1 overflow-y-auto p-3">
            <button
              type="button"
              class="mb-3 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
              @click="reader.addBookmark().then(() => showToast('Bookmark added'))"
            >
              + Bookmark this page
            </button>
            <div v-if="reader.bookmarks.length === 0" class="py-8 text-center text-sm opacity-60">No bookmarks yet. Press B to bookmark the current page.</div>
            <ul v-else class="space-y-1">
              <li v-for="bm in reader.bookmarks" :key="bm.id" class="group flex items-center gap-1">
                <button type="button" class="min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-[13px] hover:bg-black/5 dark:hover:bg-white/10" @click="reader.goTo(bm.cfi)">
                  {{ bm.label }}
                </button>
                <button type="button" class="rounded-full p-1.5 opacity-0 transition hover:text-red-600 focus:opacity-100 group-hover:opacity-100" :aria-label="`Delete bookmark ${bm.label}`" @click="reader.removeBookmark(bm.id)">
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" /></svg>
                </button>
              </li>
            </ul>
          </div>

          <div v-else class="min-h-0 flex-1 overflow-y-auto p-3">
            <div v-if="reader.annotations.length === 0" class="py-8 text-center text-sm opacity-60">
              No highlights yet. Select text in the book to highlight it.
            </div>
            <ul v-else class="space-y-2">
              <li v-for="a in reader.annotations" :key="a.id" class="rounded-xl border p-3" :style="{ borderColor: themeDef.border }">
                <button type="button" class="w-full text-left" @click="reader.showAnnotation(a.cfi)">
                  <span class="clamp-2 text-[13px] leading-relaxed">{{ a.excerpt }}</span>
                </button>
                <div v-if="editingNote?.id === a.id" class="mt-2">
                  <label class="sr-only" :for="`note-${a.id}`">Edit note</label>
                  <textarea :id="`note-${a.id}`" v-model="editingNote.text" rows="2" class="w-full rounded-lg border px-2 py-1.5 text-sm" :style="{ background: themeDef.bg, borderColor: themeDef.border, color: themeDef.fg }" />
                  <div class="mt-1 flex gap-1">
                    <button type="button" class="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white" @click="reader.updateAnnotationNote(a.id, editingNote.text).then(() => { editingNote = null; showToast('Note saved') })">Save</button>
                    <button type="button" class="rounded-full border px-3 py-1 text-xs" :style="{ borderColor: themeDef.border }" @click="editingNote = null">Cancel</button>
                  </div>
                </div>
                <p v-else-if="a.note" class="mt-1 text-xs opacity-70">{{ a.note }}</p>
                <div class="mt-2 flex items-center gap-1">
                  <button type="button" class="rounded-full border px-2 py-1 text-[11px] opacity-70 hover:opacity-100" :style="{ borderColor: themeDef.border }" @click="editingNote = { id: a.id, text: a.note }">{{ a.note ? 'Edit note' : 'Add note' }}</button>
                  <button type="button" class="rounded-full border px-2 py-1 text-[11px] text-red-600 opacity-70 hover:opacity-100" :style="{ borderColor: themeDef.border }" @click="reader.removeAnnotation(a.id).then(() => showToast('Highlight removed'))">Delete</button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <!-- Reading surface -->
      <main class="relative min-w-0 flex-1" aria-label="Reading area">
        <div v-if="reader.loading" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3" :style="{ background: themeDef.bg }">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" aria-hidden="true" />
          <p class="text-sm opacity-70">Opening book…</p>
        </div>
        <div v-else-if="reader.loadError" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center" :style="{ background: themeDef.bg }">
          <p class="max-w-md text-sm" role="alert">{{ reader.loadError }}</p>
          <button type="button" class="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500" @click="emit('back')">Back to library</button>
        </div>

        <!-- foliate-view host — explicit dimensions for pagination.
             No overlay tap-zones here: they would block text selection.
             Navigation is via footer buttons, keyboard, and swipe. -->
        <div
          ref="hostRef"
          class="absolute inset-0"
          :style="{ background: themeDef.bg }"
        />

        <!-- Floating chrome toggle (non-blocking; full-screen overlay would break selection) -->
        <button
          v-if="!chromeVisible && !reader.loading && !reader.loadError"
          type="button"
          class="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur transition hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-indigo-400"
          aria-label="Show controls"
          @click="toggleChrome"
        >
          Show controls
        </button>

        <!-- Highlight popup -->
        <div
          v-if="highlightMenu"
          class="absolute z-40 w-64 -translate-x-1/2 rounded-2xl border bg-white p-3 shadow-xl dark:bg-zinc-900 dark:border-zinc-700"
          :style="{ left: '50%', top: '12%' }"
          role="dialog"
          aria-label="Create highlight"
          @click.stop
        >
          <p class="clamp-2 text-xs text-zinc-500 dark:text-zinc-400">“{{ highlightMenu.excerpt }}”</p>
          <div class="mt-2 flex items-center gap-1.5" role="radiogroup" aria-label="Highlight color">
            <button
              v-for="c in colorSwatches"
              :key="c.name"
              type="button"
              role="radio"
              :aria-checked="highlightColor === c.name"
              :aria-label="c.label"
              class="h-6 w-6 rounded-full border-2 transition focus-visible:ring-2 focus-visible:ring-indigo-500"
              :class="highlightColor === c.name ? 'border-indigo-600 scale-110' : 'border-transparent'"
              :style="{ background: c.bg }"
              @click="highlightColor = c.name"
            />
          </div>
          <label class="sr-only" for="highlight-note">Note (optional)</label>
          <textarea
            id="highlight-note"
            v-model="highlightNote"
            rows="2"
            placeholder="Add a note…"
            class="mt-2 w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          <div class="mt-2 flex gap-2">
            <button type="button" class="flex-1 rounded-full bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500" @click="saveHighlight">Save highlight</button>
            <button type="button" class="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" @click="highlightMenu = null">Cancel</button>
          </div>
        </div>

      </main>
    </div>

    <!-- Bottom chrome -->
    <footer
      class="z-30 flex items-center gap-2 border-t px-3 py-2 transition-all sm:px-4"
      :class="chromeVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'"
      :style="{ borderColor: themeDef.border, background: themeDef.bg }"
      aria-label="Reading progress"
    >
      <button
        type="button"
        class="rounded-full p-2 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        aria-label="Previous page"
        @click="reader.goLeft()"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>

      <div class="min-w-0 flex-1">
        <label class="sr-only" for="progress-slider">Reading progress</label>
        <input
          id="progress-slider"
          type="range"
          min="0"
          max="1"
          step="0.001"
          :value="reader.fraction"
          class="w-full"
          @input="onProgressInput"
        />
        <div class="flex items-center justify-between text-[11px] opacity-60">
          <span class="clamp-1 min-w-0 flex-1 truncate">{{ reader.tocLabel || '—' }}</span>
          <span class="tabular-nums shrink-0">{{ progressPct }}%{{ reader.pageLabel ? ` · p. ${reader.pageLabel}` : '' }}</span>
        </div>
      </div>

      <button
        type="button"
        class="rounded-full p-2 transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10"
        aria-label="Next page"
        @click="reader.goRight()"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </footer>

    <!-- Toast -->
    <div v-if="toast" class="pointer-events-none absolute bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900" role="status" aria-live="polite">
      {{ toast }}
    </div>

    <span class="sr-only" aria-live="polite">{{ isDarkChrome ? 'Dark theme active' : '' }}</span>
  </div>
</template>
