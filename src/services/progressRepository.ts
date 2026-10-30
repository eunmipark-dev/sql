import { supabase } from '@/lib/supabase'
import type { ProgressRecord } from '@/types'

/**
 * 풀이 기록 저장소.
 * 비로그인: localStorage / 로그인: Supabase (progress 테이블, RLS로 본인 행만)
 */
export interface ProgressRepository {
  list(): Promise<ProgressRecord[]>
  saveMany(records: ProgressRecord[]): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'sql-cert:progress'

export class LocalProgressRepository implements ProgressRepository {
  private read(): Record<string, ProgressRecord> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  async list() {
    return Object.values(this.read())
  }

  async saveMany(records: ProgressRecord[]) {
    const data = this.read()
    for (const r of records) data[r.key] = r
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async clear() {
    localStorage.removeItem(STORAGE_KEY)
  }
}

interface ProgressRow {
  key: string
  exam_id: string
  question_id: number
  theory: string | null
  last_answer: number
  correct: boolean
  attempts: number
  updated_at: string
}

const toRow = (r: ProgressRecord): ProgressRow => ({
  key: r.key,
  exam_id: r.examId,
  question_id: r.questionId,
  theory: r.theory ?? null,
  last_answer: r.lastAnswer,
  correct: r.correct,
  attempts: r.attempts,
  updated_at: r.updatedAt,
})

const fromRow = (r: ProgressRow): ProgressRecord => ({
  key: r.key,
  examId: r.exam_id,
  questionId: r.question_id,
  theory: r.theory ?? undefined,
  lastAnswer: r.last_answer,
  correct: r.correct,
  attempts: r.attempts,
  updatedAt: r.updated_at,
})

export class SupabaseProgressRepository implements ProgressRepository {
  private get db() {
    if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
    return supabase.from('progress')
  }

  async list() {
    const { data, error } = await this.db.select('*')
    if (error) throw error
    return (data as ProgressRow[]).map(fromRow)
  }

  async saveMany(records: ProgressRecord[]) {
    if (!records.length) return
    const { error } = await this.db.upsert(records.map(toRow), { onConflict: 'user_id,key' })
    if (error) throw error
  }

  async clear() {
    // 서버 데이터는 계정에 속하므로 지우지 않는다
  }
}

export const localProgress = new LocalProgressRepository()
export const remoteProgress = new SupabaseProgressRepository()
