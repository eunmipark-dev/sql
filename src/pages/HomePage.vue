<script setup lang="ts">
import { computed } from 'vue'
import { Bell, CalendarCheck, Check, ChevronRight, CirclePlay, Dices, Flame, Gamepad2, PencilLine, Play, RotateCcw, Target, TrendingUp, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import ExamPlanCard from '@/components/home/ExamPlanCard.vue'
import RankingCard from '@/components/home/RankingCard.vue'
import { useResume } from '@/composables/useResume'
import { MIN_FOR_SCORE, useStudySummary } from '@/composables/useStudySummary'
import { lectureMs, minutesLabel } from '@/lib/lectureParts'
import { challengeStreak, readChallenge, readChallengeLog } from '@/lib/games'
import { markReminderAsked, reminder, reminderAsked, reminderSupported, requestReminderPermission } from '@/lib/reminder'
import { cn } from '@/lib/utils'
import { PART_POINTS, useActivityStore } from '@/stores/activity'
import { useCertStore } from '@/stores/cert'

/**
 * 홈 = '오늘 할 것' (Speak 처럼 열자마자 할 일 하나를 크게).
 * 연속 학습일 · 오늘 목표 → 이어서 하기 → 오늘 복습·랜덤 → 실력 요약
 */
document.title = 'Pass SQLD/SQLP'
const certStore = useCertStore()
const activity = useActivityStore()
const { items: resume, next } = useResume()
const summary = useStudySummary()

const greeting = computed(() => {
  if (activity.goalMet) return '오늘 목표 달성! 🎉'
  if (activity.studiedToday) return '좋아요, 조금만 더 해 볼까요?'
  if (activity.streak) return `${activity.streak}일째 이어가 볼까요?`
  return '오늘의 첫 학습을 시작해요'
})

const goalPct = computed(() => Math.min(1, activity.todayPoints / activity.goal))
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']
const week = computed(() =>
  activity.recent(7).map((d) => {
    const [y, m, day] = d.day.split('-').map(Number)
    return {
      day: d.day,
      label: WEEKDAY[new Date(y!, m! - 1, day!).getDay()],
      done: d.questions + d.lectureParts * PART_POINTS >= activity.goal,
      studied: d.questions > 0 || d.lectureParts > 0 || d.lectureMs >= 60_000,
      today: d.day === activity.today,
    }
  }),
)

const hero = computed(() => resume.value[0])
const more = computed(() => resume.value[1])
/** 앱에서 한 번: 매일 알림 켜기 권유 (켜거나 닫으면 다시 안 보인다) */
const askReminder = computed(() => reminderSupported && !reminder.value.on && !reminderAsked.value)
async function enableReminder() {
  const ok = await requestReminderPermission()
  markReminderAsked()
  if (ok) reminder.value = { ...reminder.value, on: true }
}

/** 오늘의 챌린지 진행 (이 기기 기록) */
const challenge = computed(() => {
  const s = readChallenge(certStore.examKind, activity.today)
  return { solved: s.answers.length, correct: s.results.filter(Boolean).length, streak: challengeStreak(readChallengeLog(certStore.examKind), activity.today) }
})

const pct = (n?: number) => (n === undefined ? '-' : `${Math.round(n * 100)}%`)
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:py-10">
    <!-- 인사 · 연속 학습일 -->
    <section class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <p class="text-sm text-muted-foreground">{{ certStore.info.label }} 준비 중</p>
        <h1 class="mt-0.5 text-2xl font-bold tracking-tight break-keep">{{ greeting }}</h1>
      </div>
      <RouterLink
        to="/me"
        :class="
          cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 font-bold tabular-nums',
            activity.studiedToday ? 'border-orange-300 bg-orange-50 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-400' : 'text-muted-foreground',
          )
        "
        :aria-label="`연속 학습 ${activity.streak}일`"
      >
        <Flame :class="cn('size-5', activity.studiedToday && 'fill-orange-400')" /> {{ activity.streak }}일
      </RouterLink>
    </section>

    <!-- 시험일: 없으면 묻고, 있으면 D-day · 오늘의 계획 -->
    <ExamPlanCard mode="home" class="mt-4" />

    <!-- 오늘 목표 + 이번 주 -->
    <section class="mt-5 flex items-center gap-4 rounded-2xl border p-4">
      <div class="relative size-16 shrink-0">
        <svg viewBox="0 0 36 36" class="size-16 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--muted)" stroke-width="4" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            :stroke="activity.goalMet ? 'var(--success)' : 'var(--primary)'"
            stroke-width="4"
            stroke-linecap="round"
            :stroke-dasharray="97.4"
            :stroke-dashoffset="97.4 * (1 - goalPct)"
            class="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <Target class="absolute inset-0 m-auto size-6 text-primary" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-1.5">
          <span class="text-sm font-semibold">오늘 목표</span>
          <span class="text-lg font-bold tabular-nums">{{ Math.min(activity.todayPoints, activity.goal) }}</span>
          <span class="text-sm text-muted-foreground tabular-nums">/ {{ activity.goal }}</span>
        </div>
        <p class="truncate text-xs text-muted-foreground">
          문제 {{ activity.todayDay.questions }}개 · 강의 {{ activity.todayDay.lectureParts }}파트
          <span class="opacity-70">(파트 1개 = 문제 {{ PART_POINTS }}개)</span>
        </p>
        <ol class="mt-2 flex gap-1.5" aria-label="최근 7일">
          <li v-for="d in week" :key="d.day" class="flex flex-col items-center gap-0.5">
            <span
              :class="
                cn(
                  'grid size-6 place-items-center rounded-full text-[10px]',
                  d.done ? 'bg-success text-white' : d.studied ? 'bg-highlight text-ink' : 'bg-muted',
                  d.today && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                )
              "
              :title="d.day"
            >
              <Flame v-if="d.studied" class="size-3.5" />
            </span>
            <span :class="cn('text-[10px] text-muted-foreground', d.today && 'font-bold text-foreground')">{{ d.label }}</span>
          </li>
        </ol>
      </div>
    </section>

    <!-- 이어서 하기: 가장 최근에 하던 것 하나를 크게 -->
    <RouterLink
      v-if="hero"
      :to="hero.to"
      class="group mt-4 flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]"
    >
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium opacity-80">{{ hero.kind === 'lecture' ? '이어 듣기' : '이어 풀기' }}</p>
        <template v-if="hero.kind === 'lecture'">
          <p class="mt-0.5 truncate text-xl font-bold">{{ hero.doc.title }}</p>
          <p class="truncate text-sm opacity-80">
            <template v-if="hero.part">파트 {{ hero.part.index + 1 }}/{{ hero.part.count }} · {{ hero.part.title }}</template>
            <template v-else>{{ hero.pos + 1 }} / {{ hero.total }} 장면</template>
          </p>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-foreground/25">
            <div class="h-full rounded-full bg-primary-foreground" :style="{ width: `${(hero.pos / hero.total) * 100}%` }" />
          </div>
        </template>
        <template v-else>
          <p class="mt-0.5 truncate text-xl font-bold">{{ hero.meta.title }}</p>
          <p class="text-sm opacity-80">{{ hero.answered }} / {{ hero.meta.questionCount }}문항 풀었어요</p>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-primary-foreground/25">
            <div class="h-full rounded-full bg-primary-foreground" :style="{ width: `${(hero.answered / hero.meta.questionCount) * 100}%` }" />
          </div>
        </template>
      </div>
      <span class="grid size-14 shrink-0 place-items-center rounded-full bg-primary-foreground text-primary transition-transform group-hover:scale-105">
        <Play v-if="hero.kind === 'lecture'" class="size-6 translate-x-0.5 fill-current" />
        <PencilLine v-else class="size-6" />
      </span>
    </RouterLink>
    <!-- 하던 게 없으면: 아직 안 끝낸 첫 강의 -->
    <RouterLink
      v-else-if="next"
      :to="{ name: 'lecture', params: { slug: next.slug } }"
      class="group mt-4 flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]"
    >
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium opacity-80">다음 강의 · {{ minutesLabel(lectureMs(next.slug)) }}</p>
        <p class="mt-0.5 truncate text-xl font-bold">{{ next.title }}</p>
        <p class="truncate text-sm opacity-80">{{ next.summary }}</p>
      </div>
      <span class="grid size-14 shrink-0 place-items-center rounded-full bg-primary-foreground text-primary transition-transform group-hover:scale-105">
        <Play class="size-6 translate-x-0.5 fill-current" />
      </span>
    </RouterLink>
    <RouterLink
      v-if="more"
      :to="more.to"
      class="mt-2 flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <CirclePlay v-if="more.kind === 'lecture'" class="size-4 shrink-0" />
      <PencilLine v-else class="size-4 shrink-0" />
      <span class="truncate">
        또는 <b class="font-medium text-foreground">{{ more.kind === 'lecture' ? more.doc.title : more.meta.title }}</b>
        {{ more.kind === 'lecture' ? '이어 듣기' : `이어 풀기 (${more.answered}/${more.meta.questionCount})` }}
      </span>
      <ChevronRight class="ml-auto size-4 shrink-0" />
    </RouterLink>

    <!-- 앱: 알림 권유 -->
    <div v-if="askReminder" class="mt-4 flex items-center gap-3 rounded-2xl border border-dashed p-4">
      <Bell class="size-5 shrink-0 text-primary" />
      <p class="min-w-0 flex-1 text-sm break-keep">공부를 잊은 날, 저녁 {{ reminder.time }}에 알려 드릴까요?</p>
      <Button size="sm" @click="enableReminder">켜기</Button>
      <Button variant="ghost" size="icon" class="size-8" aria-label="닫기" @click="markReminderAsked"><X class="size-4" /></Button>
    </div>

    <!-- 짧게 할 수 있는 것 -->
    <section class="mt-4 grid grid-cols-2 gap-3">
      <RouterLink
        to="/review"
        :class="
          cn(
            'flex flex-col gap-2 rounded-2xl border p-4 transition-colors hover:border-primary',
            certStore.dueNotes.length && 'border-highlight bg-highlight/25',
          )
        "
      >
        <span class="grid size-10 place-items-center rounded-xl bg-highlight text-ink"><RotateCcw class="size-5" /></span>
        <span>
          <span class="block font-semibold">오늘 복습</span>
          <span class="block text-sm text-muted-foreground">
            <template v-if="certStore.dueNotes.length"><b class="text-foreground tabular-nums">{{ certStore.dueNotes.length }}</b>문제 기다려요</template>
            <template v-else>오늘은 끝!</template>
          </span>
        </span>
      </RouterLink>
      <RouterLink to="/random" class="flex flex-col gap-2 rounded-2xl border p-4 transition-colors hover:border-primary">
        <span class="grid size-10 place-items-center rounded-xl bg-highlight text-ink"><Dices class="size-5" /></span>
        <span>
          <span class="block font-semibold">랜덤 문제</span>
          <span class="block text-sm text-muted-foreground">한 문제씩 가볍게</span>
        </span>
      </RouterLink>
    </section>

    <!-- 오늘의 챌린지 · 미니게임 -->
    <section class="mt-3 flex items-stretch gap-3">
      <RouterLink
        to="/games/daily"
        :class="
          cn(
            'flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-primary',
            challenge.solved < 5 && 'border-primary/40 bg-primary/5',
          )
        "
      >
        <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><CalendarCheck class="size-5" /></span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5 font-semibold">
            오늘의 챌린지
            <span v-if="challenge.streak" class="inline-flex items-center text-xs font-bold text-orange-500 tabular-nums"><Flame class="size-3.5" />{{ challenge.streak }}</span>
          </span>
          <span class="block truncate text-sm text-muted-foreground">
            <template v-if="challenge.solved >= 5">완료 · {{ challenge.correct }}/5 맞힘</template>
            <template v-else-if="challenge.solved">{{ challenge.solved }}/5 · 이어서 풀기</template>
            <template v-else>모두 같은 5문제, 하루 한 번</template>
          </span>
        </span>
        <Check v-if="challenge.solved >= 5" class="size-5 shrink-0 text-success" />
        <ChevronRight v-else class="size-5 shrink-0 text-muted-foreground" />
      </RouterLink>
      <RouterLink
        to="/games"
        class="flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-medium transition-colors hover:border-primary"
      >
        <Gamepad2 class="size-6 text-primary" /> 미니게임
      </RouterLink>
    </section>

    <!-- 이번 주 랭킹 -->
    <RankingCard class="mt-4" />

    <!-- 실력 요약 -->
    <RouterLink to="/me" class="mt-4 block rounded-2xl border p-4 transition-colors hover:border-primary">
      <div class="flex items-center gap-2">
        <TrendingUp class="size-5 text-primary" />
        <span class="font-semibold">내 실력</span>
        <span class="ml-auto flex items-center text-xs text-muted-foreground">자세히 <ChevronRight class="size-4" /></span>
      </div>
      <div v-if="summary.expected.value" class="mt-3 flex items-baseline gap-2">
        <span class="text-3xl font-bold tabular-nums">{{ summary.expected.value.score }}</span>
        <span class="text-sm text-muted-foreground">/ {{ summary.expected.value.max }}점 예상</span>
        <span
          v-if="summary.expected.value.pass !== undefined"
          :class="
            cn(
              'ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold',
              summary.expected.value.pass ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive',
            )
          "
        >
          {{ summary.expected.value.pass ? '합격권' : summary.expected.value.cutoff.length ? '과락 주의' : '조금 더' }}
        </span>
      </div>
      <p v-else class="mt-2 text-sm text-muted-foreground">과목마다 {{ MIN_FOR_SCORE }}문제 이상 풀면 예상 점수를 알려드려요.</p>
      <ul class="mt-3 space-y-2.5">
        <li v-for="s in summary.subjects.value" :key="s.subject">
          <div class="flex items-baseline gap-2 text-sm">
            <span class="font-medium">{{ s.subject }}과목</span>
            <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ s.name }}</span>
            <span class="text-xs text-muted-foreground tabular-nums">
              정답률 <b class="text-foreground">{{ pct(s.accuracy) }}</b> · {{ s.solved }}문제
            </span>
          </div>
          <div class="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              :class="cn('h-full rounded-full', (s.accuracy ?? 1) < 0.4 ? 'bg-destructive' : (s.accuracy ?? 0) >= 0.6 ? 'bg-success' : 'bg-primary')"
              :style="{ width: `${(s.accuracy ?? 0) * 100}%` }"
            />
          </div>
        </li>
      </ul>
    </RouterLink>

  </div>
</template>
