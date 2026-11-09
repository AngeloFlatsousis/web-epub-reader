import DOMPurify from 'dompurify'
import type { ReaderSettings, ThemeName } from '../types'

/**
 * Sanitize untrusted EPUB metadata before injecting into parent DOM.
 * foliate-js parses EPUB via DOMParser (scripts never execute), but
 * metadata strings (title/author) are still untrusted — we strip
 * any HTML and limit length.
 */
export function sanitizeText(input: unknown, maxLen = 500): string {
  if (input == null) return ''
  let s: string
  if (typeof input === 'string') s = input
  else if (typeof input === 'object') {
    // foliate-js metadata can be { en: "...", ja: "..." } or { name: "..." }
    const obj = input as Record<string, unknown>
    if (typeof obj.name === 'string') s = obj.name
    else {
      const keys = Object.keys(obj)
      const first = keys.length ? obj[keys[0]] : ''
      s = typeof first === 'string' ? first : ''
    }
  } else s = String(input)
  // Strip tags via DOMPurify (text mode) then collapse whitespace
  const clean = DOMPurify.sanitize(s, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
  return clean.replace(/\s+/g, ' ').trim().slice(0, maxLen)
}

export function formatContributor(contributor: unknown): string {
  if (!contributor) return 'Unknown author'
  if (Array.isArray(contributor)) {
    return contributor.map((c) => sanitizeText(c)).filter(Boolean).join(', ') || 'Unknown author'
  }
  return sanitizeText(contributor) || 'Unknown author'
}

export function formatTitle(title: unknown): string {
  return sanitizeText(title, 300) || 'Untitled book'
}

export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Hash ArrayBuffer for stable book id (FNV-1a over first 64KB + size) */
export function hashBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const sample = bytes.subarray(0, Math.min(bytes.length, 65536))
  let h = 0x811c9dc5
  for (let i = 0; i < sample.length; i++) {
    h ^= sample[i]!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `book-${h.toString(16)}-${bytes.length.toString(16)}`
}

export interface ThemeDef {
  bg: string
  fg: string
  link: string
  codeBg: string
  border: string
  colorScheme: 'light' | 'dark'
}

export const THEMES: Record<ThemeName, ThemeDef> = {
  light: {
    bg: '#ffffff',
    fg: '#1a1a1e',
    link: '#2563eb',
    codeBg: '#f4f4f5',
    border: '#e4e4e7',
    colorScheme: 'light',
  },
  dark: {
    bg: '#121216',
    fg: '#e4e4e7',
    link: '#93c5fd',
    codeBg: '#1f1f23',
    border: '#2e2e33',
    colorScheme: 'dark',
  },
  sepia: {
    bg: '#f4ecd8',
    fg: '#433422',
    link: '#7c4a1e',
    codeBg: '#ede0c8',
    border: '#d9c9a3',
    colorScheme: 'light',
  },
  warm: {
    bg: '#faf3e8',
    fg: '#3d2c1e',
    link: '#9a3412',
    codeBg: '#f0e2cc',
    border: '#e2d5bd',
    colorScheme: 'light',
  },
}

export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: 'Serif (Book)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Sans (Modern)', value: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { label: 'Mono (Code)', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  { label: 'Literary', value: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' },
  { label: 'Dyslexia-friendly', value: '"Atkinson Hyperlegible", Verdana, sans-serif' },
]

/**
 * Build the CSS injected into the foliate paginator via renderer.setStyles().
 * This is the single source of truth for reading typography + theme.
 */
export function buildReaderCSS(settings: ReaderSettings): string {
  const t = THEMES[settings.theme]
  const align = settings.textAlign === 'justify' || settings.justify ? 'justify' : settings.textAlign
  return `
@namespace epub "http://www.idpf.org/2007/ops";
html {
  color-scheme: ${t.colorScheme};
}
body {
  background: ${t.bg} !important;
  color: ${t.fg} !important;
  font-family: ${settings.fontFamily} !important;
  font-size: ${settings.fontSize}px !important;
  line-height: ${settings.lineHeight} !important;
}
p, li, blockquote, dd, h1, h2, h3, h4, h5, h6 {
  line-height: ${settings.lineHeight} !important;
  text-align: ${align} !important;
  -webkit-hyphens: ${settings.hyphenate ? 'auto' : 'manual'} !important;
  hyphens: ${settings.hyphenate ? 'auto' : 'manual'} !important;
  -webkit-hyphenate-limit-before: 3;
  -webkit-hyphenate-limit-after: 2;
  -webkit-hyphenate-limit-lines: 2;
  hanging-punctuation: allow-end last;
  widows: 2;
  orphans: 2;
}
[align="left"] { text-align: left !important; }
[align="right"] { text-align: right !important; }
[align="center"] { text-align: center !important; }
[align="justify"] { text-align: justify !important; }
a:link, a:visited { color: ${t.link} !important; }
pre, code {
  background: ${t.codeBg} !important;
  color: ${t.fg} !important;
  white-space: pre-wrap !important;
  word-break: break-word;
}
pre { padding: 12px; border-radius: 8px; border: 1px solid ${t.border}; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; max-width: 100%; }
th, td { border: 1px solid ${t.border}; padding: 6px 10px; }
aside[epub|type~="endnote"], aside[epub|type~="footnote"], aside[epub|type~="note"], aside[epub|type~="rearnote"] {
  display: none;
}
::selection { background: rgba(99, 102, 241, 0.25); }
`
}

export function themeToCssVars(theme: ThemeName): Record<string, string> {
  const t = THEMES[theme]
  return {
    '--reader-bg': t.bg,
    '--reader-fg': t.fg,
    '--reader-border': t.border,
  }
}
