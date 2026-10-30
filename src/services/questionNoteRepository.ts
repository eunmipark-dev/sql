import { supabase } from '@/lib/supabase'
import type { QuestionNote } from '@/types'

/**
 * 문제별 개인 메모 저장소.
 * 비로그인: localStorage / 로그인: Supabase (question_notes 테이블, RLS로 본인 행만)
 */
export interface QuestionNoteRepository {
  list(): Promise<QuestionNote[]>
  saveMany(notes: QuestionNote[]): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'sql-cert:question-notes'

export class LocalQuestionNoteRepository implements QuestionNoteRepository {
  private read(): Record<string, QuestionNote> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  private write(data: Record<string, QuestionNote>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async list() {
    return Object.values(this.read())
  }

  async saveMany(notes: QuestionNote[]) {
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

interface QuestionNoteRow {
  key: string
  exam_id: string
  question_id: number
  memo: string
  updated_at: string
}

const toRow = (n: QuestionNote): QuestionNoteRow => ({
  key: n.key,
  exam_id: n.examId,
  question_id: n.questionId,
  memo: n.memo,
  updated_at: n.updatedAt,
})

const fromRow = (r: QuestionNoteRow): QuestionNote => ({
  key: r.key,
  examId: r.exam_id,
  questionId: r.question_id,
  memo: r.memo,
  updatedAt: r.updated_at,
})

export class SupabaseQuestionNoteRepository implements QuestionNoteRepository {
  private get db() {
    if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
    return supabase.from('question_notes')
  }

  async list() {
    const { data, error } = await this.db.select('*')
    if (error) throw error
    return (data as QuestionNoteRow[]).map(fromRow)
  }

  async saveMany(notes: QuestionNote[]) {
    if (!notes.length) return
    // user_id 는 DB 기본값 auth.uid() 로 채워진다
    const { error } = await this.db.upsert(notes.map(toRow), { onConflict: 'user_id,key' })
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

export const localQuestionNotes = new LocalQuestionNoteRepository()
export const remoteQuestionNotes = new SupabaseQuestionNoteRepository()
