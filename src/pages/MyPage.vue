<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bookmark, Dices, Check, ChevronRight, Crown, Gamepad2, LogIn, TerminalSquare, LogOut, Pencil, ShieldCheck, Trophy, X } from '@lucide/vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import TheoryProgress from '@/components/theory/TheoryProgress.vue'
import ExamPlanCard from '@/components/home/ExamPlanCard.vue'
import HabitCard from '@/components/me/HabitCard.vue'
import ReminderCard from '@/components/me/ReminderCard.vue'
import SkillCard from '@/components/me/SkillCard.vue'
import { reminderSupported } from '@/lib/reminder'
import { subjectNo, theoryDocs } from '@/lib/content'
import { examKindOf } from '@/lib/exams'
import { cn } from '@/lib/utils'
import { checkNickname, getMyProfile, setNickname, type MyProfile } from '@/services/profileRepository'
import { loadLeaderboard, type RankingPeriod } from '@/services/rankingRepository'
import { useAuthStore } from '@/stores/auth'
import { useBookmarksStore } from '@/stores/bookmarks'
import { CERTS, useCertStore, type Cert } from '@/stores/cert'
import { useProgressStore } from '@/stores/progress'
import { useTheoryStore } from '@/stores/theory'
import { useWrongNotesStore } from '@/stores/wrongNotes'

document.title = '마이페이지 · Pass SQLD/SQLP'
const auth = useAuthStore()
const certStore = useCertStore()
const progress = useProgressStore()
const wrongNotes = useWrongNotesStore()
const bookmarks = useBookmarksStore()
const theory = useTheoryStore()

// ── 프로필 · 닉네임 ──
const profile = ref<MyProfile>()
const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const nickError = ref('')
const saved = ref(false)

// ── 랭킹 요약 (내 순위만) ──
const myRank = ref<Partial<Record<RankingPeriod, { rank: number; xp: number; solved: number }>>>({})

watch(
  () => auth.user?.id,
  async (id) => {
    profile.value = undefined
    myRank.value = {}
    if (!id) return
    getMyProfile()
      .then((p) => (profile.value = p))
      .catch((e) => console.error('[프로필 불러오기 실패]', e))
    for (const period of ['week', 'all'] as const) {
      loadLeaderboard(period, 1)
        .then((rows) => {
          const me = rows.find((r) => r.isMe)
          myRank.value[period] = me ? { rank: me.rank, xp: me.xp, solved: me.solved } : undefined
        })
        .catch((e) => console.error('[랭킹 불러오기 실패]', e))
    }
  },
  { immediate: true },
)

function startEdit() {
  draft.value = profile.value?.custom ? profile.value.nickname : ''
  nickError.value = ''
  saved.value = false
  editing.value = true
}

const draftError = computed(() => (draft.value ? checkNickname(draft.value) : undefined))

async function saveNickname() {
  const problem = checkNickname(draft.value)
  if (problem) return (nickError.value = problem)
  saving.value = true
  nickError.value = ''
  try {
    const nickname = await setNickname(draft.value)
    profile.value = { nickname, custom: true }
    editing.value = false
    saved.value = true
  } catch (e) {
    nickError.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

// ── 자격증별 학습 현황 (이 기기·계정에 저장된 기록 기준) ──
const ownedBy = (cert: Cert, examId: string) => (examKindOf(examId) === 'sqlp') === (cert === 'sqlp')

function statsFor(cert: Cert) {
  const records = Object.values(progress.records).filter((r) => ownedBy(cert, r.examId))
  const correct = records.filter((r) => r.correct).length
  const docs = theoryDocs.filter((d) => CERTS[cert].subjects.includes(subjectNo(d)))
  return {
    solved: records.length,
    attempts: records.reduce((n, r) => n + r.attempts, 0),
    accuracy: records.length ? Math.round((correct / records.length) * 100) : undefined,
    wrong: wrongNotes.list.filter((n) => !n.resolved && ownedBy(cert, n.examId)).length,
    bookmarks: bookmarks.list.filter((b) => ownedBy(cert, b.examId)).length,
    theory: theory.statsOf(docs),
  }
}
const certStats = computed(() => (['sqld', 'sqlp'] as const).map((c) => ({ cert: c, label: CERTS[c].label, ...statsFor(c) })))

const links = computed(() => [
  { to: '/random', label: '랜덤 문제', icon: Dices, count: 0 },
  { to: '/games', label: '미니게임', icon: Gamepad2, count: 0 },
  { to: '/sql', label: 'SQL 실습장', icon: TerminalSquare, count: 0 },
  { to: '/audit', label: '문제 검수 · 오류 제보', icon: ShieldCheck, count: 0 },
  { to: '/bookmarks', label: '북마크', icon: Bookmark, count: certStore.bookmarks.length },
  { to: '/ranking', label: '랭킹', icon: Trophy, count: 0 },
])

const joined = computed(() => (auth.user?.createdAt ? new Date(auth.user.createdAt).toLocaleDateString('ko-KR') : undefined))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="text-2xl font-bold">마이페이지</h1>

    <!-- 비로그인: 기록은 이 기기에만 있다는 걸 먼저 알린다 -->
    <div v-if="!auth.user" class="mt-4 flex items-center gap-3 rounded-2xl border border-dashed p-4">
      <p class="min-w-0 flex-1 text-sm break-keep">지금 기록은 이 기기에만 있어요. 로그인하면 계정에 저장되고 랭킹에도 올라가요.</p>
      <Button size="sm" class="shrink-0" :disabled="!auth.isAvailable" @click="auth.signInWithGoogle"><LogIn class="size-4" /> 로그인</Button>
    </div>

    <!-- 학습 습관 · 알림 · 실력 (로그인과 상관없이 이 기기·계정의 기록으로) -->
    <div class="mt-4 space-y-4">
      <ExamPlanCard />
      <HabitCard />
      <ReminderCard v-if="reminderSupported" />
      <SkillCard />
    </div>

    <!-- 바로가기 (휴대폰 하단 탭에 없는 메뉴) -->
    <nav class="mt-6 grid gap-2 sm:grid-cols-2" aria-label="바로가기">
      <RouterLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors hover:border-primary"
      >
        <component :is="l.icon" class="size-5 text-primary" />
        <span class="flex-1 font-medium">{{ l.label }}</span>
        <span v-if="l.count" class="text-sm text-muted-foreground tabular-nums">{{ l.count }}</span>
        <ChevronRight class="size-4 text-muted-foreground" />
      </RouterLink>
    </nav>

    <template v-if="auth.user">
      <!-- 프로필 -->
      <section class="mt-6 rounded-2xl border p-5 sm:p-6">
        <div class="flex items-center gap-4">
          <Avatar class="size-16">
            <AvatarImage v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" :alt="auth.user.name" referrerpolicy="no-referrer" />
            <AvatarFallback class="text-xl">{{ auth.user.name.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0">
            <div class="truncate text-lg font-semibold">{{ auth.user.name }}</div>
            <div class="truncate text-sm text-muted-foreground">{{ auth.user.email }}</div>
            <div v-if="joined" class="text-xs text-muted-foreground">가입 {{ joined }}</div>
          </div>
        </div>

        <!-- 닉네임 -->
        <div class="mt-5 rounded-xl bg-muted/50 p-4">
          <div class="flex items-center gap-2 text-sm font-semibold">
            닉네임 <span class="font-normal text-muted-foreground">· 랭킹에 보이는 이름</span>
          </div>

          <div v-if="!editing" class="mt-2 flex flex-wrap items-center gap-2">
            <span class="text-lg font-bold">{{ profile?.nickname ?? '…' }}</span>
            <span v-if="profile && !profile.custom" class="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
              Google 이름
            </span>
            <span v-if="saved" class="inline-flex items-center gap-1 text-xs text-success"><Check class="size-3.5" /> 저장했어요</span>
            <Button variant="outline" size="sm" class="ml-auto" :disabled="!profile && !auth.isAvailable" @click="startEdit">
              <Pencil class="size-4" /> {{ profile?.custom ? '변경' : '닉네임 정하기' }}
            </Button>
          </div>

          <form v-else class="mt-2" @submit.prevent="saveNickname">
            <div class="flex gap-2">
              <Input v-model="draft" maxlength="12" placeholder="2~12자 (한글·영문·숫자·밑줄)" class="bg-background" autofocus />
              <Button type="submit" :disabled="saving || !draft.trim() || !!draftError"><Check class="size-4" /> 저장</Button>
              <Button type="button" variant="ghost" size="icon" aria-label="취소" @click="editing = false"><X class="size-4" /></Button>
            </div>
            <p :class="cn('mt-1.5 text-xs', nickError || draftError ? 'text-destructive' : 'text-muted-foreground')">
              {{ nickError || draftError || '다른 사람과 겹칠 수 없고, 언제든 다시 바꿀 수 있어요.' }}
            </p>
          </form>
        </div>
      </section>

      <!-- 랭킹 요약 -->
      <section class="mt-4 grid gap-3 sm:grid-cols-2">
        <RouterLink
          v-for="p in (['week', 'all'] as const)"
          :key="p"
          to="/ranking"
          class="flex items-center gap-3 rounded-2xl border p-4 transition-colors hover:border-primary"
        >
          <Crown v-if="myRank[p]?.rank === 1" class="size-8 fill-amber-400 text-amber-500" />
          <Trophy v-else class="size-8 text-amber-500" />
          <div>
            <div class="text-sm text-muted-foreground">{{ p === 'week' ? '이번 주' : '전체' }} 랭킹</div>
            <div v-if="myRank[p]" class="text-xl font-bold">
              {{ myRank[p]!.rank }}위 <span class="text-sm font-normal text-muted-foreground">· {{ myRank[p]!.xp.toLocaleString() }} XP</span>
            </div>
            <div v-else class="text-sm">아직 순위가 없어요</div>
          </div>
        </RouterLink>
      </section>

      <!-- 자격증별 학습 현황 -->
      <section class="mt-8">
        <h2 class="mb-3 text-lg font-bold">학습 현황</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="s in certStats"
            :key="s.cert"
            :class="cn('rounded-2xl border p-5', s.cert === certStore.cert && 'border-primary/50 bg-primary/5')"
          >
            <div class="mb-3 flex items-center gap-2">
              <span class="text-lg font-bold">{{ s.label }}</span>
              <span v-if="s.cert === certStore.cert" class="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                공부 중
              </span>
            </div>
            <dl class="grid grid-cols-2 gap-y-3 text-sm">
              <div><dt class="text-muted-foreground">푼 문항</dt><dd class="text-lg font-semibold tabular-nums">{{ s.solved }}</dd></div>
              <div>
                <dt class="text-muted-foreground">정답률</dt>
                <dd class="text-lg font-semibold tabular-nums">{{ s.accuracy === undefined ? '-' : `${s.accuracy}%` }}</dd>
              </div>
              <div><dt class="text-muted-foreground">풀이 횟수</dt><dd class="text-lg font-semibold tabular-nums">{{ s.attempts }}</dd></div>
              <div>
                <dt class="text-muted-foreground">미해결 오답 · 북마크</dt>
                <dd class="text-lg font-semibold tabular-nums">{{ s.wrong }} · {{ s.bookmarks }}</dd>
              </div>
            </dl>
            <div class="mt-4 border-t pt-3">
              <div class="mb-1.5 text-xs text-muted-foreground">이론 학습</div>
              <TheoryProgress :stats="s.theory" compact />
            </div>
          </div>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">정답률은 문항마다 마지막으로 고른 답 기준이에요.</p>
      </section>

      <div class="mt-8 flex justify-end">
        <Button variant="outline" @click="auth.signOut()"><LogOut class="size-4" /> 로그아웃</Button>
      </div>
    </template>
  </div>
</template>
