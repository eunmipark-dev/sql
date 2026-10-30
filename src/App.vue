<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import AppHeader from '@/components/layout/AppHeader.vue'
import BottomTabBar from '@/components/layout/BottomTabBar.vue'
import SearchDialog from '@/components/SearchDialog.vue'
import { useSearchDialog } from '@/composables/useSearchDialog'
import { useWrongNotesStore } from '@/stores/wrongNotes'
import { useProgressStore } from '@/stores/progress'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useTheoryStore } from '@/stores/theory'
import { useQuestionNotesStore } from '@/stores/questionNotes'
import { useAuthStore } from '@/stores/auth'
import { useActivityStore } from '@/stores/activity'
import { setupReminders } from '@/lib/reminder'
import { useCertStore } from '@/stores/cert'
import { getMarkdown } from '@/lib/markdown'
import { loadExamIndex } from '@/lib/exams'

const { show } = useSearchDialog()
const route = useRoute()
const certStore = useCertStore()
/** 강의 재생·문제 풀이는 화면 전체를 쓰므로 하단 탭을 숨긴다 */
const hideTabBar = computed(() => ['lecture', 'exam', 'mock-exam', 'sqlp-exam'].includes(String(route.name)))
watch(
  () => route.fullPath,
  () => {
    const isDoc = route.name === 'theory' || route.name === 'lecture'
    certStore.followRoute(route.path, isDoc ? String(route.params.slug) : undefined)
  },
)

// Ctrl+K / Cmd+K 로 검색 열기
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    show()
  }
})

onMounted(async () => {
  getMarkdown() // 하이라이터 미리 로드
  loadExamIndex().catch(() => {}) // 회차 목록 (없어진 문제의 기록을 집계에서 빼는 데 사용)
  // 로그인 세션을 먼저 확인해 저장 위치(브라우저/서버)를 정한 뒤 학습 기록을 불러온다
  await useAuthStore().init()
  useWrongNotesStore().load()
  useProgressStore().load()
  useBookmarksStore().load()
  useTheoryStore().load()
  useQuestionNotesStore().load()
  useActivityStore().load()
  setupReminders() // 앱: 매일 학습 알림 예약
})
</script>

<template>
  <!-- 가로 화면에서 옆으로 간 시스템 버튼에 가리지 않게 좌우 여백 -->
  <div class="flex min-h-dvh flex-col pr-(--inset-right) pl-(--inset-left)">
    <AppHeader />
    <!-- 아래 여백: 휴대폰은 하단 탭 높이, 탭이 없는 화면은 시스템 버튼 높이 -->
    <main :class="['flex-1', hideTabBar ? 'pb-(--inset-bottom)' : 'pb-(--tabbar-h) md:pb-(--inset-bottom)']">
      <RouterView />
    </main>
    <BottomTabBar v-if="!hideTabBar" />
    <SearchDialog />
  </div>
</template>
