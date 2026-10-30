<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Dices, Info, LayoutList, ListTree } from '@lucide/vue'
import ExamGrid from '@/components/exam/ExamGrid.vue'
import TopicTree from '@/components/exam/TopicTree.vue'
import ProgressStat from '@/components/exam/ProgressStat.vue'
import { loadExamsByKind } from '@/lib/exams'
import { cn } from '@/lib/utils'
import { useProgressStore } from '@/stores/progress'
import type { ExamKind, ExamMeta } from '@/types'

const route = useRoute()
const progress = useProgressStore()
/** /mock → SQLD(ai), /sqlp → SQLP */
const kind = computed<ExamKind>(() => (route.meta.kind as ExamKind | undefined) ?? 'ai')
const exams = ref<ExamMeta[]>([])
watch(
  kind,
  (k) => {
    exams.value = []
    loadExamsByKind(k).then((list) => (exams.value = list)).catch(() => {})
  },
  { immediate: true },
)

const INTRO = {
  ai: {
    title: '모의고사',
    lead: '실제 시험과 같은 구성(50문항 · 90분 · 1과목 10 / 2과목 40)으로 만든 SQLD 예상 문제입니다.',
    note: 'AI가 SQLD 출제 범위와 자주 나오는 유형을 바탕으로 새로 만든 문제이며, 실제 기출문제가 아닙니다. 회차별은 합격 기준(총점 60점 이상, 과목별 40% 미만 과락)으로 채점하고, 분류별은 이론 절마다 모아 바로 정답을 확인합니다.',
  },
  sqlp: {
    title: '모의고사',
    lead: '실제 시험과 같은 구성(객관식 70문항 + 실기 2문항 · 180분 · 1과목 10 / 2과목 20 / 3과목 40)으로 만든 SQLP 예상 문제입니다.',
    note: 'AI가 SQLP 출제 범위를 바탕으로 새로 만든 문제이며, 실제 기출문제가 아닙니다. 객관식 70점 + 실기 30점, 총점 75점 이상(과목별 40% 미만 과락)이면 합격입니다. 실기는 제출 후 모범 답안의 채점 포인트를 체크해 스스로 채점합니다.',
  },
} as const
const intro = computed(() => INTRO[kind.value === 'sqlp' ? 'sqlp' : 'ai'])
watch(intro, (i) => (document.title = `${i.title} · SQL 자격증`), { immediate: true })
const total = computed(() =>
  progress.statsByExams(
    exams.value.map((e) => e.id),
    exams.value.reduce((n, e) => n + e.questionCount, 0),
  ),
)
const router = useRouter()
// 보기 방식은 주소(?view=topic)에 남겨 뒤로가기·공유 시에도 유지
const view = computed(() => (route.query.view === 'topic' ? 'topic' : 'round'))
const setView = (v: 'round' | 'topic') => router.replace({ query: v === 'topic' ? { view: 'topic' } : {} })

const tabs = [
  { value: 'round', label: '회차별', icon: LayoutList },
  { value: 'topic', label: '분류별', icon: ListTree },
] as const
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="text-2xl font-bold">{{ intro.title }}</h1>
    <p class="mt-1 text-sm text-muted-foreground">{{ intro.lead }}</p>

    <!-- 전체 진행률 -->
    <div v-if="exams.length" class="mt-6 rounded-xl border p-4">
      <div class="mb-2 text-sm font-semibold">전체 {{ exams.length }}회 · {{ total.total }}문항</div>
      <ProgressStat :stats="total" size="md" />
    </div>

    <!-- 랜덤 문제 -->
    <RouterLink
      to="/random"
      class="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary"
    >
      <Dices class="size-7 shrink-0 text-primary" />
      <div class="flex-1">
        <div class="font-semibold">랜덤 문제</div>
        <div class="text-sm text-muted-foreground">전체 회차에서 무작위로 한 문제씩 풀어봐요.</div>
      </div>
      <ChevronRight class="size-5 text-muted-foreground" />
    </RouterLink>

    <div class="mt-6 inline-flex rounded-lg border p-1">
      <button
        v-for="t in tabs"
        :key="t.value"
        type="button"
        :class="
          cn(
            'inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm transition-colors',
            view === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )
        "
        @click="setView(t.value)"
      >
        <component :is="t.icon" class="size-4" /> {{ t.label }}
      </button>
    </div>

    <ExamGrid v-if="view === 'round'" :key="`r-${kind}`" :kind="kind" />
    <TopicTree v-else :key="`t-${kind}`" :kind="kind" />
  </div>
</template>
