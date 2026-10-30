<script setup lang="ts">
import { CirclePlay, PencilLine, TrendingUp } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { MIN_FOR_SCORE, useStudySummary } from '@/composables/useStudySummary'
import { KIND_ROUTE } from '@/lib/exams'
import { hasLecture } from '@/lib/lectures'
import { cn } from '@/lib/utils'
import { useCertStore } from '@/stores/cert'

/**
 * 내 실력: 예상 점수 · 과목별 정답률과 이론 진도 · 약한 절 (바로 연습·강의로).
 * 정답률은 문항마다 마지막으로 고른 답 기준
 */
const certStore = useCertStore()
const { subjects, expected, weak } = useStudySummary()
const pct = (n?: number) => (n === undefined ? '-' : `${Math.round(n * 100)}%`)
</script>

<template>
  <section class="rounded-2xl border p-5">
    <div class="flex items-center gap-2">
      <TrendingUp class="size-5 text-primary" />
      <h2 class="font-bold">내 실력 <span class="text-sm font-normal text-muted-foreground">{{ certStore.info.label }}</span></h2>
    </div>

    <div v-if="expected" class="mt-3 flex flex-wrap items-baseline gap-2">
      <span class="text-4xl font-bold tabular-nums">{{ expected.score }}</span>
      <span class="text-sm text-muted-foreground">/ {{ expected.max }}점 예상<template v-if="certStore.cert === 'sqlp'"> (객관식)</template></span>
      <span
        v-if="expected.pass !== undefined"
        :class="cn('ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold', expected.pass ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive')"
      >
        {{ expected.pass ? '합격권' : expected.cutoff.length ? `${expected.cutoff.join('·')}과목 과락 주의` : '합격선 60점까지 조금 더' }}
      </span>
    </div>
    <p v-else class="mt-2 text-sm text-muted-foreground">과목마다 {{ MIN_FOR_SCORE }}문제 이상 풀면 실제 시험 비중으로 예상 점수를 계산해 드려요.</p>

    <ul class="mt-4 space-y-3">
      <li v-for="s in subjects" :key="s.subject">
        <div class="flex items-baseline gap-2 text-sm">
          <span class="font-semibold">{{ s.subject }}과목</span>
          <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ s.name }}</span>
          <span class="text-xs tabular-nums">정답률 <b>{{ pct(s.accuracy) }}</b></span>
        </div>
        <div class="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div
            :class="cn('h-full rounded-full', (s.accuracy ?? 1) < 0.4 ? 'bg-destructive' : (s.accuracy ?? 0) >= 0.6 ? 'bg-success' : 'bg-primary')"
            :style="{ width: `${(s.accuracy ?? 0) * 100}%` }"
          />
        </div>
        <div class="mt-1 text-xs text-muted-foreground tabular-nums">
          {{ s.solved }}문제 풀이 · 이론 {{ s.theoryDone }}/{{ s.theoryTotal }} 완료
          <span v-if="s.solved < MIN_FOR_SCORE" class="opacity-70">· 예상 점수까지 {{ MIN_FOR_SCORE - s.solved }}문제</span>
        </div>
      </li>
    </ul>

    <!-- 약한 절: 바로 연습하거나 강의로 -->
    <div v-if="weak.length" class="mt-5 border-t pt-4">
      <h3 class="text-sm font-semibold">먼저 보강할 곳</h3>
      <ul class="mt-2 space-y-2">
        <li v-for="w in weak" :key="w.slug" class="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium">{{ w.doc!.title }}</div>
            <div class="text-xs text-muted-foreground tabular-nums">{{ w.solved }}문제 중 {{ w.correct }}개 맞힘 · {{ pct(w.accuracy) }}</div>
          </div>
          <Button v-if="hasLecture(w.slug)" variant="ghost" size="icon" class="size-9" as-child>
            <RouterLink :to="{ name: 'lecture', params: { slug: w.slug } }" :aria-label="`${w.doc!.title} 강의 듣기`"><CirclePlay class="size-5" /></RouterLink>
          </Button>
          <Button variant="outline" size="sm" as-child>
            <RouterLink :to="`${KIND_ROUTE[certStore.examKind]}/topic/${w.slug}`"><PencilLine class="size-4" /> 연습</RouterLink>
          </Button>
        </li>
      </ul>
    </div>
  </section>
</template>
