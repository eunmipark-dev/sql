<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { FileText, Hash, Search } from '@lucide/vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useSearchDialog } from '@/composables/useSearchDialog'
import { theoryDocs } from '@/lib/content'
import { buildIndex, highlight, snippet, type SearchEntry } from '@/lib/search'
import { useCertStore } from '@/stores/cert'

const { open } = useSearchDialog()
const router = useRouter()
const index = buildIndex(theoryDocs)
const certStore = useCertStore()

const query = ref('')
const active = ref(0)
const listEl = ref<HTMLElement>()

type Result = SearchEntry & { score: number }

const results = computed<Result[]>(() => {
  const q = query.value.trim()
  if (!q) return []
  // 모든 단어를 포함하는 결과가 없으면 일부만 맞아도 보여준다
  // 선택한 자격증 범위의 문서만 (SQLD 면 3과목 제외)
  const inCert = (r: { slug: string }) => certStore.includes(r.slug)
  let hits = index.search(q, { filter: inCert as never })
  if (!hits.length) hits = index.search(q, { combineWith: 'OR', filter: inCert as never })
  return (hits as unknown as Result[]).slice(0, 12)
})

watch(results, () => (active.value = 0))
watch(open, (v) => {
  if (v) query.value = ''
})

function go(r: Result) {
  open.value = false
  router.push({ name: 'theory', params: { slug: r.slug }, hash: r.anchor ? `#${r.anchor}` : '' })
}

function move(delta: number) {
  const n = results.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  nextTick(() => listEl.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }))
}

function onEnter() {
  const r = results.value[active.value]
  if (r) go(r)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl" :show-close-button="false">
      <DialogTitle class="sr-only">이론 검색</DialogTitle>
      <DialogDescription class="sr-only">이론 문서를 검색합니다</DialogDescription>
      <div class="flex items-center gap-2 border-b px-4">
        <Search class="size-4 shrink-0 text-muted-foreground" />
        <input
          v-model="query"
          placeholder="예: 정규화, OUTER JOIN, NULL"
          class="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="onEnter"
        />
      </div>

      <div ref="listEl" class="max-h-[60vh] overflow-y-auto p-2">
        <p v-if="!query.trim()" class="px-3 py-8 text-center text-sm text-muted-foreground">
          검색어를 입력하세요 · ↑↓ 이동 · Enter 열기
        </p>
        <p v-else-if="!results.length" class="px-3 py-8 text-center text-sm text-muted-foreground">
          "{{ query }}"에 대한 결과가 없습니다.
        </p>
        <button
          v-for="(r, i) in results"
          :key="r.id"
          type="button"
          :data-active="i === active"
          class="flex w-full gap-3 rounded-md px-3 py-2.5 text-left data-[active=true]:bg-accent"
          @mousemove="active = i"
          @click="go(r)"
        >
          <component :is="r.anchor ? Hash : FileText" class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div class="min-w-0">
            <div class="text-xs text-muted-foreground">{{ r.docTitle }}</div>
            <div class="text-sm font-medium" v-html="highlight(r.heading, query)" />
            <div class="line-clamp-2 text-xs text-muted-foreground" v-html="snippet(r.text, query)" />
          </div>
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
