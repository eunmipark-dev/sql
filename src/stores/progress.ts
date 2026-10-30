import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { localProgress, remoteProgress } from '@/services/progressRepository'
import { questionExists } from '@/lib/exams'
import { noteKey, useWrongNotesStore } from '@/stores/wrongNotes'
import { useActivityStore } from '@/stores/activity'
import type { ProgressRecord } from '@/types'

export interface AnsweredQuestion {
  examId: string
  questionId: number
  theory?: string
  answer: number
}

export interface Stats {
  total: number
  /** 푼 문항 수 */
  solved: number
  /** 아직 해결하지 않은 오답 수 (오답노트에서 '해결' 표시하면 빠짐) */
  wrong: number
  /** 진행률 0~1 */
  progress: number
  /** 오답률 0~1 (푼 문항 대비) */
  wrongRate: number
}

/**
 * 풀이 기록 + 진행률/오답률 집계.
 * 문제를 푸는 모든 화면은 answer() 하나로 기록하고, 오답노트도 여기서 함께 갱신한다.
 */
export const useProgressStore = defineStore('progress', () => {
  const records = ref<Record<string, ProgressRecord>>({})
  const loaded = ref(false)
  const wrongNotes = useWrongNotesStore()
  /** true 면 로그인 상태 → 서버(Supabase)에 저장 */
  const remote = ref(false)
  const repo = () => (remote.value ? remoteProgress : localProgress)

  async function load() {
    if (loaded.value) return
    await reload(remote.value)
  }

  /** 저장 위치를 바꾸고 다시 불러온다 (로그인/로그아웃 시) */
  async function reload(useRemote: boolean) {
    remote.value = useRemote
    const list = await repo().list()
    records.value = Object.fromEntries(list.map((r) => [r.key, r]))
    loaded.value = true
  }

  function toRecord(q: AnsweredQuestion, correct: boolean): ProgressRecord {
    const key = noteKey(q.examId, q.questionId)
    const prev = records.value[key]
    return {
      key,
      examId: q.examId,
      questionId: q.questionId,
      theory: q.theory ?? prev?.theory,
      lastAnswer: q.answer,
      correct,
      attempts: (prev?.attempts ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    }
  }

  /** 여러 문항을 한 번에 기록 (회차 제출) */
  async function answerMany(list: { q: AnsweredQuestion; correct: boolean }[]) {
    const recs = list.map(({ q, correct }) => toRecord(q, correct))
    for (const r of recs) records.value[r.key] = r
    void useActivityStore().addQuestions(list.length, list.filter((l) => l.correct).length)
    await repo().saveMany(recs).catch((e) => console.error('[풀이 기록 저장 실패]', e))
    await wrongNotes.recordMany(list.map(({ q, correct }) => ({ ...q, correct })))
  }

  /** 한 문항 기록 (분류별 연습, 오답노트 다시 풀기) */
  async function answer(q: AnsweredQuestion, correct: boolean) {
    await answerMany([{ q, correct }])
  }

  const unresolvedKeys = computed(() => new Set(wrongNotes.list.filter((n) => !n.resolved).map((n) => n.key)))

  /** 조건에 맞는 풀이 기록으로 진행률/오답률 계산 */
  function statsOf(total: number, match: (r: ProgressRecord) => boolean): Stats {
    let solved = 0
    let wrong = 0
    for (const r of Object.values(records.value)) {
      // 지금은 없는 문제의 기록은 진행률에서 뺀다
      if (!match(r) || !questionExists(r.examId, r.questionId)) continue
      solved++
      if (unresolvedKeys.value.has(r.key)) wrong++
    }
    return {
      total,
      solved,
      wrong,
      progress: total ? Math.min(1, solved / total) : 0,
      wrongRate: solved ? wrong / solved : 0,
    }
  }

  const statsByExam = (examId: string, total: number) => statsOf(total, (r) => r.examId === examId)
  const statsByTheory = (slugs: string[], total: number, examPrefix = '') => {
    const set = new Set(slugs)
    return statsOf(total, (r) => !!r.theory && set.has(r.theory) && r.examId.startsWith(examPrefix))
  }
  const statsByExams = (examIds: string[], total: number) => {
    const set = new Set(examIds)
    return statsOf(total, (r) => set.has(r.examId))
  }

  /** 문항 상태: 안 푼 / 맞힘 / 오답(미해결) / 해결 */
  function statusOf(examId: string, questionId: number): 'new' | 'correct' | 'wrong' | 'resolved' {
    const key = noteKey(examId, questionId)
    if (!records.value[key]) return 'new'
    if (unresolvedKeys.value.has(key)) return 'wrong'
    return wrongNotes.notes[key] ? 'resolved' : 'correct'
  }

  return { records, loaded, remote, load, reload, answer, answerMany, statsByExam, statsByExams, statsByTheory, statusOf }
})
