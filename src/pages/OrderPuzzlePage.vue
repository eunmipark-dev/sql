<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { ArrowDownUp, Check, ChevronLeft, ChevronRight, RotateCcw, Trophy, Undo2, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import CodeBlock from '@/components/exam/CodeBlock.vue'
import { orderPuzzlesFor, pickFresh, recordResult, solvedCount, type OrderPuzzle } from '@/lib/gameContent'
import { bestOf, shuffle, submitBest } from '@/lib/games'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'
import { useCertStore } from '@/stores/cert'

/**
 * 순서 퍼즐: 카드를 눌러 순서대로 쌓는다 (끌기보다 휴대폰에서 정확하다). 한 판 = 5문제.
 * 점수 = 한 번에 맞힌 퍼즐 × 100 + 빨리 끝낸 보너스 (150초에서 걸린 초를 뺀 만큼)
 */
document.title = '순서 퍼즐 · SQL 자격증'
const certStore = useCertStore()
const activity = useActivityStore()
const ROUND = 5
const BONUS_SEC = 150

const phase = ref<'intro' | 'play' | 'end'>('intro')
const round = ref<OrderPuzzle[]>([])
const index = ref(0)
/** 아직 안 놓은 카드 (items 의 번호) */
const pool = ref<number[]>([])
/** 놓은 카드 (위에서부터) */
const placed = ref<number[]>([])
/** 확인을 눌렀으면 맞았는지 */
const checked = ref<boolean>()
const results = ref<boolean[]>([])
const startedAt = ref(0)
const elapsed = ref(0)
const isNewBest = ref(false)

const available = computed(() => orderPuzzlesFor(certStore.cert))
const solved = computed(() => solvedCount('order', available.value.map((p) => p.id)))
/** 이번 판에서 한 바퀴를 다 돌아 처음부터 다시 시작했는지 */
const recycled = ref(false)
const puzzle = computed(() => round.value[index.value])
const best = computed(() => bestOf('order', certStore.examKind))
const correctCount = computed(() => results.value.filter(Boolean).length)
const score = computed(() => correctCount.value * 100 + Math.max(0, BONUS_SEC - elapsed.value))

let timer: ReturnType<typeof setInterval> | undefined
onBeforeUnmount(() => clearInterval(timer))

function setup() {
  const p = puzzle.value!
  const order = p.items.map((_, i) => i)
  // 섞었는데 그대로면 다시 섞는다
  let mixed = shuffle(order)
  while (mixed.every((v, i) => v === i)) mixed = shuffle(order)
  pool.value = mixed
  placed.value = []
  checked.value = undefined
}

function start() {
  const r = pickFresh('order', available.value, ROUND, (p) => p.id)
  round.value = r.picked
  recycled.value = r.recycled
  index.value = 0
  results.value = []
  isNewBest.value = false
  startedAt.value = Date.now()
  elapsed.value = 0
  clearInterval(timer)
  timer = setInterval(() => (elapsed.value = Math.floor((Date.now() - startedAt.value) / 1000)), 500)
  phase.value = 'play'
  setup()
}

function place(item: number) {
  if (checked.value !== undefined) return
  pool.value = pool.value.filter((i) => i !== item)
  placed.value = [...placed.value, item]
}
function unplace(item: number) {
  if (checked.value !== undefined) return
  placed.value = placed.value.filter((i) => i !== item)
  pool.value = [...pool.value, item]
}
function undo() {
  const last = placed.value.at(-1)
  if (last !== undefined) unplace(last)
}

function check() {
  const ok = placed.value.every((v, i) => v === i)
  checked.value = ok
  results.value = [...results.value, ok]
  recordResult('order', puzzle.value!.id, ok)
}

function next() {
  if (index.value < round.value.length - 1) {
    index.value++
    setup()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  clearInterval(timer)
  elapsed.value = Math.floor((Date.now() - startedAt.value) / 1000)
  isNewBest.value = submitBest('order', certStore.examKind, score.value)
  void activity.addGame()
  phase.value = 'end'
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 sm:py-8">
    <RouterLink to="/games" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      <ChevronLeft class="size-4" /> 미니게임
    </RouterLink>

    <!-- 시작 -->
    <section v-if="phase === 'intro'" class="mt-4 rounded-2xl border p-6 text-center">
      <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-highlight text-ink"><ArrowDownUp class="size-7" /></span>
      <h1 class="mt-3 text-2xl font-bold">순서 퍼즐</h1>
      <p class="mt-2 text-sm text-muted-foreground break-keep">
        SQL 실행 순서, 정규화 단계처럼 순서가 중요한 개념을 카드로 맞혀요.<br />
        카드를 누르면 1번 칸부터 차례로 채워져요. 한 판 {{ ROUND }}문제.
      </p>
      <p class="mt-3 text-sm text-muted-foreground tabular-nums">
        퍼즐 {{ available.length }}개 중 <b class="text-foreground">{{ solved }}개</b> 맞힘 · 맞힌 퍼즐은 다시 안 나와요
      </p>
      <p v-if="best" class="mt-1 inline-flex items-center gap-1 text-sm"><Trophy class="size-4 text-amber-500" /> 최고 {{ best.score }}점</p>
      <div class="mt-5"><Button size="lg" @click="start">시작</Button></div>
    </section>

    <!-- 퍼즐 -->
    <section v-else-if="phase === 'play' && puzzle" class="mt-4">
      <div class="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
        <span class="font-semibold text-foreground">{{ index + 1 }} / {{ round.length }}</span>
        <span class="flex gap-1" aria-hidden="true">
          <span
            v-for="(_, i) in round"
            :key="i"
            :class="cn('size-2 rounded-full', results[i] === true ? 'bg-success' : results[i] === false ? 'bg-destructive' : i === index ? 'bg-primary' : 'bg-muted')"
          />
        </span>
        <span class="ml-auto">{{ elapsed }}초</span>
      </div>

      <p v-if="recycled && index === 0" class="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">모든 퍼즐을 맞혔어요! 처음부터 다시 돌아요.</p>
      <h1 class="mt-3 text-xl font-bold">{{ puzzle.title }}</h1>
      <p class="mt-1 text-sm text-muted-foreground break-keep">{{ puzzle.prompt }}</p>
      <CodeBlock v-if="puzzle.code" :code="puzzle.code" class="mt-3" />

      <!-- 놓은 칸 -->
      <ol class="mt-4 space-y-1.5" aria-label="놓은 순서">
        <li v-for="(_, slot) in puzzle.items" :key="slot">
          <button
            v-if="placed[slot] !== undefined"
            type="button"
            :disabled="checked !== undefined"
            :class="
              cn(
                'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors',
                checked === undefined && 'border-primary bg-primary/5 hover:bg-primary/10',
                checked !== undefined && placed[slot] === slot && 'border-success bg-success/10',
                checked !== undefined && placed[slot] !== slot && 'border-destructive bg-destructive/10',
              )
            "
            :aria-label="`${slot + 1}번째: ${puzzle.items[placed[slot]!]}${checked === undefined ? ' (눌러서 빼기)' : ''}`"
            @click="unplace(placed[slot]!)"
          >
            <span class="grid size-6 shrink-0 place-items-center rounded-full bg-background text-xs font-bold tabular-nums">{{ slot + 1 }}</span>
            <span class="min-w-0 flex-1 break-keep">{{ puzzle.items[placed[slot]!] }}</span>
            <template v-if="checked !== undefined">
              <Check v-if="placed[slot] === slot" class="size-4 shrink-0 text-success" />
              <X v-else class="size-4 shrink-0 text-destructive" />
            </template>
          </button>
          <div
            v-else
            class="flex min-h-11 items-center gap-3 rounded-xl border border-dashed px-3 text-sm text-muted-foreground/70"
          >
            <span class="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold tabular-nums">{{ slot + 1 }}</span>
          </div>
        </li>
      </ol>

      <!-- 남은 카드 -->
      <div v-if="pool.length" class="mt-4 flex flex-wrap gap-2" aria-label="남은 카드">
        <button
          v-for="item in pool"
          :key="item"
          type="button"
          class="min-h-11 rounded-xl border bg-card px-3.5 py-2 text-left text-sm font-medium shadow-sm transition-transform break-keep hover:border-primary active:scale-95"
          @click="place(item)"
        >
          {{ puzzle.items[item] }}
        </button>
      </div>

      <!-- 정답 · 해설 -->
      <div v-if="checked !== undefined" :class="cn('mt-4 rounded-xl p-4 text-sm', checked ? 'bg-success/10' : 'bg-destructive/10')">
        <p class="font-semibold">{{ checked ? '정답이에요!' : '순서가 달라요' }}</p>
        <ol v-if="!checked" class="mt-2 list-inside list-decimal space-y-0.5">
          <li v-for="item in puzzle.items" :key="item">{{ item }}</li>
        </ol>
        <p class="mt-2 text-muted-foreground break-keep">{{ puzzle.explain }}</p>
      </div>

      <div class="mt-4 flex items-center gap-2">
        <Button v-if="checked === undefined" variant="ghost" :disabled="!placed.length" @click="undo"><Undo2 class="size-4" /> 되돌리기</Button>
        <Button v-if="checked === undefined" class="ml-auto" :disabled="pool.length > 0" @click="check">확인</Button>
        <Button v-else class="ml-auto" @click="next">
          {{ index < round.length - 1 ? '다음 퍼즐' : '결과 보기' }} <ChevronRight class="size-4" />
        </Button>
      </div>
    </section>

    <!-- 결과 -->
    <section v-else-if="phase === 'end'" class="mt-4 rounded-2xl border p-6 text-center">
      <p class="text-sm text-muted-foreground">순서 퍼즐 결과</p>
      <p class="mt-2 text-4xl font-bold tabular-nums">{{ score }}<span class="text-lg font-normal text-muted-foreground">점</span></p>
      <p v-if="isNewBest" class="mt-1 font-semibold text-amber-600 dark:text-amber-400">🏆 최고 기록!</p>
      <p v-else-if="best" class="mt-1 text-sm text-muted-foreground">최고 {{ best.score }}점</p>
      <dl class="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2 text-sm">
        <div class="rounded-xl bg-muted p-3">
          <dt class="text-muted-foreground">맞힌 퍼즐</dt>
          <dd class="text-lg font-bold tabular-nums">{{ correctCount }} / {{ round.length }}</dd>
        </div>
        <div class="rounded-xl bg-muted p-3">
          <dt class="text-muted-foreground">걸린 시간</dt>
          <dd class="text-lg font-bold tabular-nums">{{ elapsed }}초</dd>
        </div>
      </dl>
      <div class="mt-5 flex justify-center gap-2">
        <Button @click="start"><RotateCcw class="size-4" /> 한 판 더</Button>
        <Button variant="outline" as-child><RouterLink to="/games">다른 게임</RouterLink></Button>
      </div>
    </section>
  </div>
</template>
