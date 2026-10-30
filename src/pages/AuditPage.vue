<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, Flag, Info, ShieldCheck, TriangleAlert } from '@lucide/vue'
import QuestionView from '@/components/exam/QuestionView.vue'
import { relativeTime } from '@/lib/date'
import { loadExam } from '@/lib/exams'
import { cn } from '@/lib/utils'
import { loadAuditReports, loadAuditStats, type AuditReport } from '@/services/auditRepository'
import { MIN_SOLVERS, type QuestionStats } from '@/services/questionStatsRepository'
import { useCertStore } from '@/stores/cert'
import type { Exam } from '@/types'

/**
 * 문제 검수: 모의고사는 AI 가 만든 문제라 정답·해설이 틀릴 수 있다. 그런 문제를 찾는 두 가지 신호를 모아 본다.
 * - 오류 제보: 문제 코멘트에서 '오류 제보' 로 남긴 글
 * - 정답률 이상: 푼 사람이 MIN_SOLVERS 명 이상인데 정답률이 아주 낮거나, 한 오답에 정답보다 많이 몰린 문제
 * 펼치면 문제·정답·해설·코멘트를 바로 볼 수 있다
 */
document.title = '문제 검수 · Pass SQLD/SQLP'
const certStore = useCertStore()

/** 정답률이 이보다 낮으면 의심 */
const LOW_ACCURACY = 0.25

const reports = ref<AuditReport[]>([])
const stats = ref(new Map<string, QuestionStats>())
const exams = ref<Record<string, Exam>>({})
const loading = ref(true)
const error = ref('')
const tab = ref<'reports' | 'stats'>('reports')
const open = ref<string>()

const examIdOf = (key: string) => key.slice(0, key.lastIndexOf(':'))
const questionIdOf = (key: string) => Number(key.slice(key.lastIndexOf(':') + 1))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [r, s] = await Promise.all([loadAuditReports(), loadAuditStats()])
    reports.value = r
    stats.value = s
    const ids = [...new Set([...r.map((x) => x.key), ...s.keys()].map(examIdOf))].filter((id) => !exams.value[id])
    const loaded = await Promise.allSettled(ids.map((id) => loadExam(id)))
    for (const x of loaded) if (x.status === 'fulfilled') exams.value = { ...exams.value, [x.value.id]: x.value }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
void load()

/** 문제 키 → 지금 고른 자격증의 문제면 { 회차, 문항, 번호 } */
function find(key: string) {
  const exam = exams.value[examIdOf(key)]
  if (!exam || !certStore.ownsExam(exam.id)) return undefined
  const index = exam.questions.findIndex((q) => q.id === questionIdOf(key))
  return index < 0 ? undefined : { exam, question: exam.questions[index]!, number: index + 1 }
}

const reportItems = computed(() => reports.value.flatMap((r) => (find(r.key) ? [{ ...r, ...find(r.key)! }] : [])))

const statItems = computed(() =>
  [...stats.value.entries()]
    .flatMap(([key, s]) => {
      const q = find(key)
      if (!q || s.total < MIN_SOLVERS) return []
      const answer = q.question.answer
      const correct = s.picks[answer] ?? 0
      const [topChoice, topPicks] = Object.entries(s.picks)
        .map(([c, n]) => [Number(c), n] as const)
        .filter(([c]) => c !== answer)
        .sort((a, b) => b[1] - a[1])[0] ?? [0, 0]
      const accuracy = correct / s.total
      const trap = topPicks > correct
      if (accuracy >= LOW_ACCURACY && !trap) return []
      return [{ key, ...q, total: s.total, accuracy, topChoice, topRate: topPicks / s.total, trap }]
    })
    .sort((a, b) => a.accuracy - b.accuracy),
)

watch(tab, () => (open.value = undefined))
const circled = ['①', '②', '③', '④', '⑤']
const pct = (n: number) => `${Math.round(n * 100)}%`
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:py-10">
    <h1 class="flex items-center gap-2 text-2xl font-bold"><ShieldCheck class="size-6 text-primary" /> 문제 검수</h1>
    <p class="mt-1 text-sm text-muted-foreground break-keep">
      {{ certStore.info.label }} 모의고사는 AI 가 만든 문제라 정답이나 해설이 틀릴 수 있어요. 오류가 의심되는 문제를 모아 봤어요.
    </p>
    <p class="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground break-keep">
      <Info class="mt-px size-3.5 shrink-0" />
      문제를 풀다 이상하면, 정답을 확인한 뒤 코멘트에서 '오류 제보'로 남겨 주세요. 여기에 모여요.
    </p>

    <div class="mt-5 flex gap-1 border-b" role="tablist">
      <button
        v-for="t in [
          { id: 'reports', label: '오류 제보', count: reportItems.length, icon: Flag },
          { id: 'stats', label: '정답률 이상', count: statItems.length, icon: TriangleAlert },
        ] as const"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :class="
          cn(
            '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
            tab === t.id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )
        "
        @click="tab = t.id"
      >
        <component :is="t.icon" class="size-4" /> {{ t.label }}
        <span v-if="!loading && !error" class="rounded-full bg-muted px-1.5 text-xs tabular-nums">{{ t.count }}</span>
      </button>
    </div>

    <p v-if="error" class="mt-10 text-center text-sm text-destructive">{{ error }}</p>
    <div v-else-if="loading" class="mt-4 space-y-2">
      <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-xl bg-muted" />
    </div>

    <template v-else>
      <p v-if="tab === 'reports' && !reportItems.length" class="mt-10 text-center text-sm text-muted-foreground">아직 오류 제보가 없어요.</p>
      <p v-if="tab === 'stats' && !statItems.length" class="mt-10 text-center text-sm text-muted-foreground break-keep">
        정답률이 이상한 문제가 없어요. (푼 사람이 {{ MIN_SOLVERS }}명 이상인 문제만 봐요)
      </p>

      <ul class="mt-4 space-y-2">
        <li
          v-for="item in tab === 'reports' ? reportItems : statItems"
          :key="item.key"
          class="rounded-xl border"
        >
          <button
            type="button"
            class="flex w-full items-start gap-3 p-4 text-left"
            :aria-expanded="open === item.key"
            @click="open = open === item.key ? undefined : item.key"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ item.exam.title }} · {{ item.number }}번</p>
              <!-- 오류 제보 -->
              <template v-if="'reports' in item">
                <p class="mt-1 line-clamp-2 text-sm text-muted-foreground break-keep">“{{ item.lastBody }}”</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  <span class="font-semibold text-destructive">제보 {{ item.reports }}건</span> · {{ relativeTime(item.lastAt) }}
                </p>
              </template>
              <!-- 정답률 이상 -->
              <p v-else class="mt-1 text-xs text-muted-foreground tabular-nums break-keep">
                <span class="font-semibold text-destructive">정답률 {{ pct(item.accuracy) }}</span>
                · 정답 {{ circled[item.question.answer - 1] }}
                <template v-if="item.topChoice">· 가장 많이 고른 오답 {{ circled[item.topChoice - 1] }} {{ pct(item.topRate) }}</template>
                · {{ item.total }}명
              </p>
            </div>
            <ChevronDown :class="cn('mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform', open === item.key && 'rotate-180')" />
          </button>
          <div v-if="open === item.key" class="border-t p-4">
            <QuestionView
              :question="item.question"
              :number="item.number"
              :selected="null"
              revealed
              always-extras
              :bookmark="{ examId: item.exam.id, questionId: item.question.id }"
            />
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
