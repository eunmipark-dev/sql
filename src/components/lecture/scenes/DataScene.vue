<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { ArrowDown } from '@lucide/vue'
import { renderInline, renderMarkdown } from '@/lib/markdown'
import { isNull, tableView } from '@/lib/lectureTable'
import { cn } from '@/lib/utils'
import type { LectureScene, LectureTable } from '@/types'

/**
 * 예제 표를 화면에 띄워 둔 채 대본에 맞춰 바꾼다: 행·칸 반짝, 걸러지는 행에 줄 긋기 → 사라짐,
 * 정렬하면 행이 자리를 옮기고, 묶으면 색이 칠해지고, 새 컬럼이 채워지고, 아래에 결과표가 조립된다.
 * 표가 두 개면 나란히 (조인: 짝이 되는 행을 같은 색으로). SQL(code)이 있으면 위에 두고 focus 줄을 강조
 */
const props = defineProps<{
  scene: Extract<LectureScene, { type: 'data' }>
  focus: number[]
  stepIndex: number
  tables?: Record<string, LectureTable>
}>()

const views = computed(() =>
  props.scene.tables.flatMap((name) => {
    const table = props.tables?.[name]
    return table ? [{ name, view: tableView(table, props.scene.steps, name, props.stepIndex) }] : []
  }),
)

// ── SQL (CodeScene 과 같은 방식으로 줄 강조) ──
const html = ref('')
const codeBox = ref<HTMLElement>()
watch(
  () => props.scene.code,
  async (code) => {
    html.value = code ? (await renderMarkdown('```sql\n' + code + '\n```')).html : ''
    await nextTick()
    markLines()
  },
  { immediate: true },
)
watch(() => props.focus, markLines)
function markLines() {
  codeBox.value?.querySelectorAll<HTMLElement>('.line').forEach((el, i) => {
    const on = props.focus.includes(i + 1)
    el.classList.toggle('is-focus', on)
    el.classList.toggle('is-dim', props.focus.length > 0 && !on)
  })
}

// ── 넓은 표 맞추기 ──
const fitBox = ref<HTMLElement>()
const wide = ref<HTMLElement>()
const zoom = ref(1)
async function fitWidth() {
  zoom.value = 1
  await nextTick()
  const box = fitBox.value?.clientWidth ?? 0
  const natural = wide.value?.scrollWidth ?? 0
  zoom.value = box && natural > box ? Math.max(0.6, box / natural) : 1
}
onMounted(fitWidth)
// 높이는 zoom 에 따라 바뀌므로 너비가 바뀔 때만 다시 잰다 (반복 측정 방지)
let lastWidth = 0
useResizeObserver(fitBox, ([e]) => {
  const w = Math.round(e?.contentRect.width ?? 0)
  if (w !== lastWidth) {
    lastWidth = w
    void fitWidth()
  }
})
watch(() => props.stepIndex, () => void fitWidth())

/** 묶음·짝 색 (4가지를 돌려 쓴다) */
const TINTS = [
  'bg-sky-500/15 [&>td:first-child]:shadow-[inset_4px_0_0_var(--color-sky-500)]',
  'bg-amber-500/15 [&>td:first-child]:shadow-[inset_4px_0_0_var(--color-amber-500)]',
  'bg-emerald-500/15 [&>td:first-child]:shadow-[inset_4px_0_0_var(--color-emerald-500)]',
  'bg-rose-500/15 [&>td:first-child]:shadow-[inset_4px_0_0_var(--color-rose-500)]',
]
const LABELS = ['bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500']
const tint = (i?: number) => (i === undefined ? '' : TINTS[i % TINTS.length])
</script>

<template>
  <div class="flex h-full flex-col justify-center">
    <h3 v-if="scene.title" class="mb-2 text-xl font-bold sm:text-2xl">{{ scene.title }}</h3>
    <div v-if="html" ref="codeBox" class="lecture-code prose-doc mb-2 text-xs sm:text-sm [&_.md-code]:my-0" v-html="html" />

    <!-- 표가 화면보다 넓으면 잘리지 않게 이 부분만 통째로 줄인다 (zoom 은 레이아웃 크기도 줄여서 아래 결과표가 밀리지 않는다) -->
    <div ref="fitBox" class="w-full">
    <div ref="wide" class="w-max min-w-full" :style="{ zoom }">
    <div class="flex items-start gap-2">
      <div v-for="{ name, view } in views" :key="name" class="flex-auto">
        <div class="mb-1 inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">{{ name }}</div>
        <div class="overflow-hidden rounded-xl border">
          <table class="w-full border-collapse text-sm sm:text-base">
            <thead>
              <tr class="bg-muted">
                <th v-if="view.grouped" class="w-0 px-1" />
                <th
                  v-for="c in view.columns"
                  :key="c.name"
                  :class="
                    cn(
                      'px-2.5 py-1.5 text-left font-semibold whitespace-nowrap transition-colors duration-300',
                      c.hot && 'bg-primary text-primary-foreground',
                      c.fresh && 'col-fresh',
                    )
                  "
                >
                  {{ c.name }}
                </th>
              </tr>
            </thead>
            <TransitionGroup tag="tbody" name="row">
              <tr
                v-for="(r, pos) in view.rows"
                :key="r.id"
                :class="
                  cn(
                    'border-t transition-colors duration-300',
                    tint(r.tint),
                    r.hot && 'row-hot',
                    r.rejected && 'row-rejected',
                  )
                "
              >
                <td v-if="view.grouped" class="px-1 align-middle">
                  <span
                    v-if="r.groupLabel !== undefined"
                    :class="cn('pop-in inline-block rounded-full px-1.5 text-[0.7em] font-bold whitespace-nowrap text-white', LABELS[(r.tint ?? 0) % LABELS.length])"
                  >
                    {{ isNull(r.groupLabel) ? 'NULL' : r.groupLabel }}
                  </span>
                </td>
                <td
                  v-for="(cell, j) in r.cells"
                  :key="`${j}-${cell.text}`"
                  :class="
                    cn(
                      'relative px-2.5 py-1.5 whitespace-nowrap tabular-nums transition-colors duration-300',
                      view.columns[j]!.hot && !r.hot && 'bg-primary/10',
                      cell.hot && 'cell-hot',
                      cell.changed && 'cell-changed',
                      cell.fresh && 'cell-fresh',
                      cell.text === 'NULL' && 'text-muted-foreground italic',
                    )
                  "
                  :style="cell.fresh || cell.changed ? { animationDelay: `${pos * 90}ms` } : undefined"
                >
                  <span class="lecture-inline" v-html="renderInline(cell.text)" />
                  <span
                    v-if="cell.note"
                    class="pop-in ml-1.5 inline-block rounded-md bg-highlight px-1.5 py-px text-[0.75em] font-semibold text-ink not-italic"
                  >
                    {{ cell.note }}
                  </span>
                </td>
              </tr>
            </TransitionGroup>
          </table>
        </div>
      </div>
    </div>

    <!-- 결과표 조립 ('NULL' 만 NULL 로, 빈 칸은 아직 채우지 않은 칸) -->
    <template v-for="{ name, view } in views" :key="`result-${name}`">
      <div v-if="view.result" class="mt-2">
        <ArrowDown :class="cn('mx-auto size-5 text-primary', view.result.fresh && 'arrow-drop')" />
        <div v-if="view.result.title" class="mb-1 inline-block rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          {{ view.result.title }}
        </div>
        <div class="overflow-hidden rounded-xl border-2 border-primary">
          <table class="w-full border-collapse text-sm sm:text-base">
            <thead>
              <tr class="bg-primary/15">
                <th v-for="c in view.result.columns" :key="c" class="px-2.5 py-1.5 text-left font-semibold whitespace-nowrap">{{ c }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in view.result.rows"
                :key="`${i}-${row.join('|')}`"
                :class="cn('border-t', view.result.newRows[i] && 'result-in')"
                :style="view.result.newRows[i] ? { animationDelay: `${150 + view.result.newRows.slice(0, i).filter(Boolean).length * 160}ms` } : undefined"
              >
                <td
                  v-for="(cell, j) in row"
                  :key="j"
                  :class="cn('px-2.5 py-1.5 whitespace-nowrap tabular-nums', cell === 'NULL' && 'text-muted-foreground italic')"
                >
                  <span class="lecture-inline" v-html="renderInline(cell)" />
                </td>
              </tr>
              <tr v-if="!view.result.rows.length" :class="cn('border-t', view.result.fresh && 'result-in')" :style="view.result.fresh ? { animationDelay: '150ms' } : undefined">
                <td :colspan="view.result.columns.length" class="px-3 py-3 text-center font-semibold text-destructive">결과 0건</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
    </div>
    </div>
    <p v-if="scene.caption" class="mt-3 text-sm text-muted-foreground">{{ scene.caption }}</p>
  </div>
</template>

<style scoped>
/* 표가 주인공이라 SQL 은 머리줄(언어·복사) 없이 작게 */
.lecture-code :deep(.md-code-head) { display: none; }
.lecture-code :deep(.md-code pre) { padding: 0.5rem 0.75rem; line-height: 1.5; font-size: 0.8rem; }
.lecture-code :deep(.line) {
  display: inline-block;
  min-width: 100%;
  border-radius: 4px;
  transition: opacity 0.3s, background-color 0.3s;
}
.lecture-code :deep(.line.is-dim) { opacity: 0.35; }
.lecture-code :deep(.line.is-focus) { background: color-mix(in oklch, var(--primary) 18%, transparent); }

/* 정렬·묶기: 행이 제자리로 미끄러진다 */
.row-move { transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1); }
.row-enter-active { transition: opacity 0.4s, transform 0.4s; }
.row-enter-from { opacity: 0; transform: translateY(-8px); }
.row-leave-active { transition: opacity 0.3s; }
.row-leave-to { opacity: 0; }

/* 지금 말하는 행: 두 번 반짝 */
.row-hot { background: color-mix(in oklch, var(--primary) 18%, transparent); font-weight: 600; animation: row-glow 0.9s ease-in-out 2; }
@keyframes row-glow {
  50% { background: color-mix(in oklch, var(--primary) 38%, transparent); }
}
/* 걸러질 행: 줄 긋고 흐리게 */
.row-rejected { text-decoration: line-through; text-decoration-thickness: 2px; text-decoration-color: var(--destructive); opacity: 0.45; background: color-mix(in oklch, var(--destructive) 10%, transparent); }

/* 지금 말하는 칸: 테두리가 맥박처럼 */
.cell-hot { background: color-mix(in oklch, var(--highlight) 45%, transparent); font-weight: 700; box-shadow: inset 0 0 0 2px var(--primary); animation: cell-pulse 0.8s ease-in-out 3; }
@keyframes cell-pulse {
  50% { box-shadow: inset 0 0 0 4px var(--primary); }
}
/* 값이 바뀐 칸 · 새로 채워진 칸 */
.cell-changed { animation: cell-flash 1s ease-out both; }
@keyframes cell-flash {
  0% { background: var(--highlight); transform: scale(1.12); }
  100% { background: transparent; transform: scale(1); }
}
.cell-fresh { animation: cell-fill 0.5s ease-out both; }
@keyframes cell-fill {
  from { opacity: 0; transform: translateX(-10px); background: color-mix(in oklch, var(--highlight) 60%, transparent); }
  to { opacity: 1; transform: none; }
}
.col-fresh { animation: cell-fill 0.4s ease-out both; }

/* 결과표가 한 줄씩 조립된다 */
.result-in { animation: result-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@keyframes result-in {
  0% { opacity: 0; transform: translateY(-14px) scale(0.96); background: color-mix(in oklch, var(--highlight) 50%, transparent); }
  40% { opacity: 1; transform: none; background: color-mix(in oklch, var(--highlight) 50%, transparent); }
  100% { background: transparent; }
}
.arrow-drop { animation: arrow-drop 0.6s ease-out both; }
@keyframes arrow-drop {
  from { opacity: 0; transform: translateY(-8px); }
}

.pop-in { animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes pop-in {
  from { opacity: 0; transform: scale(0.5); }
}

@media (prefers-reduced-motion: reduce) {
  .pop-in, .row-move, .row-hot, .cell-hot, .cell-changed, .cell-fresh, .col-fresh, .result-in, .arrow-drop { animation: none; transition: none; }
}
</style>
