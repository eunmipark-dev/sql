<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { until } from '@vueuse/core'
import { useRoute } from 'vue-router'
import { BookOpen, ChevronLeft, ChevronRight, RotateCcw, Shuffle } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ProgressStat from '@/components/exam/ProgressStat.vue'
import QuestionView from '@/components/exam/QuestionView.vue'
import SolvedStatus from '@/components/exam/SolvedStatus.vue'
import { findDoc } from '@/lib/content'
import { KIND_LABEL, KIND_PREFIX, KIND_ROUTE, loadBank } from '@/lib/exams'
import { cn } from '@/lib/utils'
import { useProgressStore } from '@/stores/progress'
import type { BankQuestion, ExamKind } from '@/types'

const route = useRoute()
const progress = useProgressStore()

const kind = computed<ExamKind>(() =>
  route.path.startsWith('/exams') ? 'past' : route.path.startsWith('/sqlp') ? 'sqlp' : 'ai',
)
const slug = computed(() => String(route.params.slug))
const doc = computed(() => findDoc(slug.value))

type Filter = 'all' | 'new' | 'wrong'
const all = ref<BankQuestion[]>([])
const loading = ref(true)
const filter = ref<Filter>('all')
const order = ref<number[]>([]) // 섞기용 순서 (all 의 인덱스)
const frozen = ref<BankQuestion[]>([]) // 필터 결과 고정 (풀면서 목록이 바뀌지 않도록)
const current = ref(0)
/** 이번 화면에서 고른 답: key(examId:number) → 선택지 */
const picked = ref<Record<string, number>>({})

const keyOf = (q: BankQuestion) => `${q.examId}:${q.number}`
const status = (q: BankQuestion) => progress.statusOf(q.examId, q.number)

watch(
  [kind, slug],
  async () => {
    loading.value = true
    all.value = await loadBank(kind.value, slug.value).catch(() => [])
    document.title = `${doc.value?.title ?? slug.value} 문제 · SQL 자격증`
    await until(() => progress.loaded).toBe(true, { timeout: 5000 })
    resetOrder(false)
    current.value = resumeIndex()
    loading.value = false
  },
  { immediate: true },
)

const stats = computed(() => progress.statsByTheory([slug.value], all.value.length, KIND_PREFIX[kind.value]))
const counts = computed(() => ({
  all: all.value.length,
  new: all.value.filter((q) => status(q) === 'new').length,
  wrong: all.value.filter((q) => status(q) === 'wrong').length,
}))

/** 필터를 바꾸거나 섞을 때만 목록을 다시 만든다 (풀이 중에는 고정) */
function rebuild() {
  frozen.value = order.value
    .map((i) => all.value[i]!)
    .filter((q) => filter.value === 'all' || status(q) === filter.value)
  current.value = 0
  picked.value = {}
}
watch(filter, rebuild)

function resetOrder(shuffle: boolean) {
  const idx = all.value.map((_, i) => i)
  if (shuffle) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j]!, idx[i]!]
    }
  }
  order.value = idx
  rebuild()
}

const question = computed(() => frozen.value[current.value])

/** 들어올 때 시작 위치: 가장 최근에 푼 문제 다음의 안 푼 문제 (없으면 처음) */
function resumeIndex() {
  const list = frozen.value
  let last = -1
  let lastAt = ''
  list.forEach((q, i) => {
    const at = progress.records[keyOf(q)]?.updatedAt ?? ''
    if (at > lastAt) [last, lastAt] = [i, at]
  })
  for (let step = 1; step <= list.length; step++) {
    const j = (last + step) % list.length
    if (status(list[j]!) === 'new') return j
  }
  return last >= 0 ? Math.min(last + 1, list.length - 1) : 0
}

async function select(choice: number) {
  const q = question.value
  if (!q || picked.value[keyOf(q)] !== undefined) return
  picked.value[keyOf(q)] = choice
  await progress.answer({ examId: q.examId, questionId: q.number, theory: q.theory, answer: choice }, choice === q.answer)
}

/** 번호판 색: 이번에 고른 답이 있으면 그 결과, 없으면 저장된 상태 */
function paletteClass(q: BankQuestion) {
  const p = picked.value[keyOf(q)]
  const s = p !== undefined ? (p === q.answer ? 'correct' : 'wrong') : status(q)
  return {
    correct: 'border-success/50 bg-success/15 text-success',
    resolved: 'border-success/50 bg-success/10 text-success',
    wrong: 'border-destructive/50 bg-destructive/15 text-destructive',
    new: '',
  }[s]
}

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'new', label: '안 푼 문제' },
  { value: 'wrong', label: '오답' },
]
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8">
    <RouterLink
      :to="{ path: KIND_ROUTE[kind], query: { view: 'topic' } }"
      class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft class="size-4" /> {{ KIND_LABEL[kind] }} · 분류별
    </RouterLink>

    <div class="flex flex-wrap items-center gap-2">
      <h1 class="text-2xl font-bold">{{ doc?.title ?? slug }}</h1>
      <Badge variant="secondary">{{ all.length }}문항</Badge>
    </div>
    <p v-if="doc" class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {{ doc.subject }} · {{ doc.chapter }}
      <RouterLink
        :to="{ name: 'theory', params: { slug } }"
        class="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
      >
        <BookOpen class="size-3.5" /> 이론 보기
      </RouterLink>
    </p>

    <div v-if="loading" class="mt-6 h-72 animate-pulse rounded-xl bg-muted" />
    <p v-else-if="!all.length" class="mt-16 text-center text-muted-foreground">이 절에는 아직 문제가 없습니다.</p>

    <template v-else>
      <!-- 이 절의 진행률 / 오답률 (저장된 기록 기준) -->
      <div class="mt-6 rounded-xl border p-4">
        <ProgressStat :stats="stats" size="md" />
        <p class="mt-2 text-xs text-muted-foreground">오답노트에서 '해결'로 표시한 문제는 오답률에서 빠집니다.</p>
      </div>

      <!-- 상태 필터 -->
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <Button
          v-for="f in filters"
          :key="f.value"
          size="sm"
          :variant="filter === f.value ? 'default' : 'outline'"
          :disabled="f.value !== 'all' && !counts[f.value]"
          @click="filter = f.value"
        >
          {{ f.label }} <span class="opacity-70">{{ counts[f.value] }}</span>
        </Button>
        <div class="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" @click="resetOrder(true)"><Shuffle class="size-4" /> 섞기</Button>
          <Button size="sm" variant="ghost" @click="resetOrder(false)"><RotateCcw class="size-4" /> 처음부터</Button>
        </div>
      </div>

      <p v-if="!frozen.length" class="mt-12 text-center text-muted-foreground">
        {{ filter === 'new' ? '모든 문제를 풀었어요! 🎉' : '해결하지 않은 오답이 없어요! 🎉' }}
      </p>

      <template v-else>
        <!-- 문항 번호판 -->
        <div class="mt-4 flex flex-wrap gap-1.5">
          <button
            v-for="(q, i) in frozen"
            :key="keyOf(q)"
            type="button"
            :class="cn('size-8 rounded-md border text-xs transition-colors', paletteClass(q), i === current && 'ring-2 ring-primary')"
            @click="current = i"
          >
            {{ i + 1 }}
          </button>
        </div>

        <div v-if="question" class="mt-6 rounded-xl border p-6">
          <div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            출처: {{ question.examTitle }} {{ question.number }}번
            <SolvedStatus
              v-if="picked[keyOf(question)] === undefined"
              :exam-id="question.examId"
              :question-id="question.number"
            />
          </div>
          <QuestionView
            :question="question"
            :number="current + 1"
            :selected="picked[keyOf(question)] ?? null"
            :revealed="picked[keyOf(question)] !== undefined"
            :bookmark="{ examId: question.examId, questionId: question.number }"
            @select="select"
          />
        </div>

        <div class="mt-6 flex items-center gap-2">
          <Button variant="outline" :disabled="current === 0" @click="current--">
            <ChevronLeft class="size-4" /> 이전
          </Button>
          <Button :disabled="current >= frozen.length - 1" @click="current++">
            다음 <ChevronRight class="size-4" />
          </Button>
          <span class="ml-auto text-xs text-muted-foreground">고르는 즉시 정답과 해설이 보이고, 틀리면 오답노트에 저장돼요.</span>
        </div>
      </template>
    </template>
  </div>
</template>
