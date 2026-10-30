import type { Cert } from '@/stores/cert'

/**
 * 공식 시험 일정 (한국데이터산업진흥원 데이터자격검정 https://www.dataq.or.kr/www/accept/schedule.do).
 * 해마다 새 일정이 나오면 여기에 덧붙인다. 날짜는 'YYYY-MM-DD'
 */
export interface ExamRound {
  /** 제63회 */
  round: number
  applyFrom: string
  applyTo: string
  exam: string
  result: string
}

export const EXAM_SCHEDULE: Record<Cert, ExamRound[]> = {
  sqld: [
    { round: 60, applyFrom: '2026-02-02', applyTo: '2026-02-06', exam: '2026-03-07', result: '2026-03-27' },
    { round: 61, applyFrom: '2026-04-27', applyTo: '2026-05-01', exam: '2026-05-31', result: '2026-06-19' },
    { round: 62, applyFrom: '2026-07-20', applyTo: '2026-07-24', exam: '2026-08-22', result: '2026-09-11' },
    { round: 63, applyFrom: '2026-10-12', applyTo: '2026-10-16', exam: '2026-11-14', result: '2026-12-04' },
  ],
  sqlp: [
    { round: 54, applyFrom: '2026-02-02', applyTo: '2026-02-06', exam: '2026-03-07', result: '2026-04-03' },
    { round: 55, applyFrom: '2026-07-20', applyTo: '2026-07-24', exam: '2026-08-22', result: '2026-09-18' },
  ],
}

export const SCHEDULE_URL = 'https://www.dataq.or.kr/www/accept/schedule.do'

/** 오늘 이후(오늘 포함) 가장 가까운 시험. 아직 발표된 일정이 없으면 undefined */
export const nextRound = (cert: Cert, today: string) => EXAM_SCHEDULE[cert].find((r) => r.exam >= today)

/** 접수 상태: 접수 전 / 접수 중 / 접수 마감 */
export function applyState(r: ExamRound, today: string): 'before' | 'open' | 'closed' {
  if (today < r.applyFrom) return 'before'
  return today <= r.applyTo ? 'open' : 'closed'
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
/** '11월 14일(토)' */
export function dayLabel(day: string) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return `${m}월 ${d}일(${WEEKDAY[new Date(y, m - 1, d).getDay()]})`
}
