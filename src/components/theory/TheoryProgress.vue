<script setup lang="ts">
import { computed } from 'vue'
import { fullDate, studyDate } from '@/lib/date'
import type { TheoryStats } from '@/stores/theory'

/** 이론 학습 진행률: 막대는 학습 완료한 문서 / 전체만 그린다 (열어만 본 문서는 '읽는 중 n' 글자로) */
const props = withDefaults(defineProps<{ stats: TheoryStats; size?: 'sm' | 'md'; compact?: boolean }>(), {
  size: 'sm',
})

const pct = (v: number) => `${Math.round(v * 100)}%`
const total = computed(() => Math.max(props.stats.total, 1))
</script>

<template>
  <div :class="compact ? 'flex items-center gap-2' : size === 'md' ? 'space-y-2' : 'space-y-1.5'">
    <div :class="['flex overflow-hidden rounded-full bg-muted', size === 'md' ? 'h-2.5' : 'h-1.5', compact && 'flex-1']">
      <span class="bg-success transition-all" :style="{ width: pct(stats.completed / total) }" />
    </div>
    <span v-if="compact" class="shrink-0 text-xs text-muted-foreground tabular-nums">
      {{ stats.completed }}/{{ stats.total }} 완료
    </span>
    <div
      v-else
      :class="['flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground', size === 'md' ? 'text-sm' : 'text-xs']"
    >
      <span>
        학습 완료 <b class="font-semibold text-foreground tabular-nums">{{ stats.completed }}</b>/{{ stats.total }}
        <span class="tabular-nums">({{ pct(stats.completed / total) }})</span>
      </span>
      <span v-if="stats.viewed > stats.completed">읽는 중 {{ stats.viewed - stats.completed }}</span>
      <span v-if="stats.lastViewedAt" :title="fullDate(stats.lastViewedAt)">
        마지막 학습 {{ studyDate(stats.lastViewedAt) }}
      </span>
    </div>
  </div>
</template>
