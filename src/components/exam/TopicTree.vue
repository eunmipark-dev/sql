<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronRight } from '@lucide/vue'
import ProgressStat from '@/components/exam/ProgressStat.vue'
import { theoryTree } from '@/lib/content'
import { KIND_PREFIX, KIND_ROUTE, loadBankIndex } from '@/lib/exams'
import { useProgressStore } from '@/stores/progress'
import type { BankEntry, ExamKind } from '@/types'

const props = defineProps<{ kind: ExamKind }>()

const progress = useProgressStore()
const bank = ref<Record<string, BankEntry>>({})
const loading = ref(true)
onMounted(async () => {
  try {
    bank.value = await loadBankIndex(props.kind)
  } finally {
    loading.value = false
  }
})

const prefix = computed(() => KIND_PREFIX[props.kind])
const count = (slugs: string[]) => slugs.reduce((n, s) => n + (bank.value[s]?.count ?? 0), 0)
const stats = (slugs: string[]) => progress.statsByTheory(slugs, count(slugs), prefix.value)

// 이 시험에 문제가 하나도 없는 과목(예: SQLD 의 3과목)은 숨긴다
const tree = computed(() =>
  theoryTree
    .filter((subject) => count(subject.chapters.flatMap((c) => c.docs.map((d) => d.slug))) > 0)
    .map((subject) => {
      const subjectSlugs = subject.chapters.flatMap((c) => c.docs.map((d) => d.slug))
      return {
        ...subject,
        stats: stats(subjectSlugs),
        chapters: subject.chapters.map((c) => ({
          ...c,
          stats: stats(c.docs.map((d) => d.slug)),
          docs: c.docs.map((d) => ({ ...d, count: bank.value[d.slug]?.count ?? 0, stats: stats([d.slug]) })),
        })),
      }
    }),
)
</script>

<template>
  <div v-if="loading" class="mt-8 space-y-3">
    <div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-xl bg-muted" />
  </div>
  <div v-else class="mt-6">
    <section v-for="subject in tree" :key="subject.name" class="mb-10">
      <div class="mb-4 rounded-xl border bg-muted/30 p-4">
        <h2 class="mb-2 text-lg font-bold">{{ subject.name }}</h2>
        <ProgressStat :stats="subject.stats" size="md" />
      </div>
      <div v-for="chapter in subject.chapters" :key="chapter.name" class="mb-6">
        <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold text-muted-foreground">{{ chapter.name }}</h3>
          <span class="text-xs text-muted-foreground tabular-nums">
            {{ chapter.stats.solved }}/{{ chapter.stats.total }} 풀이
          </span>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          <component
            :is="doc.count ? 'RouterLink' : 'div'"
            v-for="doc in chapter.docs"
            :key="doc.slug"
            :to="`${KIND_ROUTE[kind]}/topic/${doc.slug}`"
            :class="[
              'group flex items-center gap-3 rounded-xl border p-3.5 transition-colors',
              doc.count ? 'hover:border-primary hover:bg-accent/40' : 'opacity-50',
            ]"
          >
            <div class="min-w-0 flex-1">
              <div class="mb-2 flex items-baseline justify-between gap-2">
                <span class="truncate font-medium">{{ doc.title }}</span>
                <span
                  v-if="doc.stats.solved === doc.count && doc.count"
                  class="shrink-0 text-xs font-medium text-success"
                >완료</span>
              </div>
              <ProgressStat v-if="doc.count" :stats="doc.stats" />
            </div>
            <ChevronRight v-if="doc.count" class="size-4 shrink-0 text-muted-foreground" />
          </component>
        </div>
      </div>
    </section>
  </div>
</template>
