<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, CircleCheck, CircleDashed, CirclePlay, Play } from '@lucide/vue'
import TheoryProgress from '@/components/theory/TheoryProgress.vue'
import { studyDate } from '@/lib/date'
import { hasLecture, readDoneParts, readLectureProgress } from '@/lib/lectures'
import { lectureMs, lectureParts, minutesLabel } from '@/lib/lectureParts'
import { cn } from '@/lib/utils'
import { useCertStore } from '@/stores/cert'
import { useTheoryStore } from '@/stores/theory'
import type { TheoryDoc } from '@/types'

/**
 * 강의만 모아 보기: 선택한 자격증 범위의 이론 문서 중 강의가 있는 것 (과목 → 장).
 * 상태: 완료(학습 완료 표시) / 학습 중(강의를 듣다 멈췄거나 문서를 읽음) / 미학습
 */
document.title = '강의 · Pass SQLD/SQLP'
const certStore = useCertStore()
const theory = useTheoryStore()

type Status = 'done' | 'learning' | 'new'
type Filter = 'all' | Status

interface Item {
  doc: TheoryDoc
  status: Status
  /** 강의 진행 (듣다 멈춘 장면) */
  pos: number
  total?: number
  detail: string
  /** 파트 수 · 끝까지 들은 파트 */
  parts: number
  doneParts: Set<number>
  ms: number
}

function itemOf(doc: TheoryDoc): Item {
  const record = theory.records[doc.slug]
  const { pos, total } = readLectureProgress(doc.slug)
  const base = { doc, pos, total, parts: lectureParts(doc.slug).length, doneParts: readDoneParts(doc.slug), ms: lectureMs(doc.slug) }
  if (record?.completedAt) return { ...base, status: 'done', detail: `${studyDate(record.completedAt)} 완료` }
  if (pos > 0) return { ...base, status: 'learning', detail: total ? `${pos + 1} / ${total} 장면` : `${pos + 1}번 장면까지` }
  if (record) return { ...base, status: 'learning', detail: `문서 읽음 · ${studyDate(record.lastViewedAt)}` }
  return { ...base, status: 'new', detail: '' }
}

const items = computed(() => certStore.docs.filter((d) => hasLecture(d.slug)).map(itemOf))
const bySlug = computed(() => new Map(items.value.map((i) => [i.doc.slug, i])))
const counts = computed(() => ({
  all: items.value.length,
  learning: items.value.filter((i) => i.status === 'learning').length,
  new: items.value.filter((i) => i.status === 'new').length,
  done: items.value.filter((i) => i.status === 'done').length,
}))
const overall = computed(() => theory.statsOf(items.value.map((i) => i.doc)))

const filter = ref<Filter>('all')
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'learning', label: '학습 중' },
  { value: 'new', label: '미학습' },
  { value: 'done', label: '완료' },
]

const tree = computed(() =>
  certStore.tree
    .map((s) => ({
      ...s,
      chapters: s.chapters
        .map((c) => ({
          ...c,
          items: c.docs.map((d) => bySlug.value.get(d.slug)).filter((i): i is Item => !!i && (filter.value === 'all' || i.status === filter.value)),
        }))
        .filter((c) => c.items.length),
    }))
    .filter((s) => s.chapters.length),
)

// 듣다 만 강의 (최근에 본 순)
const resumable = computed(() =>
  items.value
    .filter((i) => i.status === 'learning' && i.pos > 0)
    .sort((a, b) => (theory.records[b.doc.slug]?.lastViewedAt ?? '').localeCompare(theory.records[a.doc.slug]?.lastViewedAt ?? '')),
)

/** 맨 위에 크게: 가장 최근에 듣던 강의, 없으면 아직 안 끝낸 첫 강의 */
const hero = computed(() => resumable.value[0] ?? items.value.find((i) => i.status !== 'done'))

const STYLE: Record<Status, { icon: typeof CirclePlay; iconCls: string; label: string }> = {
  done: { icon: CircleCheck, iconCls: 'text-success', label: '완료' },
  learning: { icon: CirclePlay, iconCls: 'fill-primary/15 text-primary', label: '학습 중' },
  new: { icon: CircleDashed, iconCls: 'text-muted-foreground/50', label: '미학습' },
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <h1 class="flex items-center gap-2 text-2xl font-bold"><CirclePlay class="size-6 text-primary" /> 강의</h1>

    <div class="mt-6 rounded-xl border p-4">
      <TheoryProgress :stats="overall" size="md" />
    </div>

    <!-- 이어 듣기 / 다음 강의 -->
    <RouterLink
      v-if="hero"
      :to="{ name: 'lecture', params: { slug: hero.doc.slug } }"
      class="group mt-6 flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.99]"
    >
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium opacity-80">
          {{ hero.pos > 0 ? '이어 듣기' : '다음 강의' }} · {{ minutesLabel(hero.ms) }}<template v-if="hero.parts > 1"> · {{ hero.parts }}파트</template>
        </p>
        <p class="mt-0.5 truncate text-xl font-bold">{{ hero.doc.title }}</p>
        <p class="truncate text-sm opacity-80">{{ hero.pos > 0 ? hero.detail : hero.doc.summary }}</p>
      </div>
      <span class="grid size-14 shrink-0 place-items-center rounded-full bg-primary-foreground text-primary transition-transform group-hover:scale-105">
        <Play class="size-6 translate-x-0.5 fill-current" />
      </span>
    </RouterLink>
    <div v-if="resumable.length > 1" class="mt-2 space-y-1">
      <RouterLink
        v-for="i in resumable.slice(1, 3)"
        :key="i.doc.slug"
        :to="{ name: 'lecture', params: { slug: i.doc.slug } }"
        class="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <CirclePlay class="size-4 shrink-0 text-primary" />
        <span class="truncate"><b class="font-medium text-foreground">{{ i.doc.title }}</b> 이어 듣기 · {{ i.detail }}</span>
        <ChevronRight class="ml-auto size-4 shrink-0" />
      </RouterLink>
    </div>

    <!-- 상태별 보기 -->
    <div class="mt-8 flex flex-wrap gap-2">
      <button
        v-for="f in filters"
        :key="f.value"
        type="button"
        :class="
          cn(
            'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
            filter === f.value ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )
        "
        @click="filter = f.value"
      >
        {{ f.label }} <span class="opacity-70 tabular-nums">{{ counts[f.value] }}</span>
      </button>
    </div>

    <p v-if="!tree.length" class="mt-12 text-center text-muted-foreground">
      {{ filter === 'done' ? '아직 완료한 강의가 없어요.' : filter === 'learning' ? '듣고 있는 강의가 없어요.' : '모든 강의를 들었어요! 🎉' }}
    </p>

    <!-- 과목 → 장 -->
    <section v-for="subject in tree" :key="subject.name" class="mt-8">
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 class="text-xl font-bold">{{ subject.name }}</h2>
        <TheoryProgress :stats="theory.statsOf(subject.chapters.flatMap((c) => c.docs))" compact class="w-48" />
      </div>
      <div v-for="chapter in subject.chapters" :key="chapter.name" class="mt-5">
        <h3 class="mb-2 text-sm font-semibold text-muted-foreground">{{ chapter.name }}</h3>
        <!-- 한 줄씩 짧게: 상태 아이콘 · 제목 · 파트 진행 · 길이 -->
        <ul class="divide-y rounded-2xl border">
          <li v-for="i in chapter.items" :key="i.doc.slug">
            <RouterLink
              :to="{ name: 'lecture', params: { slug: i.doc.slug } }"
              class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
              :aria-label="`${i.doc.title} · ${STYLE[i.status].label}`"
            >
              <component :is="STYLE[i.status].icon" :class="cn('size-5 shrink-0', STYLE[i.status].iconCls)" />
              <div class="min-w-0 flex-1">
                <div :class="cn('truncate font-medium', i.status === 'new' && 'text-foreground/80')">{{ i.doc.title }}</div>
                <div v-if="i.status !== 'new'" :class="cn('truncate text-xs', i.status === 'done' ? 'text-success' : 'text-primary')">{{ i.detail }}</div>
              </div>
              <!-- 파트마다 한 칸 (들은 파트는 채움) -->
              <span v-if="i.parts > 1" class="flex shrink-0 gap-0.5" :title="`${i.parts}파트 중 ${i.doneParts.size}파트 들음`">
                <span
                  v-for="n in i.parts"
                  :key="n"
                  :class="cn('h-1.5 w-3 rounded-full', i.status === 'done' || i.doneParts.has(n - 1) ? 'bg-success' : 'bg-muted')"
                />
              </span>
              <span class="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{{ Math.max(1, Math.round(i.ms / 60_000)) }}분</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
