<script setup lang="ts">
import { computed } from 'vue'
import type { Stats } from '@/stores/progress'

const props = withDefaults(defineProps<{ stats: Stats; size?: 'sm' | 'md' }>(), { size: 'sm' })

const pct = (v: number) => `${Math.round(v * 100)}%`
const started = computed(() => props.stats.solved > 0)
</script>

<template>
  <div :class="size === 'md' ? 'space-y-2' : 'space-y-1.5'">
    <div class="flex h-1.5 overflow-hidden rounded-full bg-muted" :class="size === 'md' && 'h-2.5'">
      <!-- 맞힌(또는 해결한) 부분 / 미해결 오답 부분 -->
      <span
        class="bg-primary transition-all"
        :style="{ width: pct((stats.solved - stats.wrong) / Math.max(stats.total, 1)) }"
      />
      <span class="bg-destructive/70 transition-all" :style="{ width: pct(stats.wrong / Math.max(stats.total, 1)) }" />
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground" :class="size === 'md' && 'text-sm'">
      <span>
        진행 <b class="font-semibold text-foreground tabular-nums">{{ stats.solved }}</b>/{{ stats.total }}
        <span class="tabular-nums">({{ pct(stats.progress) }})</span>
      </span>
      <span v-if="started">
        오답률
        <b :class="['font-semibold tabular-nums', stats.wrong ? 'text-destructive' : 'text-foreground']">{{ pct(stats.wrongRate) }}</b>
        <span v-if="stats.wrong" class="tabular-nums">· 미해결 {{ stats.wrong }}</span>
      </span>
    </div>
  </div>
</template>
