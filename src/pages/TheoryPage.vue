<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { until, useDark } from '@vueuse/core'
import { BookOpen, CalendarCheck, CirclePlay, ChevronLeft, ChevronRight, CircleCheck, Clock, History, Menu, PencilLine } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import TheorySidebar from '@/components/theory/TheorySidebar.vue'
import TocNav from '@/components/theory/TocNav.vue'
import { findDoc, theoryDocs } from '@/lib/content'
import { useCertStore } from '@/stores/cert'
import { renderMarkdown } from '@/lib/markdown'
import { renderMermaid } from '@/lib/mermaid'
import { KIND_LABEL, KIND_ROUTE, loadBankIndex } from '@/lib/exams'
import { hasLecture } from '@/lib/lectures'
import { handleProseClick } from '@/lib/prose'
import { fullDate, studyDate } from '@/lib/date'
import { useTheoryStore } from '@/stores/theory'
import type { Heading } from '@/types'

const route = useRoute()
const router = useRouter()
const isDark = useDark()
const html = ref('')
const headings = ref<Heading[]>([])
const sidebarOpen = ref(false)
const contentEl = ref<HTMLElement>()
/** 이 절 문제 수: SQLD(ai) / SQLP */
const practiceCount = ref({ ai: 0, sqlp: 0 })
const theory = useTheoryStore()
/** 이번에 열기 전 마지막으로 본 시각 (없으면 처음 보는 문서) */
const prevViewedAt = ref<string>()
const record = computed(() => (doc.value ? theory.records[doc.value.slug] : undefined))

const doc = computed(() => findDoc(String(route.params.slug)))
const certStore = useCertStore()
const navDocs = computed(() => (doc.value && certStore.includes(doc.value.slug) ? certStore.docs : theoryDocs))
const docIndex = computed(() => navDocs.value.findIndex((d) => d.slug === doc.value?.slug))
const prev = computed(() => navDocs.value[docIndex.value - 1])
const next = computed(() => navDocs.value[docIndex.value + 1])
const sectionCount = computed(() => headings.value.filter((h) => h.level === 2).length)
/** 한글 기준 분당 약 500자 */
const readMinutes = computed(() => Math.max(1, Math.round((doc.value?.body.length ?? 0) / 500)))

function scrollToHash(behavior: ScrollBehavior = 'smooth') {
  const id = decodeURIComponent(route.hash.slice(1))
  if (id) document.getElementById(id)?.scrollIntoView({ behavior })
}

const drawDiagrams = () => contentEl.value && renderMermaid(contentEl.value, isDark.value)

watch(
  doc,
  async (d) => {
    if (!d) return
    // 제목은 상단 헤더에서 따로 보여주므로 본문의 # 제목은 제거
    const out = await renderMarkdown(d.body.replace(/^\s*# .*\r?\n/, ''))
    html.value = out.html
    headings.value = out.headings
    document.title = `${d.title} · SQL 자격증`
    Promise.all([loadBankIndex('ai'), loadBankIndex('sqlp')])
      .then(([ai, sqlp]) => (practiceCount.value = { ai: ai[d.slug]?.count ?? 0, sqlp: sqlp[d.slug]?.count ?? 0 }))
      .catch(() => (practiceCount.value = { ai: 0, sqlp: 0 }))
    await nextTick()
    // 다른 문서에서 넘어온 경우 해당 섹션으로 바로 이동
    if (route.hash) scrollToHash('instant')
    else window.scrollTo({ top: 0 })
    await drawDiagrams()
    if (route.hash) scrollToHash('instant') // 다이어그램 렌더링으로 위치가 밀린 경우 보정
  },
  { immediate: true },
)

watch(isDark, drawDiagrams)

// 문서를 열면 학습 기록(마지막으로 본 날짜)을 남긴다
watch(
  () => doc.value?.slug,
  async (slug) => {
    if (!slug) return
    await until(() => theory.loaded).toBe(true, { timeout: 5000 })
    if (slug !== doc.value?.slug) return // 기다리는 동안 다른 문서로 이동
    prevViewedAt.value = theory.records[slug]?.lastViewedAt
    await theory.view(slug)
  },
  { immediate: true },
)

// 같은 문서 안에서 검색 결과로 이동한 경우
watch(() => route.hash, () => nextTick(() => scrollToHash()))
</script>

<template>
  <div class="mx-auto flex max-w-7xl gap-10 px-4">
    <!-- 좌측: 문서 목록 -->
    <aside class="sticky top-(--header-h) hidden h-[calc(100dvh-var(--header-h))] w-64 shrink-0 overflow-y-auto py-8 md:block">
      <TheorySidebar />
    </aside>

    <!-- 모바일: 문서 목록 토글 -->
    <div v-if="sidebarOpen" class="fixed inset-0 z-30 bg-black/40 md:hidden" @click="sidebarOpen = false" />
    <aside
      class="fixed top-(--header-h) bottom-(--tabbar-h) left-(--inset-left) z-30 md:bottom-0 w-72 overflow-y-auto border-r bg-background p-4 transition-transform md:hidden"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <TheorySidebar @navigate="sidebarOpen = false" />
    </aside>

    <!-- 본문 -->
    <article class="min-w-0 flex-1 py-8">
      <div class="mx-auto max-w-3xl">
        <Button variant="outline" size="sm" class="mb-6 md:hidden" @click="sidebarOpen = true">
          <Menu class="size-4" /> 목차
        </Button>

        <template v-if="doc">
          <!-- 문서 헤더 -->
          <header class="mb-10 border-b pb-8">
            <nav class="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <RouterLink to="/theory" class="hover:text-foreground">이론</RouterLink>
              <ChevronRight class="size-3" />
              <span>{{ doc.subject }}</span>
              <ChevronRight class="size-3" />
              <span class="font-medium text-primary">{{ doc.chapter }}</span>
            </nav>
            <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{{ doc.title }}</h1>
            <p v-if="doc.summary" class="mt-3 text-lg text-muted-foreground">{{ doc.summary }}</p>
            <Button v-if="hasLecture(doc.slug)" class="mt-5" as-child>
              <RouterLink :to="{ name: 'lecture', params: { slug: doc.slug } }">
                <CirclePlay class="size-4" /> 강의로 듣기
              </RouterLink>
            </Button>
            <div class="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                <BookOpen class="size-3.5" /> {{ sectionCount }}개 섹션
              </span>
              <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
                <Clock class="size-3.5" /> 약 {{ readMinutes }}분
              </span>
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1"
                :title="prevViewedAt ? fullDate(prevViewedAt) : undefined"
              >
                <History class="size-3.5" />
                {{ prevViewedAt ? `이전 학습 ${studyDate(prevViewedAt)}` : '처음 보는 문서' }}
              </span>
              <span
                v-if="record?.completedAt"
                class="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-success"
                :title="fullDate(record.completedAt)"
              >
                <CircleCheck class="size-3.5" /> {{ studyDate(record.completedAt) }} 학습 완료
              </span>
            </div>
          </header>

          <div ref="contentEl" class="prose-doc" @click="handleProseClick($event, router)" v-html="html" />

          <!-- 학습 완료 표시 (장별 진행률에 반영) -->
          <div
            :class="[
              'mt-16 flex flex-wrap items-center gap-3 rounded-xl border p-5',
              record?.completedAt && 'border-success/40 bg-success/5',
            ]"
          >
            <CalendarCheck :class="['size-6 shrink-0', record?.completedAt ? 'text-success' : 'text-muted-foreground']" />
            <div class="min-w-0 flex-1">
              <div class="font-semibold">
                {{ record?.completedAt ? `${studyDate(record.completedAt)} 학습 완료` : '다 읽었나요?' }}
              </div>
              <div class="text-sm text-muted-foreground">
                {{
                  record?.completedAt
                    ? `${fullDate(record.completedAt)}에 완료했어요. 「${doc.chapter}」 진행률에 반영돼요.`
                    : '학습 완료로 표시하면 이론 목차에서 장별 진행률로 볼 수 있어요.'
                }}
              </div>
            </div>
            <Button
              :variant="record?.completedAt ? 'outline' : 'default'"
              size="sm"
              @click="theory.setCompleted(doc.slug, !record?.completedAt)"
            >
              <CircleCheck class="size-4" /> {{ record?.completedAt ? '완료 취소' : '학습 완료' }}
            </Button>
          </div>

          <!-- 이 절 문제 풀기 -->
          <template v-for="k in [certStore.examKind]" :key="k">
            <RouterLink
              v-if="practiceCount[k]"
              :to="`${KIND_ROUTE[k]}/topic/${doc.slug}`"
              class="mt-4 flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5 transition-colors hover:border-primary"
            >
              <PencilLine class="size-6 shrink-0 text-primary" />
              <div class="flex-1">
                <div class="font-semibold">이 절 문제 풀기 <span class="text-sm font-normal text-muted-foreground">{{ certStore.info.label }}</span></div>
                <div class="text-sm text-muted-foreground">
                  {{ KIND_LABEL[k] }}에서 「{{ doc.title }}」 문제 {{ practiceCount[k] }}개를 모아 바로 풀어봐요.
                </div>
              </div>
              <ChevronRight class="size-5 text-muted-foreground" />
            </RouterLink>
          </template>

          <div class="mt-8 grid gap-4 border-t pt-6 sm:grid-cols-2">
            <RouterLink
              v-if="prev"
              :to="{ name: 'theory', params: { slug: prev.slug } }"
              class="rounded-xl border p-4 transition-colors hover:border-primary hover:bg-accent/40"
            >
              <div class="flex items-center gap-1 text-xs text-muted-foreground"><ChevronLeft class="size-3" /> 이전</div>
              <div class="mt-1 font-medium">{{ prev.title }}</div>
            </RouterLink>
            <div v-else />
            <RouterLink
              v-if="next"
              :to="{ name: 'theory', params: { slug: next.slug } }"
              class="rounded-xl border p-4 text-right transition-colors hover:border-primary hover:bg-accent/40"
            >
              <div class="flex items-center justify-end gap-1 text-xs text-muted-foreground">다음 <ChevronRight class="size-3" /></div>
              <div class="mt-1 font-medium">{{ next.title }}</div>
            </RouterLink>
          </div>
        </template>
        <p v-else class="py-20 text-center text-muted-foreground">문서를 찾을 수 없습니다.</p>
      </div>
    </article>

    <!-- 우측: 페이지 목차 -->
    <aside class="sticky top-(--header-h) hidden h-[calc(100dvh-var(--header-h))] w-52 shrink-0 overflow-y-auto py-8 xl:block">
      <TocNav :headings="headings" />
    </aside>
  </div>
</template>
