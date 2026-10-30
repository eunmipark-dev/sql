<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Check } from '@lucide/vue'
import { KIND_ROUTE, loadExamsByKind } from '@/lib/exams'
import { cn } from '@/lib/utils'
import { useProgressStore } from '@/stores/progress'
import type { ExamKind, ExamMeta } from '@/types'

/**
 * 모의고사 회차를 촘촘한 격자로 (한 화면에 20회가 다 들어오게).
 * 칸마다 진행 막대, 다 풀면 정답률. 문항 수·시간은 회차마다 같아서 위에 한 번만 적는다
 */
const props = defineProps<{ kind: ExamKind }>()

const progress = useProgressStore()
const exams = ref<ExamMeta[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    exams.value = await loadExamsByKind(props.kind)
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
})

/** 회차별 푼 수 · 맞힌 수 (문항마다 마지막 답 기준) */
const tiles = computed(() =>
  exams.value.map((exam) => {
    let solved = 0
    let correct = 0
    for (const r of Object.values(progress.records)) {
      if (r.examId !== exam.id || r.questionId > exam.questionCount) continue
      solved++
      if (r.correct) correct++
    }
    const done = solved >= exam.questionCount
    return { exam, solved, correct, done, accuracy: solved ? Math.round((correct / solved) * 100) : 0 }
  }),
)
const shape = computed(() => exams.value[0])
</script>

<template>
  <div v-if="loading" class="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-5">
    <div v-for="i in 10" :key="i" class="aspect-square animate-pulse rounded-2xl bg-muted" />
  </div>
  <p v-else-if="error" class="mt-8 text-sm text-destructive">{{ error }}</p>
  <template v-else-if="exams.length">
    <p v-if="shape" class="mt-6 text-xs text-muted-foreground">
      회차마다 {{ shape.questionCount }}문항<template v-if="shape.practicalCount"> + 실기 {{ shape.practicalCount }}</template
      ><template v-if="shape.timeLimitMin"> · {{ shape.timeLimitMin }}분</template> · 다 풀면 정답률을 보여드려요
    </p>
    <ol class="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
      <li v-for="t in tiles" :key="t.exam.id">
        <RouterLink
          :to="`${KIND_ROUTE[kind]}/${t.exam.id}`"
          :class="
            cn(
              'flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border p-2 transition-colors hover:border-primary',
              t.done ? 'border-success/40 bg-success/10' : t.solved ? 'border-primary/50 bg-primary/5' : '',
            )
          "
          :aria-label="`${t.exam.title} · ${t.done ? `정답률 ${t.accuracy}%` : t.solved ? `${t.solved}/${t.exam.questionCount} 풀이` : '안 풀었음'}`"
        >
          <span class="text-xl leading-none font-bold tabular-nums">{{ t.exam.round ?? '?' }}<span class="text-xs font-medium">회</span></span>
          <span v-if="t.done" class="inline-flex items-center gap-0.5 text-xs font-semibold text-success tabular-nums">
            <Check class="size-3" stroke-width="3" />{{ t.accuracy }}%
          </span>
          <template v-else-if="t.solved">
            <span class="h-1 w-3/4 overflow-hidden rounded-full bg-primary/15">
              <span class="block h-full rounded-full bg-primary" :style="{ width: `${(t.solved / t.exam.questionCount) * 100}%` }" />
            </span>
            <span class="text-[10px] text-muted-foreground tabular-nums">{{ t.solved }}/{{ t.exam.questionCount }}</span>
          </template>
          <span v-else class="text-[10px] text-muted-foreground">미응시</span>
        </RouterLink>
      </li>
    </ol>
  </template>
  <div v-else class="mt-8 rounded-xl border border-dashed p-10 text-center text-muted-foreground">등록된 시험이 없습니다.</div>
</template>
