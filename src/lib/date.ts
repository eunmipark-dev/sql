/** 학습 날짜 표시: 오늘 / 어제 / N일 전 / 10월 3일 / 2025년 10월 3일 */
export function studyDate(iso: string, now = new Date()) {
  const d = new Date(iso)
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}년 ${md}`
}

/** 툴팁용 전체 날짜·시각 */
export const fullDate = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

/** 코멘트 시각: 방금 / n분 전 / n시간 전 / 그 이상은 studyDate */
export function relativeTime(iso: string, now = new Date()) {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  if (min < 24 * 60) return `${Math.floor(min / 60)}시간 전`
  return studyDate(iso, now)
}

// ── 날짜 단위 기록 (연속 학습일·복습 예정일). 기기 시간대의 'YYYY-MM-DD' ──
const pad = (n: number) => String(n).padStart(2, '0')

/** 그 날짜(기본 오늘)의 'YYYY-MM-DD' */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 'YYYY-MM-DD' 에서 n일 뒤(음수면 앞)의 'YYYY-MM-DD' */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number)
  return dayKey(new Date(y!, m! - 1, d! + n))
}

/** 두 날짜 사이 일수 (b - a) */
export function daysBetween(a: string, b: string) {
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y!, m! - 1, d!).getTime()
  }
  return Math.round((t(b) - t(a)) / 86_400_000)
}
