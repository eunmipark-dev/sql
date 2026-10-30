<script setup lang="ts">
import { ref } from 'vue'
import { Check, ClipboardCopy } from '@lucide/vue'
import { copyText, questionToText } from '@/lib/questionText'
import type { Question } from '@/types'

/** 문제 전체(본문·표·SQL·보기, 공개 뒤엔 정답·해설)를 AI 에 붙여 넣기 좋게 복사 */
const props = defineProps<{ question: Question; selected?: number | null; revealed?: boolean }>()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
async function copy() {
  if (!(await copyText(questionToText(props.question, props)))) return
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <button
    type="button"
    :aria-label="copied ? '복사됨' : 'AI에 물어보기용으로 문제 복사'"
    :title="copied ? '복사됨' : '문제 복사 (AI에 붙여 넣기)'"
    class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    @click="copy"
  >
    <Check v-if="copied" class="size-5 text-success" />
    <ClipboardCopy v-else class="size-5" />
    <span class="sr-only" aria-live="polite">{{ copied ? '복사됨' : '' }}</span>
  </button>
</template>
