import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getSupabase,
  supabaseConfigured,
  isoNow,
  msToIso,
  type Database,
} from '../lib/supabase'
import type { BookRecord, AnnotationRecord, BookmarkRecord } from '../types'

type Tables = Database['public']['Tables']

export const useSyncStore = defineStore('sync', () => {
  const configured = computed(() => supabaseConfigured)

  const user = ref<any>(null)
  const session = ref<any>(null)
  const syncStatus = ref<'idle' | 'syncing' | 'error'>('idle')
  const error = ref<string | null>(null)

  function setError(msg: string | null) {
    error.value = msg
    if (msg) syncStatus.value = 'error'
  }

  function clearError() {
    error.value = null
  }

  async function init() {
    if (!configured.value) return
    const sb = getSupabase()
    if (!sb) return
    const { data } = await sb.auth.getSession()
    session.value = data.session ?? null
    user.value = data.session?.user ?? null

    sb.auth.onAuthStateChange(async (event, sess) => {
      session.value = sess ?? null
      user.value = sess?.user ?? null
      if (event === 'SIGNED_IN') {
        syncStatus.value = 'idle'
      }
    })
  }

  // ---- Auth ----

  async function signUp(email: string, password: string) {
    if (!configured.value) throw new Error('Supabase is not configured')
    const sb = getSupabase()!
    syncStatus.value = 'syncing'
    setError(null)
    try {
      const { data, error: err } = await sb.auth.signUp({ email, password })
      if (err) throw err
      if (data.user) user.value = data.user
      session.value = data.session ?? null
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed')
      throw e
    } finally {
      if (!error.value) syncStatus.value = 'idle'
    }
  }

  async function signIn(email: string, password: string) {
    if (!configured.value) throw new Error('Supabase is not configured')
    const sb = getSupabase()!
    syncStatus.value = 'syncing'
    setError(null)
    try {
      const { data, error: err } = await sb.auth.signInWithPassword({ email, password })
      if (err) throw err
      user.value = data.user
      session.value = data.session ?? null
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
      throw e
    } finally {
      if (!error.value) syncStatus.value = 'idle'
    }
  }

  async function signOut() {
    if (!configured.value) return
    const sb = getSupabase()!
    try {
      await sb.auth.signOut()
    } finally {
      user.value = null
      session.value = null
      syncStatus.value = 'idle'
    }
  }

  const signedIn = computed(() => !!user.value)

  // ---- Helpers ----

  async function requireUser() {
    if (!configured.value) throw new Error('Cloud sync is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    if (!user.value) throw new Error('Not signed in')
    return getSupabase()!
  }

  // ---- Books ----

  /**
   * Pull cloud books for the current user. Returns rows; the caller merges
     * them into local IndexedDB (last-write-wins, never deletes local copies).
   */
  async function pullBooks() {
    const sb = await requireUser()
    const { data, error: err } = await sb
      .from('books')
      .select('*')
      .order('last_read_at', { ascending: false, nullsFirst: true })
    if (err) throw err
    return (data ?? []) as unknown as Tables['books']['Row'][]
  }

  /**
   * Push a local book record to the cloud (EPUB bytes are NOT synced —
   * only metadata/progress; `data` stays on-device in IndexedDB).
   */
  async function pushBook(book: BookRecord) {
    const sb = await requireUser()
    const { error: err } = await sb
      .from('books')
      .upsert({
        id: book.id,
        user_id: user.value!.id,
        title: book.title,
        author: book.author,
        file_name: book.fileName,
        file_size: book.fileSize,
        file_hash: '',
        cover_url: book.coverUrl,
        progress: book.progress,
        cfi: book.cfi,
        toc_label: book.tocLabel,
        last_read_at: book.lastReadAt ? msToIso(book.lastReadAt) : null,
        updated_at: isoNow(),
      })
    if (err) throw err
  }

  async function deleteRemoteBook(bookId: string) {
    const sb = await requireUser()
    const { error: err } = await sb.from('books').delete().eq('id', bookId)
    if (err) throw err
  }

  // ---- Reading position ----

  async function pullPosition(bookId: string) {
    const sb = await requireUser()
    const { data, error: err } = await sb
      .from('reading_positions')
      .select('*')
      .eq('book_id', bookId)
      .maybeSingle()
    if (err) throw err
    return (data ?? null) as unknown as Tables['reading_positions']['Row'] | null
  }

  async function pushPosition(bookId: string, cfi: string | null, fraction: number, tocLabel: string | null) {
    const sb = await requireUser()
    const now = isoNow()
    const { error: err } = await sb.from('reading_positions').upsert({
      book_id: bookId,
      user_id: user.value!.id,
      cfi: cfi ?? '',
      fraction,
      toc_label: tocLabel,
      updated_at: now,
    }, { onConflict: 'book_id, user_id' })
    if (err) throw err
    // Keep parent book progress in sync too
    await sb.from('books').update({
      progress: fraction,
      cfi,
      toc_label: tocLabel,
      last_read_at: now,
      updated_at: now,
    }).eq('id', bookId)
  }

  // ---- Annotations ----

  async function pullAnnotations(bookId: string) {
    const sb = await requireUser()
    const { data, error: err } = await sb
      .from('annotations')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: true })
    if (err) throw err
    return (data ?? []) as unknown as Tables['annotations']['Row'][]
  }

  async function pushAnnotation(ann: AnnotationRecord) {
    const sb = await requireUser()
    const { error: err } = await sb.from('annotations').upsert({
      id: ann.id,
      book_id: ann.bookId,
      user_id: user.value!.id,
      cfi: ann.cfi,
      color: ann.color,
      note: ann.note,
      excerpt: ann.excerpt,
      created_at: msToIso(ann.createdAt),
      updated_at: msToIso(ann.updatedAt),
    })
    if (err) throw err
  }

  async function deleteRemoteAnnotation(id: string) {
    const sb = await requireUser()
    const { error: err } = await sb.from('annotations').delete().eq('id', id)
    if (err) throw err
  }

  // ---- Bookmarks ----

  async function pullBookmarks(bookId: string) {
    const sb = await requireUser()
    const { data, error: err } = await sb
      .from('bookmarks')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: true })
    if (err) throw err
    return (data ?? []) as unknown as Tables['bookmarks']['Row'][]
  }

  async function pushBookmark(bm: BookmarkRecord) {
    const sb = await requireUser()
    const { error: err } = await sb.from('bookmarks').upsert({
      id: bm.id,
      book_id: bm.bookId,
      user_id: user.value!.id,
      cfi: bm.cfi,
      label: bm.label,
      created_at: msToIso(bm.createdAt),
    })
    if (err) throw err
  }

  async function deleteRemoteBookmark(id: string) {
    const sb = await requireUser()
    const { error: err } = await sb.from('bookmarks').delete().eq('id', id)
    if (err) throw err
  }

  return {
    configured,
    user,
    session,
    signedIn,
    syncStatus,
    error,
    init,
    signUp,
    signIn,
    signOut,
    clearError,
    pullBooks,
    pushBook,
    deleteRemoteBook,
    pullPosition,
    pushPosition,
    pullAnnotations,
    pushAnnotation,
    deleteRemoteAnnotation,
    pullBookmarks,
    pushBookmark,
    deleteRemoteBookmark,
  }
})
