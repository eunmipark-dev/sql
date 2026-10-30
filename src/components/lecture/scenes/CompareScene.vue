<script setup lang="ts">
import { lectureIcon } from '@/lib/lectureIcons'
import { renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/** 두 개념 비교 (아이콘·색 강조 가능). focus 0 = 왼쪽, 1 = 오른쪽 */
defineProps<{ scene: Extract<LectureScene, { type: 'compare' }>; focus: number[] }>()

const TONE = {
  good: { box: 'border-success/50', icon: 'bg-success text-white', title: 'text-success' },
  bad: { box: 'border-destructive/40', icon: 'bg-destructive text-white', title: 'text-destructive' },
} as const
</script>

<template>
  <div class="flex flex-col items-center">
    <h3 v-if="scene.title" class="mb-5 text-center text-2xl font-bold sm:text-3xl">{{ scene.title }}</h3>
    <div class="grid w-full grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4">
      <template v-for="(side, i) in [scene.left, scene.right]" :key="i">
        <span v-if="i === 1" class="self-center rounded-full bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">VS</span>
        <div
          :class="
            cn(
              'flex flex-col items-center rounded-2xl border-2 bg-card p-4 text-center transition-all duration-500',
              side.tone ? TONE[side.tone].box : 'border-transparent',
              focus.includes(i) ? 'scale-[1.04] border-primary shadow-lg shadow-primary/15' : focus.length ? 'opacity-45' : 'shadow-sm',
            )
          "
        >
          <span
            v-if="side.icon"
            :class="cn('mb-3 flex size-14 items-center justify-center rounded-2xl', side.tone ? TONE[side.tone].icon : 'bg-primary/10 text-primary')"
          >
            <component :is="lectureIcon(side.icon)" class="size-7" />
          </span>
          <div :class="cn('mb-2 text-lg font-bold', side.tone ? TONE[side.tone].title : 'text-primary')">{{ side.title }}</div>
          <ul class="space-y-1.5 text-sm leading-snug sm:text-base">
            <li v-for="(item, k) in side.items" :key="k" class="lecture-inline" v-html="renderInline(item)" />
          </ul>
        </div>
      </template>
    </div>
  </div>
</template>
