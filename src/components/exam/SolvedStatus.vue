<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleX, History } from '@lucide/vue'
import { noteKey } from '@/stores/wrongNotes'
import { useProgressStore } from '@/stores/progress'
import { cn } from '@/lib/utils'

/** 이 문항을 전에 풀었는지 (저장된 풀이 기록 기준). 안 푼 문제면 아무것도 보이지 않는다 */
const props = defineProps<{ examId: string; questionId: number }>()

const progress = useProgressStore()
const status = computed(() => progress.statusOf(props.examId, props.questionId))
const attempts = computed(() => progress.records[noteKey(props.examId, props.questionId)]?.attempts ?? 0)

const LABEL = { correct: '맞힘', wrong: '틀림', resolved: '틀렸지만 해결' } as const
</script>

<template>
  <span
    v-if="status !== 'new'"
    :class="
      cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        status === 'wrong' ? 'border-destructive/40 text-destructive' : 'border-success/40 text-success',
      )
    "
  >
    <CircleX v-if="status === 'wrong'" class="size-3.5" />
    <CircleCheck v-else class="size-3.5" />
    이미 푼 문제 · 최근 {{ LABEL[status] }}
    <span class="inline-flex items-center gap-0.5 text-muted-foreground">
      · <History class="size-3" /> {{ attempts }}번 풀이
    </span>
  </span>
</template>
