<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { until, useDebounceFn, useIntervalFn } from '@vueuse/core'
import { CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Clock, History, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import QuestionView from '@/components/exam/QuestionView.vue'
import PracticalView from '@/components/exam/PracticalView.vue'
import SolvedStatus from '@/components/exam/SolvedStatus.vue'
import { CERT_OF_KIND, judge, KIND_LABEL, KIND_ROUTE, loadExam, PASS_RULE, SUBJECTS } from '@/lib/exams'
import { cn } from '@/lib/utils'
import { useProgressStore } from '@/stores/progress'
import { useAuthStore } from '@/stores/auth'
import { localExamDrafts, remoteExamDrafts } from '@/services/examDraftRepository'
import type { Exam, ExamDraft, PracticalDraft, Subject } from '@/types'

const route = useRoute()
const progress = useProgressStore()
const auth = useAuthStore()

const exam = ref<Exam>()
const loadError = ref('')
const answers = ref<Record<number, number>>({})
/** 바로 채점한 문항 (정답·해설 공개, 답 변경 불가) */
const checked = ref<Record<number, boolean>>({})
/** SQLP 실기 답안 (실기 id → 답안·모범 답안 공개 여부) */
const practicalAnswers = ref<Record<number, PracticalDraft>>({})
/** 실기 자가 채점 (실기 id → 채점 포인트별 체크) */
const selfScores = ref<Record<number, boolean[]>>({})
const current = ref(0)
const submitted = ref(false)
const onlyWrong = ref(false)
const remaining = ref(0) // 남은 시간(초)
/** 마지막으로 답을 고른 문항 id (이어 풀기 시작 위치) */
const lastAnswered = ref<number>()
/** 저장해 둔 풀이 중 기록을 불러왔는지 */
const resumed = ref(false)

watch(
  () => String(route.params.id),
  async (id) => {
    exam.value = undefined
    loadError.value = ''
    try {
      const loaded = await loadExam(id)
      // 이어 풀기 저장 위치(브라우저/서버)와 '이미 푼 문제' 판단에 필요해 세션·풀이 기록을 기다린다
      await until(() => auth.ready && progress.loaded).toBe(true, { timeout: 5000 })
      const draft = await draftRepo()
        .get(id)
        .catch((e) => console.error('[이어 풀기 불러오기 실패]', e))
      exam.value = loaded
      document.title = `${loaded.title} · Pass SQLD/SQLP`
      start(draft ?? undefined)
    } catch (e) {
      loadError.value = String(e instanceof Error ? e.message : e)
    }
  },
  { immediate: true },
)

const questions = computed(() => exam.value?.questions ?? [])
const practicals = computed(() => exam.value?.practicals ?? [])
// 문항 위치: 0 ~ 객관식 수-1 은 객관식, 그 뒤는 실기
const itemCount = computed(() => questions.value.length + practicals.value.length)
const question = computed(() => questions.value[current.value])
const practical = computed(() => practicals.value[current.value - questions.value.length])
const practicalText = (pid: number) => practicalAnswers.value[pid]?.text ?? ''
const isItemAnswered = (i: number) => {
  const q = questions.value[i]
  if (q) return answers.value[q.id] !== undefined
  const p = practicals.value[i - questions.value.length]
  return !!p && !!practicalText(p.id).trim()
}
const answeredCount = computed(
  () => Object.keys(answers.value).length + practicals.value.filter((p) => practicalText(p.id).trim()).length,
)
const allAnswered = computed(() => answeredCount.value === itemCount.value)
const isCorrect = (qid: number) => answers.value[qid] === questions.value.find((q) => q.id === qid)?.answer

const practicalScore = computed(() =>
  practicals.value.reduce(
    (n, p) => n + p.rubric.reduce((m, r, i) => m + (selfScores.value[p.id]?.[i] ? r.score : 0), 0),
    0,
  ),
)
const practicalMax = computed(() => practicals.value.reduce((n, p) => n + p.rubric.reduce((m, r) => m + r.score, 0), 0))

const result = computed(() => {
  const count = (subject: Subject, onlyCorrect: boolean) =>
    questions.value.filter((q) => q.subject === subject && (!onlyCorrect || isCorrect(q.id))).length
  const total = { 1: count(1, false), 2: count(2, false), 3: count(3, false) }
  const correct = { 1: count(1, true), 2: count(2, true), 3: count(3, true) }
  const practical = practicalMax.value ? { score: practicalScore.value, max: practicalMax.value } : undefined
  return { total, correct, ...judge(exam.value!.kind, correct, total, practical) }
})
const correctCount = computed(() => SUBJECTS.reduce((n, s) => n + result.value.correct[s], 0))
const subjectsInExam = computed(() => SUBJECTS.filter((s) => result.value.total[s]))

const reviewList = computed(() =>
  questions.value.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => !onlyWrong.value || !isCorrect(q.id)),
)

// ── 타이머 ──
const timer = useIntervalFn(
  () => {
    if (remaining.value <= 1) {
      remaining.value = 0
      submit()
    } else {
      remaining.value--
      if (remaining.value % 30 === 0) saveDraft()
    }
  },
  1000,
  { immediate: false },
)
onBeforeUnmount(() => {
  timer.pause()
  saveDraft()
})
const timeText = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

function select(choice: number) {
  if (!question.value || submitted.value || checked.value[question.value.id]) return
  answers.value[question.value.id] = choice
  lastAnswered.value = question.value.id
  saveDraft()
}

/** 실기 답안 입력: 바로 저장하면 요청이 많아 잠시 멈췄을 때 저장한다 */
const saveDraftSoon = useDebounceFn(() => saveDraft(), 1500)
function writePractical(pid: number, text: string) {
  if (submitted.value || practicalAnswers.value[pid]?.revealed) return
  practicalAnswers.value[pid] = { ...practicalAnswers.value[pid], text }
  saveDraftSoon()
}

// ── 풀이 중 임시 저장 (이어 풀기) ──
// 제출 전에 나갔다 와도 답·바로 채점·남은 시간을 이어서 풀 수 있게 한다. 제출하거나 다시 풀면 지운다.
// 비로그인: 이 브라우저 / 로그인: 서버(exam_drafts) → 다른 기기에서도 이어서 푼다
const draftRepo = () => (auth.user ? remoteExamDrafts : localExamDrafts)
// 저장·삭제 요청이 순서대로 끝나도록 한 줄로 세운다 (늦게 도착한 옛 저장이 최신을 덮지 않게)
let draftQueue: Promise<unknown> = Promise.resolve()
/** 저장된 임시 기록이 있을 수 있는지 (없으면 지우기 요청을 보내지 않는다) */
let hasDraft = false
function enqueue(task: () => Promise<void>) {
  draftQueue = draftQueue.then(task).catch((e) => console.error('[이어 풀기 저장 실패]', e))
}

function saveDraft() {
  const examId = exam.value?.id
  if (!examId || submitted.value) return
  if (!answeredCount.value) return clearDraft() // 아직 답한 문제가 없으면 저장할 것도 없다
  // 지금 값을 복사해 둔다 (요청이 나가기 전에 답이 바뀌어도 순서대로 저장)
  const draft: ExamDraft = {
    key: examId,
    examId,
    answers: { ...answers.value },
    checked: { ...checked.value },
    remaining: remaining.value,
    lastAnswered: lastAnswered.value,
    practical: JSON.parse(JSON.stringify(practicalAnswers.value)),
    updatedAt: new Date().toISOString(),
  }
  const repo = draftRepo()
  hasDraft = true
  enqueue(() => repo.saveMany([draft]))
}

function clearDraft() {
  const examId = exam.value?.id
  if (!examId || !hasDraft) return
  const repo = draftRepo()
  hasDraft = false
  enqueue(() => repo.remove(examId))
}

/** i 다음부터 처음으로 돌아가며 찾은 첫 미응답 문항(실기 포함). 다 풀었으면 i */
function nextUnanswered(i: number) {
  const n = itemCount.value
  for (let step = 1; step <= n; step++) {
    const j = (i + step) % n
    if (!isItemAnswered(j)) return j
  }
  return Math.max(0, i)
}

/** 회차에 들어올 때: 풀던 기록이 있으면 이어서, 없으면 아직 안 푼 첫 문제부터 */
function start(draft?: ExamDraft) {
  reset(false)
  hasDraft = !!draft
  if (draft && (Object.keys(draft.answers).length || Object.keys(draft.practical ?? {}).length)) {
    answers.value = draft.answers
    checked.value = draft.checked ?? {}
    practicalAnswers.value = draft.practical ?? {}
    lastAnswered.value = draft.lastAnswered
    if (exam.value?.timeLimitMin && draft.remaining > 0) remaining.value = draft.remaining
    const last = questions.value.findIndex((q) => q.id === draft.lastAnswered)
    current.value = last >= 0 ? nextUnanswered(last) : nextUnanswered(-1)
    resumed.value = true
    return
  }
  const firstNew = questions.value.findIndex((q) => progress.statusOf(exam.value!.id, q.id) === 'new')
  current.value = Math.max(0, firstNew)
}

/** 현재 문항만 바로 채점 (기록은 제출할 때 한 번에 남긴다). 실기는 모범 답안을 공개한다 */
function check() {
  const q = question.value
  if (q && answers.value[q.id] !== undefined) {
    checked.value[q.id] = true
    saveDraft()
  }
  const p = practical.value
  if (p && practicalText(p.id).trim()) {
    practicalAnswers.value[p.id] = { text: practicalText(p.id), revealed: true }
    saveDraft()
  }
}
const canCheck = computed(() =>
  question.value
    ? answers.value[question.value.id] !== undefined && !checked.value[question.value.id]
    : !!practical.value && !!practicalText(practical.value.id).trim() && !practicalAnswers.value[practical.value.id]?.revealed,
)
const isChecked = computed(() =>
  question.value ? !!checked.value[question.value.id] : !!practical.value && !!practicalAnswers.value[practical.value.id]?.revealed,
)

/** 번호판 색: 바로 채점한 문항은 정오, 응답만 한 문항은 강조 */
function paletteClass(qid: number) {
  if (checked.value[qid]) {
    return isCorrect(qid)
      ? 'border-success/50 bg-success/15 text-success'
      : 'border-destructive/50 bg-destructive/15 text-destructive'
  }
  return answers.value[qid] !== undefined && 'border-primary/40 bg-primary/10 text-primary'
}

/** 직접 제출은 모든 문항에 답해야 가능. 시간이 끝나면 미응답이 있어도 제출된다 */
async function submit() {
  if (!exam.value || submitted.value) return
  timer.pause()
  submitted.value = true
  clearDraft()
  window.scrollTo({ top: 0 })
  // 미응답도 오답으로 기록 (실제 시험 채점 기준)
  await progress.answerMany(
    questions.value.map((q) => ({
      q: { examId: exam.value!.id, questionId: q.id, theory: q.theory, answer: answers.value[q.id] ?? 0 },
      correct: isCorrect(q.id),
    })),
  )
}

/** 처음부터 다시 풀기. clear 가 true 면 임시 저장도 지운다 */
function reset(clear = true) {
  if (clear) clearDraft()
  answers.value = {}
  checked.value = {}
  practicalAnswers.value = {}
  selfScores.value = {}
  lastAnswered.value = undefined
  resumed.value = false
  current.value = 0
  submitted.value = false
  onlyWrong.value = false
  timer.pause()
  if (exam.value?.timeLimitMin) {
    remaining.value = exam.value.timeLimitMin * 60
    timer.resume()
  }
}

// 문항 번호판: 기본은 접어 두고(번호가 50~70개라 화면을 많이 차지한다) 펼쳐서 고르면 다시 접는다
const paletteOpen = ref(false)
function goTo(i: number) {
  current.value = i
  paletteOpen.value = false
}
const currentLabel = computed(() =>
  question.value
    ? `${current.value + 1}번 · ${question.value.subject}과목`
    : `실기 ${current.value - questions.value.length + 1}`,
)

// 문항 팔레트를 과목별로 나눠 보여준다
const palette = computed(() =>
  SUBJECTS
    .map((subject) => ({
      subject,
      items: questions.value.map((q, i) => ({ q, i })).filter(({ q }) => q.subject === subject),
    }))
    .filter((g) => g.items.length),
)
</script>

<template>
  <div v-if="loadError" class="py-20 text-center text-muted-foreground">{{ loadError }}</div>
  <div v-else-if="!exam" class="mx-auto max-w-3xl space-y-4 px-4 py-10">
    <div class="h-8 w-1/2 animate-pulse rounded bg-muted" />
    <div class="h-64 animate-pulse rounded-xl bg-muted" />
  </div>

  <div v-else class="mx-auto max-w-3xl px-4 py-8">
    <RouterLink
      :to="KIND_ROUTE[exam.kind]"
      class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft class="size-4" /> {{ KIND_LABEL[exam.kind] }} 목록
    </RouterLink>
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-bold">{{ exam.title }}</h1>
      <Badge variant="secondary">{{ CERT_OF_KIND[exam.kind] }}</Badge>
      <span
        v-if="exam.timeLimitMin && !submitted"
        :class="
          cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm tabular-nums',
            remaining < 300 && 'border-destructive text-destructive',
          )
        "
      >
        <Clock class="size-4" /> {{ timeText }}
      </span>
    </div>

    <!-- 풀이 모드 -->
    <template v-if="!submitted && (question || practical)">
      <div
        v-if="resumed"
        class="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm"
      >
        <History class="size-4 text-primary" />
        <span>
          풀던 기록을 불러왔어요 ({{ answeredCount }}/{{ itemCount }} 응답). 마지막으로 푼 문제 다음부터 보여드려요.
        </span>
        <Button variant="ghost" size="sm" class="ml-auto h-7" @click="reset()">
          <RotateCcw class="size-3.5" /> 처음부터
        </Button>
      </div>

      <!-- 문항 번호판: 기본은 접고 현재 위치·응답 수만. 펼치면 전체 번호 -->
      <button
        type="button"
        class="mt-6 flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/50"
        :aria-expanded="paletteOpen"
        @click="paletteOpen = !paletteOpen"
      >
        <span class="font-semibold">{{ currentLabel }}</span>
        <span class="text-muted-foreground tabular-nums">· {{ answeredCount }}/{{ itemCount }} 응답</span>
        <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span class="block h-full rounded-full bg-primary/60" :style="{ width: `${(answeredCount / Math.max(itemCount, 1)) * 100}%` }" />
        </span>
        <span class="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {{ paletteOpen ? '번호 접기' : '번호 펼치기' }}
          <ChevronDown :class="cn('size-4 transition-transform', paletteOpen && 'rotate-180')" />
        </span>
      </button>

      <div v-show="paletteOpen" class="mt-3 space-y-3">
        <div v-for="g in palette" :key="g.subject">
          <div class="mb-1.5 text-xs font-semibold text-muted-foreground">{{ g.subject }}과목</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="{ q, i } in g.items"
              :key="q.id"
              type="button"
              :title="progress.statusOf(exam.id, q.id) !== 'new' ? '이미 푼 문제' : undefined"
              :class="
                cn(
                  'relative size-9 rounded-md border text-sm transition-colors',
                  paletteClass(q.id),
                  i === current && 'ring-2 ring-primary',
                )
              "
              @click="goTo(i)"
            >
              {{ i + 1 }}
              <!-- 전에 푼 문제 표시 (저장된 기록 기준) -->
              <span
                v-if="progress.statusOf(exam.id, q.id) !== 'new'"
                class="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-muted-foreground/60"
              />
            </button>
          </div>
        </div>
        <div v-if="practicals.length">
          <div class="mb-1.5 text-xs font-semibold text-muted-foreground">실기</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="(p, k) in practicals"
              :key="p.id"
              type="button"
              :class="
                cn(
                  'h-9 rounded-md border px-3 text-sm transition-colors',
                  practicalText(p.id).trim() && 'border-primary/40 bg-primary/10 text-primary',
                  questions.length + k === current && 'ring-2 ring-primary',
                )
              "
              @click="goTo(questions.length + k)"
            >
              실기 {{ k + 1 }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="question" class="mt-6 rounded-xl border p-6">
        <QuestionView
          :question="question"
          :number="current + 1"
          :selected="answers[question.id]"
          :revealed="checked[question.id]"
          :bookmark="{ examId: exam.id, questionId: question.id }"
          @select="select"
        >
          <template #meta><SolvedStatus :exam-id="exam.id" :question-id="question.id" /></template>
        </QuestionView>
      </div>
      <div v-else-if="practical" class="mt-6 rounded-xl border p-6">
        <PracticalView
          :practical="practical"
          :number="current - questions.length + 1"
          :text="practicalText(practical.id)"
          :revealed="practicalAnswers[practical.id]?.revealed"
          @update:text="(t) => writePractical(practical!.id, t)"
        />
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="outline" :disabled="current === 0" @click="current--">
          <ChevronLeft class="size-4" /> 이전
        </Button>
        <Button variant="outline" :disabled="current === itemCount - 1" @click="current++">
          다음 <ChevronRight class="size-4" />
        </Button>
        <Button variant="secondary" :disabled="!canCheck" @click="check">
          <CheckCheck class="size-4" />
          <template v-if="question">{{ isChecked ? '채점 완료' : '바로 채점' }}</template>
          <template v-else>{{ isChecked ? '모범 답안 공개됨' : '모범 답안 보기' }}</template>
        </Button>
        <span class="ml-auto text-sm text-muted-foreground">{{ answeredCount }} / {{ itemCount }} 응답</span>
        <Button v-if="allAnswered" @click="submit">제출하기</Button>
        <!-- 비활성 버튼은 마우스 이벤트가 없어 span 으로 감싸 툴팁을 띄운다 -->
        <TooltipProvider v-else :delay-duration="100">
          <Tooltip>
            <TooltipTrigger as-child>
              <span tabindex="0" class="rounded-md">
                <Button disabled class="pointer-events-none">제출하기</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              모든 문제를 풀어야 제출할 수 있어요 ({{ itemCount - answeredCount }}문제 남음)
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p v-if="!allAnswered" class="mt-2 text-right text-xs text-muted-foreground">
        {{ itemCount - answeredCount }}문제 남았어요. 모든 문제를 풀어야 제출할 수 있어요.
        <template v-if="exam.timeLimitMin">시간이 끝나면 자동 제출되고, 미응답은 오답으로 처리돼요.</template>
      </p>
    </template>

    <!-- 결과 모드 -->
    <template v-else-if="submitted">
      <div
        :class="
          cn(
            'mt-6 rounded-xl border p-5',
            result.passed ? 'border-success/40 bg-success/10' : 'border-destructive/40 bg-destructive/10',
          )
        "
      >
        <div class="flex flex-wrap items-baseline gap-3">
          <span :class="cn('text-2xl font-bold', result.passed ? 'text-success' : 'text-destructive')">
            {{ result.passed ? '합격' : '불합격' }}
          </span>
          <span class="text-3xl font-bold">{{ result.score }}<span class="text-base font-normal text-muted-foreground">점</span></span>
          <span class="text-sm text-muted-foreground">
            객관식 {{ correctCount }} / {{ questions.length }} 정답
            <template v-if="practicals.length">
              ({{ result.objective }}점) · 실기 자가 채점 {{ practicalScore }} / {{ practicalMax }}점
            </template>
          </span>
        </div>
        <p v-if="practicals.length" class="mt-1 text-xs text-muted-foreground">
          실기 점수는 아래 실기 문항의 채점 포인트를 체크하면 총점에 반영돼요.
        </p>
        <p v-if="result.cutoff.length" class="mt-1 text-sm text-destructive">
          {{ result.cutoff.map((s) => `${s}과목`).join(', ') }} 과락 (40% 미만)
        </p>
        <p v-else-if="!result.passed" class="mt-1 text-sm text-muted-foreground">
          합격 기준: {{ PASS_RULE[exam.kind].pass }}점 이상, 과목별 40% 이상
        </p>
      </div>

      <div :class="cn('mt-3 grid gap-3 sm:grid-cols-2', subjectsInExam.length + (practicals.length ? 1 : 0) > 2 && 'lg:grid-cols-4')">
        <div v-for="s in subjectsInExam" :key="s" class="rounded-xl border p-4">
          <div class="text-sm text-muted-foreground">{{ s }}과목</div>
          <div class="mt-1 text-xl font-semibold">{{ result.correct[s] }} / {{ result.total[s] }}</div>
        </div>
        <div v-if="practicals.length" class="rounded-xl border p-4">
          <div class="text-sm text-muted-foreground">실기 (자가 채점)</div>
          <div class="mt-1 text-xl font-semibold">{{ practicalScore }} / {{ practicalMax }}점</div>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-2">
        <Button :variant="onlyWrong ? 'outline' : 'default'" size="sm" @click="onlyWrong = false">전체 보기</Button>
        <Button :variant="onlyWrong ? 'default' : 'outline'" size="sm" @click="onlyWrong = true">틀린 문제만</Button>
        <div class="ml-auto flex gap-2">
          <Button variant="outline" size="sm" as-child>
            <RouterLink to="/wrong-notes">오답노트로</RouterLink>
          </Button>
          <Button variant="outline" size="sm" @click="reset()"><RotateCcw class="size-4" /> 다시 풀기</Button>
        </div>
      </div>

      <div class="mt-6 space-y-4">
        <div v-for="{ q, n } in reviewList" :key="q.id" class="rounded-xl border p-6">
          <QuestionView
            :question="q"
            :number="n"
            :selected="answers[q.id]"
            revealed
            :bookmark="{ examId: exam.id, questionId: q.id }"
          />
        </div>
        <p v-if="!reviewList.length" class="py-10 text-center text-muted-foreground">모두 맞혔어요! 🎉</p>

        <!-- 실기: 모범 답안과 채점 포인트로 자가 채점 -->
        <div v-for="(p, k) in practicals" :key="`p${p.id}`" class="rounded-xl border border-primary/30 p-6">
          <PracticalView
            :practical="p"
            :number="k + 1"
            :text="practicalText(p.id)"
            revealed
            :scoring="selfScores[p.id] ?? []"
            @update:scoring="(v) => (selfScores[p.id] = v)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
