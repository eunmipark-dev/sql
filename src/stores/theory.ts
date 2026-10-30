import { defineStore } from 'pinia'
import { ref } from 'vue'
import { localTheory, remoteTheory } from '@/services/theoryRepository'
import type { TheoryDoc, TheoryRecord } from '@/types'

export interface TheoryStats {
  total: number
  /** '학습 완료'로 표시한 문서 수 */
  completed: number
  /** 한 번이라도 연 문서 수 */
  viewed: number
  /** 가장 최근에 연 시각 */
  lastViewedAt?: string
}

/** 이론 문서별 학습 기록 (마지막으로 본 날짜, 학습 완료) */
export const useTheoryStore = defineStore('theory', () => {
  const records = ref<Record<string, TheoryRecord>>({})
  const loaded = ref(false)
  /** true 면 로그인 상태 → 서버(Supabase)에 저장 */
  const remote = ref(false)
  const repo = () => (remote.value ? remoteTheory : localTheory)

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

  async function persist(record: TheoryRecord) {
    records.value[record.key] = record
    await repo().saveMany([record]).catch((e) => console.error('[이론 학습 기록 저장 실패]', e))
  }

  /** 문서를 열었을 때 */
  async function view(slug: string) {
    const now = new Date().toISOString()
    const prev = records.value[slug]
    await persist({ ...prev, key: slug, viewCount: (prev?.viewCount ?? 0) + 1, lastViewedAt: now, updatedAt: now })
  }

  /** '학습 완료' 표시/해제 */
  async function setCompleted(slug: string, completed: boolean) {
    const now = new Date().toISOString()
    const prev = records.value[slug]
    await persist({
      key: slug,
      viewCount: prev?.viewCount ?? 1,
      lastViewedAt: prev?.lastViewedAt ?? now,
      completedAt: completed ? now : undefined,
      updatedAt: now,
    })
  }

  function statsOf(docs: TheoryDoc[]): TheoryStats {
    let completed = 0
    let viewed = 0
    let lastViewedAt: string | undefined
    for (const d of docs) {
      const r = records.value[d.slug]
      if (!r) continue
      viewed++
      if (r.completedAt) completed++
      if (!lastViewedAt || r.lastViewedAt > lastViewedAt) lastViewedAt = r.lastViewedAt
    }
    return { total: docs.length, completed, viewed, lastViewedAt }
  }

  return { records, loaded, remote, load, reload, view, setCompleted, statsOf }
})
