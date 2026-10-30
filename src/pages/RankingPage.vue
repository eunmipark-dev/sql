<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, Crown, LogIn, Medal, RefreshCw, Trophy } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { currentWeek, loadLeaderboard, XP_DAILY_MAX, XP_RULES, type RankingPeriod, type RankingRow } from '@/services/rankingRepository'
import { useAuthStore } from '@/stores/auth'

document.title = '랭킹 · Pass SQLD/SQLP'
const auth = useAuthStore()

// 홈의 '전체 랭킹'에서 들어오면 ?period=all
const period = ref<RankingPeriod>(useRoute().query.period === 'all' ? 'all' : 'week')
const rows = ref<RankingRow[]>([])
const loading = ref(false)
const error = ref('')

// 비로그인도 볼 수 있다 (참여·내 순위는 로그인해야)
async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await loadLeaderboard(period.value)
  } catch (e) {
    console.error('[랭킹 불러오기 실패]', e)
    error.value = '랭킹을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
    rows.value = []
  } finally {
    loading.value = false
  }
}
watch([period, () => auth.user?.id], load, { immediate: true })

// 상위 3명은 시상대, 나머지는 목록. 내 순위가 목록 밖이면 맨 아래에 따로
const podium = computed(() => rows.value.slice(0, 3))
const top = computed(() => rows.value.filter((r, i) => i >= 3 && r.rank <= 50))
const meOutside = computed(() => rows.value.find((r) => r.isMe && r.rank > 50))
const me = computed(() => rows.value.find((r) => r.isMe))
const maxXp = computed(() => rows.value[0]?.xp || 1)
const showRules = ref(false)

/**
 * 10위까지는 자리를 늘 보여준다: 사람이 적으면 남은 자리를 '빈 자리'로 (로딩 표시와 헷갈리지 않게 움직이지 않는 점선).
 * 첫 빈 자리에는 '1문제만 풀면 여기'를 적어 참여를 권한다 (아직 순위에 없을 때만)
 */
const SEATS = 10
const emptySeats = computed(() => {
  const filled = Math.min(rows.value.filter((r) => r.rank <= SEATS && r !== meOutside.value).length, SEATS)
  return Array.from({ length: Math.max(0, SEATS - Math.max(filled, 3)) }, (_, i) => Math.max(filled, 3) + i + 1)
})

/** 시상대 순서: 2등 · 1등 · 3등 (가운데가 가장 높다) */
const podiumOrder = computed(() => [podium.value[1], podium.value[0], podium.value[2]])

// 순위별 꾸밈 (동점이면 같은 순위 → 같은 꾸밈)
const TIER = {
  1: { icon: Crown, ring: 'ring-amber-400', bg: 'from-amber-300/40 to-amber-100/10', text: 'text-amber-500', height: 'h-28', label: '1위' },
  2: { icon: Medal, ring: 'ring-slate-300', bg: 'from-slate-300/40 to-slate-100/10', text: 'text-slate-400', height: 'h-20', label: '2위' },
  3: { icon: Medal, ring: 'ring-orange-400/70', bg: 'from-orange-300/40 to-orange-100/10', text: 'text-orange-500', height: 'h-14', label: '3위' },
} as const
const tier = (rank: number) => TIER[Math.min(rank, 3) as 1 | 2 | 3]

const tabs: { value: RankingPeriod; label: string }[] = [
  { value: 'week', label: '주간' },
  { value: 'all', label: '전체' },
]
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-10">
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold"><Trophy class="size-6 text-amber-500" /> 랭킹</h1>
        <p class="mt-1 text-sm text-muted-foreground break-keep">
          문제 풀기 · 강의 · 미니게임으로 얻은 경험치(XP)로 순위를 매겨요.
          <button type="button" class="inline-flex items-center font-medium text-primary hover:underline" :aria-expanded="showRules" @click="showRules = !showRules">
            경험치 얻는 법 <ChevronDown :class="cn('size-4 transition-transform', showRules && 'rotate-180')" />
          </button>
        </p>
      </div>
      <Button variant="ghost" size="sm" class="ml-auto" :disabled="loading" @click="load">
        <RefreshCw :class="cn('size-4', loading && 'animate-spin')" /> 새로고침
      </Button>
    </div>

    <div v-if="showRules" class="mt-3 rounded-xl border bg-muted/30 p-4 text-sm">
      <dl class="space-y-1.5">
        <div v-for="r in XP_RULES" :key="r.label" class="flex items-baseline gap-3">
          <dt class="min-w-0 flex-1 break-keep text-muted-foreground">{{ r.label }}</dt>
          <dd class="shrink-0 font-semibold tabular-nums">{{ r.xp }} XP</dd>
        </div>
      </dl>
      <p class="mt-3 text-xs text-muted-foreground break-keep">
        미니게임은 처음 맞힌 문제만 경험치를 줘요. 하루 최대 {{ XP_DAILY_MAX.toLocaleString() }} XP · 로그인해야 쌓여요.
      </p>
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div class="inline-flex shrink-0 rounded-lg border p-1">
        <button
          v-for="t in tabs"
          :key="t.value"
          type="button"
          :class="
            cn(
              'rounded-md px-5 py-1.5 text-sm whitespace-nowrap transition-colors',
              period === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )
          "
          @click="period = t.value"
        >
          {{ t.label }}
        </button>
      </div>
      <span class="text-xs text-muted-foreground">
        {{ period === 'week' ? `${currentWeek()} · 매주 월요일 0시에 새로 시작` : '서비스 시작부터 지금까지' }}
      </span>
    </div>

    <!-- 비로그인: 순위는 보이고, 참여는 로그인 -->
    <div v-if="!auth.user" class="mt-6 flex items-center gap-3 rounded-2xl border border-dashed p-4">
      <p class="min-w-0 flex-1 text-sm break-keep">로그인하면 경험치가 쌓여 랭킹에 참여하고 내 순위를 볼 수 있어요.</p>
      <Button size="sm" class="shrink-0" :disabled="!auth.isAvailable" @click="auth.signInWithGoogle"><LogIn class="size-4" /> 로그인</Button>
    </div>

    <div>
      <p v-if="error" class="mt-10 text-center text-sm text-destructive">{{ error }}</p>
      <div v-else-if="loading && !rows.length" class="mt-8 space-y-3">
        <div class="h-48 animate-pulse rounded-2xl bg-muted" />
        <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-xl bg-muted" />
      </div>
      <template v-else>
        <!-- 시상대: 2등 · 1등 · 3등 -->
        <div class="mt-8 grid grid-cols-3 items-end gap-2 sm:gap-4">
          <div v-for="(r, i) in podiumOrder" :key="r ? `${r.rank}-${r.nickname}-${i}` : `empty-${i}`" class="flex flex-col items-center">
            <template v-if="r">
              <div class="relative mb-2 flex flex-col items-center">
                <!-- 1등 왕관 -->
                <Crown
                  v-if="r.rank === 1"
                  class="crown absolute -top-7 size-8 fill-amber-400 text-amber-500 drop-shadow"
                />
                <div
                  :class="
                    cn(
                      'flex items-center justify-center rounded-full bg-gradient-to-b font-bold ring-4',
                      r.rank === 1 ? 'size-20 text-2xl' : 'size-16 text-xl',
                      tier(r.rank).bg,
                      tier(r.rank).ring,
                      r.isMe && 'outline-2 outline-offset-4 outline-primary',
                    )
                  "
                >
                  {{ r.nickname.slice(0, 1) }}
                </div>
              </div>
              <div class="max-w-full truncate text-sm font-semibold">
                {{ r.nickname }}<span v-if="r.isMe" class="ml-1 text-xs text-primary">(나)</span>
              </div>
              <div class="text-xs text-muted-foreground tabular-nums">{{ r.xp.toLocaleString() }} XP · {{ r.solved.toLocaleString() }}문제</div>
              <div
                :class="
                  cn(
                    'mt-2 flex w-full items-start justify-center rounded-t-xl bg-gradient-to-b pt-2 font-bold',
                    tier(r.rank).bg,
                    tier(r.rank).height,
                    tier(r.rank).text,
                  )
                "
              >
                <component :is="tier(r.rank).icon" class="mr-1 size-4" /> {{ r.rank }}위
              </div>
            </template>
            <!-- 빈 시상대 자리 -->
            <template v-else>
              <div
                :class="
                  cn(
                    'mb-2 flex items-center justify-center rounded-full border-2 border-dashed text-xl font-bold text-muted-foreground/50',
                    i === 1 ? 'size-20' : 'size-16',
                  )
                "
              >
                ?
              </div>
              <div class="text-sm text-muted-foreground">빈 자리</div>
              <div class="text-xs text-muted-foreground/70">&nbsp;</div>
              <div
                :class="
                  cn(
                    'mt-2 flex w-full items-start justify-center rounded-t-xl border-2 border-b-0 border-dashed pt-2 font-bold text-muted-foreground/60',
                    tier([2, 1, 3][i]!).height,
                  )
                "
              >
                {{ [2, 1, 3][i] }}위
              </div>
            </template>
          </div>
        </div>

        <!-- 4위부터 -->
        <ol class="mt-6 space-y-1.5">
          <li
            v-for="r in top"
            :key="`${r.rank}-${r.nickname}`"
            :class="cn('flex items-center gap-3 rounded-xl border px-4 py-2.5', r.isMe && 'border-primary bg-primary/5')"
          >
            <span class="w-8 text-center font-semibold text-muted-foreground tabular-nums">{{ r.rank }}</span>
            <span class="w-24 truncate text-sm font-medium sm:w-32">
              {{ r.nickname }}<span v-if="r.isMe" class="ml-1 text-xs text-primary">(나)</span>
            </span>
            <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span class="block h-full rounded-full bg-primary/60" :style="{ width: `${(r.xp / maxXp) * 100}%` }" />
            </span>
            <span class="w-20 text-right text-sm tabular-nums">{{ r.xp.toLocaleString() }} <span class="text-xs text-muted-foreground">XP</span></span>
          </li>
          <!-- 빈 자리 (10위까지) -->
          <li
            v-for="(n, i) in emptySeats"
            :key="`seat-${n}`"
            class="flex items-center gap-3 rounded-xl border border-dashed px-4 py-2.5 text-muted-foreground"
          >
            <span class="w-8 text-center font-semibold tabular-nums opacity-60">{{ n }}</span>
            <span class="flex-1 truncate text-sm">
              <template v-if="i === 0 && !me">{{ auth.user ? '1문제만 풀어도 이 자리에 올라가요' : '로그인하고 1문제만 풀어도 이 자리예요' }}</template>
              <template v-else><span class="opacity-60">빈 자리</span></template>
            </span>
          </li>
        </ol>

        <!-- 내 순위가 50위 밖이면 -->
        <div v-if="meOutside" class="mt-3">
          <div class="py-1 text-center text-muted-foreground">⋮</div>
          <div class="flex items-center gap-3 rounded-xl border border-primary bg-primary/5 px-4 py-2.5">
            <span class="w-8 text-center font-semibold tabular-nums">{{ meOutside.rank }}</span>
            <span class="flex-1 text-sm font-medium">{{ meOutside.nickname }} <span class="text-xs text-primary">(나)</span></span>
            <span class="text-sm tabular-nums">{{ meOutside.xp.toLocaleString() }} <span class="text-xs text-muted-foreground">XP</span></span>
          </div>
        </div>

        <p v-if="auth.user && !me" class="mt-6 text-center text-sm text-muted-foreground">
          {{ period === 'week' ? '이번 주에 경험치를 얻으면 랭킹에 올라가요.' : '경험치를 얻으면 랭킹에 올라가요.' }}
        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 1등 왕관이 살짝 흔들린다 */
.crown { animation: crown-sway 2.4s ease-in-out infinite; transform-origin: 50% 100%; }
@keyframes crown-sway {
  0%, 100% { transform: rotate(-8deg); }
  50% { transform: rotate(8deg); }
}
@media (prefers-reduced-motion: reduce) { .crown { animation: none; } }
</style>
