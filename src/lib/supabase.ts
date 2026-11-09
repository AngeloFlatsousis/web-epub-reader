import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Minimal Supabase DB shape mirroring supabase/schema.sql (Milestone 2). */
export interface Database {
  public: {
    Tables: {
      books: {
        Row: BookRow & Record<string, unknown>
        Insert: BookInsert & Record<string, unknown>
        Update: BookUpdate & Record<string, unknown>
        Relationships: never[]
      }
      reading_positions: {
        Row: PositionRow & Record<string, unknown>
        Insert: PositionInsert & Record<string, unknown>
        Update: PositionUpdate & Record<string, unknown>
        Relationships: never[]
      }
      annotations: {
        Row: AnnotationRow & Record<string, unknown>
        Insert: AnnotationInsert & Record<string, unknown>
        Update: AnnotationUpdate & Record<string, unknown>
        Relationships: never[]
      }
      bookmarks: {
        Row: BookmarkRow & Record<string, unknown>
        Insert: BookmarkInsert & Record<string, unknown>
        Update: BookmarkUpdate & Record<string, unknown>
        Relationships: never[]
      }
    }
    Views: {}
    Functions: {}
    CompositeTypes: {}
    Enums: {}
  }
}

export interface BookRow {
  id: string
  user_id: string
  title: string
  author: string
  file_name: string
  file_size: number
  file_hash: string
  cover_url: string | null
  progress: number
  cfi: string | null
  toc_label: string | null
  added_at: string
  last_read_at: string | null
  created_at: string
  updated_at: string
}
export interface BookInsert {
  id: string
  user_id: string
  title: string
  author?: string
  file_name: string
  file_size?: number
  file_hash?: string
  cover_url?: string | null
  progress?: number
  cfi?: string | null
  toc_label?: string | null
  added_at?: string
  last_read_at?: string | null
}
export interface BookUpdate extends Partial<Omit<BookInsert, 'id' | 'user_id'>> {}

export interface PositionRow {
  book_id: string
  user_id: string
  cfi: string
  fraction: number
  toc_label: string | null
  updated_at: string
}
export interface PositionInsert {
  book_id: string
  user_id: string
  cfi?: string
  fraction?: number
  toc_label?: string | null
  updated_at?: string
}
export interface PositionUpdate extends Partial<PositionInsert> {}

export interface AnnotationRow {
  id: string
  book_id: string
  user_id: string
  cfi: string
  color: string
  note: string
  excerpt: string
  created_at: string
  updated_at: string
}
export interface AnnotationInsert {
  id: string
  book_id: string
  user_id: string
  cfi: string
  color?: string
  note?: string
  excerpt?: string
  created_at?: string
  updated_at?: string
}
export interface AnnotationUpdate extends Partial<AnnotationInsert> {}

export interface BookmarkRow {
  id: string
  book_id: string
  user_id: string
  cfi: string
  label: string
  created_at: string
}
export interface BookmarkInsert {
  id: string
  book_id: string
  user_id: string
  cfi: string
  label?: string
  created_at?: string
}
export interface BookmarkUpdate extends Partial<BookmarkInsert> {}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Configured when both env vars are present (set in .env / Vercel project settings). */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON)

let client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> | null {
  if (!supabaseConfigured) return null
  if (!client) {
    client = createClient<Database>(SUPABASE_URL!, SUPABASE_ANON!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}

export function isoNow(): string {
  return new Date().toISOString()
}

export function msToIso(ms: number): string {
  return new Date(ms).toISOString()
}

export function isoToMs(s: string | null): number | null {
  if (!s) return null
  return Date.parse(s)
}
