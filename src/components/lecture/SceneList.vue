<script setup lang="ts">
import { computed } from 'vue'
import { CircleHelp } from '@lucide/vue'
import { minutesLabel, type LecturePart } from '@/lib/lectureParts'
import { cn } from '@/lib/utils'
import type { LectureScene } from '@/types'

/** 장면 목록: 파트 → 소단원별로 묶고, 누르면 그 장면으로 이동 (번호는 강의 전체 기준) */
const props = defineProps<{ scenes: LectureScene[]; current: number; parts?: LecturePart[] }>()
defineEmits<{ select: [index: number] }>()

const groups = computed(() => {
  const out: { part?: LecturePart; section: string; items: { scene: LectureScene; index: number }[] }[] = []
  props.scenes.forEach((scene, index) => {
    const last = out[out.length - 1]
    const part = props.parts?.find((p) => p.start === index)
    if (!part && last?.section === scene.section) last.items.push({ scene, index })
    else out.push({ part, section: scene.section, items: [{ scene, index }] })
  })
  return out
})
</script>

<template>
  <nav class="space-y-4 text-sm">
    <div v-for="g in groups" :key="g.section + g.items[0]!.index">
      <div v-if="g.part" :class="cn('mb-2 flex items-baseline gap-2 border-b pb-1', g.part.index && 'pt-2')">
        <span class="font-bold">파트 {{ g.part.index + 1 }}</span>
        <span class="text-xs text-muted-foreground">{{ minutesLabel(g.part.ms) }}</span>
      </div>
      <div class="mb-1 px-2 text-xs font-bold text-primary">{{ g.section }}</div>
      <ul class="space-y-0.5">
        <li v-for="{ scene, index } in g.items" :key="scene.id">
          <button
            type="button"
            :class="
              cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent',
                index === current ? 'bg-primary/10 font-medium text-primary' : index < current ? 'text-muted-foreground' : '',
              )
            "
            @click="$emit('select', index)"
          >
            <span class="w-5 shrink-0 text-right text-xs tabular-nums opacity-60">{{ index + 1 }}</span>
            <span class="flex-1 truncate">{{ scene.type === 'quiz' ? '확인 퀴즈' : (scene.title ?? scene.section) }}</span>
            <CircleHelp v-if="scene.type === 'quiz'" class="size-3.5 shrink-0 text-primary" />
          </button>
        </li>
      </ul>
    </div>
  </nav>
</template>
