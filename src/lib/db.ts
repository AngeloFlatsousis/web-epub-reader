import { openDB, type IDBPDatabase } from 'idb'
import type { AnnotationRecord, BookmarkRecord, BookRecord, PositionRecord } from '../types'

const DB_NAME = 'openbook-epub-reader'
const DB_VERSION = 1

export interface OpenBookDB {
  books: {
    key: string
    value: BookRecord
    indexes: { addedAt: number }
  }
  positions: {
    key: string
    value: PositionRecord
  }
  annotations: {
    key: string
    value: AnnotationRecord
    indexes: { bookId: string }
  }
  bookmarks: {
    key: string
    value: BookmarkRecord
    indexes: { bookId: string }
  }
}

let dbPromise: Promise<IDBPDatabase<OpenBookDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OpenBookDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          const books = db.createObjectStore('books', { keyPath: 'id' })
          books.createIndex('addedAt', 'addedAt')
        }
        if (!db.objectStoreNames.contains('positions')) {
          db.createObjectStore('positions', { keyPath: 'bookId' })
        }
        if (!db.objectStoreNames.contains('annotations')) {
          const ann = db.createObjectStore('annotations', { keyPath: 'id' })
          ann.createIndex('bookId', 'bookId')
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bm = db.createObjectStore('bookmarks', { keyPath: 'id' })
          bm.createIndex('bookId', 'bookId')
        }
      },
    })
  }
  return dbPromise
}

export async function listBooks(): Promise<BookRecord[]> {
  const db = await getDB()
  const all = await db.getAll('books')
  return all.sort((a, b) => b.addedAt - a.addedAt)
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = await getDB()
  return db.get('books', id)
}

export async function putBook(book: BookRecord) {
  const db = await getDB()
  await db.put('books', book)
}

export async function deleteBook(id: string) {
  const db = await getDB()
  const tx = db.transaction(['books', 'positions', 'annotations', 'bookmarks'], 'readwrite')
  await tx.objectStore('books').delete(id)
  await tx.objectStore('positions').delete(id)
  const annIdx = tx.objectStore('annotations').index('bookId')
  const annKeys = await annIdx.getAllKeys(id)
  for (const k of annKeys) await tx.objectStore('annotations').delete(k)
  const bmIdx = tx.objectStore('bookmarks').index('bookId')
  const bmKeys = await bmIdx.getAllKeys(id)
  for (const k of bmKeys) await tx.objectStore('bookmarks').delete(k)
  await tx.done
}

export async function updateBookProgress(
  id: string,
  patch: Partial<Pick<BookRecord, 'progress' | 'cfi' | 'tocLabel' | 'lastReadAt'>>,
) {
  const db = await getDB()
  const book = await db.get('books', id)
  if (!book) return
  const next = { ...book, ...patch, updatedAt: Date.now() }
  await db.put('books', next)
  await db.put('positions', {
    bookId: id,
    cfi: patch.cfi ?? book.cfi ?? '',
    fraction: patch.progress ?? book.progress ?? 0,
    tocLabel: patch.tocLabel ?? book.tocLabel ?? null,
    updatedAt: Date.now(),
  } satisfies PositionRecord)
}

export async function getPosition(bookId: string): Promise<PositionRecord | undefined> {
  const db = await getDB()
  return db.get('positions', bookId)
}

export async function listAnnotations(bookId: string): Promise<AnnotationRecord[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('annotations', 'bookId', bookId)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putAnnotation(a: AnnotationRecord) {
  const db = await getDB()
  await db.put('annotations', a)
}

export async function deleteAnnotation(id: string) {
  const db = await getDB()
  await db.delete('annotations', id)
}

export async function listBookmarks(bookId: string): Promise<BookmarkRecord[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('bookmarks', 'bookId', bookId)
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putBookmark(b: BookmarkRecord) {
  const db = await getDB()
  await db.put('bookmarks', b)
}

export async function deleteBookmark(id: string) {
  const db = await getDB()
  await db.delete('bookmarks', id)
}
