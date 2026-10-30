import { ref, watch } from 'vue'
import { addDays } from '@/lib/date'
import { loadExam, loadExamsByKind } from '@/lib/exams'
import type { Exam, ExamKind, Question } from '@/types'

/**
 * 미니게임 공통: 날짜로 정해지는 난수, 모의고사 불러오기, 이 기기의 최고 기록.
 * 기록은 기기에만 둔다 (게임 랭킹은 아직 없음). 학습량은 activity.addGame 으로 하루 목표에 더한다
 */

/** 같은 문자열이면 늘 같은 순서를 내는 난수 (오늘의 챌린지: 모두가 같은 문제) */
export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  // mulberry32
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(list: T[], rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** 한 종류(SQLD/SQLP)의 모의고사 전체. 랜덤 문제와 같은 캐시를 쓴다 */
export async function loadAllExams(kind: ExamKind): Promise<Exam[]> {
  const metas = await loadExamsByKind(kind)
  return Promise.all(metas.map((m) => loadExam(m.id)))
}

// ── 오늘의 챌린지 ──

export interface PickedQuestion {
  examId: string
  examTitle: string
  number: number
  question: Question
}

/** 과목별 문제 수 (SQLD 5 = 1과목 2 + 2과목 3, SQLP 5 = 1·2·2) */
const QUOTA: Partial<Record<ExamKind, number[]>> = { ai: [2, 3], sqlp: [1, 2, 2] }

/** 그날의 5문제. 날짜와 종류가 같으면 누구에게나 같은 문제 */
export function challengeQuestions(exams: Exam[], kind: ExamKind, day: string): PickedQuestion[] {
  const rand = seededRandom(`challenge|${kind}|${day}`)
  const all = exams
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((e) => e.questions.map((q, i) => ({ examId: e.id, examTitle: e.title, number: i + 1, question: q })))
  return (QUOTA[kind] ?? [5]).flatMap((count, i) =>
    shuffle(
      all.filter((p) => QUOTA[kind] === undefined || p.question.subject === i + 1),
      rand,
    ).slice(0, count),
  )
}

export interface ChallengeState {
  day: string
  /** 고른 보기 (푼 순서대로) */
  answers: number[]
  /** 정답 여부 */
  results: boolean[]
}

const challengeKey = (kind: ExamKind) => `sql-cert:challenge:${kind}`
const challengeLogKey = (kind: ExamKind) => `sql-cert:challenge-log:${kind}`

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장이 막혀 있으면 이번 방문 동안만
  }
}

/** 오늘 챌린지를 어디까지 풀었는지 (날짜가 바뀌면 새로) */
export function readChallenge(kind: ExamKind, day: string): ChallengeState {
  const s = readJson<ChallengeState | null>(challengeKey(kind), null)
  return s && s.day === day ? s : { day, answers: [], results: [] }
}
export function saveChallenge(kind: ExamKind, s: ChallengeState) {
  writeJson(challengeKey(kind), s)
}

/** 끝낸 날 → 맞힌 수 */
export function readChallengeLog(kind: ExamKind) {
  return readJson<Record<string, number>>(challengeLogKey(kind), {})
}
export function logChallenge(kind: ExamKind, day: string, correct: number) {
  writeJson(challengeLogKey(kind), { ...readChallengeLog(kind), [day]: correct })
}

/** 챌린지 연속 일수 (오늘 아직이면 어제까지) */
export function challengeStreak(log: Record<string, number>, today: string) {
  let day = log[today] !== undefined ? today : addDays(today, -1)
  let n = 0
  while (log[day] !== undefined) {
    n++
    day = addDays(day, -1)
  }
  return n
}

// ── O/X: 모의고사의 '옳은 것/옳지 않은 것' 문제에서 보기 문장을 뽑는다 ──

export interface OxStatement {
  id: string
  /** 무엇에 대한 문장인지 (예: 집합 연산자) */
  topic: string
  text: string
  answer: boolean
  /** 왜 O/X 인지 (이론 문서별로 쓴 문장에만) */
  explain?: string
  /** 모의고사에서 뽑은 문장의 출처 */
  examId?: string
  number?: number
  theory?: string
}

/** '다음 중 ○○에 대한 설명으로 가장 적절하지 않은 것은? (Oracle 기준)' 같은 한 줄 문제만 */
const STEM =
  /^(?:다음 중 )?([^`\n]{2,40}?)(?:에 대한|에 관한) 설명으로 (?:가장 )?(옳은|옳지 않은|적절한|적절하지 않은|틀린|잘못된|바른) 것은\?\s*(\([^)]*기준\))?$/

export function oxStatements(exams: Exam[]): OxStatement[] {
  return exams.flatMap((e) =>
    e.questions.flatMap((q, i) => {
      const m = q.code ? null : q.question.replace(/\*\*/g, '').trim().match(STEM)
      // 보기가 'ㄱ, ㄴ' 같은 조합이거나 SQL 이면 문장으로 판단할 수 없다
      if (!m || !q.choices.every((c) => c.length >= 12 && !c.includes('`') && !/^[ㄱ-ㅎ][,.\s]/.test(c))) return []
      const negative = /않은|틀린|잘못된/.test(m[2]!)
      const topic = m[3] ? `${m[1]} ${m[3]}` : m[1]!
      return q.choices.map((text, c) => ({
        id: `${e.id}:${q.id}:${c + 1}`,
        topic,
        text,
        // '옳지 않은 것' 문제는 정답 보기만 X, '옳은 것' 문제는 정답 보기만 O
        answer: (c + 1 === q.answer) !== negative,
        examId: e.id,
        number: i + 1,
        theory: q.theory,
      }))
    }),
  )
}

// ── 이 기기의 최고 기록 ──

export type GameId = 'ox' | 'order'
export interface GameBest {
  score: number
  at: string
}

const BEST_KEY = 'sql-cert:game-best'
/** `${게임}:${종류}` → 최고 기록 */
export const gameBest = ref<Record<string, GameBest>>(readJson(BEST_KEY, {}))
watch(gameBest, (v) => writeJson(BEST_KEY, v), { deep: true })

export const bestOf = (game: GameId, kind: ExamKind) => gameBest.value[`${game}:${kind}`]
/** 최고 기록이면 바꾸고 true */
export function submitBest(game: GameId, kind: ExamKind, score: number) {
  const prev = bestOf(game, kind)
  if (prev && prev.score >= score) return false
  gameBest.value = { ...gameBest.value, [`${game}:${kind}`]: { score, at: new Date().toISOString() } }
  return true
}

/** 결과 공유: 공유 창이 있으면 그걸로, 없으면(안드로이드 웹뷰 등) 클립보드에 복사. 복사했으면 'copied' */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text })
      return 'shared'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
