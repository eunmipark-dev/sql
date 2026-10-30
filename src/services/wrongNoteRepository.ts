import { supabase } from '@/lib/supabase'
import type { WrongNote } from '@/types'

/**
 * 오답노트 저장소.
 * 비로그인: localStorage / 로그인: Supabase (wrong_notes 테이블, RLS로 본인 행만)
 */
export interface WrongNoteRepository {
  list(): Promise<WrongNote[]>
  save(note: WrongNote): Promise<void>
  saveMany(notes: WrongNote[]): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'sql-cert:wrong-notes'

export class LocalWrongNoteRepository implements WrongNoteRepository {
  private read(): Record<string, WrongNote> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  private write(data: Record<string, WrongNote>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async list() {
    return Object.values(this.read())
  }

  async save(note: WrongNote) {
    await this.saveMany([note])
  }

  async saveMany(notes: WrongNote[]) {
    const data = this.read()
    for (const n of notes) data[n.key] = n
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

interface WrongNoteRow {
  key: string
  exam_id: string
  question_id: number
  last_answer: number
  wrong_count: number
  correct_count: number
  memo: string
  resolved: boolean
  review_stage?: number | null
  due_on?: string | null
  created_at: string
  updated_at: string
}

const toRow = (n: WrongNote): WrongNoteRow => ({
  key: n.key,
  exam_id: n.examId,
  question_id: n.questionId,
  last_answer: n.lastAnswer,
  wrong_count: n.wrongCount,
  correct_count: n.correctCount,
  memo: n.memo,
  resolved: n.resolved,
  review_stage: n.reviewStage ?? 0,
  due_on: n.dueOn ?? null,
  created_at: n.createdAt,
  updated_at: n.updatedAt,
})

const fromRow = (r: WrongNoteRow): WrongNote => ({
  key: r.key,
  examId: r.exam_id,
  questionId: r.question_id,
  lastAnswer: r.last_answer,
  wrongCount: r.wrong_count,
  correctCount: r.correct_count,
  memo: r.memo,
  resolved: r.resolved,
  reviewStage: r.review_stage ?? undefined,
  dueOn: r.due_on ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export class SupabaseWrongNoteRepository implements WrongNoteRepository {
  private get db() {
    if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
    return supabase.from('wrong_notes')
  }

  async list() {
    const { data, error } = await this.db.select('*')
    if (error) throw error
    return (data as WrongNoteRow[]).map(fromRow)
  }

  async save(note: WrongNote) {
    await this.saveMany([note])
  }

  async saveMany(notes: WrongNote[]) {
    if (!notes.length) return
    // user_id 는 DB 기본값 auth.uid() 로 채워진다
    const rows = notes.map(toRow)
    let { error } = await this.db.upsert(rows, { onConflict: 'user_id,key' })
    // 간격 복습 열(review_stage, due_on)을 아직 안 만든 DB: 그 열만 빼고 저장한다 (schema.sql 의 '간격 복습' 실행 전)
    if (error?.code === 'PGRST204') {
      console.warn('[오답노트] 간격 복습 열이 없어 복습 일정 없이 저장합니다. supabase/schema.sql 을 실행해 주세요.')
      ;({ error } = await this.db.upsert(rows.map(({ review_stage: _s, due_on: _d, ...rest }) => rest), { onConflict: 'user_id,key' }))
    }
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

export const localWrongNotes = new LocalWrongNoteRepository()
export const remoteWrongNotes = new SupabaseWrongNoteRepository()
