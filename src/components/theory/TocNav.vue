<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { Heading } from '@/types'

const props = defineProps<{ headings: Heading[] }>()
const activeId = ref('')
let observer: IntersectionObserver | null = null

// 화면 상단에 걸친 제목을 현재 위치로 표시
watch(
  () => props.headings,
  (list) => {
    observer?.disconnect()
    activeId.value = list[0]?.id ?? ''
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) activeId.value = visible[0]!.target.id
      },
      { rootMargin: '-64px 0px -70% 0px' },
    )
    requestAnimationFrame(() => {
      for (const h of list) {
        const el = document.getElementById(h.id)
        if (el) observer!.observe(el)
      }
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => observer?.disconnect())

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  history.replaceState(history.state, '', `#${id}`)
  activeId.value = id
}
</script>

<template>
  <nav v-if="headings.length" class="text-sm">
    <h4 class="mb-3 text-xs font-semibold text-muted-foreground">이 페이지의 목차</h4>
    <ul class="space-y-1 border-l">
      <li v-for="h in headings" :key="h.id">
        <a
          :href="`#${h.id}`"
          class="-ml-px block border-l-2 border-transparent py-1 text-muted-foreground transition-colors hover:text-foreground"
          :class="[
            h.level === 3 ? 'pl-6 text-[13px]' : 'pl-3',
            activeId === h.id && '!border-primary !text-primary font-medium',
          ]"
          @click.prevent="scrollTo(h.id)"
        >
          {{ h.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>
