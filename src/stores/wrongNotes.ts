import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { localWrongNotes, remoteWrongNotes } from '@/services/wrongNoteRepository'
import { questionExists } from '@/lib/exams'
import { addDays, dayKey } from '@/lib/date'
import type { WrongNote } from '@/types'

export const noteKey = (examId: string, questionId: number) => `${examId}:${questionId}`

/**
 * 간격 복습: 틀리면 다음 날, 복습 날에 맞히면 3일 뒤, 또 맞히면 7일 뒤.
 * 7일 뒤 복습까지 맞히면 '해결'로 바뀐다. 복습 날 전에 맞힌 건 단계를 올리지 않는다 (금방 기억나는 게 당연하니까)
 */
export const REVIEW_DAYS = [1, 3, 7]

/** 다음 복습 날짜 (예전 기록은 틀린 다음 날) */
export const dueOf = (n: WrongNote) => n.dueOn ?? addDays(dayKey(new Date(n.createdAt)), 1)
/** 오늘 복습할 차례인지 */
export const isDue = (n: WrongNote, today = dayKey()) => !n.resolved && dueOf(n) <= today

export const useWrongNotesStore = defineStore('wrongNotes', () => {
  const notes = ref<Record<string, WrongNote>>({})
  const loaded = ref(false)
  /** true 면 로그인 상태 → 서버(Supabase)에 저장 */
  const remote = ref(false)
  const repo = () => (remote.value ? remoteWrongNotes : localWrongNotes)

  async function load() {
    if (loaded.value) return
    await reload(remote.value)
  }

  /** 저장 위치를 바꾸고 다시 불러온다 (로그인/로그아웃 시) */
  async function reload(useRemote: boolean) {
    remote.value = useRemote
    const list = await repo().list()
    notes.value = Object.fromEntries(list.map((n) => [n.key, n]))
    loaded.value = true
  }

  // 다시 풀기/메모 수정으로 카드 순서가 바뀌지 않도록 생성 시각 기준 정렬
  // 지금은 없는 문제(회차 파일 삭제 등)의 오답은 목록·개수에서 뺀다
  const list = computed(() =>
    Object.values(notes.value)
      .filter((n) => questionExists(n.examId, n.questionId))
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) ||
          a.examId.localeCompare(b.examId) ||
          a.questionId - b.questionId,
      ),
  )
  const unresolvedCount = computed(() => list.value.filter((n) => !n.resolved).length)
  /** 오늘 복습할 오답 (복습 날짜가 오늘이거나 지난 것) */
  const dueList = computed(() => {
    const today = dayKey()
    return list.value.filter((n) => isDue(n, today))
  })

  async function persist(note: WrongNote) {
    note.updatedAt = new Date().toISOString()
    notes.value[note.key] = note
    await repo().save(note).catch((e) => console.error('[오답노트 저장 실패]', e))
  }

  /**
   * 풀이 결과로 갱신될 오답노트 계산.
   * 틀리면 추가/누적하고 복습을 처음부터, 맞히면 맞힌 횟수를 올리고 복습 날이면 다음 단계로
   */
  function next(examId: string, questionId: number, answer: number, correct: boolean): WrongNote | null {
    const key = noteKey(examId, questionId)
    const existing = notes.value[key]
    const now = new Date().toISOString()
    const today = dayKey()
    if (correct) {
      if (!existing) return null
      const updated = { ...existing, lastAnswer: answer, correctCount: existing.correctCount + 1, updatedAt: now }
      if (!isDue(existing, today)) return updated
      const stage = (existing.reviewStage ?? 0) + 1
      return stage >= REVIEW_DAYS.length
        ? { ...updated, reviewStage: stage, dueOn: undefined, resolved: true }
        : { ...updated, reviewStage: stage, dueOn: addDays(today, REVIEW_DAYS[stage]!) }
    }
    const restart = { reviewStage: 0, dueOn: addDays(today, REVIEW_DAYS[0]!), resolved: false }
    return existing
      ? { ...existing, ...restart, lastAnswer: answer, wrongCount: existing.wrongCount + 1, updatedAt: now }
      : {
          key,
          examId,
          questionId,
          lastAnswer: answer,
          wrongCount: 1,
          correctCount: 0,
          memo: '',
          ...restart,
          createdAt: now,
          updatedAt: now,
        }
  }

  /** 여러 문항의 풀이 결과를 한 번에 기록 (서버 요청 1번) */
  async function recordMany(list: { examId: string; questionId: number; answer: number; correct: boolean }[]) {
    const changed = list
      .map((r) => next(r.examId, r.questionId, r.answer, r.correct))
      .filter((n): n is WrongNote => !!n)
    for (const n of changed) notes.value[n.key] = n
    await repo().saveMany(changed).catch((e) => console.error('[오답노트 저장 실패]', e))
  }

  async function record(examId: string, questionId: number, answer: number, correct: boolean) {
    await recordMany([{ examId, questionId, answer, correct }])
  }

  async function update(key: string, patch: Partial<Pick<WrongNote, 'memo' | 'resolved'>>) {
    const note = notes.value[key]
    if (!note) return
    // '복습 필요'로 되돌리면 오늘부터 다시 복습
    const restart = patch.resolved === false && note.resolved ? { reviewStage: 0, dueOn: dayKey() } : {}
    await persist({ ...note, ...patch, ...restart })
  }

  async function remove(key: string) {
    delete notes.value[key]
    await repo().remove(key).catch((e) => console.error('[오답노트 삭제 실패]', e))
  }

  return { notes, list, unresolvedCount, dueList, loaded, remote, load, reload, record, recordMany, update, remove }
})
