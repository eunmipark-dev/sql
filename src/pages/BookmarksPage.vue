<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import BookmarkButton from '@/components/exam/BookmarkButton.vue'
import CopyQuestionButton from '@/components/exam/CopyQuestionButton.vue'
import QuestionView from '@/components/exam/QuestionView.vue'
import { loadExam, loadExamIndex } from '@/lib/exams'
import { useProgressStore } from '@/stores/progress'
import { useCertStore } from '@/stores/cert'
import type { Bookmark, Exam, ExamMeta, Question } from '@/types'

const progress = useProgressStore()
const certStore = useCertStore()

// 북마크가 있는 회차의 문제만 불러온다
const exams = ref<Record<string, Exam>>({})
const metas = ref<ExamMeta[]>([])
const loading = ref(true)
loadExamIndex().then((list) => (metas.value = list)).catch(() => {})
watch(
  () => [...new Set(certStore.bookmarks.map((b) => b.examId))].join(','),
  async (ids) => {
    const need = ids.split(',').filter((id) => id && !exams.value[id])
    const loaded = await Promise.allSettled(need.map((id) => loadExam(id)))
    for (const r of loaded) if (r.status === 'fulfilled') exams.value[r.value.id] = r.value
    loading.value = false
  },
  { immediate: true },
)
const examOptions = computed(() => metas.value.filter((m) => certStore.bookmarks.some((b) => b.examId === m.id)))

type Subject = 0 | 1 | 2 | 3
const subject = ref<Subject>(0)
const examFilter = ref('')
/** 다시 풀기 중 선택한 답 (key → 선택지) */
const retry = ref<Record<string, number>>({})

const all = computed(() =>
  certStore.bookmarks
    .filter((b) => !examFilter.value || b.examId === examFilter.value)
    .map((bookmark) => {
      const exam = exams.value[bookmark.examId]
      const index = exam?.questions.findIndex((q) => q.id === bookmark.questionId) ?? -1
      return { bookmark, exam, question: exam?.questions[index], number: index + 1 }
    })
    .filter((i) => i.question),
)
const items = computed(() => all.value.filter((i) => !subject.value || i.question!.subject === subject.value))

const counts = computed(() => ({
  0: all.value.length,
  1: all.value.filter((i) => i.question!.subject === 1).length,
  2: all.value.filter((i) => i.question!.subject === 2).length,
  3: all.value.filter((i) => i.question!.subject === 3).length,
}))

const STATUS_LABEL = { new: '안 푼 문제', correct: '맞힘', wrong: '오답', resolved: '오답 해결' } as const

async function answer(bookmark: Bookmark, choice: number, question: Question) {
  retry.value[bookmark.key] = choice
  await progress.answer(
    { examId: bookmark.examId, questionId: bookmark.questionId, theory: question.theory, answer: choice },
    choice === question.answer,
  )
}

// 3과목(SQLP)은 북마크가 있을 때만 보여준다
const tabs = computed(() =>
  ([
    { value: 0, label: '전체' },
    { value: 1, label: '1과목' },
    { value: 2, label: '2과목' },
    { value: 3, label: '3과목' },
  ] as { value: Subject; label: string }[]).filter((t) => t.value !== 3 || counts.value[3]),
)
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="text-2xl font-bold">북마크 <span class="text-base font-normal text-muted-foreground">{{ certStore.info.label }}</span></h1>
    <p class="mt-1 text-sm text-muted-foreground">
      문제 오른쪽 위 책갈피 아이콘으로 저장한 문제예요. 다시 풀어보고, 다 봤으면 책갈피를 눌러 빼세요.
    </p>

    <div class="mt-6 flex flex-wrap items-center gap-2">
      <Button
        v-for="t in tabs"
        :key="t.value"
        size="sm"
        :variant="subject === t.value ? 'default' : 'outline'"
        @click="subject = t.value"
      >
        {{ t.label }} <span class="opacity-70">{{ counts[t.value] }}</span>
      </Button>
      <select v-model="examFilter" class="ml-auto h-8 rounded-md border bg-background px-2 text-sm">
        <option value="">모든 회차</option>
        <option v-for="e in examOptions" :key="e.id" :value="e.id">{{ e.kind === 'past' ? `기출 · ${e.title}` : e.title }}</option>
      </select>
    </div>

    <div v-if="loading && certStore.bookmarks.length" class="mt-6 space-y-4">
      <div v-for="i in 2" :key="i" class="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
    <div v-else-if="!items.length" class="mt-16 text-center text-muted-foreground">
      <p>북마크한 문제가 없어요.</p>
      <Button variant="link" as-child><RouterLink :to="certStore.examRoute">{{ certStore.info.examLabel }} 풀러 가기</RouterLink></Button>
    </div>

    <div class="mt-6 space-y-4">
      <div v-for="{ bookmark, exam, question, number } in items" :key="bookmark.key" class="rounded-xl border p-4 sm:p-6">
        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{{ exam!.kind === 'past' ? `기출 · ${exam!.title}` : exam!.title }}</Badge>
          <Badge variant="outline">{{ question!.subject }}과목</Badge>
          <span class="text-muted-foreground">{{ STATUS_LABEL[progress.statusOf(bookmark.examId, bookmark.questionId)] }}</span>
          <div class="-my-1.5 -mr-1.5 ml-auto flex items-center">
            <CopyQuestionButton :question="question!" :selected="retry[bookmark.key] ?? null" :revealed="retry[bookmark.key] !== undefined" />
            <BookmarkButton :exam-id="bookmark.examId" :question-id="bookmark.questionId" />
          </div>
        </div>

        <QuestionView
          :question="question!"
          :number="number"
          :selected="retry[bookmark.key] ?? null"
          :revealed="retry[bookmark.key] !== undefined"
          :bookmark="{ examId: bookmark.examId, questionId: bookmark.questionId }"
          always-extras
          bookmark-outside
          @select="(c) => answer(bookmark, c, question!)"
        />

        <div v-if="retry[bookmark.key] !== undefined" class="mt-3">
          <Button variant="outline" size="sm" @click="delete retry[bookmark.key]">
            <RotateCcw class="size-4" /> 다시 풀기
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
