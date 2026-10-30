<script setup lang="ts">
import { lectureIcon } from '@/lib/lectureIcons'
import { renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/** 아이콘 카드 그리드. 대본에 맞춰 한 장씩 나타나고, 지금 말하는 카드가 떠오른다 */
defineProps<{ scene: Extract<LectureScene, { type: 'cards' }>; focus: number[]; revealed: number }>()

const TONE = {
  good: 'bg-success/15 text-success',
  bad: 'bg-destructive/15 text-destructive',
  warn: 'bg-amber-400/20 text-amber-600 dark:text-amber-400',
} as const
</script>

<template>
  <div class="flex flex-col items-center">
    <h3 v-if="scene.title" class="mb-5 text-center text-2xl font-bold sm:text-3xl">{{ scene.title }}</h3>
    <div :class="cn('grid w-full gap-3 sm:gap-4', scene.cols === 3 ? 'grid-cols-3' : 'grid-cols-2')">
      <div
        v-for="(item, i) in scene.items"
        :key="i"
        :class="
          cn(
            'flex flex-col items-center rounded-2xl border-2 bg-card px-3 py-5 text-center transition-all duration-500',
            i < revealed ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
            focus.includes(i) ? 'scale-[1.04] border-primary shadow-lg shadow-primary/15' : 'border-transparent shadow-sm',
          )
        "
      >
        <span
          :class="
            cn(
              'mb-3 flex size-14 items-center justify-center rounded-2xl transition-colors',
              item.tone ? TONE[item.tone] : focus.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
            )
          "
        >
          <component :is="lectureIcon(item.icon)" v-if="item.icon" class="size-7" />
          <span v-else class="text-xl font-bold">{{ i + 1 }}</span>
        </span>
        <div class="lecture-inline text-lg leading-snug font-bold" v-html="renderInline(item.title)" />
        <div v-if="item.desc" class="lecture-inline mt-1 text-sm leading-snug text-muted-foreground" v-html="renderInline(item.desc)" />
      </div>
    </div>
  </div>
</template>
