<script setup lang="ts">
import { computed } from 'vue'
import { Info, Lightbulb, TriangleAlert } from '@lucide/vue'
import { renderInline } from '@/lib/markdown'
import type { LectureScene } from '@/types'

/** 시험 포인트·주의·참고 박스 */
const props = defineProps<{ scene: Extract<LectureScene, { type: 'callout' }> }>()

const TONE = {
  tip: { icon: Lightbulb, label: '시험 포인트', cls: 'border-amber-400/60 bg-amber-400/10 text-amber-600 dark:text-amber-400' },
  info: { icon: Info, label: '참고', cls: 'border-primary/50 bg-primary/10 text-primary' },
  warning: { icon: TriangleAlert, label: '주의', cls: 'border-destructive/50 bg-destructive/10 text-destructive' },
} as const
const tone = computed(() => TONE[props.scene.tone])
</script>

<template>
  <div class="flex h-full flex-col justify-center">
    <div :class="['rounded-2xl border-2 p-6 sm:p-8', tone.cls]">
      <div class="mb-3 flex items-center gap-2 text-sm font-bold">
        <component :is="tone.icon" class="size-5" /> {{ scene.title ?? tone.label }}
      </div>
      <p class="lecture-inline text-xl leading-9 text-foreground" v-html="renderInline(scene.text)" />
    </div>
  </div>
</template>
