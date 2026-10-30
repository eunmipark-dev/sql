<script setup lang="ts">
import { computed } from 'vue'
import { Flame, Trophy } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { GOAL_OPTIONS, PART_POINTS, pointsOf, useActivityStore } from '@/stores/activity'

/**
 * 학습 습관: 연속 학습일 · 하루 목표 고르기 · 최근 14일 학습량 막대.
 * 막대 하나 = 하루 (문제 수 + 강의 파트 × PART_POINTS), 가로 점선 = 하루 목표
 */
const activity = useActivityStore()
const DAYS = 14

const bars = computed(() => {
  const list = activity.recent(DAYS)
  const max = Math.max(activity.goal, ...list.map(pointsOf))
  return list.map((d) => {
    const [, m, day] = d.day.split('-').map(Number)
    const points = pointsOf(d)
    return {
      day: d.day,
      label: `${m}/${day}`,
      points,
      height: (points / max) * 100,
      met: points >= activity.goal,
      today: d.day === activity.today,
      detail: `${m}월 ${day}일 · 문제 ${d.questions}개 · 강의 ${d.lectureParts}파트`,
    }
  })
})
const goalLine = computed(() => (activity.goal / Math.max(activity.goal, ...bars.value.map((b) => b.points))) * 100)
const activeDays = computed(() => bars.value.filter((b) => b.points > 0).length)
</script>

<template>
  <section class="rounded-2xl border p-5">
    <div class="flex items-center gap-4">
      <span class="grid size-14 shrink-0 place-items-center rounded-2xl bg-orange-50 dark:bg-orange-500/10">
        <Flame :class="cn('size-8 text-orange-500', activity.studiedToday && 'fill-orange-400')" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm text-muted-foreground">연속 학습</div>
        <div class="text-2xl font-bold tabular-nums">{{ activity.streak }}일</div>
      </div>
      <div class="text-right text-sm text-muted-foreground">
        <div class="flex items-center justify-end gap-1"><Trophy class="size-4 text-amber-500" /> 최고 {{ activity.bestStreak }}일</div>
        <div>{{ activity.studiedToday ? '오늘 완료' : '오늘 아직' }}</div>
      </div>
    </div>
    <p class="mt-2 text-xs text-muted-foreground">하루에 문제를 하나라도 풀거나 강의 한 파트를 들으면 이어져요.</p>

    <!-- 하루 목표 -->
    <div class="mt-5 flex flex-wrap items-center gap-2">
      <span class="text-sm font-semibold">하루 목표</span>
      <span class="text-xs text-muted-foreground">문제 수 · 강의 1파트 = {{ PART_POINTS }}문제</span>
      <div class="ml-auto flex gap-1" role="radiogroup" aria-label="하루 목표">
        <button
          v-for="g in GOAL_OPTIONS"
          :key="g"
          type="button"
          role="radio"
          :aria-checked="activity.goal === g"
          :class="
            cn(
              'h-8 min-w-10 rounded-full border px-2.5 text-sm tabular-nums transition-colors',
              activity.goal === g ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )
          "
          @click="activity.goal = g"
        >
          {{ g }}
        </button>
      </div>
    </div>

    <!-- 최근 14일 -->
    <div class="mt-5">
      <!-- 목표선 설명은 그래프 위에 범례로 (선 옆에 두면 막대·글자와 겹친다) -->
      <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>최근 {{ DAYS }}일 · {{ activeDays }}일 공부함</span>
        <span class="ml-auto inline-flex items-center gap-1.5">
          <span class="w-4 border-t border-dashed border-muted-foreground" /> 목표 {{ activity.goal }}
        </span>
      </div>
      <div class="relative h-24">
        <!-- 목표선 -->
        <div class="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50" :style="{ bottom: `${goalLine}%` }" />
        <ol class="flex h-full items-end gap-[2px]" aria-hidden="true">
          <li v-for="b in bars" :key="b.day" class="group relative flex h-full flex-1 items-end" :title="b.detail">
            <span
              :class="cn('w-full rounded-t-[4px] transition-colors', b.met ? 'bg-primary' : 'bg-primary/45', b.today && 'ring-2 ring-highlight')"
              :style="{ height: b.points ? `max(${b.height}%, 3px)` : '0' }"
            />
            <!-- 누르거나 올리면 그날 학습량 -->
            <span
              class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[11px] whitespace-nowrap text-popover-foreground shadow group-hover:block"
            >
              {{ b.detail }}
            </span>
          </li>
        </ol>
      </div>
      <div class="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{{ bars[0]?.label }}</span>
        <span>오늘</span>
      </div>
      <!-- 화면 읽기 프로그램용 표 -->
      <table class="sr-only">
        <caption>최근 {{ DAYS }}일 학습량</caption>
        <tbody>
          <tr v-for="b in bars" :key="b.day"><td>{{ b.detail }}</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
