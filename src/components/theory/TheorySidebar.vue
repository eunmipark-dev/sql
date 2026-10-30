<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronRight, CircleCheck } from '@lucide/vue'
import { findDoc } from '@/lib/content'
import { useCertStore } from '@/stores/cert'
import { useTheoryStore } from '@/stores/theory'

defineEmits<{ navigate: [] }>()

const route = useRoute()
const theory = useTheoryStore()
const certStore = useCertStore()
// 접힌 장 목록. 현재 문서가 속한 장은 항상 펼친다.
const collapsed = ref(new Set<string>())

watch(
  () => route.params.slug,
  (slug) => {
    const chapter = findDoc(String(slug))?.chapter
    if (chapter) collapsed.value.delete(chapter)
  },
  { immediate: true },
)

function toggle(chapter: string) {
  if (!collapsed.value.delete(chapter)) collapsed.value.add(chapter)
}
</script>

<template>
  <nav class="space-y-6 text-sm">
    <RouterLink to="/theory" class="block px-2 font-semibold hover:text-primary" @click="$emit('navigate')">
      전체 목차
    </RouterLink>
    <div v-for="subject in certStore.tree" :key="subject.name">
      <h4 class="mb-2 px-2 text-xs font-bold tracking-wide text-primary">{{ subject.name }}</h4>
      <div v-for="chapter in subject.chapters" :key="chapter.name" class="mb-2">
        <button
          type="button"
          class="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
          @click="toggle(chapter.name)"
        >
          <ChevronRight class="size-3.5 shrink-0 transition-transform" :class="!collapsed.has(chapter.name) && 'rotate-90'" />
          <span class="flex-1">{{ chapter.name }}</span>
          <span class="font-normal tabular-nums" title="학습 완료한 문서">
            {{ theory.statsOf(chapter.docs).completed }}/{{ chapter.docs.length }}
          </span>
        </button>
        <ul v-show="!collapsed.has(chapter.name)" class="ml-3.5 space-y-0.5 border-l pl-2">
          <li v-for="doc in chapter.docs" :key="doc.slug">
            <RouterLink
              :to="{ name: 'theory', params: { slug: doc.slug } }"
              class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              active-class="!bg-primary/10 !text-primary font-medium"
              @click="$emit('navigate')"
            >
              <span class="flex-1">{{ doc.title }}</span>
              <CircleCheck v-if="theory.records[doc.slug]?.completedAt" class="size-3.5 shrink-0 text-success" />
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>
