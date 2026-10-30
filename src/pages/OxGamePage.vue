<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { BookOpen, ChevronLeft, Circle, RotateCcw, Timer, Trophy, X, Zap } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { findDoc } from '@/lib/content'
import { loadOxBank, recordResult, solvedCount, statusOf } from '@/lib/gameContent'
import { bestOf, loadAllExams, oxStatements, submitBest, type OxStatement } from '@/lib/games'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'
import { useCertStore } from '@/stores/cert'

/**
 * 60초 O/X: 이론 문서별로 쓴 문장 + 모의고사 '옳은 것/옳지 않은 것' 문제의 보기 문장을 하나씩 보고 O/X 를 고른다.
 * 맞힌 문장은 다시 내지 않는다 (안 푼 문장 → 틀린 문장 순서, 다 맞히면 처음부터).
 * 맞히면 10점 (5연속마다 ×2, ×3 …), 틀리면 3초가 깎인다. 끝나면 틀린 문장을 정답과 함께 다시 본다
 */
document.title = '60초 O/X · SQL 자격증'
const certStore = useCertStore()
const activity = useActivityStore()
const TIME_MS = 60_000
const PENALTY_MS = 3_000
const COMBO_STEP = 5

const phase = ref<'intro' | 'play' | 'end'>('intro')
const pool = ref<OxStatement[]>([])
const loading = ref(true)
const loadError = ref('')
watch(
  () => certStore.examKind,
  async (kind) => {
    loading.value = true
    loadError.value = ''
    phase.value = 'intro'
    try {
      // SQLP 는 SQLD 범위도 시험에 나오고 SQLP 문제만으로는 문장이 적어서 둘 다 쓴다
      const kinds = kind === 'sqlp' ? (['ai', 'sqlp'] as const) : ([kind] as const)
      const [bank, exams] = await Promise.all([loadOxBank(certStore.cert), Promise.all(kinds.map(loadAllExams))])
      pool.value = [...bank, ...oxStatements(exams.flat())]
    } catch (e) {
      loadError.value = String(e instanceof Error ? e.message : e)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const current = ref<OxStatement>()
const left = ref(TIME_MS)
const score = ref(0)
const combo = ref(0)
const maxCombo = ref(0)
const answered = ref<{ s: OxStatement; ok: boolean }[]>([])
/** 방금 고른 답의 결과 (잠깐 색으로 보여 주는 동안 입력을 막는다) */
const flash = ref<{ ok: boolean; answer: boolean }>()
const isNewBest = ref(false)
const multiplier = computed(() => 1 + Math.floor(combo.value / COMBO_STEP))
const best = computed(() => bestOf('ox', certStore.examKind))

const solved = computed(() => solvedCount('ox', pool.value.map((s) => s.id)))

let seen = new Set<string>()
/**
 * 다음 문장: 이번 판에 안 나온 것 중 안 푼 문장 → 틀린 문장 → (다 맞혔으면) 맞힌 문장.
 * 그 안에서 O·X 가 반반 나오게 하고, 방금과 같은 주제는 되도록 피한다
 */
function draw() {
  const unseen = pool.value.filter((s) => !seen.has(s.id))
  const tier =
    [unseen.filter((s) => statusOf('ox', s.id) === 'new'), unseen.filter((s) => statusOf('ox', s.id) === 'wrong')].find((l) => l.length) ??
    (unseen.length ? unseen : pool.value)
  const want = Math.random() < 0.5
  const prefer = (l: OxStatement[], ok: (s: OxStatement) => boolean) => (l.some(ok) ? l.filter(ok) : l)
  const from = prefer(
    prefer(tier, (s) => s.answer === want),
    (s) => s.topic !== current.value?.topic,
  )
  const s = from[Math.floor(Math.random() * from.length)]!
  seen.add(s.id)
  current.value = s
}

let raf = 0
let endAt = 0
function loop() {
  left.value = Math.max(0, endAt - performance.now())
  if (left.value <= 0) return finish()
  raf = requestAnimationFrame(loop)
}
onBeforeUnmount(() => cancelAnimationFrame(raf))

function start() {
  seen = new Set()
  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  answered.value = []
  flash.value = undefined
  isNewBest.value = false
  phase.value = 'play'
  draw()
  endAt = performance.now() + TIME_MS
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(loop)
}

function pick(o: boolean) {
  const s = current.value
  if (phase.value !== 'play' || !s || flash.value) return
  const ok = o === s.answer
  answered.value.push({ s, ok })
  recordResult('ox', s.id, ok)
  if (ok) {
    score.value += 10 * multiplier.value
    combo.value++
    maxCombo.value = Math.max(maxCombo.value, combo.value)
  } else {
    combo.value = 0
    endAt -= PENALTY_MS
  }
  flash.value = { ok, answer: s.answer }
  // 틀리면 정답을 볼 시간을 조금 더 준다 (이 시간도 남은 시간에서 흐른다)
  setTimeout(
    () => {
      flash.value = undefined
      if (phase.value === 'play') draw()
    },
    ok ? 250 : 700,
  )
}

function finish() {
  cancelAnimationFrame(raf)
  left.value = 0
  phase.value = 'end'
  isNewBest.value = score.value > 0 && submitBest('ox', certStore.examKind, score.value)
  if (answered.value.length) void activity.addGame()
}

const correctCount = computed(() => answered.value.filter((a) => a.ok).length)
const wrongs = computed(() => answered.value.filter((a) => !a.ok).map((a) => a.s))

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (phase.value !== 'play') return
  const k = e.key.toLowerCase()
  if (k === 'o' || k === 'arrowleft') pick(true)
  else if (k === 'x' || k === 'arrowright') pick(false)
})
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <RouterLink to="/games" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft class="size-4" /> 미니게임
    </RouterLink>

    <p v-if="loadError" class="mt-12 text-center text-destructive">{{ loadError }}</p>

    <!-- 시작 -->
    <section v-else-if="phase === 'intro'" class="mt-4 rounded-2xl border p-6 text-center">
      <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-highlight text-ink"><Timer class="size-7" /></span>
      <h1 class="mt-3 text-2xl font-bold">60초 O/X</h1>
      <p class="mt-2 text-sm text-muted-foreground break-keep">
        개념 문장이 맞으면 O, 틀리면 X. 60초 동안 최대한 많이 맞혀요.<br />
        {{ COMBO_STEP }}연속으로 맞히면 점수가 ×2, ×3으로 올라가고, 틀리면 {{ PENALTY_MS / 1000 }}초가 깎여요.
      </p>
      <p class="mt-2 text-xs text-muted-foreground">
        {{ certStore.info.label }} 문장 {{ loading ? '…' : pool.length.toLocaleString() }}개 중 {{ loading ? '…' : solved.toLocaleString() }}개 맞힘 · 맞힌 문장은 다시 안 나와요<br />
        키보드는 O / X (← / →)
      </p>
      <p v-if="best" class="mt-3 inline-flex items-center gap-1 text-sm"><Trophy class="size-4 text-amber-500" /> 최고 {{ best.score }}점</p>
      <div class="mt-5"><Button size="lg" :disabled="loading || !pool.length" @click="start">시작</Button></div>
    </section>

    <!-- 게임 -->
    <section v-else-if="phase === 'play' && current" class="mt-4">
      <div class="flex items-center gap-3 tabular-nums">
        <span class="text-2xl font-bold">{{ score }}</span>
        <span
          v-if="combo >= 2"
          :class="cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold', multiplier > 1 ? 'bg-amber-400 text-ink' : 'bg-muted')"
        >
          <Zap class="size-3.5" /> {{ combo }}연속{{ multiplier > 1 ? ` ×${multiplier}` : '' }}
        </span>
        <span :class="cn('ml-auto text-lg font-semibold', left < 10_000 && 'text-destructive')">{{ Math.ceil(left / 1000) }}초</span>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div :class="cn('h-full rounded-full', left < 10_000 ? 'bg-destructive' : 'bg-primary')" :style="{ width: `${(left / TIME_MS) * 100}%` }" />
      </div>

      <div
        :class="
          cn(
            'mt-5 flex min-h-56 flex-col justify-center rounded-2xl border-2 p-6 transition-colors',
            flash?.ok === true && 'border-success bg-success/10',
            flash?.ok === false && 'border-destructive bg-destructive/10',
          )
        "
        aria-live="polite"
      >
        <p class="text-xs font-semibold text-muted-foreground">{{ current.topic }}에 대해</p>
        <p class="mt-2 text-lg leading-relaxed font-medium break-keep">{{ current.text }}</p>
        <p v-if="flash && !flash.ok" class="mt-3 text-sm font-semibold text-destructive">정답은 {{ flash.answer ? 'O' : 'X' }}</p>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          class="grid h-24 place-items-center rounded-2xl border-2 border-primary/40 bg-primary/5 text-primary transition-transform hover:bg-primary/10 active:scale-95"
          aria-label="O, 맞다"
          @click="pick(true)"
        >
          <Circle class="size-12" :stroke-width="3" />
        </button>
        <button
          type="button"
          class="grid h-24 place-items-center rounded-2xl border-2 border-destructive/40 bg-destructive/5 text-destructive transition-transform hover:bg-destructive/10 active:scale-95"
          aria-label="X, 틀리다"
          @click="pick(false)"
        >
          <X class="size-14" :stroke-width="3" />
        </button>
      </div>
      <div class="mt-4 text-center">
        <Button variant="ghost" size="sm" @click="finish">그만하기</Button>
      </div>
    </section>

    <!-- 결과 -->
    <section v-else-if="phase === 'end'" class="mt-4">
      <div class="rounded-2xl border p-6 text-center">
        <p class="text-sm text-muted-foreground">60초 O/X 결과</p>
        <p class="mt-2 text-4xl font-bold tabular-nums">{{ score }}<span class="text-lg font-normal text-muted-foreground">점</span></p>
        <p v-if="isNewBest" class="mt-1 font-semibold text-amber-600 dark:text-amber-400">🏆 최고 기록!</p>
        <p v-else-if="best" class="mt-1 text-sm text-muted-foreground">최고 {{ best.score }}점</p>
        <dl class="mx-auto mt-4 grid max-w-sm grid-cols-3 gap-2 text-sm">
          <div class="rounded-xl bg-muted p-3">
            <dt class="text-muted-foreground">맞힘</dt>
            <dd class="text-lg font-bold tabular-nums">{{ correctCount }}</dd>
          </div>
          <div class="rounded-xl bg-muted p-3">
            <dt class="text-muted-foreground">틀림</dt>
            <dd class="text-lg font-bold tabular-nums">{{ wrongs.length }}</dd>
          </div>
          <div class="rounded-xl bg-muted p-3">
            <dt class="text-muted-foreground">최대 연속</dt>
            <dd class="text-lg font-bold tabular-nums">{{ maxCombo }}</dd>
          </div>
        </dl>
        <div class="mt-5 flex justify-center gap-2">
          <Button @click="start"><RotateCcw class="size-4" /> 한 판 더</Button>
          <Button variant="outline" as-child><RouterLink to="/games">다른 게임</RouterLink></Button>
        </div>
      </div>

      <!-- 틀린 문장 다시 보기 -->
      <div v-if="wrongs.length" class="mt-6">
        <h2 class="font-semibold">틀린 문장</h2>
        <ul class="mt-2 space-y-2">
          <li v-for="s in wrongs" :key="s.id" class="rounded-xl border p-4">
            <div class="flex items-start gap-3">
              <span
                :class="cn('grid size-8 shrink-0 place-items-center rounded-full text-white', s.answer ? 'bg-primary' : 'bg-destructive')"
                :aria-label="`정답 ${s.answer ? 'O' : 'X'}`"
              >
                <Circle v-if="s.answer" class="size-4" :stroke-width="3" />
                <X v-else class="size-5" :stroke-width="3" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-muted-foreground">{{ s.topic }}</p>
                <p class="mt-0.5 text-sm break-keep">{{ s.text }}</p>
                <p v-if="s.explain" class="mt-1 text-sm text-muted-foreground break-keep">→ {{ s.explain }}</p>
                <RouterLink
                  v-if="s.theory && findDoc(s.theory)"
                  :to="{ name: 'theory', params: { slug: s.theory } }"
                  class="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                >
                  <BookOpen class="size-3.5" /> {{ findDoc(s.theory)!.title }}
                </RouterLink>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
