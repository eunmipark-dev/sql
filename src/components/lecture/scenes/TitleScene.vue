<script setup lang="ts">
import { lectureIcon } from '@/lib/lectureIcons'
import type { LectureScene } from '@/types'

defineProps<{ scene: Extract<LectureScene, { type: 'title' }> }>()
</script>

<template>
  <div class="flex flex-col items-center text-center">
    <span
      v-if="scene.icon"
      class="title-icon mb-6 flex size-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-xl shadow-primary/25"
    >
      <component :is="lectureIcon(scene.icon)" class="size-12" />
    </span>
    <p class="text-sm font-semibold text-primary">{{ scene.section }}</p>
    <h2 class="mt-2 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{{ scene.title }}</h2>
    <p v-if="scene.subtitle" class="mt-4 max-w-md text-lg text-muted-foreground">{{ scene.subtitle }}</p>
  </div>
</template>

<style scoped>
.title-icon { animation: pop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes pop-in {
  from { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  to { opacity: 1; transform: scale(1) rotate(0); }
}
@media (prefers-reduced-motion: reduce) { .title-icon { animation: none; } }
</style>
