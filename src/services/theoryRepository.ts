import { supabase } from '@/lib/supabase'
import type { TheoryRecord } from '@/types'

/**
 * 이론 학습 기록 저장소.
 * 비로그인: localStorage / 로그인: Supabase (theory_progress 테이블, RLS로 본인 행만)
 */
export interface TheoryRepository {
  list(): Promise<TheoryRecord[]>
  saveMany(records: TheoryRecord[]): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'sql-cert:theory'

export class LocalTheoryRepository implements TheoryRepository {
  private read(): Record<string, TheoryRecord> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  async list() {
    return Object.values(this.read())
  }

  async saveMany(records: TheoryRecord[]) {
    const data = this.read()
    for (const r of records) data[r.key] = r
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async clear() {
    localStorage.removeItem(STORAGE_KEY)
  }
}

interface TheoryRow {
  slug: string
  view_count: number
  last_viewed_at: string
  completed_at: string | null
  updated_at: string
}

const toRow = (r: TheoryRecord): TheoryRow => ({
  slug: r.key,
  view_count: r.viewCount,
  last_viewed_at: r.lastViewedAt,
  completed_at: r.completedAt ?? null,
  updated_at: r.updatedAt,
})

const fromRow = (r: TheoryRow): TheoryRecord => ({
  key: r.slug,
  viewCount: r.view_count,
  lastViewedAt: r.last_viewed_at,
  completedAt: r.completed_at ?? undefined,
  updatedAt: r.updated_at,
})

export class SupabaseTheoryRepository implements TheoryRepository {
  private get db() {
    if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
    return supabase.from('theory_progress')
  }

  async list() {
    const { data, error } = await this.db.select('*')
    if (error) throw error
    return (data as TheoryRow[]).map(fromRow)
  }

  async saveMany(records: TheoryRecord[]) {
    if (!records.length) return
    // user_id 는 DB 기본값 auth.uid() 로 채워진다
    const { error } = await this.db.upsert(records.map(toRow), { onConflict: 'user_id,slug' })
    if (error) throw error
  }

  async clear() {
    // 서버 데이터는 계정에 속하므로 지우지 않는다
  }
}

export const localTheory = new LocalTheoryRepository()
export const remoteTheory = new SupabaseTheoryRepository()
