import { supabase } from '@/lib/supabase'
import type { Bookmark } from '@/types'

/**
 * 북마크 저장소.
 * 비로그인: localStorage / 로그인: Supabase (bookmarks 테이블, RLS로 본인 행만)
 */
export interface BookmarkRepository {
  list(): Promise<Bookmark[]>
  saveMany(bookmarks: Bookmark[]): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'sql-cert:bookmarks'

export class LocalBookmarkRepository implements BookmarkRepository {
  private read(): Record<string, Bookmark> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  private write(data: Record<string, Bookmark>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async list() {
    return Object.values(this.read())
  }

  async saveMany(bookmarks: Bookmark[]) {
    const data = this.read()
    for (const b of bookmarks) data[b.key] = b
    this.write(data)
  }

  async remove(key: string) {
    const data = this.read()
    delete data[key]
    this.write(data)
  }

  async clear() {
    localStorage.removeItem(STORAGE_KEY)
  }
}

interface BookmarkRow {
  key: string
  exam_id: string
  question_id: number
  created_at: string
  updated_at: string
}

const toRow = (b: Bookmark): BookmarkRow => ({
  key: b.key,
  exam_id: b.examId,
  question_id: b.questionId,
  created_at: b.createdAt,
  updated_at: b.updatedAt,
})

const fromRow = (r: BookmarkRow): Bookmark => ({
  key: r.key,
  examId: r.exam_id,
  questionId: r.question_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export class SupabaseBookmarkRepository implements BookmarkRepository {
  private get db() {
    if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
    return supabase.from('bookmarks')
  }

  async list() {
    const { data, error } = await this.db.select('*')
    if (error) throw error
    return (data as BookmarkRow[]).map(fromRow)
  }

  async saveMany(bookmarks: Bookmark[]) {
    if (!bookmarks.length) return
    // user_id 는 DB 기본값 auth.uid() 로 채워진다
    const { error } = await this.db.upsert(bookmarks.map(toRow), { onConflict: 'user_id,key' })
    if (error) throw error
  }

  async remove(key: string) {
    const { error } = await this.db.delete().eq('key', key)
    if (error) throw error
  }

  async clear() {
    // 서버 데이터는 계정에 속하므로 지우지 않는다
  }
}

export const localBookmarks = new LocalBookmarkRepository()
export const remoteBookmarks = new SupabaseBookmarkRepository()
