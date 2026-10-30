<script setup lang="ts">
import { cn } from '@/lib/utils'
import type { LecturePlayer } from '@/composables/useLecturePlayer'

/** 장면 진행 막대 (Speak 처럼 위쪽에 얇게). 칸을 누르면 그 장면으로 */
defineProps<{ player: LecturePlayer }>()
</script>

<template>
  <div class="flex h-1.5 gap-[3px]" role="group" aria-label="장면 이동">
    <button
      v-for="(s, i) in player.scenes.value"
      :key="s.id"
      type="button"
      :title="`${i + 1}. ${s.title ?? s.section}`"
      :aria-label="`${i + 1}번 장면으로 이동`"
      :class="
        cn(
          'flex-1 rounded-full transition-colors duration-300',
          i < player.sceneIndex.value || player.finished.value
            ? 'bg-primary'
            : i === player.sceneIndex.value
              ? 'bg-primary/50'
              : 'bg-muted',
        )
      "
      @click="player.goScene(i)"
    />
  </div>
</template>
