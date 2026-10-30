<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarDays, ChevronRight, ExternalLink } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { ddayLabel, setExamDate, useExamPlan } from '@/composables/useExamPlan'
import { daysBetween } from '@/lib/date'
import { applyState, dayLabel, SCHEDULE_URL } from '@/lib/examSchedule'
import { openExternal } from '@/lib/native'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'
import { useCertStore } from '@/stores/cert'

/**
 * 시험일(D-day) 카드. 시험일은 공식 일정에서 가장 가까운 회차 (직접 고른 날짜가 있으면 그 날짜).
 * - home: D-day · 회차 · 오늘의 계획 한 줄
 * - full(마이페이지): 회차 일정(접수·시험·발표), 다른 날짜로 정하기, 강의 진도
 */
const props = withDefaults(defineProps<{ mode?: 'home' | 'full' }>(), { mode: 'full' })
const certStore = useCertStore()
const activity = useActivityStore()
const plan = useExamPlan()

/** '제63회 SQLD · 11월 14일(토)' / '내가 정한 날 · 12월 1일(화)' */
const title = computed(() => {
  if (!plan.date.value) return ''
  const day = dayLabel(plan.date.value)
  return plan.round.value ? `제${plan.round.value.round}회 ${certStore.info.label} · ${day}` : `내가 정한 시험일 · ${day}`
})

/** 접수 안내 한 줄 (공식 회차일 때) */
const apply = computed(() => {
  const r = plan.round.value
  if (!r) return undefined
  const state = applyState(r, activity.today)
  const range = `${dayLabel(r.applyFrom)} ~ ${dayLabel(r.applyTo)}`
  if (state === 'open') return { state, text: `지금 접수 중 · ${dayLabel(r.applyTo)}까지` }
  if (state === 'before') return { state, text: `접수 D-${daysBetween(activity.today, r.applyFrom)} · ${range}` }
  return { state, text: `접수 마감 · 결과 발표 ${dayLabel(r.result)}` }
})

const editing = ref(false)
const input = ref(plan.custom.value ?? '')
watch(plan.custom, (d) => (input.value = d ?? ''))

function save() {
  if (!input.value) return
  setExamDate(certStore.cert, input.value)
  editing.value = false
}
</script>

<template>
  <!-- 홈: D-day 한 줄 -->
  <RouterLink
    v-if="props.mode === 'home' && plan.daysLeft.value !== undefined"
    to="/me#exam-plan"
    class="flex items-center gap-3 rounded-2xl border p-3 pr-2 transition-colors hover:border-primary"
  >
    <span
      :class="
        cn(
          'shrink-0 rounded-xl px-2.5 py-1.5 text-lg font-extrabold tabular-nums',
          plan.daysLeft.value <= 7 ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground',
        )
      "
    >
      {{ ddayLabel(plan.daysLeft.value) }}
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-semibold">{{ title }}</span>
      <span class="block text-xs text-muted-foreground break-keep">{{ plan.advice.value }}</span>
    </span>
    <ChevronRight class="size-5 shrink-0 text-muted-foreground" />
  </RouterLink>
  <!-- 홈: 다음 일정이 아직 없을 때 -->
  <RouterLink
    v-else-if="props.mode === 'home'"
    to="/me#exam-plan"
    class="flex items-center gap-3 rounded-2xl border border-dashed p-3 pr-2 text-sm text-muted-foreground transition-colors hover:border-primary"
  >
    <CalendarDays class="size-5 shrink-0" />
    <span class="min-w-0 flex-1 break-keep">{{ certStore.info.label }} 다음 시험 일정은 아직 발표 전이에요.</span>
    <ChevronRight class="size-5 shrink-0" />
  </RouterLink>

  <!-- 마이페이지 -->
  <section v-else id="exam-plan" class="scroll-mt-20 rounded-2xl border p-5">
    <div class="flex items-center gap-2">
      <CalendarDays class="size-5 text-primary" />
      <h2 class="font-semibold">{{ certStore.info.label }} 시험일</h2>
      <span
        v-if="plan.daysLeft.value !== undefined"
        :class="
          cn(
            'ml-auto rounded-lg px-2 py-0.5 text-sm font-extrabold tabular-nums',
            plan.daysLeft.value <= 7 ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground',
          )
        "
      >
        {{ ddayLabel(plan.daysLeft.value) }}
      </span>
    </div>

    <template v-if="plan.date.value">
      <p class="mt-3 text-lg font-bold">{{ title }}</p>
      <p
        v-if="apply"
        :class="cn('mt-0.5 text-sm break-keep', apply.state === 'open' ? 'font-semibold text-primary' : 'text-muted-foreground')"
      >
        {{ apply.text }}
      </p>
      <p class="mt-3 text-sm break-keep">{{ plan.advice.value }}</p>
      <div class="mt-3">
        <div class="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>강의 진도</span>
          <span>{{ plan.lectures.value.done }} / {{ plan.lectures.value.total }}</span>
        </div>
        <div class="mt-1 h-2 overflow-hidden rounded-full bg-muted">
          <div class="h-full rounded-full bg-primary" :style="{ width: `${(plan.lectures.value.done / Math.max(1, plan.lectures.value.total)) * 100}%` }" />
        </div>
      </div>
    </template>
    <p v-else class="mt-3 text-sm text-muted-foreground break-keep">
      다음 시험 일정이 아직 발표되지 않았어요. 발표되면 여기에 D-day 가 떠요. 그 전에 목표일을 직접 정할 수도 있어요.
    </p>

    <!-- 다른 날짜 -->
    <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-sm">
      <template v-if="plan.custom.value">
        <span class="text-muted-foreground">직접 정한 날짜를 쓰고 있어요.</span>
        <button v-if="plan.official.value" type="button" class="font-medium text-primary hover:underline" @click="setExamDate(certStore.cert, undefined)">
          공식 일정(제{{ plan.official.value.round }}회)으로
        </button>
      </template>
      <button v-if="!editing" type="button" class="font-medium text-primary hover:underline" @click="editing = true">
        {{ plan.custom.value ? '날짜 바꾸기' : '다른 날짜로 정하기' }}
      </button>
      <button type="button" class="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary" @click="openExternal(SCHEDULE_URL)">
        공식 일정 <ExternalLink class="size-3.5" />
      </button>
    </div>
    <form v-if="editing" class="mt-2 flex gap-2" @submit.prevent="save">
      <input
        v-model="input"
        type="date"
        :min="activity.today"
        required
        class="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        aria-label="시험일"
      />
      <Button type="submit" size="sm" class="h-9" :disabled="!input">저장</Button>
      <Button type="button" size="sm" variant="ghost" class="h-9" @click="editing = false">취소</Button>
    </form>
  </section>
</template>
