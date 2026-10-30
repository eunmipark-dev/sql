<script setup lang="ts">
import { ArrowDown, ArrowRight } from '@lucide/vue'
import { lectureIcon } from '@/lib/lectureIcons'
import { renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/**
 * 화살표로 이어진 흐름. 대본에 맞춰 단계가 차례로 나타나고 화살표가 이어진다.
 * 'right' 는 넓은 화면에서만 가로, 휴대폰에서는 세로로 바뀐다 (한 화면에 들어오게)
 */
defineProps<{ scene: Extract<LectureScene, { type: 'flow' }>; focus: number[]; revealed: number }>()
</script>

<template>
  <div class="flex flex-col items-center">
    <h3 v-if="scene.title" class="mb-5 text-center text-2xl font-bold sm:text-3xl">{{ scene.title }}</h3>
    <div :class="cn('flex w-full items-center', scene.direction === 'right' ? 'flex-col sm:flex-row sm:items-stretch' : 'flex-col')">
      <template v-for="(node, i) in scene.nodes" :key="i">
        <!-- 화살표 (앞 단계와 이어짐) -->
        <div
          v-if="i > 0"
          :class="
            cn(
              'flex shrink-0 items-center justify-center gap-1 text-primary transition-all duration-500',
              scene.direction === 'right' ? 'flex-col py-1 sm:px-1 sm:py-0' : 'flex-col py-1',
              i < revealed ? 'opacity-100' : 'opacity-0',
            )
          "
        >
          <span v-if="scene.edges?.[i - 1]" class="text-xs font-semibold whitespace-nowrap">{{ scene.edges[i - 1] }}</span>
          <ArrowDown :class="cn('size-6', scene.direction === 'right' && 'sm:hidden')" />
          <ArrowRight v-if="scene.direction === 'right'" class="hidden size-6 sm:block" />
        </div>
        <div
          :class="
            cn(
              'flex w-full max-w-sm items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 transition-all duration-500',
              scene.direction === 'right' && 'sm:max-w-none sm:flex-1 sm:flex-col sm:justify-center sm:text-center',
              i < revealed ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
              focus.includes(i) ? 'scale-[1.03] border-primary shadow-lg shadow-primary/15' : 'border-transparent shadow-sm',
            )
          "
        >
          <span
            :class="
              cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors',
                focus.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
              )
            "
          >
            <component :is="lectureIcon(node.icon)" v-if="node.icon" class="size-6" />
            <span v-else class="font-bold">{{ i + 1 }}</span>
          </span>
          <div class="min-w-0">
            <div class="lecture-inline text-lg leading-snug font-bold" v-html="renderInline(node.title)" />
            <div v-if="node.desc" class="lecture-inline text-sm leading-snug text-muted-foreground" v-html="renderInline(node.desc)" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
