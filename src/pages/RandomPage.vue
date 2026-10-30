<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { BookOpen, ChevronRight, Dices, RotateCcw } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import QuestionView from '@/components/exam/QuestionView.vue'
import SolvedStatus from '@/components/exam/SolvedStatus.vue'
import { findDoc } from '@/lib/content'
import { KIND_ROUTE, loadExam, loadExamsByKind } from '@/lib/exams'
import { cn } from '@/lib/utils'
import { useCertStore } from '@/stores/cert'
import { useProgressStore } from '@/stores/progress'
import type { Exam, Question } from '@/types'

/**
 * 랜덤 문제: 선택한 자격증의 모의고사 전체(객관식)에서 회차·문항을 무작위로 하나씩 뽑는다.
 * 고르면 바로 채점하고 풀이 기록·오답노트에 남긴다. 이번 방문에서 나온 문제는 다시 뽑지 않는다
 */
document.title = '랜덤 문제 · SQL 자격증'
const certStore = useCertStore()
const progress = useProgressStore()

/** 선택한 자격증의 모의고사 전체 (SQLD 약 1.2MB, SQLP 약 0.7MB — 열 때 한 번 받는다) */
const exams = ref<Exam[]>([])
const loadError = ref('')
const loading = ref(true)
const onlyNew = ref(true)
/** 0 = 전체, 1~3 = 과목 */
const subject = ref(0)

const current = ref<{ exam: Exam; question: Question; number: number }>()
const picked = ref<number>()
const drawing = ref(false)
/** 이번 방문에서 나온 문제 (examId:문항번호) */
const seen = new Set<string>()
const session = ref({ solved: 0, correct: 0 })

watch(
  () => certStore.examKind,
  async (kind) => {
    exams.value = []
    loading.value = true
    current.value = undefined
    seen.clear()
    session.value = { solved: 0, correct: 0 }
    try {
      const metas = await loadExamsByKind(kind)
      exams.value = await Promise.all(metas.map((m) => loadExam(m.id)))
      draw()
    } catch (e) {
      loadError.value = String(e instanceof Error ? e.message : e)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const totalQuestions = computed(() => exams.value.reduce((n, e) => n + e.questions.length, 0))
const subjects = computed(() => (certStore.cert === 'sqlp' ? [1, 2, 3] : [1, 2]))

/** 조건(과목, 안 푼 문제만, 이번에 안 나온 문제)에 맞는 문항 중 하나를 무작위로 */
function draw() {
  drawing.value = true
  picked.value = undefined
  const pool = exams.value.flatMap((exam) =>
    exam.questions
      .map((question, i) => ({ exam, question, number: i + 1 }))
      .filter(
        (c) =>
          !seen.has(`${c.exam.id}:${c.number}`) &&
          (!subject.value || c.question.subject === subject.value) &&
          (!onlyNew.value || progress.statusOf(c.exam.id, c.question.id) === 'new'),
      ),
  )
  current.value = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined
  if (current.value) {
    seen.add(`${current.value.exam.id}:${current.value.number}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  drawing.value = false
}

async function select(choice: number) {
  const c = current.value
  if (!c || picked.value !== undefined) return
  picked.value = choice
  const correct = choice === c.question.answer
  session.value.solved++
  if (correct) session.value.correct++
  await progress.answer({ examId: c.exam.id, questionId: c.question.id, theory: c.question.theory, answer: choice }, correct)
}

function reset() {
  seen.clear()
  session.value = { solved: 0, correct: 0 }
  draw()
}

watch([onlyNew, subject], draw)

const theoryDoc = computed(() => (current.value?.question.theory ? findDoc(current.value.question.theory) : undefined))

// Enter·→ 로 다음 문제 (입력창·버튼에 포커스가 있으면 그쪽 동작)
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if ((e.target as HTMLElement | null)?.closest('button, input, select, textarea, a')) return
  if ((e.key === 'Enter' || e.key === 'ArrowRight') && picked.value !== undefined) draw()
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold"><Dices class="size-6 text-primary" /> 랜덤 문제</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ certStore.info.label }} 모의고사 {{ exams.length }}회 · {{ totalQuestions.toLocaleString() }}문항에서 무작위로 하나씩 골라요.
        </p>
      </div>
      <div v-if="session.solved" class="ml-auto text-sm text-muted-foreground tabular-nums">
        이번에 <b class="text-foreground">{{ session.solved }}</b>문제 · 정답 <b class="text-success">{{ session.correct }}</b>
      </div>
    </div>

    <!-- 옵션 -->
    <div class="mt-5 flex flex-wrap items-center gap-2">
      <button
        v-for="s in [0, ...subjects]"
        :key="s"
        type="button"
        :class="
          cn(
            'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
            subject === s ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )
        "
        @click="subject = s"
      >
        {{ s ? `${s}과목` : '전체 과목' }}
      </button>
      <label class="ml-auto flex cursor-pointer items-center gap-2 text-sm">
        <input v-model="onlyNew" type="checkbox" class="size-4 accent-[var(--primary)]" /> 안 푼 문제만
      </label>
    </div>

    <p v-if="loadError" class="mt-12 text-center text-destructive">{{ loadError }}</p>
    <div v-else-if="loading" class="mt-6 h-80 animate-pulse rounded-xl bg-muted" />
    <div v-else-if="!current" class="mt-12 text-center text-muted-foreground">
      <p>{{ onlyNew ? '조건에 맞는 안 푼 문제가 없어요. 🎉' : '더 뽑을 문제가 없어요.' }}</p>
      <Button variant="outline" class="mt-4" @click="reset"><RotateCcw class="size-4" /> 처음부터 다시 뽑기</Button>
    </div>

    <template v-else>
      <div :class="cn('mt-6 rounded-xl border p-6 transition-opacity', drawing && 'opacity-50')">
        <!-- 출처: 어느 모의고사 몇 번인지 -->
        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge>{{ certStore.info.label }}</Badge>
          <span class="font-semibold">{{ current.exam.title }} · {{ current.number }}번</span>
          <Badge variant="outline">{{ current.question.subject }}과목</Badge>
          <RouterLink
            v-if="theoryDoc"
            :to="{ name: 'theory', params: { slug: theoryDoc.slug } }"
            class="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <BookOpen class="size-3.5" /> {{ theoryDoc.title }}
          </RouterLink>
          <SolvedStatus v-if="picked === undefined" :exam-id="current.exam.id" :question-id="current.question.id" class="ml-auto" />
        </div>

        <QuestionView
          :question="current.question"
          :number="current.number"
          :selected="picked ?? null"
          :revealed="picked !== undefined"
          :bookmark="{ examId: current.exam.id, questionId: current.question.id }"
          @select="select"
        />
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="outline" as-child>
          <RouterLink :to="`${KIND_ROUTE[current.exam.kind]}/${current.exam.id}`">{{ current.exam.title }} 풀기</RouterLink>
        </Button>
        <span v-if="picked === undefined" class="text-xs text-muted-foreground">답을 고르면 바로 채점하고 기록에 남아요.</span>
        <Button class="ml-auto" :disabled="drawing" @click="draw">
          <Dices class="size-4" /> {{ picked === undefined ? '다른 문제' : '다음 문제' }} <ChevronRight class="size-4" />
        </Button>
      </div>
    </template>
  </div>
</template>
