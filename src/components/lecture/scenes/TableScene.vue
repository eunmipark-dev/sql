<script setup lang="ts">
import { renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/** 결과표. 대본이 가리키는 행을 강조한다 */
defineProps<{ scene: Extract<LectureScene, { type: 'table' }>; focus: number[] }>()
</script>

<template>
  <div class="flex h-full flex-col justify-center">
    <h3 v-if="scene.title" class="mb-4 text-2xl font-bold">{{ scene.title }}</h3>
    <div class="overflow-x-auto rounded-xl border">
      <table class="w-full border-collapse text-sm sm:text-base">
        <thead>
          <tr class="bg-muted">
            <th v-for="c in scene.columns" :key="c" class="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{{ c }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in scene.rows"
            :key="i"
            :class="
              cn(
                'border-t transition-all duration-300',
                focus.includes(i) && 'bg-primary/15 font-semibold',
                focus.length && !focus.includes(i) && 'opacity-40',
              )
            "
          >
            <td v-for="(cell, j) in row" :key="j" class="lecture-inline px-4 py-2.5 whitespace-nowrap tabular-nums" v-html="renderInline(cell)" />
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="scene.caption" class="mt-3 text-sm text-muted-foreground">{{ scene.caption }}</p>
  </div>
</template>
