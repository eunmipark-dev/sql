<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, Database, Info, LoaderCircle, RotateCcw, Table2, TerminalSquare } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import CodeBlock from '@/components/exam/CodeBlock.vue'
import ResultTable from '@/components/sql/ResultTable.vue'
import SqlRunner from '@/components/sql/SqlRunner.vue'
import SqlTables from '@/components/sql/SqlTables.vue'
import { pickFresh, recordResult, solvedCount, SQL_PUZZLES, type SqlPuzzle } from '@/lib/gameContent'
import { shuffle } from '@/lib/games'
import { cellText, runSql, sqlEngine, type SqlResult } from '@/lib/sqlEngine'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'

/**
 * SQL 결과 맞히기: 연습 테이블에 SQL 을 실행하면 몇 행이 나오는지 / 어떤 값이 나오는지 고른다.
 * 정답은 데이터에 적어 두지 않고 그 자리에서 실제로 실행해서 정한다 (AI 가 정답을 잘못 적을 일이 없다).
 * 풀고 나면 실제 결과 표를 보여주고, SQL 을 고쳐서 다시 실행해 볼 수 있다
 */
document.title = 'SQL 결과 맞히기 · SQL 자격증'
const activity = useActivityStore()

const ROUND = 5
const solved = computed(() => solvedCount('sql', SQL_PUZZLES.map((p) => p.id)))
const recycled = ref(false)

const phase = ref<'intro' | 'play' | 'end'>('intro')
const engineState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const engineError = ref('')
const round = ref<{ p: SqlPuzzle; result: SqlResult; answer: string; choices: string[] }[]>([])
const index = ref(0)
const picked = ref<string>()
const results = ref<boolean[]>([])
const showTables = ref(false)
const showRunner = ref(false)

const current = computed(() => round.value[index.value])
const correctCount = computed(() => results.value.filter(Boolean).length)

/** 행 수 문제의 보기: 정답 근처 숫자 3개 (음수 제외) */
function rowChoices(n: number) {
  const near = shuffle([n - 2, n - 1, n + 1, n + 2].filter((v) => v >= 0))
  const extra = [n + 3, n + 4, n + 5]
  return [n, ...[...near, ...extra].slice(0, 3)].sort((a, b) => a - b).map(String)
}

async function start() {
  engineState.value = 'loading'
  try {
    await sqlEngine()
    const { picked: picks, recycled: again } = pickFresh('sql', SQL_PUZZLES, ROUND, (p) => p.id)
    recycled.value = again
    round.value = await Promise.all(
      picks.map(async (p) => {
        const [result] = await runSql(p.sql)
        const answer = p.ask === 'rows' ? String(result!.rows.length) : cellText(result!.rows[0]?.[0])
        const choices = p.ask === 'rows' ? rowChoices(result!.rows.length) : shuffle([answer, ...(p.distractors ?? [])])
        return { p, result: result!, answer, choices }
      }),
    )
    engineState.value = 'ready'
  } catch (e) {
    engineState.value = 'error'
    engineError.value = e instanceof Error ? e.message : String(e)
    return
  }
  index.value = 0
  results.value = []
  reset()
  phase.value = 'play'
}

function reset() {
  picked.value = undefined
  showRunner.value = false
}

function pick(choice: string) {
  if (picked.value !== undefined || !current.value) return
  picked.value = choice
  results.value = [...results.value, choice === current.value.answer]
  recordResult('sql', current.value.p.id, choice === current.value.answer)
}

function next() {
  if (index.value < round.value.length - 1) {
    index.value++
    reset()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
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
      <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-highlight text-ink"><Database class="size-7" /></span>
      <h1 class="mt-3 text-2xl font-bold">SQL 결과 맞히기</h1>
      <p class="mt-2 text-sm text-muted-foreground break-keep">
        연습 테이블(EMP · DEPT …)에 SQL 을 실행하면 몇 행이 나올지, 어떤 값이 나올지 맞혀요.<br />
        정답은 이 기기에서 SQL 을 실제로 실행해서 정해요. 한 판 {{ ROUND }}문제.
      </p>
      <p class="mt-3 text-sm text-muted-foreground tabular-nums">
        문제 {{ SQL_PUZZLES.length }}개 중 <b class="text-foreground">{{ solved }}개</b> 맞힘 · 맞힌 문제는 다시 안 나와요
      </p>
      <p class="mt-1 text-xs text-muted-foreground">처음 한 번 SQL 엔진(약 5MB)을 받아요.</p>
      <div class="mt-5">
        <Button size="lg" :disabled="engineState === 'loading'" @click="start">
          <LoaderCircle v-if="engineState === 'loading'" class="size-4 animate-spin" />
          {{ engineState === 'loading' ? 'SQL 엔진 준비 중…' : '시작' }}
        </Button>
      </div>
      <p v-if="engineState === 'error'" class="mt-3 text-sm text-destructive">엔진을 불러오지 못했어요. {{ engineError }}</p>
      <RouterLink to="/sql" class="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <TerminalSquare class="size-4" /> SQL 실습장에서 자유롭게 실행해 보기
      </RouterLink>
    </section>

    <!-- 문제 -->
    <section v-else-if="phase === 'play' && current" class="mt-4">
      <div class="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
        <span class="font-semibold text-foreground">{{ index + 1 }} / {{ round.length }}</span>
        <span class="flex gap-1" aria-hidden="true">
          <span
            v-for="(_, i) in round"
            :key="i"
            :class="cn('size-2 rounded-full', results[i] === true ? 'bg-success' : results[i] === false ? 'bg-destructive' : i === index ? 'bg-primary' : 'bg-muted')"
          />
        </span>
        <span class="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs">{{ current.p.topic }}</span>
      </div>

      <p v-if="recycled && index === 0" class="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">모든 문제를 맞혔어요! 처음부터 다시 돌아요.</p>
      <h1 class="mt-4 text-lg font-bold">
        {{ current.p.ask === 'rows' ? '이 SQL 의 결과는 몇 행일까요?' : '이 SQL 의 결과 값은?' }}
      </h1>
      <CodeBlock :code="current.p.sql" class="mt-3" />
      <p v-if="current.p.note" class="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info class="mt-px size-3.5 shrink-0" /> {{ current.p.note }}
      </p>

      <!-- 테이블 보기 -->
      <button
        type="button"
        class="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        :aria-expanded="showTables"
        @click="showTables = !showTables"
      >
        <Table2 class="size-4" /> {{ showTables ? '테이블 접기' : '테이블 보기' }}
      </button>
      <SqlTables v-if="showTables" class="mt-2" />

      <!-- 보기 -->
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          v-for="c in current.choices"
          :key="c"
          type="button"
          :disabled="picked !== undefined"
          :class="
            cn(
              'min-h-14 rounded-xl border-2 px-3 py-2 font-mono text-lg font-semibold transition-colors',
              picked === undefined && 'hover:border-primary active:scale-[0.98]',
              picked !== undefined && c === current.answer && 'border-success bg-success/10 text-success',
              picked !== undefined && c === picked && c !== current.answer && 'border-destructive bg-destructive/10 text-destructive',
              picked !== undefined && c !== picked && c !== current.answer && 'opacity-50',
            )
          "
          @click="pick(c)"
        >
          {{ c }}{{ current.p.ask === 'rows' ? '행' : '' }}
        </button>
      </div>

      <!-- 해설 · 실제 결과 -->
      <template v-if="picked !== undefined">
        <div :class="cn('mt-4 rounded-xl p-4 text-sm', picked === current.answer ? 'bg-success/10' : 'bg-destructive/10')">
          <p class="font-semibold">{{ picked === current.answer ? '정답이에요!' : `정답은 ${current.answer}${current.p.ask === 'rows' ? '행' : ''}` }}</p>
          <p class="mt-1.5 text-muted-foreground break-keep">{{ current.p.explain }}</p>
        </div>
        <h2 class="mt-4 text-sm font-semibold">실제 실행 결과</h2>
        <ResultTable :result="current.result" class="mt-2" />

        <button
          v-if="!showRunner"
          type="button"
          class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          @click="showRunner = true"
        >
          <TerminalSquare class="size-4" /> SQL 을 고쳐서 실행해 보기
        </button>
        <SqlRunner v-else :initial="current.p.sql" class="mt-3" />

        <div class="mt-5 flex">
          <Button class="ml-auto" @click="next">
            {{ index < round.length - 1 ? '다음 문제' : '결과 보기' }} <ChevronRight class="size-4" />
          </Button>
        </div>
      </template>
    </section>

    <!-- 결과 -->
    <section v-else-if="phase === 'end'" class="mt-4 rounded-2xl border p-6 text-center">
      <p class="text-sm text-muted-foreground">SQL 결과 맞히기</p>
      <p class="mt-2 text-4xl font-bold tabular-nums">{{ correctCount }} <span class="text-lg font-normal text-muted-foreground">/ {{ round.length }}</span></p>
      <p class="mt-1 font-medium">{{ correctCount === round.length ? '완벽해요! 🎉' : correctCount >= 3 ? '좋아요!' : 'NULL 과 OUTER JOIN 이 함정이에요. 한 판 더?' }}</p>
      <div class="mt-5 flex justify-center gap-2">
        <Button @click="start"><RotateCcw class="size-4" /> 한 판 더</Button>
        <Button variant="outline" as-child><RouterLink to="/sql">SQL 실습장</RouterLink></Button>
      </div>
    </section>
  </div>
</template>
