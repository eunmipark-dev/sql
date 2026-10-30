<script setup lang="ts">
import AppLogo from '@/components/brand/AppLogo.vue'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDark, useToggle } from '@vueuse/core'
import { Cloud, Loader2, LogIn, LogOut, Moon, Search, Sun, UserRound } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSearchDialog } from '@/composables/useSearchDialog'
import { syncStatusBar } from '@/lib/native'
import { useAuthStore } from '@/stores/auth'
import { CERTS, useCertStore, type Cert } from '@/stores/cert'
import { KIND_ROUTE } from '@/lib/exams'
import { findDoc } from '@/lib/content'

const isDark = useDark()
const toggleDark = useToggle(isDark)
// 앱: 상태바 글자색을 테마에 맞춘다
watch(isDark, syncStatusBar, { immediate: true })
const { show } = useSearchDialog()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const certStore = useCertStore()
// 강의 재생 화면(/theory/:slug/lecture)은 '이론'이 아니라 '강의' 메뉴로 표시
const isActive = (to: string) => {
  if (route.name === 'lecture') return to === '/lectures'
  return route.path === to || route.path.startsWith(`${to}/`)
}

// 모의고사 메뉴는 선택한 자격증의 것만
const nav = computed(() => [
  { to: '/theory', label: '이론' },
  { to: '/lectures', label: '강의' },
  { to: certStore.examRoute, label: certStore.info.examLabel },
  { to: '/random', label: '랜덤 문제' },
  { to: '/games', label: '미니게임' },
  { to: '/wrong-notes', label: '오답노트' },
  { to: '/bookmarks', label: '북마크' },
  { to: '/ranking', label: '랭킹' },
])

/** 자격증을 바꾸면, 지금 화면이 그 자격증에 없는 화면일 때 맞는 화면으로 옮긴다 */
function selectCert(c: Cert) {
  if (certStore.cert === c) return
  certStore.cert = c
  const path = route.path
  if (/^\/(mock|sqlp|exams)(\/|$)/.test(path)) {
    // 모의고사 목록·회차·분류별 → 새 자격증의 모의고사 목록 (보기 방식은 유지)
    void router.push({ path: KIND_ROUTE[CERTS[c].examKind], query: route.query.view ? { view: route.query.view } : {} })
  } else if (route.name === 'theory' || route.name === 'lecture') {
    const slug = String(route.params.slug)
    if (findDoc(slug) && !certStore.includes(slug)) void router.push('/theory')
  }
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b bg-background/80 pt-(--inset-top) backdrop-blur">
    <div class="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
      <RouterLink to="/" class="mr-1 flex items-center sm:mr-2" aria-label="SQL 자격증 홈">
        <AppLogo />
        <span class="ml-2 hidden text-[17px] whitespace-nowrap tracking-tight sm:inline">
          <b class="font-extrabold">SQL</b><span class="ml-1 font-medium">자격증</span>
        </span>
      </RouterLink>

      <!-- 공부 중인 자격증: 이론 범위와 모의고사가 바뀐다 -->
      <div class="flex shrink-0 rounded-lg border p-0.5 text-xs font-semibold" role="radiogroup" aria-label="자격증 선택">
        <button
          v-for="(info, c) in CERTS"
          :key="c"
          type="button"
          role="radio"
          :aria-checked="certStore.cert === c"
          :class="[
            'rounded-md px-2 py-1 transition-colors',
            certStore.cert === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          ]"
          @click="selectCert(c)"
        >
          {{ info.label }}
        </button>
      </div>

      <nav class="hidden min-w-0 items-center overflow-x-auto whitespace-nowrap text-sm [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          :class="isActive(item.to) && '!text-foreground font-semibold'"
        >
          <span :class="isActive(item.to) && 'hl'">{{ item.label }}</span>
          <Badge
            v-if="item.to === '/wrong-notes' && certStore.dueNotes.length"
            variant="destructive"
            class="ml-1 h-4 min-w-4 px-1 text-[10px]"
          >
            {{ certStore.dueNotes.length }}
          </Badge>
          <Badge
            v-if="item.to === '/bookmarks' && certStore.bookmarks.length"
            variant="secondary"
            class="ml-1 h-4 min-w-4 px-1 text-[10px]"
          >
            {{ certStore.bookmarks.length }}
          </Badge>
        </RouterLink>
      </nav>

      <div class="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm" class="hidden w-56 justify-start text-muted-foreground lg:flex" @click="show">
          <Search class="size-4" />
          이론 검색…
          <kbd class="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
        </Button>
        <Button variant="ghost" size="icon" class="lg:hidden" aria-label="검색" @click="show">
          <Search class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="테마 전환" @click="toggleDark()">
          <Sun v-if="isDark" class="size-4" />
          <Moon v-else class="size-4" />
        </Button>
        <!-- 세션 확인 중 -->
        <div v-if="!auth.ready" class="size-8 animate-pulse rounded-full bg-muted" />

        <!-- 로그인 상태 -->
        <DropdownMenu v-else-if="auth.user">
          <DropdownMenuTrigger as-child>
            <button type="button" class="relative rounded-full ring-offset-2 ring-offset-background hover:ring-2 hover:ring-primary/40">
              <Avatar class="size-8">
                <AvatarImage v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" :alt="auth.user.name" referrerpolicy="no-referrer" />
                <AvatarFallback class="text-xs">{{ auth.user.name.slice(0, 1) }}</AvatarFallback>
              </Avatar>
              <Loader2 v-if="auth.syncing" class="absolute -right-1 -bottom-1 size-3.5 animate-spin rounded-full bg-background text-primary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-60">
            <DropdownMenuLabel class="font-normal">
              <div class="truncate text-sm font-medium">{{ auth.user.name }}</div>
              <div class="truncate text-xs text-muted-foreground">{{ auth.user.email }}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div class="px-2 py-1.5 text-xs text-muted-foreground">
              <Cloud class="mr-1 inline size-3.5" />
              {{ auth.syncing ? '학습 기록 동기화 중…' : '학습 기록이 계정에 저장돼요' }}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem @select="router.push('/me')">
              <UserRound class="size-4" /> 마이페이지
            </DropdownMenuItem>
            <DropdownMenuItem @select="auth.signOut()">
              <LogOut class="size-4" /> 로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- 비로그인 -->
        <TooltipProvider v-else>
          <Tooltip>
            <TooltipTrigger as-child>
              <span tabindex="0">
                <Button size="sm" :disabled="!auth.isAvailable" @click="auth.signInWithGoogle">
                  <LogIn class="size-4" />
                  <span class="hidden sm:inline">Google 로그인</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {{ auth.isAvailable ? '로그인하면 학습 기록을 어느 기기에서든 이어볼 수 있어요.' : '로그인이 설정되지 않았어요. 지금은 이 브라우저에 저장돼요.' }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  </header>
</template>
