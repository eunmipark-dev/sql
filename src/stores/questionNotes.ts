import { defineStore } from 'pinia'
import { ref } from 'vue'
import { localQuestionNotes, remoteQuestionNotes } from '@/services/questionNoteRepository'
import { noteKey, useWrongNotesStore } from '@/stores/wrongNotes'
import type { QuestionNote } from '@/types'

/**
 * 문제별 개인 메모 (나만 보기). 문제가 보이는 모든 화면에서 같은 메모를 쓴다.
 * 예전에는 오답노트에만 메모가 있었으므로, 아직 메모가 없으면 오답노트 메모를 대신 보여준다
 * (서버에서는 schema.sql 이 오답노트 메모를 한 번 옮겨 온다)
 */
export const useQuestionNotesStore = defineStore('questionNotes', () => {
  const notes = ref<Record<string, QuestionNote>>({})
  const loaded = ref(false)
  /** true 면 로그인 상태 → 서버(Supabase)에 저장 */
  const remote = ref(false)
  const repo = () => (remote.value ? remoteQuestionNotes : localQuestionNotes)
  const wrongNotes = useWrongNotesStore()

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

  function memoOf(examId: string, questionId: number) {
    const key = noteKey(examId, questionId)
    return notes.value[key]?.memo ?? wrongNotes.notes[key]?.memo ?? ''
  }

  /** 메모 저장. 비우면 지운다 */
  async function save(examId: string, questionId: number, memo: string) {
    const key = noteKey(examId, questionId)
    const text = memo.trim() ? memo.slice(0, 2000) : ''
    if (!text) {
      delete notes.value[key]
      await repo().remove(key)
    } else {
      const note: QuestionNote = { key, examId, questionId, memo: text, updatedAt: new Date().toISOString() }
      notes.value[key] = note
      await repo().saveMany([note])
    }
    // 오답노트 메모는 이제 쓰지 않으므로 비워 둔다 (대신 보여주기에서 옛 메모가 다시 나오지 않게)
    if (wrongNotes.notes[key]?.memo) await wrongNotes.update(key, { memo: '' })
  }

  return { notes, loaded, remote, load, reload, memoOf, save }
})
