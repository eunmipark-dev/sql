import { supabase } from '@/lib/supabase'
import { MIN_SOLVERS, type QuestionStats } from '@/services/questionStatsRepository'

/** 문제 검수용 집계 (Supabase audit_reports · audit_stats 함수, 비로그인도 읽을 수 있다) */
export interface AuditReport {
  key: string
  reports: number
  lastAt: string
  lastBody: string
}

const db = () => {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
  return supabase
}

/** 함수가 아직 없으면(schema.sql 의 '문제 검수' 실행 전) 알아보기 쉬운 문구로 */
function explain(error: { code?: string; message: string }) {
  return new Error(error.code === 'PGRST202' ? '서버에 검수 기능이 아직 없어요 (schema.sql 의 "문제 검수" 부분 실행 필요)' : error.message)
}

export async function loadAuditReports(): Promise<AuditReport[]> {
  const { data, error } = await db().rpc('audit_reports')
  if (error) throw explain(error)
  return (data as { question_key: string; reports: number; last_at: string; last_body: string }[]).map((r) => ({
    key: r.question_key,
    reports: r.reports,
    lastAt: r.last_at,
    lastBody: r.last_body,
  }))
}

/** 푼 사람이 MIN_SOLVERS 명 이상인 문제의 보기별 첫 답 수 */
export async function loadAuditStats(): Promise<Map<string, QuestionStats>> {
  const { data, error } = await db().rpc('audit_stats', { min_solvers: MIN_SOLVERS })
  if (error) throw explain(error)
  const map = new Map<string, QuestionStats>()
  for (const r of data as { question_key: string; choice: number; picks: number }[]) {
    const s = map.get(r.question_key) ?? { total: 0, picks: {} }
    s.picks[r.choice] = r.picks
    s.total += r.picks
    map.set(r.question_key, s)
  }
  return map
}
