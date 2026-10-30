<script setup lang="ts">
import { computed } from 'vue'
import { Bookmark } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { useBookmarksStore } from '@/stores/bookmarks'

/** 문제 북마크 토글 (출처 시험 + 문항 번호) */
const props = defineProps<{ examId: string; questionId: number }>()

const bookmarks = useBookmarksStore()
const on = computed(() => bookmarks.has(props.examId, props.questionId))
</script>

<template>
  <button
    type="button"
    :aria-label="on ? '북마크 해제' : '북마크'"
    :title="on ? '북마크 해제' : '북마크'"
    :aria-pressed="on"
    class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    @click="bookmarks.toggle(examId, questionId)"
  >
    <Bookmark :class="cn('size-5', on && 'fill-primary text-primary')" />
  </button>
</template>
