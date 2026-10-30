<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronRight, Clock, FileQuestion, Sparkles } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import ProgressStat from '@/components/exam/ProgressStat.vue'
import { KIND_ROUTE, loadExamsByKind } from '@/lib/exams'
import { useProgressStore } from '@/stores/progress'
import type { ExamKind, ExamMeta } from '@/types'

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

const icon = computed(() => (props.kind === 'past' ? FileQuestion : Sparkles))
</script>

<template>
  <div v-if="loading" class="mt-8 space-y-3">
    <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-xl bg-muted" />
  </div>
  <p v-else-if="error" class="mt-8 text-sm text-destructive">{{ error }}</p>
  <div v-else-if="!exams.length" class="mt-8 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
    <slot name="empty">등록된 시험이 없습니다.</slot>
  </div>
  <ul v-else class="mt-8 space-y-3">
    <li v-for="exam in exams" :key="exam.id">
      <RouterLink
        :to="`${KIND_ROUTE[kind]}/${exam.id}`"
        class="flex items-center gap-4 rounded-xl border p-5 transition-colors hover:border-primary hover:bg-accent/40"
      >
        <component :is="icon" class="size-8 shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-semibold">{{ exam.title }}</span>
            <Badge variant="secondary">{{ exam.questionCount }}문항</Badge>
            <Badge v-if="exam.timeLimitMin" variant="outline" class="gap-1">
              <Clock class="size-3" /> {{ exam.timeLimitMin }}분
            </Badge>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            1과목 {{ exam.subjectCounts[1] }} · 2과목 {{ exam.subjectCounts[2] }}
            <template v-if="exam.subjectCounts[3]"> · 3과목 {{ exam.subjectCounts[3] }}</template>
            <template v-if="exam.practicalCount"> · 실기 {{ exam.practicalCount }}</template>
            <template v-if="exam.description"> · {{ exam.description }}</template>
          </p>
          <ProgressStat class="mt-2.5" :stats="progress.statsByExam(exam.id, exam.questionCount)" />
        </div>
        <ChevronRight class="size-5 text-muted-foreground" />
      </RouterLink>
    </li>
  </ul>
</template>
