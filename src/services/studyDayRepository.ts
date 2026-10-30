import { supabase } from '@/lib/supabase'
import type { StudyDay } from '@/types'

/**
 * 하루 학습량 저장소 (연속 학습일·하루 목표).
 * 비로그인: localStorage / 로그인: Supabase (study_days 테이블, RLS로 본인 행만)
 */
export interface StudyDayRepository {
  list(): Promise<StudyDay[]>
  save(day: StudyDay): Promise<void>
  clear(): Promise<void>
}

const STORAGE_KEY = 'sql-cert:study-days'

export class LocalStudyDayRepository implements StudyDayRepository {
  private read(): Record<string, StudyDay> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    } catch {
      return {}
    }
  }

  async list() {
    return Object.values(this.read())
  }

  async save(day: StudyDay) {
    const data = this.read()
    data[day.day] = day
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  async clear() {
    localStorage.removeItem(STORAGE_KEY)
  }
}

interface StudyDayRow {
  day: string
  questions: number
  correct: number
  lecture_parts: number
  lecture_ms: number
  updated_at: string
}

const toRow = (d: StudyDay): StudyDayRow => ({
  day: d.day,
  questions: d.questions,
  correct: d.correct,
  lecture_parts: d.lectureParts,
  lecture_ms: Math.round(d.lectureMs),
  updated_at: d.updatedAt,
})

const fromRow = (r: StudyDayRow): StudyDay => ({
  day: r.day,
  questions: r.questions,
  correct: r.correct,
  lectureParts: r.lecture_parts,
  lectureMs: r.lecture_ms,
  updatedAt: r.updated_at,
})

export class SupabaseStudyDayRepository implements StudyDayRepository {
  private get db() {
    if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
    return supabase.from('study_days')
  }

  async list() {
    const { data, error } = await this.db.select('*')
    if (error) throw error
    return (data as StudyDayRow[]).map(fromRow)
  }

  async save(day: StudyDay) {
    // user_id 는 DB 기본값 auth.uid() 로 채워진다
    const { error } = await this.db.upsert(toRow(day), { onConflict: 'user_id,day' })
    if (error) throw error
  }

  async clear() {
    // 서버 데이터는 계정에 속하므로 지우지 않는다
  }
}

export const localStudyDays = new LocalStudyDayRepository()
export const remoteStudyDays = new SupabaseStudyDayRepository()
