<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { CalendarClock, Check, ChevronRight, Flame, NotebookPen, PartyPopper, RotateCcw } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import QuestionView from '@/components/exam/QuestionView.vue'
import { daysBetween, dayKey } from '@/lib/date'
import { loadExam } from '@/lib/exams'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'
import { useCertStore } from '@/stores/cert'
import { useProgressStore } from '@/stores/progress'
import { REVIEW_DAYS, dueOf, useWrongNotesStore } from '@/stores/wrongNotes'
import type { Exam, WrongNote } from '@/types'

/**
 * 오늘 복습: 복습 날짜가 된 오답을 한 문제씩 다시 푼다 (간격 복습 1일 → 3일 → 7일).
 * 시작할 때 목록을 고정해 두고(푸는 동안 줄어들지 않게) 끝까지 간다
 */
document.title = '오늘 복습 · SQL 자격증'
const certStore = useCertStore()
const progress = useProgressStore()
const wrongNotes = useWrongNotesStore()
const activity = useActivityStore()

const queue = ref<WrongNote[]>([])
const index = ref(0)
const picked = ref<number>()
const exams = ref<Record<string, Exam>>({})
const loading = ref(true)
const result = ref({ correct: 0, solved: 0 })
/** 방금 푼 문제의 바뀐 복습 일정 */
const after = ref<WrongNote>()

/** 오답노트를 다 불러온 뒤 한 번 목록을 잡는다 (자격증을 바꾸면 다시) */
async function begin() {
  loading.value = true
  queue.value = [...certStore.dueNotes].sort((a, b) => dueOf(a).localeCompare(dueOf(b)))
  index.value = 0
  picked.value = undefined
  after.value = undefined
  result.value = { correct: 0, solved: 0 }
  const ids = [...new Set(queue.value.map((n) => n.examId))].filter((id) => !exams.value[id])
  const loaded = await Promise.allSettled(ids.map((id) => loadExam(id)))
  for (const r of loaded) if (r.status === 'fulfilled') exams.value[r.value.id] = r.value
  loading.value = false
}
watch(
  () => [wrongNotes.loaded, certStore.cert] as const,
  ([loaded]) => loaded && begin(),
  { immediate: true },
)

const current = computed(() => {
  const note = queue.value[index.value]
  const exam = note && exams.value[note.examId]
  const i = exam?.questions.findIndex((q) => q.id === note.questionId) ?? -1
  return note && exam && i >= 0 ? { note, exam, question: exam.questions[i]!, number: i + 1 } : undefined
})
const done = computed(() => !loading.value && index.value >= queue.value.length)

async function select(choice: number) {
  const c = current.value
  if (!c || picked.value !== undefined) return
  picked.value = choice
  const correct = choice === c.question.answer
  result.value.solved++
  if (correct) result.value.correct++
  await progress.answer({ examId: c.exam.id, questionId: c.question.id, theory: c.question.theory, answer: choice }, correct)
  after.value = wrongNotes.notes[c.note.key]
}

function next() {
  picked.value = undefined
  after.value = undefined
  index.value++
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** 바뀐 일정을 말로 */
const schedule = computed(() => {
  const n = after.value
  if (!n || picked.value === undefined) return undefined
  if (n.resolved) return { good: true, text: `${REVIEW_DAYS.length}번의 복습을 모두 맞혀 '해결'로 옮겼어요. 🎉` }
  const correct = picked.value === current.value?.question.answer
  return correct
    ? { good: true, text: `잘했어요! ${daysBetween(dayKey(), dueOf(n))}일 뒤에 한 번 더 확인해요.` }
    : { good: false, text: '괜찮아요. 내일 다시 나와요.' }
})

// Enter·→ 로 다음 문제
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if ((e.target as HTMLElement | null)?.closest('button, input, select, textarea, a')) return
  if ((e.key === 'Enter' || e.key === 'ArrowRight') && picked.value !== undefined) next()
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <div class="flex items-end gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="flex items-center gap-2 text-2xl font-bold"><RotateCcw class="size-6 text-primary" /> 오늘 복습</h1>
        <p class="mt-1 text-sm text-muted-foreground">틀린 문제를 1일 · 3일 · 7일 뒤에 다시 풀어요. 세 번 다 맞히면 해결!</p>
      </div>
      <span v-if="queue.length && !done" class="text-sm text-muted-foreground tabular-nums">
        <b class="text-foreground">{{ Math.min(index + 1, queue.length) }}</b> / {{ queue.length }}
      </span>
    </div>
    <div v-if="queue.length && !done" class="mt-4 flex h-1.5 gap-[3px]">
      <span
        v-for="(n, i) in queue"
        :key="n.key"
        :class="cn('flex-1 rounded-full', i < index || (i === index && picked !== undefined) ? 'bg-primary' : i === index ? 'bg-primary/40' : 'bg-muted')"
      />
    </div>

    <div v-if="loading" class="mt-6 h-80 animate-pulse rounded-xl bg-muted" />

    <!-- 복습할 게 없음 -->
    <div v-else-if="!queue.length" class="mt-12 flex flex-col items-center gap-3 text-center">
      <span class="grid size-16 place-items-center rounded-full bg-highlight text-ink"><Check class="size-8" stroke-width="3" /></span>
      <p class="text-lg font-semibold">오늘 복습할 문제가 없어요</p>
      <p class="text-sm text-muted-foreground break-keep">
        <template v-if="certStore.unresolvedCount">남은 오답 {{ certStore.unresolvedCount }}개는 복습 날짜가 되면 여기 나와요.</template>
        <template v-else>문제를 틀리면 다음 날 여기서 다시 만나요.</template>
      </p>
      <div class="mt-2 flex gap-2">
        <Button variant="outline" as-child><RouterLink to="/wrong-notes"><NotebookPen class="size-4" /> 오답노트</RouterLink></Button>
        <Button as-child><RouterLink to="/random">랜덤 문제 풀기</RouterLink></Button>
      </div>
    </div>

    <!-- 다 풀었음 -->
    <div v-else-if="done" class="mt-12 flex flex-col items-center gap-3 text-center">
      <span class="grid size-16 place-items-center rounded-full bg-highlight text-ink"><PartyPopper class="size-8" /></span>
      <p class="text-2xl font-bold">오늘 복습 끝!</p>
      <p class="text-muted-foreground">
        {{ result.solved }}문제 중 <b class="text-success">{{ result.correct }}</b>문제 맞혔어요.
      </p>
      <p class="flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
        <Flame class="size-5 fill-orange-400" /> {{ activity.streak }}일 연속 학습 중
      </p>
      <div class="mt-2 flex gap-2">
        <Button variant="outline" as-child><RouterLink to="/">홈으로</RouterLink></Button>
        <Button as-child><RouterLink to="/random">랜덤 문제 더 풀기</RouterLink></Button>
      </div>
    </div>

    <template v-else-if="current">
      <div class="mt-5 rounded-xl border p-4 sm:p-6">
        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{{ current.exam.kind === 'past' ? `기출 · ${current.exam.title}` : current.exam.title }}</Badge>
          <Badge variant="outline">{{ current.question.subject }}과목</Badge>
          <span class="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarClock class="size-3.5" /> 복습 {{ (current.note.reviewStage ?? 0) + 1 }}회차 · 틀림 {{ current.note.wrongCount }}
          </span>
        </div>
        <QuestionView
          :question="current.question"
          :number="current.number"
          :selected="picked ?? null"
          :revealed="picked !== undefined"
          :bookmark="{ examId: current.note.examId, questionId: current.note.questionId }"
          always-extras
          @select="select"
        />
      </div>

      <div v-if="schedule" :class="cn('mt-4 rounded-xl px-4 py-3 text-sm font-medium', schedule.good ? 'bg-success/10 text-success' : 'bg-muted')">
        {{ schedule.text }}
      </div>
      <div class="mt-4 flex items-center gap-2">
        <span v-if="picked === undefined" class="text-xs text-muted-foreground">답을 고르면 바로 채점하고 다음 복습 날짜를 정해요.</span>
        <Button class="ml-auto" size="lg" :disabled="picked === undefined" @click="next">
          {{ index + 1 >= queue.length ? '복습 마치기' : '다음 문제' }} <ChevronRight class="size-4" />
        </Button>
      </div>
    </template>

    <!-- 회차 파일이 없어진 오답 등 -->
    <div v-else class="mt-12 text-center text-muted-foreground">
      <p>이 문제를 불러오지 못했어요.</p>
      <Button variant="outline" class="mt-3" @click="next">건너뛰기</Button>
    </div>
  </div>
</template>
