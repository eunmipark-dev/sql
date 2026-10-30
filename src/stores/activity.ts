import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { addDays, dayKey, daysBetween } from '@/lib/date'
import { localStudyDays, remoteStudyDays } from '@/services/studyDayRepository'
import type { StudyDay } from '@/types'

/** 강의 파트 하나를 끝까지 들으면 문제 몇 개만큼으로 칠지 (하루 목표 계산) */
export const PART_POINTS = 5
/** 미니게임 한 판을 문제 몇 개만큼으로 칠지 (오늘의 챌린지는 실제 문제라 따로 세지 않는다) */
export const GAME_POINTS = 3
/** 고를 수 있는 하루 목표 (문제 수 기준) */
export const GOAL_OPTIONS = [5, 10, 20, 30]

const GOAL_KEY = 'sql-cert:daily-goal'
function readGoal() {
  try {
    const n = Number(localStorage.getItem(GOAL_KEY))
    return GOAL_OPTIONS.includes(n) ? n : 10
  } catch {
    return 10
  }
}

const empty = (day: string): StudyDay => ({ day, questions: 0, correct: 0, lectureParts: 0, lectureMs: 0, updatedAt: '' })

/** 하루 학습량 → 목표 점수 (문제 1개 = 1, 강의 파트 1개 = PART_POINTS) */
export const pointsOf = (d?: StudyDay) => (d ? d.questions + d.lectureParts * PART_POINTS : 0)

/**
 * 학습 활동 (Speak 처럼 매일 하게 만드는 장치).
 * - 연속 학습일: 하루에 문제를 하나라도 풀거나 강의 파트를 하나라도 들으면 이어진다
 * - 하루 목표: 문제 N개 (강의 파트 하나는 PART_POINTS 개로 친다). 목표는 이 기기에 기억
 */
export const useActivityStore = defineStore('activity', () => {
  const days = ref<Record<string, StudyDay>>({})
  const loaded = ref(false)
  const remote = ref(false)
  const repo = () => (remote.value ? remoteStudyDays : localStudyDays)
  /** 날짜가 바뀌면 다시 계산되게 (자정을 넘겨 켜 둔 경우) */
  const today = ref(dayKey())
  if (typeof window !== 'undefined') setInterval(() => (today.value = dayKey()), 60_000)

  const goal = ref(readGoal())
  watch(goal, (g) => {
    try {
      localStorage.setItem(GOAL_KEY, String(g))
    } catch {
      // 저장이 막혀 있으면 이번 방문 동안만
    }
  })

  async function load() {
    if (loaded.value) return
    await reload(remote.value)
  }

  async function reload(useRemote: boolean) {
    remote.value = useRemote
    let list: StudyDay[] = []
    try {
      list = await repo().list()
    } catch (e) {
      // study_days 테이블을 아직 안 만든 DB 등: 기록 없이 시작 (schema.sql 의 '연속 학습일' 실행 필요)
      console.error('[학습 기록 불러오기 실패]', e)
    }
    days.value = Object.fromEntries(list.map((d) => [d.day, d]))
    loaded.value = true
  }

  async function add(patch: Partial<Pick<StudyDay, 'questions' | 'correct' | 'lectureParts' | 'lectureMs'>>) {
    const key = dayKey()
    today.value = key
    const prev = days.value[key] ?? empty(key)
    const next: StudyDay = {
      ...prev,
      questions: prev.questions + (patch.questions ?? 0),
      correct: prev.correct + (patch.correct ?? 0),
      lectureParts: prev.lectureParts + (patch.lectureParts ?? 0),
      lectureMs: prev.lectureMs + (patch.lectureMs ?? 0),
      updatedAt: new Date().toISOString(),
    }
    days.value[key] = next
    await repo().save(next).catch((e) => console.error('[학습 기록 저장 실패]', e))
  }

  const addQuestions = (count: number, correct: number) => add({ questions: count, correct })
  const addGame = () => add({ questions: GAME_POINTS })
  const addLecture = (ms: number, partDone = false) => add({ lectureMs: ms, lectureParts: partDone ? 1 : 0 })

  const todayDay = computed(() => days.value[today.value] ?? empty(today.value))
  const todayPoints = computed(() => pointsOf(todayDay.value))
  const goalMet = computed(() => todayPoints.value >= goal.value)
  const studied = (day: string) => pointsOf(days.value[day]) > 0 || (days.value[day]?.lectureMs ?? 0) >= 60_000

  /** 연속 학습일. 오늘 아직 안 했으면 어제까지 이어진 날 수 (오늘 하면 +1) */
  const streak = computed(() => {
    let day = studied(today.value) ? today.value : addDays(today.value, -1)
    let n = 0
    while (studied(day)) {
      n++
      day = addDays(day, -1)
    }
    return n
  })
  const studiedToday = computed(() => studied(today.value))

  /** 가장 길게 이어진 연속 학습일 */
  const bestStreak = computed(() => {
    const list = Object.keys(days.value).filter(studied).sort()
    let best = 0
    let run = 0
    list.forEach((d, i) => {
      run = i && daysBetween(list[i - 1]!, d) === 1 ? run + 1 : 1
      best = Math.max(best, run)
    })
    return best
  })

  /** 최근 n일 (오래된 날부터) */
  const recent = (n: number) => Array.from({ length: n }, (_, i) => days.value[addDays(today.value, i - n + 1)] ?? empty(addDays(today.value, i - n + 1)))

  return {
    days,
    loaded,
    remote,
    goal,
    today,
    todayDay,
    todayPoints,
    goalMet,
    streak,
    studiedToday,
    bestStreak,
    load,
    reload,
    addQuestions,
    addLecture,
    addGame,
    recent,
  }
})
