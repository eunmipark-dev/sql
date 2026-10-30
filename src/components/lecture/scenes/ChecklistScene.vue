<script setup lang="ts">
import { Check } from '@lucide/vue'
import { renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/** 요약 체크리스트: 항목은 처음부터 흐리게 보이고, 대본에 맞춰 하나씩 체크된다 */
defineProps<{ scene: Extract<LectureScene, { type: 'checklist' }>; focus: number[]; revealed: number }>()
</script>

<template>
  <div class="flex flex-col items-center">
    <h3 v-if="scene.title" class="mb-5 text-center text-2xl font-bold sm:text-3xl">{{ scene.title }}</h3>
    <ul class="w-full space-y-2.5">
      <li
        v-for="(item, i) in scene.items"
        :key="i"
        :class="
          cn(
            'flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all duration-500',
            i < revealed ? 'bg-card' : 'border-dashed opacity-40',
            focus.includes(i) ? 'border-primary shadow-md' : i < revealed ? 'border-transparent shadow-sm' : '',
          )
        "
      >
        <span
          :class="
            cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500',
              i < revealed ? 'scale-100 border-success bg-success text-white' : 'scale-90 border-muted-foreground/40',
            )
          "
        >
          <Check v-if="i < revealed" class="size-5" :stroke-width="3" />
        </span>
        <span class="lecture-inline text-lg leading-snug font-semibold" v-html="renderInline(item)" />
      </li>
    </ul>
  </div>
</template>
