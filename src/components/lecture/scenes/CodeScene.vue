<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { renderMarkdown } from '@/lib/markdown'
import type { LectureScene } from '@/types'

/** SQL 을 하이라이트하고, 대본이 설명하는 줄을 강조한다 (나머지 줄은 흐리게) */
const props = defineProps<{ scene: Extract<LectureScene, { type: 'code' }>; focus: number[] }>()

const html = ref('')
const box = ref<HTMLElement>()

watch(
  () => props.scene.code,
  async (code) => {
    html.value = (await renderMarkdown('```sql\n' + code + '\n```')).html
    await nextTick()
    markLines()
  },
  { immediate: true },
)
watch(() => props.focus, markLines)

function markLines() {
  const lines = box.value?.querySelectorAll<HTMLElement>('.line') ?? []
  lines.forEach((el, i) => {
    const on = props.focus.includes(i + 1)
    el.classList.toggle('is-focus', on)
    el.classList.toggle('is-dim', props.focus.length > 0 && !on)
  })
}
</script>

<template>
  <div class="flex h-full flex-col justify-center">
    <h3 v-if="scene.title" class="mb-4 text-2xl font-bold">{{ scene.title }}</h3>
    <div ref="box" class="lecture-code prose-doc text-xs sm:text-base [&_.md-code]:my-0" v-html="html" />
    <p v-if="scene.caption" class="mt-3 text-sm text-muted-foreground">{{ scene.caption }}</p>
  </div>
</template>

<style scoped>
.lecture-code :deep(.line) {
  display: inline-block;
  min-width: 100%;
  border-radius: 4px;
  transition: opacity 0.3s, background-color 0.3s;
}
.lecture-code :deep(.line.is-dim) { opacity: 0.35; }
.lecture-code :deep(.line.is-focus) { background: color-mix(in oklch, var(--primary) 18%, transparent); }
</style>
