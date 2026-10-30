<script setup lang="ts">
import { Check, CircleHelp, X } from '@lucide/vue'
import { renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/** 확인 퀴즈. 보기까지 읽고 답을 기다리다 8초가 지나면 정답을 자동으로 공개하고 해설을 읽는다 (useLecturePlayer) */
const props = defineProps<{
  scene: Extract<LectureScene, { type: 'quiz' }>
  chosen?: number
  /** 시간이 지나 정답을 자동으로 공개함 */
  auto?: boolean
  /** 자동 공개까지 남은 초 */
  countdown?: number
}>()
const emit = defineEmits<{ answer: [choice: number] }>()

const circled = ['①', '②', '③', '④', '⑤']

function choiceClass(n: number) {
  if (props.chosen === undefined) return 'hover:border-primary hover:bg-accent'
  if (n === props.scene.answer) return 'border-success bg-success/10'
  if (n === props.chosen) return 'border-destructive bg-destructive/10'
  return 'opacity-50'
}
</script>

<template>
  <div class="flex h-full flex-col justify-center">
    <div class="mb-2 flex items-center gap-1.5 text-sm font-bold text-primary">
      <CircleHelp class="size-4" /> 확인 퀴즈
    </div>
    <p class="lecture-inline mb-5 text-xl leading-8 font-semibold" v-html="renderInline(scene.question)" />
    <div class="grid gap-2.5 sm:grid-cols-2">
      <button
        v-for="(c, i) in scene.choices"
        :key="i"
        type="button"
        :disabled="chosen !== undefined"
        :class="cn('flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-base transition-colors', choiceClass(i + 1))"
        @click="emit('answer', i + 1)"
      >
        <span class="font-semibold">{{ circled[i] }}</span>
        <span class="lecture-inline flex-1" v-html="renderInline(c)" />
        <Check v-if="chosen !== undefined && i + 1 === scene.answer" class="size-5 text-success" />
        <X v-else-if="chosen === i + 1" class="size-5 text-destructive" />
      </button>
    </div>
    <!-- 남은 시간: 줄어드는 막대 -->
    <div v-if="chosen === undefined && countdown" class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
      <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span class="block h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear" :style="{ width: `${(countdown / 5) * 100}%` }" />
      </span>
      <span class="tabular-nums">{{ countdown }}초 뒤 정답 공개</span>
    </div>
    <p v-if="auto" class="mt-4 text-sm font-medium text-primary">시간이 지나 정답을 보여드렸어요.</p>
    <p v-if="chosen !== undefined" :class="cn('lecture-inline rounded-lg bg-muted/60 p-4 text-base leading-7', auto ? 'mt-2' : 'mt-4')" v-html="renderInline(scene.explanation)" />
  </div>
</template>
