import { computed, ref, watch } from 'vue'
import { daysBetween } from '@/lib/date'
import { nextRound } from '@/lib/examSchedule'
import { hasLecture } from '@/lib/lectures'
import { useActivityStore } from '@/stores/activity'
import { type Cert, useCertStore } from '@/stores/cert'
import { useTheoryStore } from '@/stores/theory'

/**
 * 시험일(D-day)과 남은 기간 계획.
 * 시험일은 공식 일정(lib/examSchedule)에서 가장 가까운 회차로 정하고, 다른 날짜를 직접 고르면 그 날짜를 쓴다(자격증마다 이 기기에 기억, 지나면 다시 공식 일정).
 * 계획: 남은 강의를 마지막 일주일 전까지 끝내도록 하루 몇 개씩 들으면 되는지 (마지막 주는 모의고사·복습)
 */
const DATE_KEY = 'sql-cert:exam-date'
/** 시험 전 마지막 며칠은 강의 대신 모의고사·오답 복습 */
export const FINAL_DAYS = 7

function read<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장이 막혀 있으면 이번 방문 동안만
  }
}

/** 자격증 → 직접 고른 시험일 'YYYY-MM-DD' (없으면 공식 일정) */
export const examDates = ref<Partial<Record<Cert, string>>>(read(DATE_KEY, {}))
watch(examDates, (v) => write(DATE_KEY, v), { deep: true })

export function setExamDate(cert: Cert, day: string | undefined) {
  const next = { ...examDates.value }
  if (day) next[cert] = day
  else delete next[cert]
  examDates.value = next
}

/** 'D-23' / 'D-DAY' / 시험이 지났으면 undefined */
export const ddayLabel = (left: number) => (left > 0 ? `D-${left}` : left === 0 ? 'D-DAY' : undefined)

export function useExamPlan() {
  const certStore = useCertStore()
  const theory = useTheoryStore()
  const activity = useActivityStore()

  /** 직접 고른 날짜 (지났으면 버리고 공식 일정으로) */
  const custom = computed(() => {
    const d = examDates.value[certStore.cert]
    return d && d >= activity.today ? d : undefined
  })
  /** 가장 가까운 공식 회차 (아직 발표 전이면 undefined) */
  const official = computed(() => nextRound(certStore.cert, activity.today))
  const date = computed(() => custom.value ?? official.value?.exam)
  /** 공식 회차를 쓰고 있으면 그 회차 */
  const round = computed(() => (custom.value && custom.value !== official.value?.exam ? undefined : official.value))
  /** 시험까지 남은 날 (오늘이 시험일이면 0) */
  const daysLeft = computed(() => (date.value ? daysBetween(activity.today, date.value) : undefined))

  const lectures = computed(() => {
    const docs = certStore.docs.filter((d) => hasLecture(d.slug))
    const done = docs.filter((d) => theory.records[d.slug]?.completedAt).length
    return { total: docs.length, done, left: docs.length - done }
  })

  /** 하루에 들을 강의 수 (마지막 FINAL_DAYS 일 전까지 끝내도록). 끝냈거나 시간이 없으면 undefined */
  const perDay = computed(() => {
    const d = daysLeft.value
    if (d === undefined || !lectures.value.left) return undefined
    const studyDays = d - FINAL_DAYS
    return studyDays > 0 ? Math.ceil(lectures.value.left / studyDays) : undefined
  })

  /** 지금 무엇에 집중할지 한 줄 */
  const advice = computed(() => {
    const d = daysLeft.value
    if (d === undefined) return ''
    if (d === 0) return '오늘 시험이에요. 오답노트만 가볍게 훑어보세요. 화이팅!'
    if (d <= FINAL_DAYS) return '마지막 주예요. 모의고사를 시간 재고 풀고, 오답 복습에 집중하세요.'
    if (!lectures.value.left) return '강의는 다 들었어요. 모의고사로 실전 감각을 키워요.'
    return `강의 ${lectures.value.left}개 남음 · 하루 ${perDay.value}개씩 들으면 시험 ${FINAL_DAYS}일 전에 끝나요.`
  })

  return { date, custom, official, round, daysLeft, lectures, perDay, advice }
}
