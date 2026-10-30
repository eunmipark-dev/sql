<script setup lang="ts">
import { ref, watch } from 'vue'
import { renderMarkdown } from '@/lib/markdown'
import { handleProseClick } from '@/lib/prose'

const props = defineProps<{ code: string }>()
const html = ref('')

watch(
  () => props.code,
  async (code) => {
    html.value = (await renderMarkdown('```sql\n' + code + '\n```')).html
  },
  { immediate: true },
)
</script>

<template>
  <div class="prose-doc [&_.md-code]:my-0" @click="handleProseClick($event)" v-html="html" />
</template>
