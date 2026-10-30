import { supabase } from '@/lib/supabase'
import type { ExamDraft } from '@/types'

/**
 * 제출 전 회차 풀이 저장소 (이어 풀기).
 * 비로그인: localStorage / 로그인: Supabase (exam_drafts 테이블, RLS로 본인 행만)
 */
export interface ExamDraftRepository {
  list(): Promise<ExamDraft[]>
  get(examId: string): Promise<ExamDraft | undefined>
  saveMany(drafts: ExamDraft[]): Promise<void>
  remove(examId: string): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'sql-cert:exam-drafts'

export class LocalExamDraftRepository implements ExamDraftRepository {
  private read(): Record<string, ExamDraft> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  private write(data: Record<string, ExamDraft>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async list() {
    return Object.values(this.read())
  }

  async get(examId: string) {
    return this.read()[examId]
  }

  async saveMany(drafts: ExamDraft[]) {
    const data = this.read()
    for (const d of drafts) data[d.key] = d
    this.write(data)
  }

  async remove(examId: string) {
    const data = this.read()
    delete data[examId]
    this.write(data)
  }

  async clear() {
    localStorage.removeItem(STORAGE_KEY)
  }
}

interface ExamDraftRow {
  exam_id: string
  answers: Record<number, number>
  checked: Record<number, boolean>
  remaining: number
  last_answered: number | null
  practical: ExamDraft['practical'] | null
  updated_at: string
}

const toRow = (d: ExamDraft): ExamDraftRow => ({
  exam_id: d.examId,
  answers: d.answers,
  checked: d.checked,
  remaining: d.remaining,
  last_answered: d.lastAnswered ?? null,
  practical: d.practical ?? {},
  updated_at: d.updatedAt,
})

const fromRow = (r: ExamDraftRow): ExamDraft => ({
  key: r.exam_id,
  examId: r.exam_id,
  answers: r.answers,
  checked: r.checked,
  remaining: r.remaining,
  lastAnswered: r.last_answered ?? undefined,
  practical: r.practical ?? {},
  updatedAt: r.updated_at,
})

export class SupabaseExamDraftRepository implements ExamDraftRepository {
  private get db() {
    if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
    return supabase.from('exam_drafts')
  }

  async list() {
    const { data, error } = await this.db.select('*')
    if (error) throw error
    return (data as ExamDraftRow[]).map(fromRow)
  }

  async get(examId: string) {
    const { data, error } = await this.db.select('*').eq('exam_id', examId).maybeSingle()
    if (error) throw error
    return data ? fromRow(data as ExamDraftRow) : undefined
  }

  async saveMany(drafts: ExamDraft[]) {
    if (!drafts.length) return
    // user_id 는 DB 기본값 auth.uid() 로 채워진다
    const { error } = await this.db.upsert(drafts.map(toRow), { onConflict: 'user_id,exam_id' })
    if (error) throw error
  }

  async remove(examId: string) {
    const { error } = await this.db.delete().eq('exam_id', examId)
    if (error) throw error
  }

  async clear() {
    // 서버 데이터는 계정에 속하므로 지우지 않는다
  }
}

export const localExamDrafts = new LocalExamDraftRepository()
export const remoteExamDrafts = new SupabaseExamDraftRepository()
