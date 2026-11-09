# OpenBook — Client-Side EPUB Reader

A polished, production-ready EPUB reading experience that runs **entirely in the browser**. No backend required for the core experience: your library, reading positions, highlights, and bookmarks live in IndexedDB on your device. Optional Supabase sync (Milestone 2) is documented but not required.

**Live demo:** deploy to Vercel (`npm run build` → `dist/`). See [Deployment](#deployment).

![Stack](https://img.shields.io/badge/Vue%203-42b883) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6) ![Vite](https://img.shields.io/badge/Vite-646cff) ![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-06b6d4) ![foliate-js](https://img.shields.io/badge/foliate--js-0ea5e9)

---

## Features

### Library & file handling
- Drag-and-drop or picker-based EPUB ingestion (multi-file supported)
- Metadata extraction (title, author, cover) via foliate-js `makeBook`
- Persistent local library in IndexedDB (`idb`), resume from last-read CFI
- Search, sort (recent / title / progress), progress bars, “Finished” state
- Two bundled public-domain samples for instant validation:
  - `public/samples/alice.epub` — standard novel (text only, 3 chapters)
  - `public/samples/illustrated.epub` — book with cover + inline figures + table

### Rendering & navigation
- **Paginated and scrolled flow modes** (switch without reload — foliate paginator)
- TOC sidebar (recursive tree, current-chapter highlight)
- Progress slider with section tick marks + chapter / page labels
- Keyboard arrows (`←` / `→`), touch swipe, footer prev/next buttons
- Full-screen distraction-free mode (`F` or button), auto-hiding chrome (click centre to toggle)
- RTL-aware navigation (`goLeft` / `goRight` respect `book.dir`)

### Reading customization
- Themes: **Light / Dark / Sepia / Warm** (injected CSS via `renderer.setStyles()`)
- Font size (14–26px), family (5 curated stacks incl. dyslexia-friendly), line height (1.2–2.0), alignment, column width, hyphenation, justification
- Page-turn animation toggle; all settings persist to `localStorage`

### Annotations & search
- Bookmarks (button or `B` key), stored per-book
- Text highlights with 5 colours + optional notes (select text → popup)
- Full-text search across chapters via foliate-js `search()` async generator, with in-text outline highlighting, result list, and prev/next cycling

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 (host 0.0.0.0 for preview)
npm run build      # vue-tsc + vite build → dist/
npm run preview    # preview production build
```

No environment variables are required for the local-only MVP. Cloud sync (Supabase) requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — see [Supabase](#supabase-milestone-2-optional-sync) and [Vercel](#vercel).

### Validate with the samples
1. Open the app → click **“Try sample: Alice (text)”** and **“Try sample: Illustrated”** (or drag the files from `public/samples/`).
2. Open each book: check TOC navigation, progress slider, theme switching, search for a word (e.g. “Alice” / “garden”), highlight a sentence, add a bookmark, then reload — position and notes should persist.
3. Test keyboard (`←`/`→`), swipe on mobile, and fullscreen (`F`).

Regenerate samples any time:

```bash
python3 scripts/make_samples.py
```

---

## Architecture

```
src/
  main.ts                  — Vue + Pinia bootstrap
  App.vue                  — library ↔ reader view switch (no router needed; state is tiny)
  types.ts                 — BookRecord, AnnotationRecord, ReaderSettings, …
  lib/
    db.ts                  — IndexedDB via `idb` (books / positions / annotations / bookmarks)
    epub.ts                — metadata sanitization, hashing, themes, reader CSS builder
    supabase.ts            — Supabase client + `Database` types (Milestone 2)
  stores/
    library.ts             — import (makeBook → sanitize → put), dedupe by hash, progress, cloud push/pull
    reader.ts              — foliate-view lifecycle, search, annotations, bookmarks, cloud sync
    settings.ts            — persisted reader settings (localStorage)
    sync.ts                — Supabase auth + push/pull for books, positions, annotations, bookmarks (Milestone 2)
  components/
    LibraryView.vue        — header, search/sort, drag-drop overlay, grid, sync button
    AuthPanel.vue          — sign in / sign up / sign out, sync status (Milestone 2)
    BookCard.vue           — cover, progress, last-read, remove, “Cloud” badge
    ReaderView.vue         — foliate-view host, chrome, sidebar, highlight popup, swipe
    TocTree.vue            — recursive TOC
    SettingsPanel.vue      — theme / layout / typography controls
    SearchPanel.vue        — search input, progress, results, cycling
  foliate-js.d.ts          — ambient types for untyped foliate-js modules
public/samples/            — alice.epub, illustrated.epub
supabase/schema.sql        — Milestone 2 sync schema (RLS)
scripts/make_samples.py    — sample EPUB generator
```

### Data model (IndexedDB `openbook-epub-reader`, v1)

| Store | Key | Contents |
|---|---|---|
| `books` | `id` (content hash) | title, author, coverUrl, fileName, fileSize, addedAt, lastReadAt, progress, cfi, tocLabel, **updatedAt**, **hasData**, **data: ArrayBuffer** |
| `positions` | `bookId` | cfi, fraction, tocLabel, updatedAt |
| `annotations` | `id` | bookId, cfi, color, note, excerpt, timestamps |
| `bookmarks` | `id` | bookId, cfi, label, createdAt |

Book `id` is a stable FNV-1a hash over the first 64 KB + file size, so re-importing the same EPUB dedupes instead of duplicating.

### Rendering-engine choice: foliate-js (not epub.js)

| Criterion | **foliate-js** ✅ | epub.js |
|---|---|---|
| Pagination | Dedicated `paginator.js` (CSS multi-column + bisecting visible-range; more accurate than epub.js) | CSS multi-column; known perf / style quirks |
| Flow switching | Paginated ↔ scrolled **without reload** | Requires rendition re-creation |
| Annotations | First-class `overlayer.js` + `view.addAnnotation()` / `draw-annotation` events | Manual overlay management |
| Search | Built-in `search.js` (Intl.Collator/Segmenter, diacritic-insensitive) + async-generator API | No built-in full-text search |
| Progress | `progress.js` (SectionProgress / TOCProgress) + `getSectionFractions()` | Manual CFI math |
| CFI | Full `epubcfi.js` parser (range CFIs, spatial/temporal offsets) | CFI support present but less complete |
| Dependencies | Pure JS, no build step, ES modules, tiny | Heavier, jQuery-era patterns |
| Loading | `view.open(File/Blob)` — ArrayBuffer/Blob preferred over URL (avoids epub.js percentage-sizing pitfall) | URL loading common; container needs explicit px dimensions |

**Trade-offs acknowledged:** foliate-js is pre-1.0 (“API may change”) and requires CSP to block EPUB scripts (see Security). We pin `foliate-js@1.0.1` from npm and isolate usage behind `stores/reader.ts` + `lib/epub.ts`, so a future swap is contained. The paginator host uses explicit `width:100%; height:100%` (pixel-backed) — never percentage-only sizing — per the epub.js pitfall guidance, which applies equally here.

### Security (untrusted EPUB content)

EPUBs are untrusted HTML/CSS/JS. Defences, in depth:

1. **CSP (meta + Vercel headers):** `script-src 'self'` blocks all EPUB scripts; `object-src 'none'`; `frame-src blob: data:` only. This is the control foliate-js itself mandates (its README: *“Do NOT use this library without CSP”*).
2. **No `allow-scripts` + `allow-same-origin` combo:** foliate-js renders via `DOMParser`-created documents + blob URLs, never by executing EPUB `<script>` tags. Scripts are stripped at parse time; the paginator’s internal iframe does not run book scripts.
3. **Metadata sanitization:** titles/authors pass through `DOMPurify` (text-only) + length caps in `lib/epub.ts` before touching the parent DOM. Vue interpolation auto-escapes the rest. Cover images are `blob:` URLs from `book.getCover()`, never `data:` HTML.
4. **External links:** intercepted via `external-link` event → `window.open(..., 'noopener,noreferrer')`.

### Accessibility (WCAG 2.1 AA target)

- Semantic landmarks (`header`, `main`, `nav`, `footer`), skip link, hierarchical headings
- Every icon-only button has `aria-label`; form controls have `<label>`; TOC uses `aria-expanded` / `aria-current`; progress uses `role="progressbar"`; toasts use `aria-live="polite"`
- Visible `:focus-visible` rings everywhere (never `outline: none` without replacement)
- Full keyboard operability: arrows, `B` (bookmark), `F` (fullscreen), `C` (toggle chrome), `Esc` (close panels)
- `prefers-reduced-motion` disables animations/transitions; animation is `transform`/`opacity` only
- Responsive: library grid 2→5 columns, sidebar overlays on mobile / docks on desktop, reading surface fluid

### Performance (Vercel React Best Practices, adapted to Vue)

- Code-splitting: foliate-js sub-modules (`epub`, `paginator`, `search`, `overlayer`, `zip`) are dynamic `import()` chunks — the initial bundle is ~58 KB gzip
- No layout reads in render; progress persistence rides the existing `relocate` event
- Covers use `loading="lazy"` + explicit `width`/`height` (no CLS); long TOC/search lists are small enough to avoid virtualization (noted as a future step if books exceed ~500 TOC items)

---

## Supabase (Milestone 2 — optional cross-device sync)

The MVP is local-only by design. Everything works without Supabase. If you want your library, reading positions, highlights and bookmarks to follow you across devices, enable sync:

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor (tables, RLS policies, indexes, `updated_at` triggers).
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (local) and in your Vercel project settings (production) — see [`.env.example`](.env.example).
3. Sign in with email + password in the app (“Cloud sync” button in the library header). Sign-up is open and auto-confirmed.

**Sync model:** last-write-wins on `updated_at`. Pulling merges cloud rows into IndexedDB and never deletes local books; pushing upserts metadata/positions/annotations/bookmarks. **EPUB file bytes are never synced** — they stay on the device that imported them. A book mirrored from the cloud shows a “Cloud” badge; import its EPUB locally to read it (import dedupes by content hash, and positions/notes re-attach by CFI).

All four tables have RLS (`auth.uid() = user_id`), so users only ever see their own rows. The Supabase **anon key is public by design** (it belongs in client code) — RLS, not key secrecy, enforces isolation.

**What syncs:** library metadata + progress, reading positions (CFI/fraction), highlights with notes, bookmarks.
**What does not sync:** EPUB bytes, reader settings (theme, font size, … stay in `localStorage`), per-device cover blob URLs.

---

## Deployment

### Vercel (recommended)

```bash
npm run build
npx vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard — `vercel.json` already sets the Vite framework, SPA rewrites, immutable asset caching, and the CSP/security headers.

**Required env vars in Vercel project settings** (target production, preview, development) for cloud sync: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them the app still works fully in local-only mode and shows a “Cloud sync not configured” hint.

### Any static host

Serve `dist/` with SPA fallback to `index.html` and the CSP header from `vercel.json`. The app has no server component.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (0.0.0.0:5173) |
| `npm run build` | `vue-tsc -b && vite build` |
| `npm run preview` | Preview production build |
| `python3 scripts/make_samples.py` | Regenerate sample EPUBs |

## License

MIT. Sample EPUBs contain public-domain excerpts (Lewis Carroll, 1865) generated for testing.
