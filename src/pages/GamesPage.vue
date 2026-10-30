<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDownUp, CalendarCheck, Check, ChevronRight, Database, Flame, Gamepad2, TerminalSquare, Timer, Trophy } from '@lucide/vue'
import { orderPuzzlesFor, solvedCount, SQL_PUZZLES } from '@/lib/gameContent'
import { bestOf, challengeStreak, readChallenge, readChallengeLog } from '@/lib/games'
import { GAME_POINTS, useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useCertStore } from '@/stores/cert'

/** 미니게임 모음: 오늘의 챌린지 · 60초 O/X · 순서 퍼즐 · SQL 결과 맞히기 (+ SQL 실습장). 푼 기록은 비로그인이면 이 기기, 로그인하면 계정에 */
document.title = '미니게임 · Pass SQLD/SQLP'
const auth = useAuthStore()
const certStore = useCertStore()
const activity = useActivityStore()

const challenge = computed(() => {
  const s = readChallenge(certStore.examKind, activity.today)
  const log = readChallengeLog(certStore.examKind)
  return { solved: s.answers.length, correct: s.results.filter(Boolean).length, streak: challengeStreak(log, activity.today) }
})
const progressOf = (game: 'order' | 'sql', ids: string[]) => ({ solved: solvedCount(game, ids), total: ids.length })
const games = computed(() => [
  { to: '/games/ox', title: '60초 O/X', desc: '개념 문장이 맞는지 빠르게 판단해요', icon: Timer, best: bestOf('ox', certStore.examKind), progress: undefined },
  {
    to: '/games/order',
    title: '순서 퍼즐',
    desc: 'SQL 실행 순서, 정규화 단계를 맞춰요',
    icon: ArrowDownUp,
    best: bestOf('order', certStore.examKind),
    progress: progressOf('order', orderPuzzlesFor(certStore.cert).map((p) => p.id)),
  },
  {
    to: '/games/sql',
    title: 'SQL 결과 맞히기',
    desc: '쿼리 결과가 몇 행인지, 무슨 값인지 맞혀요',
    icon: Database,
    best: undefined,
    progress: progressOf('sql', SQL_PUZZLES.map((p) => p.id)),
  },
])
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:py-10">
    <h1 class="flex items-center gap-2 text-2xl font-bold"><Gamepad2 class="size-6 text-primary" /> 미니게임</h1>
    <p class="mt-1 text-sm text-muted-foreground break-keep">
      짧게 한 판. 게임 한 판은 하루 목표에서 문제 {{ GAME_POINTS }}개로 쳐요.
      <template v-if="auth.user">푼 기록은 계정에 저장되고, 처음 맞힌 문제마다 <RouterLink to="/ranking" class="text-primary hover:underline">경험치</RouterLink>를 얻어요.</template>
      <template v-else>로그인하면 푼 기록이 계정에 저장되고 경험치로 랭킹에 올라가요.</template>
    </p>

    <!-- 오늘의 챌린지 -->
    <RouterLink
      to="/games/daily"
      class="group mt-5 flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]"
    >
      <span class="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-foreground/15"><CalendarCheck class="size-6" /></span>
      <div class="min-w-0 flex-1">
        <p class="text-lg font-bold">오늘의 챌린지</p>
        <p class="text-sm opacity-85">
          <template v-if="challenge.solved >= 5">오늘 완료 · {{ challenge.correct }}/5 맞힘</template>
          <template v-else-if="challenge.solved">{{ challenge.solved }}/5 풀었어요 · 이어서 풀기</template>
          <template v-else>모두가 같은 {{ certStore.info.label }} 5문제, 하루 한 번</template>
        </p>
      </div>
      <span v-if="challenge.streak" class="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums">
        <Flame class="size-4 fill-current" /> {{ challenge.streak }}일
      </span>
      <Check v-if="challenge.solved >= 5" class="size-6 shrink-0" />
      <ChevronRight v-else class="size-6 shrink-0" />
    </RouterLink>

    <div class="mt-3 grid gap-3 sm:grid-cols-2">
      <RouterLink
        v-for="g in games"
        :key="g.to"
        :to="g.to"
        class="flex items-center gap-4 rounded-2xl border p-4 transition-colors hover:border-primary"
      >
        <span class="grid size-12 shrink-0 place-items-center rounded-xl bg-highlight text-ink"><component :is="g.icon" class="size-6" /></span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{{ g.title }}</p>
          <p class="text-sm text-muted-foreground break-keep">{{ g.desc }}</p>
          <p v-if="g.best || g.progress" class="mt-1 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span v-if="g.progress">{{ g.progress.solved }} / {{ g.progress.total }} 맞힘</span>
            <span v-if="g.best" class="inline-flex items-center gap-1"><Trophy class="size-3.5 text-amber-500" /> 최고 {{ g.best.score }}점</span>
          </p>
        </div>
        <ChevronRight class="size-5 shrink-0 text-muted-foreground" />
      </RouterLink>
    </div>

    <RouterLink to="/sql" class="mt-3 flex items-center gap-3 rounded-2xl border border-dashed p-4 transition-colors hover:border-primary">
      <TerminalSquare class="size-6 shrink-0 text-primary" />
      <span class="min-w-0 flex-1">
        <span class="block font-semibold">SQL 실습장</span>
        <span class="block text-sm text-muted-foreground break-keep">연습 테이블에 SQL 을 직접 실행해 봐요</span>
      </span>
      <ChevronRight class="size-5 shrink-0 text-muted-foreground" />
    </RouterLink>
  </div>
</template>
