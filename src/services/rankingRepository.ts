import { supabase } from '@/lib/supabase'

export type RankingPeriod = 'week' | 'all'

export interface RankingRow {
  rank: number
  /** 닉네임 (정하지 않았으면 Google 이름) */
  nickname: string
  /** 경험치 (순위 기준) */
  xp: number
  /** 푼 문제 수 (다시 풀기 포함) */
  solved: number
  isMe: boolean
}

/**
 * 랭킹 조회 (Supabase get_leaderboard 함수, 비로그인도 조회 가능 · 내 순위는 로그인해야).
 * 상위 limit 명과 내 순위(밖에 있어도)를 돌려준다. 경험치는 서버 트리거가 풀이·학습·게임 기록에서 쌓는다
 */
export async function loadLeaderboard(period: RankingPeriod, limit = 50): Promise<RankingRow[]> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
  const { data, error } = await supabase.rpc('get_leaderboard', { period, max_rows: limit })
  if (error) throw error
  return (data as { rank: number; nickname: string; xp?: number; solved: number; is_me: boolean }[]).map((r) => ({
    rank: Number(r.rank),
    nickname: r.nickname,
    // 경험치 SQL 을 반영하기 전 서버는 푼 문제 수만 준다
    xp: Number(r.xp ?? r.solved),
    solved: Number(r.solved),
    isMe: r.is_me,
  }))
}

/** 이번 주 범위 (한국 시간 월요일 ~ 일요일). 서버의 주간 기준과 같다 */
export function currentWeek(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const day = (kst.getUTCDay() + 6) % 7 // 월 0 … 일 6
  const monday = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - day))
  const sunday = new Date(monday.getTime() + 6 * 86_400_000)
  const fmt = (d: Date) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`
  return `${fmt(monday)} ~ ${fmt(sunday)}`
}

/** 경험치 얻는 법 (supabase/schema.sql 의 '경험치' 트리거와 같게) */
export const XP_RULES = [
  { label: '모의고사·랜덤·복습 문제 처음 풀기', xp: '정답 10 · 오답 2' },
  { label: '같은 문제 다시 풀기', xp: '2' },
  { label: '이론·강의 학습 완료 (문서마다 한 번)', xp: '20' },
  { label: '오늘의 챌린지 완료', xp: '20' },
  { label: '순서 퍼즐 · SQL 결과 맞히기 (처음 맞힌 문제)', xp: '8' },
  { label: '60초 O/X (처음 맞힌 문장)', xp: '2' },
]
/** 하루에 얻을 수 있는 최대 경험치 */
export const XP_DAILY_MAX = 3000
