import { computed } from 'vue'
import { findDoc, subjectNo } from '@/lib/content'
import { PASS_RULE, questionExists } from '@/lib/exams'
import { useCertStore } from '@/stores/cert'
import { useProgressStore } from '@/stores/progress'
import { useTheoryStore } from '@/stores/theory'

/** 실제 시험의 과목별 문항 수 (예상 점수 계산) */
const EXAM_SHAPE = {
  sqld: { 1: 10, 2: 40 },
  sqlp: { 1: 10, 2: 20, 3: 40 },
} as const
/** 과목 정답률을 믿을 만한 최소 풀이 수 */
export const MIN_FOR_SCORE = 10
/** 약한 절로 꼽을 최소 풀이 수 */
const MIN_FOR_WEAK = 3

export interface SubjectSummary {
  subject: number
  name: string
  solved: number
  correct: number
  /** 0~1, 푼 게 없으면 undefined */
  accuracy?: number
  theoryDone: number
  theoryTotal: number
}

/**
 * 실력 요약 (홈·마이페이지): 선택한 자격증의 과목별 정답률·이론 진도, 예상 점수, 약한 절.
 * 정답률은 문항마다 마지막으로 고른 답 기준 (다시 풀어 맞히면 오른다)
 */
export function useStudySummary() {
  const certStore = useCertStore()
  const progress = useProgressStore()
  const theory = useTheoryStore()

  /** 이 자격증 회차에서 푼 기록 (이론 절을 아는 것만) */
  const records = computed(() =>
    Object.values(progress.records).filter((r) => r.theory && certStore.ownsExam(r.examId) && questionExists(r.examId, r.questionId)),
  )

  const subjects = computed<SubjectSummary[]>(() =>
    certStore.info.subjects.map((subject) => {
      const docs = certStore.docs.filter((d) => subjectNo(d) === subject)
      const slugs = new Set(docs.map((d) => d.slug))
      const mine = records.value.filter((r) => slugs.has(r.theory!))
      const correct = mine.filter((r) => r.correct).length
      return {
        subject,
        name: docs[0]?.subject.replace(/^\d+과목\s*·?\s*/, '') ?? `${subject}과목`,
        solved: mine.length,
        correct,
        accuracy: mine.length ? correct / mine.length : undefined,
        theoryDone: docs.filter((d) => theory.records[d.slug]?.completedAt).length,
        theoryTotal: docs.length,
      }
    }),
  )

  /**
   * 예상 점수: 과목별 정답률 × 실제 시험 문항 수. 모든 과목을 MIN_FOR_SCORE 개 이상 풀어야 계산한다.
   * SQLP 는 실기(30점)를 뺀 객관식 70점 만점
   */
  const expected = computed(() => {
    const shape = EXAM_SHAPE[certStore.cert] as Record<number, number>
    if (subjects.value.some((s) => s.solved < MIN_FOR_SCORE)) return undefined
    const all = Object.values(shape).reduce((n, c) => n + c, 0)
    const max = certStore.cert === 'sqlp' ? PASS_RULE.sqlp.objectiveMax : 100
    const hit = subjects.value.reduce((n, s) => n + (s.accuracy ?? 0) * (shape[s.subject] ?? 0), 0)
    const cutoff = subjects.value.filter((s) => (s.accuracy ?? 0) < 0.4).map((s) => s.subject)
    const score = Math.round((hit / all) * max)
    // SQLP 는 실기 없이 합격 여부를 말할 수 없어 객관식 점수만 보여준다
    const pass = certStore.cert === 'sqld' ? score >= PASS_RULE.ai.pass && !cutoff.length : undefined
    return { score, max, cutoff, pass }
  })

  /** 정답률이 가장 낮은 절 3개 (MIN_FOR_WEAK 개 이상 푼 절만) */
  const weak = computed(() => {
    const by = new Map<string, { solved: number; correct: number }>()
    for (const r of records.value) {
      const s = by.get(r.theory!) ?? { solved: 0, correct: 0 }
      s.solved++
      if (r.correct) s.correct++
      by.set(r.theory!, s)
    }
    return [...by.entries()]
      .filter(([, s]) => s.solved >= MIN_FOR_WEAK && s.correct < s.solved)
      .map(([slug, s]) => ({ doc: findDoc(slug), slug, ...s, accuracy: s.correct / s.solved }))
      .filter((w) => w.doc)
      .sort((a, b) => a.accuracy - b.accuracy || b.solved - a.solved)
      .slice(0, 3)
  })

  const solved = computed(() => records.value.length)

  return { subjects, expected, weak, solved }
}
