import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { localBookmarks, remoteBookmarks } from '@/services/bookmarkRepository'
import { questionExists } from '@/lib/exams'
import { noteKey } from '@/stores/wrongNotes'
import type { Bookmark } from '@/types'

/** 북마크한 문항 (나중에 다시 볼 문제) */
export const useBookmarksStore = defineStore('bookmarks', () => {
  const items = ref<Record<string, Bookmark>>({})
  const loaded = ref(false)
  /** true 면 로그인 상태 → 서버(Supabase)에 저장 */
  const remote = ref(false)
  const repo = () => (remote.value ? remoteBookmarks : localBookmarks)

  async function load() {
    if (loaded.value) return
    await reload(remote.value)
  }

  /** 저장 위치를 바꾸고 다시 불러온다 (로그인/로그아웃 시) */
  async function reload(useRemote: boolean) {
    remote.value = useRemote
    const list = await repo().list()
    items.value = Object.fromEntries(list.map((b) => [b.key, b]))
    loaded.value = true
  }

  // 최근에 북마크한 문제가 위로. 지금은 없는 문제는 뺀다
  const list = computed(() =>
    Object.values(items.value)
      .filter((b) => questionExists(b.examId, b.questionId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
  const count = computed(() => list.value.length)

  const has = (examId: string, questionId: number) => !!items.value[noteKey(examId, questionId)]

  async function toggle(examId: string, questionId: number) {
    const key = noteKey(examId, questionId)
    if (items.value[key]) {
      delete items.value[key]
      await repo().remove(key).catch((e) => console.error('[북마크 삭제 실패]', e))
      return
    }
    const now = new Date().toISOString()
    const bookmark: Bookmark = { key, examId, questionId, createdAt: now, updatedAt: now }
    items.value[key] = bookmark
    await repo().saveMany([bookmark]).catch((e) => console.error('[북마크 저장 실패]', e))
  }

  return { items, list, count, remote, load, reload, has, toggle }
})
