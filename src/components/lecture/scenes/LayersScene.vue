<script setup lang="ts">
import { computed } from 'vue'
import { lectureIcon } from '@/lib/lectureIcons'
import { renderInline } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/**
 * 위에서 아래로 쌓인 단계 (예: 개념 → 논리 → 물리, 외부 → 개념 → 내부).
 * 아래로 갈수록 넓어지는 계단 모양이고, 왼쪽 화살표에 양 끝의 의미(axis)를 적는다
 */
const props = defineProps<{ scene: Extract<LectureScene, { type: 'layers' }>; focus: number[]; revealed: number }>()

const n = computed(() => props.scene.layers.length)
/** 위 단계일수록 좁게 (계단 모양) */
const widthOf = (i: number) => `${72 + (28 * i) / Math.max(n.value - 1, 1)}%`
</script>

<template>
  <div class="flex flex-col items-center">
    <h3 v-if="scene.title" class="mb-5 text-center text-2xl font-bold sm:text-3xl">{{ scene.title }}</h3>
    <div class="flex w-full gap-3">
      <!-- 축: 위 ↔ 아래 의미 -->
      <div v-if="scene.axis" class="flex w-6 shrink-0 flex-col items-center text-[11px] font-semibold text-muted-foreground">
        <span class="[writing-mode:vertical-rl]">{{ scene.axis.top }}</span>
        <span class="my-1 w-0.5 flex-1 rounded-full bg-gradient-to-b from-primary to-primary/20" />
        <span class="[writing-mode:vertical-rl]">{{ scene.axis.bottom }}</span>
      </div>
      <div class="flex flex-1 flex-col items-center gap-2.5">
        <div
          v-for="(layer, i) in scene.layers"
          :key="i"
          :style="{ width: widthOf(i) }"
          :class="
            cn(
              'flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all duration-500',
              i < revealed ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0',
              focus.includes(i)
                ? 'scale-[1.03] border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'border-primary/20 bg-primary/5',
            )
          "
        >
          <component :is="lectureIcon(layer.icon)" v-if="layer.icon" class="size-6 shrink-0" />
          <div class="min-w-0">
            <div class="lecture-inline text-lg leading-snug font-bold" v-html="renderInline(layer.title)" />
            <div
              v-if="layer.desc"
              :class="cn('lecture-inline text-sm leading-snug', focus.includes(i) ? 'text-primary-foreground/85' : 'text-muted-foreground')"
              v-html="renderInline(layer.desc)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
