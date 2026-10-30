<script setup lang="ts">
import { renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/** 항목을 대본에 맞춰 하나씩 펼친다. 방금 펼친 항목을 강조 */
defineProps<{ scene: Extract<LectureScene, { type: 'points' }>; focus: number[]; revealed: number }>()
</script>

<template>
  <div class="flex h-full flex-col justify-center">
    <h3 v-if="scene.title" class="mb-6 text-2xl font-bold">{{ scene.title }}</h3>
    <!-- 아직 말하지 않은 항목도 자리는 잡아 둔다 (펼쳐질 때 화면 크기가 흔들리지 않게) -->
    <ul class="space-y-3">
      <li
        v-for="(item, i) in scene.items"
        :key="i"
        :class="
          cn(
            'flex items-start gap-3 rounded-xl border px-5 py-4 text-lg leading-7 transition-all duration-500',
            i < revealed ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            focus.includes(i) ? 'border-primary bg-primary/10' : 'bg-card',
          )
        "
      >
        <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {{ i + 1 }}
        </span>
        <span class="lecture-inline" v-html="renderInline(item)" />
      </li>
    </ul>
  </div>
</template>
