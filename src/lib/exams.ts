import { shallowRef } from 'vue'
import type { BankIndex, BankQuestion, Exam, ExamKind, ExamMeta, Subject } from '@/types'

/**
 * 시험 데이터는 JS 번들에 넣지 않고 public/data/exams 의 정적 JSON 으로 둔다.
 * - index.json(목록)만 먼저 받고, 회차 본문은 풀 때 받아온다
 * - 파일 주소에 ?v=해시 가 붙어 있어 내용이 바뀌면 캐시가 갱신된다
 * - 한 번 받은 데이터는 메모리에 캐시
 */
const BASE = `${import.meta.env.BASE_URL}data/exams/`

let indexPromise: Promise<{ exams: ExamMeta[]; bank: BankIndex }> | null = null
const examCache = new Map<string, Promise<Exam>>()
const bankCache = new Map<string, Promise<BankQuestion[]>>()

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} 를 불러오지 못했습니다 (${res.status})`)
  return res.json() as Promise<T>
}

/** 지금 있는 회차 → 문항 수·종류. 목록을 받기 전에는 undefined */
const catalog = shallowRef<Map<string, { count: number; kind: ExamKind }>>()

/**
 * 저장된 기록(오답노트·풀이 기록·북마크)이 가리키는 문제가 지금도 있는지.
 * 회차 파일을 지우거나 문항 수를 줄이면 남은 기록은 집계·목록에서 빠진다.
 * 목록을 받기 전에는 true (깜빡임 방지)
 */
export function questionExists(examId: string, questionId: number) {
  const count = catalog.value?.get(examId)?.count
  return !catalog.value || (count !== undefined && questionId >= 1 && questionId <= count)
}

/** 회차의 종류 (SQLD 모의고사 / SQLP 모의고사 / 기출). 목록을 받기 전에는 id 접두사로 판단 */
export function examKindOf(examId: string): ExamKind {
  return (
    catalog.value?.get(examId)?.kind ?? (examId.startsWith('sqlp-') ? 'sqlp' : examId.startsWith('ai-') ? 'ai' : 'past')
  )
}

function loadIndex() {
  indexPromise ??= getJson<{ exams: ExamMeta[]; bank?: BankIndex }>(`${BASE}index.json?t=${Date.now()}`)
    .then((d) => {
      catalog.value = new Map(d.exams.map((e) => [e.id, { count: e.questionCount, kind: e.kind }]))
      return { exams: d.exams, bank: d.bank ?? {} }
    })
    .catch((e) => {
      indexPromise = null // 실패하면 다음에 다시 시도
      throw e
    })
  return indexPromise
}

export async function loadExamIndex() {
  return (await loadIndex()).exams
}

/** 이론 절(slug)별 문항 수 */
export async function loadBankIndex(kind: ExamKind) {
  return (await loadIndex()).bank[kind] ?? {}
}

/** 한 절의 문제은행 (여러 회차에서 모은 문항) */
export function loadBank(kind: ExamKind, slug: string): Promise<BankQuestion[]> {
  const key = `${kind}/${slug}`
  let p = bankCache.get(key)
  if (!p) {
    p = loadBankIndex(kind).then((idx) => {
      const entry = idx[slug]
      return entry ? getJson<BankQuestion[]>(BASE + entry.file) : []
    })
    p.catch(() => bankCache.delete(key))
    bankCache.set(key, p)
  }
  return p
}

export async function loadExamsByKind(kind: ExamKind) {
  return (await loadExamIndex()).filter((e) => e.kind === kind)
}

export async function findExamMeta(id: string) {
  return (await loadExamIndex()).find((e) => e.id === id)
}

export function loadExam(id: string): Promise<Exam> {
  let p = examCache.get(id)
  if (!p) {
    p = findExamMeta(id).then((meta) => {
      if (!meta) throw new Error(`시험을 찾을 수 없습니다: ${id}`)
      return getJson<Exam>(BASE + meta.file)
    })
    p.catch(() => examCache.delete(id))
    examCache.set(id, p)
  }
  return p
}

// SQLD/SQLP 는 헤더에서 고르므로 둘 다 '모의고사'. 어느 자격증인지 밝혀야 할 때는 CERT_OF_KIND 를 함께 쓴다
export const KIND_LABEL: Record<ExamKind, string> = { past: '기출문제', ai: '모의고사', sqlp: '모의고사' }
export const CERT_OF_KIND: Record<ExamKind, string> = { past: 'SQLD', ai: 'SQLD', sqlp: 'SQLP' }
export const KIND_ROUTE: Record<ExamKind, string> = { past: '/exams', ai: '/mock', sqlp: '/sqlp' }
/** 진행률 집계 시 회차 id 접두사 (분류별 연습) */
export const KIND_PREFIX: Record<ExamKind, string> = { past: '', ai: 'ai-', sqlp: 'sqlp-' }
export const SUBJECTS: Subject[] = [1, 2, 3]

/**
 * 합격 기준
 * - SQLD: 객관식 100점 만점, 60점 이상, 과목별 40% 미만 과락
 * - SQLP: 객관식 70점 + 실기 30점, 75점 이상, 과목별(객관식) 40% 미만 과락
 */
export const PASS_RULE: Record<ExamKind, { pass: number; objectiveMax: number }> = {
  past: { pass: 60, objectiveMax: 100 },
  ai: { pass: 60, objectiveMax: 100 },
  sqlp: { pass: 75, objectiveMax: 70 },
}

export function judge(
  kind: ExamKind,
  correct: Record<Subject, number>,
  total: Record<Subject, number>,
  practical?: { score: number; max: number },
) {
  const all = SUBJECTS.reduce((n, s) => n + total[s], 0)
  const hit = SUBJECTS.reduce((n, s) => n + correct[s], 0)
  // 실기가 없으면 객관식만으로 100점 환산
  const objectiveMax = practical?.max ? PASS_RULE[kind].objectiveMax : 100
  const objective = all ? (hit / all) * objectiveMax : 0
  const score = Math.round(objective + (practical?.score ?? 0))
  const cutoff = SUBJECTS.filter((s) => total[s] && correct[s] / total[s] < 0.4)
  return { score, objective: Math.round(objective), passed: score >= PASS_RULE[kind].pass && cutoff.length === 0, cutoff }
}
