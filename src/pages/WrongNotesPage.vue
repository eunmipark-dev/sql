<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarClock, CheckCircle2, ChevronRight, RotateCcw, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import BookmarkButton from '@/components/exam/BookmarkButton.vue'
import CopyQuestionButton from '@/components/exam/CopyQuestionButton.vue'
import QuestionView from '@/components/exam/QuestionView.vue'
import { loadExam, loadExamIndex } from '@/lib/exams'
import { dueOf, useWrongNotesStore } from '@/stores/wrongNotes'
import { dayKey, daysBetween } from '@/lib/date'
import { useProgressStore } from '@/stores/progress'
import { useCertStore } from '@/stores/cert'
import type { Exam, ExamMeta, Question, WrongNote } from '@/types'

const store = useWrongNotesStore()
const progress = useProgressStore()
const certStore = useCertStore()

// 오답이 있는 회차의 문제만 불러온다
const exams = ref<Record<string, Exam>>({})
const metas = ref<ExamMeta[]>([])
const loading = ref(true)
loadExamIndex().then((list) => (metas.value = list)).catch(() => {})
watch(
  () => [...new Set(certStore.wrongNotes.map((n) => n.examId))].join(','),
  async (ids) => {
    const need = ids.split(',').filter((id) => id && !exams.value[id])
    const loaded = await Promise.allSettled(need.map((id) => loadExam(id)))
    for (const r of loaded) if (r.status === 'fulfilled') exams.value[r.value.id] = r.value
    loading.value = false
  },
  { immediate: true },
)
const examOptions = computed(() => metas.value.filter((m) => certStore.wrongNotes.some((n) => n.examId === m.id)))

type Filter = 'open' | 'resolved' | 'all'
const filter = ref<Filter>('open')
const examFilter = ref('')
/** 다시 풀기 중 선택한 답 (key → 선택지) */
const retry = ref<Record<string, number>>({})

const items = computed(() =>
  certStore.wrongNotes
    .filter((n) => (filter.value === 'all' ? true : filter.value === 'resolved' ? n.resolved : !n.resolved))
    .filter((n) => !examFilter.value || n.examId === examFilter.value)
    .map((note) => {
      const exam = exams.value[note.examId]
      const index = exam?.questions.findIndex((q) => q.id === note.questionId) ?? -1
      return { note, exam, question: exam?.questions[index], number: index + 1 }
    })
    .filter((i) => i.question),
)

const counts = computed(() => ({
  open: certStore.wrongNotes.filter((n) => !n.resolved).length,
  resolved: certStore.wrongNotes.filter((n) => n.resolved).length,
  all: certStore.wrongNotes.length,
}))

async function answer(note: WrongNote, choice: number, question: Question) {
  retry.value[note.key] = choice
  await progress.answer(
    { examId: note.examId, questionId: note.questionId, theory: question.theory, answer: choice },
    choice === question.answer,
  )
}

function resetRetry(key: string) {
  delete retry.value[key]
}

/** 다음 복습: 오늘 / n일 뒤 */
function dueLabel(note: WrongNote) {
  const days = daysBetween(dayKey(), dueOf(note))
  return days <= 0 ? '오늘 복습' : `${days}일 뒤 복습`
}

const tabs: { value: Filter; label: string }[] = [
  { value: 'open', label: '복습 필요' },
  { value: 'resolved', label: '해결됨' },
  { value: 'all', label: '전체' },
]
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="text-2xl font-bold">오답노트 <span class="text-base font-normal text-muted-foreground">{{ certStore.info.label }}</span></h1>
    <p class="mt-1 text-sm text-muted-foreground">
      틀린 문제를 다시 풀고 메모를 남겨보세요. 완전히 이해했다면 '해결'로 표시하세요.
    </p>

    <!-- 간격 복습: 오늘 차례인 오답이 있으면 먼저 -->
    <RouterLink
      v-if="certStore.dueNotes.length"
      to="/review"
      class="mt-5 flex items-center gap-3 rounded-2xl border border-highlight bg-highlight/25 p-4 transition-colors hover:border-primary"
    >
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-highlight text-ink"><RotateCcw class="size-5" /></span>
      <span class="min-w-0 flex-1">
        <span class="block font-semibold">오늘 복습 {{ certStore.dueNotes.length }}문제</span>
        <span class="block text-xs text-muted-foreground">1일 · 3일 · 7일 뒤에 다시 풀고, 세 번 다 맞히면 해결돼요.</span>
      </span>
      <ChevronRight class="size-5 text-muted-foreground" />
    </RouterLink>

    <div class="mt-6 flex flex-wrap items-center gap-2">
      <Button
        v-for="t in tabs"
        :key="t.value"
        size="sm"
        :variant="filter === t.value ? 'default' : 'outline'"
        @click="filter = t.value"
      >
        {{ t.label }} <span class="opacity-70">{{ counts[t.value] }}</span>
      </Button>
      <select v-model="examFilter" class="ml-auto h-8 rounded-md border bg-background px-2 text-sm">
        <option value="">모든 회차</option>
        <option v-for="e in examOptions" :key="e.id" :value="e.id">{{ e.kind === 'past' ? `기출 · ${e.title}` : e.title }}</option>
      </select>
    </div>

    <div v-if="loading && certStore.wrongNotes.length" class="mt-6 space-y-4">
      <div v-for="i in 2" :key="i" class="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
    <div v-else-if="!items.length" class="mt-16 text-center text-muted-foreground">
      <p>표시할 오답이 없어요.</p>
      <Button variant="link" as-child><RouterLink :to="certStore.examRoute">{{ certStore.info.examLabel }} 풀러 가기</RouterLink></Button>
    </div>

    <div class="mt-6 space-y-4">
      <div v-for="{ note, exam, question, number } in items" :key="note.key" class="rounded-xl border p-4 sm:p-6">
        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{{ exam!.kind === 'past' ? `기출 · ${exam!.title}` : exam!.title }}</Badge>
          <Badge variant="outline">{{ question!.subject }}과목</Badge>
          <span class="text-muted-foreground">틀림 {{ note.wrongCount }} · 맞힘 {{ note.correctCount }}</span>
          <span v-if="!note.resolved" class="inline-flex items-center gap-0.5 text-muted-foreground">
            <CalendarClock class="size-3.5" /> {{ dueLabel(note) }}
          </span>
          <div class="-my-1.5 -mr-1.5 ml-auto flex items-center gap-1">
            <Badge v-if="note.resolved" class="bg-success text-white"><CheckCircle2 class="size-3" /> 해결</Badge>
            <CopyQuestionButton :question="question!" :selected="retry[note.key] ?? null" :revealed="retry[note.key] !== undefined" />
            <BookmarkButton :exam-id="note.examId" :question-id="note.questionId" />
          </div>
        </div>

        <QuestionView
          :question="question!"
          :number="number"
          :selected="retry[note.key] ?? null"
          :revealed="retry[note.key] !== undefined"
          :bookmark="{ examId: note.examId, questionId: note.questionId }"
          always-extras
          bookmark-outside
          @select="(c) => answer(note, c, question!)"
        />

        <div class="mt-3 flex flex-wrap gap-2">
          <Button v-if="retry[note.key] !== undefined" variant="outline" size="sm" @click="resetRetry(note.key)">
            <RotateCcw class="size-4" /> 다시 풀기
          </Button>
          <Button variant="outline" size="sm" @click="store.update(note.key, { resolved: !note.resolved })">
            <CheckCircle2 class="size-4" /> {{ note.resolved ? '복습 필요로 되돌리기' : '해결로 표시' }}
          </Button>
          <Button variant="ghost" size="sm" class="ml-auto text-muted-foreground" @click="store.remove(note.key)">
            <Trash2 class="size-4" /> 삭제
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
