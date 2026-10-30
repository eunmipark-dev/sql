<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Flame, Share2, X } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import QuestionView from '@/components/exam/QuestionView.vue'
import {
  challengeQuestions,
  challengeStreak,
  loadAllExams,
  readChallenge,
  readChallengeLog,
  saveChallenge,
  shareText,
  type ChallengeState,
  type PickedQuestion,
} from '@/lib/games'
import { recordChallenge } from '@/lib/gameHistory'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'
import { useCertStore } from '@/stores/cert'
import { useProgressStore } from '@/stores/progress'

/**
 * 오늘의 챌린지: 날짜로 정해진 5문제를 하루 한 번 (모두 같은 문제).
 * 푼 문제는 풀이 기록·오답노트·랭킹에 그대로 남고, 끝나면 🟩🟥 결과를 공유할 수 있다.
 * 어디까지 풀었는지는 이 기기에 기억해서, 중간에 나가도 이어서 푼다
 */
document.title = '오늘의 챌린지 · SQL 자격증'
const certStore = useCertStore()
const activity = useActivityStore()
const progress = useProgressStore()

const questions = ref<PickedQuestion[]>([])
const loading = ref(true)
const loadError = ref('')
const state = ref<ChallengeState>({ day: '', answers: [], results: [] })
const log = ref<Record<string, number>>({})
/** 지금 보고 있는 문제 (끝나면 결과 화면에서 하나씩 다시 볼 때도 쓴다) */
const index = ref(0)

watch(
  [() => certStore.examKind, () => activity.today],
  async ([kind, day]) => {
    loading.value = true
    loadError.value = ''
    try {
      questions.value = challengeQuestions(await loadAllExams(kind), kind, day)
      state.value = readChallenge(kind, day)
      log.value = readChallengeLog(kind)
      index.value = Math.min(state.value.answers.length, questions.value.length - 1)
    } catch (e) {
      loadError.value = String(e instanceof Error ? e.message : e)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const total = computed(() => questions.value.length)
const done = computed(() => total.value > 0 && state.value.answers.length >= total.value)
const correct = computed(() => state.value.results.filter(Boolean).length)
const current = computed(() => questions.value[index.value])
/** 지금 문제를 이미 풀었는지 (풀었으면 정답 공개) */
const answered = computed(() => index.value < state.value.answers.length)
const streak = computed(() => challengeStreak(log.value, activity.today))

async function select(choice: number) {
  const q = current.value
  if (!q || answered.value) return
  const ok = choice === q.question.answer
  state.value = { ...state.value, answers: [...state.value.answers, choice], results: [...state.value.results, ok] }
  saveChallenge(certStore.examKind, state.value)
  if (done.value) {
    recordChallenge(certStore.examKind, state.value.day, correct.value)
    log.value = readChallengeLog(certStore.examKind)
  }
  await progress.answer({ examId: q.examId, questionId: q.question.id, theory: q.question.theory, answer: choice }, ok)
}

/** 결과 보기 = 모두 풀고 마지막 문제에서 '결과' 를 누른 뒤 */
const showResult = ref(false)
watch(done, (d) => !d && (showResult.value = false))
watch(
  () => state.value.day,
  () => (showResult.value = done.value),
)

function next() {
  if (index.value < total.value - 1) index.value++
  else showResult.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const squares = computed(() => state.value.results.map((r) => (r ? '🟩' : '🟥')).join(''))
const shareMsg = ref('')
async function share() {
  const [, m, d] = state.value.day.split('-').map(Number)
  const text = `${certStore.info.label} 오늘의 챌린지 ${m}/${d}\n${squares.value} ${correct.value}/${total.value}${streak.value > 1 ? `\n🔥 ${streak.value}일 연속` : ''}`
  const r = await shareText(text)
  shareMsg.value = r === 'copied' ? '결과를 복사했어요. 붙여 넣어 공유하세요.' : ''
}

/** 다음 챌린지(자정)까지 남은 시간 */
const now = ref(Date.now())
const tick = setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(tick))
const untilNext = computed(() => {
  const d = new Date(now.value)
  const ms = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now.value
  const h = Math.floor(ms / 3_600_000)
  const min = Math.floor((ms % 3_600_000) / 60_000)
  return h ? `${h}시간 ${min}분` : `${min}분`
})

const message = computed(() => {
  const c = correct.value
  if (c === total.value) return '완벽해요! 🎉'
  if (c >= total.value - 1) return '아깝다, 거의 다 맞혔어요!'
  if (c >= total.value / 2) return '좋아요, 틀린 문제만 다시 볼까요?'
  return '틀린 문제는 오답노트에 담아 뒀어요.'
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:py-8">
    <RouterLink to="/games" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft class="size-4" /> 미니게임
    </RouterLink>
    <div class="mt-2 flex items-end gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="flex items-center gap-2 text-2xl font-bold"><CalendarCheck class="size-6 text-primary" /> 오늘의 챌린지</h1>
        <p class="mt-1 text-sm text-muted-foreground break-keep">
          {{ certStore.info.label }} 5문제 · 하루 한 번, 모두 같은 문제를 풀어요.
        </p>
      </div>
      <span
        v-if="streak"
        class="flex shrink-0 items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600 tabular-nums dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-400"
      >
        <Flame class="size-4 fill-orange-400" /> {{ streak }}일
      </span>
    </div>

    <p v-if="loadError" class="mt-12 text-center text-destructive">{{ loadError }}</p>
    <div v-else-if="loading" class="mt-6 h-80 animate-pulse rounded-xl bg-muted" />

    <!-- 결과 -->
    <section v-else-if="showResult" class="mt-6 rounded-2xl border p-6 text-center">
      <p class="text-sm text-muted-foreground">{{ state.day.replace(/-/g, '.') }}</p>
      <p class="mt-2 text-4xl tracking-widest" aria-hidden="true">{{ squares }}</p>
      <p class="mt-3 text-3xl font-bold tabular-nums">{{ correct }} <span class="text-lg font-normal text-muted-foreground">/ {{ total }}</span></p>
      <p class="mt-1 font-medium">{{ message }}</p>
      <div class="mt-5 flex flex-wrap justify-center gap-2">
        <Button @click="share"><Share2 class="size-4" /> 결과 공유</Button>
        <Button variant="outline" @click="(showResult = false), (index = 0)">문제 다시 보기</Button>
      </div>
      <p v-if="shareMsg" class="mt-2 text-sm text-success" role="status">{{ shareMsg }}</p>
      <p class="mt-5 text-sm text-muted-foreground">다음 챌린지까지 {{ untilNext }}</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2 border-t pt-4">
        <Button variant="ghost" size="sm" as-child><RouterLink to="/games/ox">60초 O/X 하러 가기</RouterLink></Button>
        <Button variant="ghost" size="sm" as-child><RouterLink to="/games/order">순서 퍼즐 하러 가기</RouterLink></Button>
      </div>
    </section>

    <!-- 문제 -->
    <template v-else-if="current">
      <!-- 진행: 칸마다 맞힘/틀림/지금 -->
      <ol class="mt-5 flex gap-1.5" aria-label="진행">
        <li v-for="(_, i) in questions" :key="i" class="flex-1">
          <button
            type="button"
            :disabled="i > state.answers.length"
            :aria-label="`${i + 1}번`"
            :aria-current="i === index ? 'step' : undefined"
            :class="
              cn(
                'grid h-8 w-full place-items-center rounded-lg text-xs font-semibold transition-colors',
                state.results[i] === true && 'bg-success text-white',
                state.results[i] === false && 'bg-destructive text-white',
                state.results[i] === undefined && 'bg-muted text-muted-foreground',
                i === index && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              )
            "
            @click="index = i"
          >
            <Check v-if="state.results[i] === true" class="size-4" />
            <X v-else-if="state.results[i] === false" class="size-4" />
            <template v-else>{{ i + 1 }}</template>
          </button>
        </li>
      </ol>

      <div class="mt-5 rounded-xl border p-5 sm:p-6">
        <div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{{ current.question.subject }}과목</Badge>
          <span class="text-muted-foreground">{{ current.examTitle }} · {{ current.number }}번</span>
        </div>
        <QuestionView
          :question="current.question"
          :number="index + 1"
          :selected="state.answers[index] ?? null"
          :revealed="answered"
          :bookmark="{ examId: current.examId, questionId: current.question.id }"
          @select="select"
        />
      </div>

      <div class="mt-5 flex items-center gap-2">
        <span v-if="!answered" class="text-xs text-muted-foreground">답을 고르면 바로 채점해요.</span>
        <Button v-if="answered" class="ml-auto" @click="next">
          {{ index < total - 1 ? '다음 문제' : '결과 보기' }} <ChevronRight class="size-4" />
        </Button>
      </div>
    </template>
  </div>
</template>
