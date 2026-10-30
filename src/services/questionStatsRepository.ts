import { supabase } from '@/lib/supabase'

/** 이보다 적게 풀린 문제는 비율이 흔들려서 보여주지 않는다 */
export const MIN_SOLVERS = 10

/** 문제별 첫 답 통계 (Supabase question_stats 함수, 숫자만) */
export interface QuestionStats {
  /** 첫 답을 남긴 사람 수 */
  total: number
  /** 보기 번호(1~) → 고른 사람 수 */
  picks: Record<number, number>
}

// 한 화면에서 같은 문제를 여러 번 묻지 않게, 앱이 켜져 있는 동안 기억한다
const cache = new Map<string, Promise<QuestionStats>>()

export function loadQuestionStats(key: string): Promise<QuestionStats> {
  const hit = cache.get(key)
  if (hit) return hit
  const req = (async () => {
    if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
    const { data, error } = await supabase.rpc('question_stats', { q_key: key })
    if (error) throw new Error(error.message)
    const picks: Record<number, number> = {}
    let total = 0
    for (const r of data as { choice: number; picks: number }[]) {
      picks[r.choice] = r.picks
      total += r.picks
    }
    return { total, picks }
  })()
  // 실패하면 다음에 다시 묻도록 지운다
  req.catch(() => cache.delete(key))
  cache.set(key, req)
  return req
}
