import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { buildTree, subjectNo, theoryDocs } from '@/lib/content'
import { examKindOf, KIND_ROUTE } from '@/lib/exams'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useWrongNotesStore } from '@/stores/wrongNotes'
import type { ExamKind } from '@/types'

export type Cert = 'sqld' | 'sqlp'

/** 자격증별로 보여줄 범위: 이론 과목, 모의고사 종류 */
/** 자격증별 모의고사 종류 (기출 past 는 SQLD 화면에 따로 있다) */
export type MockKind = Exclude<ExamKind, 'past'>

export const CERTS: Record<Cert, { label: string; subjects: number[]; examKind: MockKind; examLabel: string }> = {
  sqld: { label: 'SQLD', subjects: [1, 2], examKind: 'ai', examLabel: '모의고사' },
  sqlp: { label: 'SQLP', subjects: [1, 2, 3], examKind: 'sqlp', examLabel: '모의고사' },
}

// 마지막으로 고른 자격증은 이 브라우저에 기억한다 (편의 기능이라 저장이 막혀 있으면 SQLD 로 시작)
const STORAGE_KEY = 'sql-cert:cert'
function readSaved(): Cert {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'sqlp' ? 'sqlp' : 'sqld'
  } catch {
    return 'sqld'
  }
}

/**
 * 지금 공부 중인 자격증 (헤더에서 선택).
 * SQLD 면 이론 1~2과목과 SQLD 모의고사, SQLP 면 이론 1~3과목과 SQLP 모의고사만 보여준다.
 */
export const useCertStore = defineStore('cert', () => {
  const cert = ref<Cert>(readSaved())
  watch(cert, (c) => {
    try {
      localStorage.setItem(STORAGE_KEY, c)
    } catch {
      // 저장이 막혀 있으면 이번 방문 동안만 유지
    }
  })

  const info = computed(() => CERTS[cert.value])
  /** 이 자격증 범위의 이론 문서 (진행률·목록·검색에 쓴다) */
  const docs = computed(() => theoryDocs.filter((d) => info.value.subjects.includes(subjectNo(d))))
  const tree = computed(() => buildTree(docs.value))
  const examKind = computed(() => info.value.examKind)
  const examRoute = computed(() => KIND_ROUTE[examKind.value])
  const includes = (slug: string) => docs.value.some((d) => d.slug === slug)

  /** 이 자격증의 회차인지 (기출은 SQLD) */
  function ownsExam(examId: string) {
    const kind = examKindOf(examId)
    return cert.value === 'sqlp' ? kind === 'sqlp' : kind !== 'sqlp'
  }
  // 오답노트·북마크도 선택한 자격증 것만 (진행률 집계는 회차별이라 전체 기록을 그대로 쓴다)
  const wrongNotesStore = useWrongNotesStore()
  const bookmarksStore = useBookmarksStore()
  const wrongNotes = computed(() => wrongNotesStore.list.filter((n) => ownsExam(n.examId)))
  const unresolvedCount = computed(() => wrongNotes.value.filter((n) => !n.resolved).length)
  /** 오늘 복습할 오답 (간격 복습) */
  const dueNotes = computed(() => wrongNotesStore.dueList.filter((n) => ownsExam(n.examId)))
  const bookmarks = computed(() => bookmarksStore.list.filter((b) => ownsExam(b.examId)))

  /** 다른 자격증 화면(주소)으로 들어오면 선택도 따라간다 (예: /sqlp 링크를 열면 SQLP) */
  function followRoute(path: string, docSlug?: string) {
    if (path.startsWith('/sqlp')) cert.value = 'sqlp'
    else if (path.startsWith('/mock') || path.startsWith('/exams')) cert.value = 'sqld'
    else if (docSlug && !includes(docSlug)) cert.value = 'sqlp' // SQLD 에 없는 3과목 문서
  }

  return {
    cert,
    info,
    docs,
    tree,
    examKind,
    examRoute,
    includes,
    followRoute,
    ownsExam,
    wrongNotes,
    unresolvedCount,
    dueNotes,
    bookmarks,
  }
})
