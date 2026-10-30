<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, Circle, CircleCheck, CirclePlay, Search } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import TheoryProgress from '@/components/theory/TheoryProgress.vue'
import { useSearchDialog } from '@/composables/useSearchDialog'
import { useCertStore } from '@/stores/cert'
import { fullDate, studyDate } from '@/lib/date'
import { hasLecture } from '@/lib/lectures'
import { useTheoryStore } from '@/stores/theory'

const { show } = useSearchDialog()
const theory = useTheoryStore()
const certStore = useCertStore()
const overall = computed(() => theory.statsOf(certStore.docs))
document.title = '이론 · Pass SQLD/SQLP'
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <div class="flex flex-wrap items-end gap-4">
      <div>
        <h1 class="text-2xl font-bold">이론</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          과목 → 장 → 절 순서로 개념을 익혀보세요. {{ certStore.info.label }} 범위 {{ certStore.docs.length }}개 문서
        </p>
      </div>
      <Button variant="outline" size="sm" class="ml-auto text-muted-foreground" @click="show">
        <Search class="size-4" /> 이론 검색
        <kbd class="ml-2 rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
      </Button>
    </div>

    <!-- 전체 학습 현황 -->
    <div class="mt-6 rounded-xl border p-4">
      <TheoryProgress :stats="overall" size="md" />
    </div>

    <section v-for="subject in certStore.tree" :key="subject.name" class="mt-12">
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 class="text-xl font-bold">{{ subject.name }}</h2>
        <TheoryProgress :stats="theory.statsOf(subject.chapters.flatMap((c) => c.docs))" compact class="w-48" />
      </div>
      <div v-for="chapter in subject.chapters" :key="chapter.name" class="mt-6">
        <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h3 class="text-sm font-semibold text-muted-foreground">{{ chapter.name }}</h3>
          <TheoryProgress :stats="theory.statsOf(chapter.docs)" compact class="w-40" />
        </div>
        <!-- grid-cols-1: 칸 너비가 긴 요약(한 줄 말줄임)에 끌려 화면 밖으로 넓어지지 않게 -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RouterLink
            v-for="doc in chapter.docs"
            :key="doc.slug"
            :to="{ name: 'theory', params: { slug: doc.slug } }"
            class="group flex min-w-0 items-center gap-3 rounded-xl border p-4 transition-colors hover:border-primary hover:bg-accent/40"
          >
            <CircleCheck v-if="theory.records[doc.slug]?.completedAt" class="size-5 shrink-0 text-success" />
            <Circle v-else class="size-5 shrink-0 text-muted-foreground/40" />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium">
                {{ doc.title }}
                <span
                  v-if="hasLecture(doc.slug)"
                  class="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                  title="인터랙티브 강의가 있어요"
                >
                  <CirclePlay class="size-3" /> 강의
                </span>
              </div>
              <div class="mt-0.5 truncate text-sm text-muted-foreground">{{ doc.summary }}</div>
              <div
                v-if="theory.records[doc.slug]"
                class="mt-1 text-xs text-muted-foreground"
                :title="fullDate(theory.records[doc.slug]!.completedAt ?? theory.records[doc.slug]!.lastViewedAt)"
              >
                <template v-if="theory.records[doc.slug]!.completedAt">
                  <span class="text-success">{{ studyDate(theory.records[doc.slug]!.completedAt!) }} 완료</span> ·
                </template>
                마지막 학습 {{ studyDate(theory.records[doc.slug]!.lastViewedAt) }}
              </div>
            </div>
            <ChevronRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
