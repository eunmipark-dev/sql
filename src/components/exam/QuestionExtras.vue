<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { MessageSquare, NotebookPen } from '@lucide/vue'
import QuestionComments from '@/components/exam/QuestionComments.vue'
import QuestionMemo from '@/components/exam/QuestionMemo.vue'
import { cn } from '@/lib/utils'
import { commentKey, countComments } from '@/services/commentRepository'
import { useAuthStore } from '@/stores/auth'
import { useQuestionNotesStore } from '@/stores/questionNotes'

/** 문제 아래: 내 메모 · 공유 코멘트 (접었다 폈다). 문제를 푼 뒤나 오답노트·북마크에서만 보인다 */
const props = defineProps<{ examId: string; questionId: number }>()

const auth = useAuthStore()
const notes = useQuestionNotesStore()
const hasMemo = computed(() => !!notes.memoOf(props.examId, props.questionId))

const open = ref<'memo' | 'comments' | undefined>(hasMemo.value ? 'memo' : undefined)
const toggle = (panel: 'memo' | 'comments') => (open.value = open.value === panel ? undefined : panel)

// 코멘트 수는 화면에 보일 때 한 번만 묻는다 (오답노트처럼 문제가 많은 화면에서 요청을 줄이려고)
const root = ref<HTMLElement>()
const count = ref<number>()
let asked = ''
function askCount() {
  const key = commentKey(props.examId, props.questionId)
  if (!auth.user || asked === key) return
  asked = key
  countComments(key)
    .then((n) => (count.value = n))
    .catch(() => {})
}
useIntersectionObserver(root, ([entry]) => entry?.isIntersecting && askCount())
watch(
  () => [props.examId, props.questionId, auth.user?.id],
  () => {
    count.value = undefined
    asked = ''
    open.value = hasMemo.value ? 'memo' : undefined
    askCount()
  },
)
</script>

<template>
  <div ref="root" class="mt-4 border-t pt-3">
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        :aria-expanded="open === 'memo'"
        :class="
          cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
            open === 'memo' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
          )
        "
        @click="toggle('memo')"
      >
        <NotebookPen class="size-3.5" /> 내 메모
        <span v-if="hasMemo" class="size-1.5 rounded-full bg-primary" aria-label="메모 있음" />
      </button>
      <button
        type="button"
        :aria-expanded="open === 'comments'"
        :class="
          cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
            open === 'comments' ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
          )
        "
        @click="toggle('comments')"
      >
        <MessageSquare class="size-3.5" /> 코멘트<span v-if="count" class="tabular-nums">{{ count }}</span>
      </button>
    </div>

    <div v-if="open" class="mt-3 rounded-lg bg-muted/40 p-3">
      <QuestionMemo v-if="open === 'memo'" :exam-id="examId" :question-id="questionId" />
      <QuestionComments v-else :exam-id="examId" :question-id="questionId" @count="(n) => (count = n)" />
    </div>
  </div>
</template>
