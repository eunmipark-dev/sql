<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { BookOpen, Check, Users, X } from '@lucide/vue'
import BookmarkButton from '@/components/exam/BookmarkButton.vue'
import CodeBlock from '@/components/exam/CodeBlock.vue'
import CopyQuestionButton from '@/components/exam/CopyQuestionButton.vue'
import QuestionExtras from '@/components/exam/QuestionExtras.vue'
import { findDoc } from '@/lib/content'
import { renderBlock, renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { loadQuestionStats, MIN_SOLVERS, type QuestionStats } from '@/services/questionStatsRepository'
import type { Question } from '@/types'

const props = defineProps<{
  question: Question
  number: number
  selected?: number | null
  /** 정답/해설 공개 여부 */
  revealed?: boolean
  /** 북마크 대상 (출처 시험 + 문항 번호). 있으면 북마크 버튼과 메모·코멘트를 보여준다 */
  bookmark?: { examId: string; questionId: number }
  /**
   * 메모·코멘트를 풀기 전에도 보여줄지 (오답노트·북마크처럼 이미 본 문제).
   * 기본은 정답이 공개된 뒤에만 — 시험 중 메모나 코멘트가 힌트가 되지 않게
   */
  alwaysExtras?: boolean
  /** 북마크·복사 버튼을 부모가 카드 위쪽에 따로 둔다 (문제 본문을 가로로 넓게 쓰려고) */
  bookmarkOutside?: boolean
}>()

const emit = defineEmits<{ select: [choice: number] }>()

const circled = ['①', '②', '③', '④', '⑤']
const theoryDoc = computed(() => (props.question.theory ? findDoc(props.question.theory) : undefined))

// 정답률: 정답이 공개된 뒤, 화면에 보일 때 한 번 묻는다 (풀기 전에 보이면 힌트가 되니까)
const root = ref<HTMLElement>()
const stats = ref<QuestionStats>()
const statsKey = computed(() => (props.bookmark ? `${props.bookmark.examId}:${props.bookmark.questionId}` : undefined))
let asked: string | undefined
function askStats() {
  const key = statsKey.value
  if (!key || !props.revealed || asked === key) return
  asked = key
  loadQuestionStats(key)
    .then((s) => key === statsKey.value && (stats.value = s))
    .catch(() => {})
}
useIntersectionObserver(root, ([entry]) => entry?.isIntersecting && askStats())
watch(statsKey, () => {
  stats.value = undefined
  asked = undefined
})
watch(() => props.revealed, askStats)

/** 푼 사람이 충분할 때만 비율을 쓴다 */
const enough = computed(() => !!stats.value && stats.value.total >= MIN_SOLVERS)
const pct = (n: number) => Math.round(((stats.value?.picks[n] ?? 0) / (stats.value?.total || 1)) * 100)
/** 오답 중 가장 많이 고른 보기 (20% 이상일 때만 '함정'으로 알려 준다) */
const trap = computed(() => {
  if (!enough.value) return undefined
  const wrong = props.question.choices.map((_, i) => i + 1).filter((n) => n !== props.question.answer)
  const top = wrong.sort((a, b) => pct(b) - pct(a))[0]
  return top && pct(top) >= 20 ? top : undefined
})

function choiceClass(n: number) {
  const { selected, revealed, question } = props
  if (!revealed) {
    return selected === n ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:border-foreground/30 hover:bg-accent'
  }
  if (n === question.answer) return 'border-success bg-success/10'
  if (n === selected) return 'border-destructive bg-destructive/10'
  return 'opacity-60'
}
</script>

<template>
  <div ref="root">
    <div class="mb-4 flex gap-2 text-base leading-7 font-medium">
      <span class="shrink-0 font-bold text-primary">{{ number }}.</span>
      <div class="q-body min-w-0 flex-1" v-html="renderBlock(question.question)" />
      <div v-if="!bookmarkOutside" class="-mt-1 -mr-2 flex shrink-0 self-start">
        <CopyQuestionButton :question="question" :selected="selected" :revealed="revealed" />
        <BookmarkButton v-if="bookmark" :exam-id="bookmark.examId" :question-id="bookmark.questionId" />
      </div>
    </div>

    <CodeBlock v-if="question.code" :code="question.code" class="mb-4" />

    <div class="space-y-2">
      <button
        v-for="(choice, i) in question.choices"
        :key="i"
        type="button"
        :disabled="revealed"
        :class="cn('relative flex w-full items-start gap-3 overflow-hidden rounded-lg border px-4 py-3 text-left text-sm transition-colors', choiceClass(i + 1))"
        @click="emit('select', i + 1)"
      >
        <!-- 이 보기를 첫 시도에 고른 비율 -->
        <span
          v-if="revealed && enough"
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-500"
          :style="{ width: `${pct(i + 1)}%` }"
        />
        <span class="font-medium">{{ circled[i] }}</span>
        <span class="flex-1" v-html="renderInline(choice)" />
        <span v-if="revealed && enough" class="shrink-0 text-xs text-muted-foreground tabular-nums">{{ pct(i + 1) }}%</span>
        <Check v-if="revealed && i + 1 === question.answer" class="size-4 shrink-0 text-success" />
        <X v-else-if="revealed && i + 1 === selected" class="size-4 shrink-0 text-destructive" />
      </button>
    </div>

    <div v-if="revealed" class="mt-4 rounded-lg bg-muted/60 p-4 text-sm leading-6">
      <p class="mb-1 font-semibold">
        정답 {{ circled[question.answer - 1] }}
        <span v-if="selected && selected !== question.answer" class="ml-2 font-normal text-destructive">
          (내 답 {{ circled[selected - 1] }})
        </span>
        <span v-else-if="!selected" class="ml-2 font-normal text-muted-foreground">(미응답)</span>
      </p>
      <p v-if="stats" class="mb-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
        <Users class="mt-0.5 size-3.5 shrink-0" />
        <span v-if="enough">
          정답률 <b class="text-foreground tabular-nums">{{ pct(question.answer) }}%</b>
          · {{ stats.total.toLocaleString() }}명 첫 시도 기준
          <span v-if="trap" class="text-amber-600 dark:text-amber-400">· {{ circled[trap - 1] }}번을 {{ pct(trap) }}%가 골랐어요</span>
        </span>
        <span v-else>정답률은 {{ MIN_SOLVERS }}명 이상 풀면 보여드려요 ({{ stats.total }}/{{ MIN_SOLVERS }}명)</span>
      </p>
      <div class="q-body text-muted-foreground" v-html="renderBlock(question.explanation)" />
      <RouterLink
        v-if="theoryDoc"
        :to="{ name: 'theory', params: { slug: theoryDoc.slug } }"
        class="mt-3 inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-primary hover:border-primary"
      >
        <BookOpen class="size-3.5" /> 관련 이론: {{ theoryDoc.title }}
      </RouterLink>
    </div>

    <QuestionExtras
      v-if="bookmark && (revealed || alwaysExtras)"
      :exam-id="bookmark.examId"
      :question-id="bookmark.questionId"
    />
  </div>
</template>

<style scoped>
/* 문제 본문·해설 안의 문단/표 */
.q-body :deep(p) { margin: 0.25rem 0; }
.q-body :deep(p:first-child) { margin-top: 0; }
.q-body :deep(p:last-child) { margin-bottom: 0; }
.q-body :deep(.md-table) {
  margin: 0.75rem 0;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) + 2px);
  font-weight: 400;
}
.q-body :deep(table) { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.q-body :deep(th) { background: var(--muted); padding: 0.4rem 0.75rem; text-align: left; font-weight: 600; white-space: nowrap; }
.q-body :deep(td) { padding: 0.4rem 0.75rem; border-top: 1px solid var(--border); white-space: nowrap; }
.q-body :deep(code) { border-radius: 4px; background: var(--muted); padding: 0.05em 0.35em; font-size: 0.88em; }
.q-body :deep(ul), .q-body :deep(ol) { margin: 0.4rem 0; padding-left: 1.25rem; list-style: disc; }
</style>
