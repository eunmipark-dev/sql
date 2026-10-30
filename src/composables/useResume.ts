import { computed, ref, watch } from 'vue'
import { hasLecture, readLectureProgress } from '@/lib/lectures'
import { lectureParts, partOf } from '@/lib/lectureParts'
import { KIND_ROUTE, loadExamIndex } from '@/lib/exams'
import { localExamDrafts, remoteExamDrafts } from '@/services/examDraftRepository'
import { useAuthStore } from '@/stores/auth'
import { useCertStore } from '@/stores/cert'
import { useTheoryStore } from '@/stores/theory'
import type { ExamMeta, TheoryDoc } from '@/types'

export type ResumeItem =
  | {
      kind: 'lecture'
      doc: TheoryDoc
      /** 이어 들을 장면 / 전체 */
      pos: number
      total: number
      part?: { index: number; count: number; title: string }
      at: string
      to: { name: 'lecture'; params: { slug: string } }
    }
  | { kind: 'exam'; meta: ExamMeta; answered: number; at: string; to: string }

/**
 * 이어서 할 것 (홈 '오늘 할 것'): 듣다 만 강의, 풀다 만 모의고사 중 최근 것부터.
 * 둘 다 없으면 next 로 아직 끝내지 않은 첫 강의를 권한다
 */
export function useResume() {
  const certStore = useCertStore()
  const theory = useTheoryStore()
  const auth = useAuthStore()

  const lectures = computed<ResumeItem[]>(() =>
    certStore.docs
      .filter((d) => hasLecture(d.slug))
      .flatMap((doc) => {
        const { pos, total } = readLectureProgress(doc.slug)
        const record = theory.records[doc.slug]
        if (!pos || !total || pos >= total) return []
        const parts = lectureParts(doc.slug)
        const p = partOf(parts, pos)
        return [
          {
            kind: 'lecture' as const,
            doc,
            pos,
            total,
            part: p && parts.length > 1 ? { index: p.index, count: parts.length, title: p.title } : undefined,
            at: record?.lastViewedAt ?? '',
            to: { name: 'lecture' as const, params: { slug: doc.slug } },
          },
        ]
      }),
  )

  const exams = ref<ResumeItem[]>([])
  watch(
    [() => auth.user?.id, () => certStore.cert],
    async () => {
      try {
        const [drafts, metas] = await Promise.all([(auth.user ? remoteExamDrafts : localExamDrafts).list(), loadExamIndex()])
        exams.value = drafts.flatMap((d) => {
          const meta = metas.find((m) => m.id === d.examId)
          const answered = Object.keys(d.answers).length
          if (!meta || !answered || !certStore.ownsExam(meta.id)) return []
          return [{ kind: 'exam' as const, meta, answered, at: d.updatedAt, to: `${KIND_ROUTE[meta.kind]}/${meta.id}` }]
        })
      } catch {
        exams.value = []
      }
    },
    { immediate: true },
  )

  /** 최근에 하던 것부터 */
  const items = computed(() => [...lectures.value, ...exams.value].sort((a, b) => b.at.localeCompare(a.at)))

  /** 아직 끝내지 않은 첫 강의 (이론 순서) */
  const next = computed(() => certStore.docs.find((d) => hasLecture(d.slug) && !theory.records[d.slug]?.completedAt))

  return { items, next }
}
