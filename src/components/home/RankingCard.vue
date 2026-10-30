<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronRight, Crown, LogIn, Medal, Trophy } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { loadLeaderboard, type RankingPeriod, type RankingRow } from '@/services/rankingRepository'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'

/**
 * 홈의 랭킹 요약: 왼쪽 주간 · 오른쪽 전체, 각각 상위 3명 + 내 순위.
 * 비로그인도 보이고, 아래에 참여(로그인) 권유. 3위까지 비면 점선 '빈 자리'.
 * 문제를 풀어 기록이 늘면 (서버 집계가 끝나게 잠깐 뒤에) 다시 묻는다
 */
const auth = useAuthStore()
const progress = useProgressStore()
const TOP = 3
const PERIODS: { value: RankingPeriod; label: string }[] = [
  { value: 'week', label: '주간 랭킹' },
  { value: 'all', label: '전체 랭킹' },
]

const boards = ref<Record<RankingPeriod, RankingRow[] | undefined>>({ week: undefined, all: undefined })
const failed = ref(false)

async function load() {
  try {
    const [week, all] = await Promise.all([loadLeaderboard('week', TOP), loadLeaderboard('all', TOP)])
    boards.value = { week, all }
    failed.value = false
  } catch (e) {
    console.error('[랭킹 불러오기 실패]', e)
    failed.value = true
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => auth.user?.id, () => void load(), { immediate: true })
watch(
  () => Object.keys(progress.records).length,
  () => {
    clearTimeout(timer)
    timer = setTimeout(() => void load(), 1500)
  },
)

/** 상위 3명(모자라면 빈 자리 번호), 내가 그 밖이면 내 줄을 덧붙인다 */
function linesOf(rows: RankingRow[]) {
  const top = rows.filter((r) => r.rank <= TOP).slice(0, TOP)
  const me = rows.find((r) => r.isMe)
  const empty = Array.from({ length: TOP - top.length }, (_, i) => top.length + i + 1)
  return { top, empty, me: me && !top.includes(me) ? me : undefined }
}

const MEDAL: Record<number, { icon: typeof Crown; cls: string }> = {
  1: { icon: Crown, cls: 'fill-amber-300 text-amber-500' },
  2: { icon: Medal, cls: 'text-slate-400' },
  3: { icon: Medal, cls: 'text-orange-500' },
}
</script>

<template>
  <!-- 왼쪽 주간 · 오른쪽 전체 -->
  <section v-if="!failed">
  <div class="grid grid-cols-2 gap-3">
    <RouterLink
      v-for="p in PERIODS"
      :key="p.value"
      :to="{ path: '/ranking', query: p.value === 'all' ? { period: 'all' } : {} }"
      class="min-w-0 rounded-2xl border p-3 transition-colors hover:border-primary"
    >
      <div class="flex items-center gap-1">
        <Trophy class="size-4 shrink-0 text-amber-500" />
        <span class="truncate text-sm font-semibold">{{ p.label }}</span>
        <ChevronRight class="ml-auto size-4 shrink-0 text-muted-foreground" />
      </div>

      <div v-if="!boards[p.value]" class="mt-2 space-y-1.5">
        <div v-for="i in TOP" :key="i" class="h-6 animate-pulse rounded-md bg-muted" />
      </div>
      <template v-else>
        <ol class="mt-2 space-y-0.5">
          <li
            v-for="r in [...linesOf(boards[p.value]!).top, ...(linesOf(boards[p.value]!).me ? [linesOf(boards[p.value]!).me!] : [])]"
            :key="`${r.rank}-${r.nickname}`"
            :class="cn('flex items-center gap-1.5 rounded-md px-1 py-1', r.isMe && 'bg-highlight/30', r.rank > TOP && 'mt-1 border-t pt-1.5')"
          >
            <span class="grid w-5 shrink-0 place-items-center">
              <component :is="MEDAL[r.rank]!.icon" v-if="MEDAL[r.rank]" :class="cn('size-4', MEDAL[r.rank]!.cls)" />
              <span v-else class="text-xs font-semibold text-muted-foreground tabular-nums">{{ r.rank }}</span>
            </span>
            <span class="min-w-0 flex-1 truncate text-sm">{{ r.nickname }}</span>
            <span class="shrink-0 text-xs text-muted-foreground tabular-nums">{{ r.xp.toLocaleString() }} XP</span>
          </li>
          <!-- 빈 자리 (움직이지 않는 점선: 로딩이 아니라 '비어 있음') -->
          <li
            v-for="n in linesOf(boards[p.value]!).empty"
            :key="`seat-${n}`"
            class="flex items-center gap-1.5 rounded-md border border-dashed px-1 py-[3px] text-muted-foreground/70"
          >
            <span class="grid w-5 shrink-0 place-items-center text-xs font-semibold tabular-nums">{{ n }}</span>
            <span class="truncate text-xs">빈 자리</span>
          </li>
        </ol>
        <p v-if="auth.user && !boards[p.value]!.some((r) => r.isMe)" class="mt-1.5 text-[11px] text-muted-foreground break-keep">
          문제를 풀면 내 순위가 보여요.
        </p>
      </template>
    </RouterLink>
  </div>
  <!-- 비로그인: 참여 권유 -->
  <div v-if="!auth.user" class="mt-2 flex items-center gap-2 px-1 text-sm text-muted-foreground">
    <span class="min-w-0 flex-1 break-keep">로그인하면 경험치(XP)로 랭킹에 참여해요.</span>
    <Button size="sm" variant="outline" class="shrink-0" :disabled="!auth.isAvailable" @click="auth.signInWithGoogle">
      <LogIn class="size-4" /> 참여
    </Button>
  </div>
  </section>
</template>
