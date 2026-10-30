<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { BookOpen, CirclePlay, NotebookPen, Sparkles, UserRound } from '@lucide/vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useCertStore } from '@/stores/cert'

/**
 * 휴대폰 화면 하단 탭 (md 미만). 자주 쓰는 5개만 두고, 북마크·랭킹은 마이페이지에서 들어간다.
 * 강의 재생·문제 풀이처럼 화면 전체를 쓰는 곳에서는 숨긴다 (App.vue 의 hideTabBar)
 */
const route = useRoute()
const auth = useAuthStore()
const certStore = useCertStore()

const tabs = computed(() => [
  { to: '/theory', label: '이론', icon: BookOpen, match: (p: string) => p.startsWith('/theory') && route.name !== 'lecture' },
  { to: '/lectures', label: '강의', icon: CirclePlay, match: (p: string) => p.startsWith('/lectures') || route.name === 'lecture' },
  { to: certStore.examRoute, label: '모의고사', icon: Sparkles, match: (p: string) => /^\/(mock|sqlp|exams|random)(\/|$)/.test(p) },
  { to: '/wrong-notes', label: '오답노트', icon: NotebookPen, match: (p: string) => /^\/(wrong-notes|review)(\/|$)/.test(p) },
  { to: '/me', label: '마이', icon: UserRound, match: (p: string) => /^\/(me|bookmarks|ranking)(\/|$)/.test(p) },
])
</script>

<template>
  <nav
    class="fixed right-(--inset-right) bottom-0 left-(--inset-left) z-40 border-t bg-background/95 pb-(--inset-bottom) backdrop-blur md:hidden"
    aria-label="주요 메뉴"
  >
    <ul class="grid grid-cols-5">
      <li v-for="t in tabs" :key="t.label">
        <RouterLink
          :to="t.to"
          :aria-current="t.match(route.path) ? 'page' : undefined"
          :class="
            cn(
              'relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
              t.match(route.path) ? 'font-semibold text-primary' : 'text-muted-foreground',
            )
          "
        >
          <!-- 마이: 로그인하면 프로필 사진 -->
          <Avatar v-if="t.to === '/me' && auth.user" :class="cn('size-6', t.match(route.path) && 'ring-2 ring-primary')">
            <AvatarImage v-if="auth.user.avatarUrl" :src="auth.user.avatarUrl" :alt="auth.user.name" referrerpolicy="no-referrer" />
            <AvatarFallback class="text-[10px]">{{ auth.user.name.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <component :is="t.icon" v-else class="size-6" :stroke-width="t.match(route.path) ? 2.4 : 1.8" />
          {{ t.label }}
          <span
            v-if="t.to === '/wrong-notes' && certStore.dueNotes.length"
            class="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-semibold text-white"
          >
            {{ certStore.dueNotes.length > 99 ? '99+' : certStore.dueNotes.length }}
          </span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
