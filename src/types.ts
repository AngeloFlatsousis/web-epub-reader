export interface BookRecord {
  id: string
  title: string
  author: string
  coverUrl: string | null
  fileName: string
  fileSize: number
  addedAt: number
  lastReadAt: number | null
  progress: number // 0..1
  cfi: string | null
  tocLabel: string | null
  data: ArrayBuffer
}

export interface BookMeta {
  id: string
  title: string
  author: string
  coverUrl: string | null
  fileName: string
  fileSize: number
  addedAt: number
  lastReadAt: number | null
  progress: number
  cfi: string | null
  tocLabel: string | null
}

export interface PositionRecord {
  bookId: string
  cfi: string
  fraction: number
  tocLabel: string | null
  updatedAt: number
}

export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export interface AnnotationRecord {
  id: string
  bookId: string
  cfi: string
  color: AnnotationColor
  note: string
  excerpt: string
  createdAt: number
  updatedAt: number
}

export interface BookmarkRecord {
  id: string
  bookId: string
  cfi: string
  label: string
  createdAt: number
}

export type ThemeName = 'light' | 'dark' | 'sepia' | 'warm'
export type FlowMode = 'paginated' | 'scrolled'
export type TextAlign = 'left' | 'justify' | 'center'

export interface ReaderSettings {
  theme: ThemeName
  fontSize: number // px, 14..24
  fontFamily: string
  lineHeight: number // 1.2..2.0
  textAlign: TextAlign
  flow: FlowMode
  hyphenate: boolean
  justify: boolean
  maxInlineSize: number // px, 0 = auto
  animated: boolean
}

export interface TocItem {
  label: string
  href: string
  subitems?: TocItem[]
}

export interface SearchResultItem {
  cfi: string
  excerpt: string
}

export interface SearchSectionResult {
  label: string
  index: number
  subitems: SearchResultItem[]
}
