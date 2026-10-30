<script setup lang="ts">
import { computed } from 'vue'
import { ClipboardCheck, PenLine } from '@lucide/vue'
import CodeBlock from '@/components/exam/CodeBlock.vue'
import { Textarea } from '@/components/ui/textarea'
import { renderBlock } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { PracticalQuestion } from '@/types'

/**
 * SQLP 실기 (서술형) 문항.
 * 답안을 직접 작성하고, 공개되면 모범 답안과 채점 포인트를 보여준다.
 * scoring 이면 채점 포인트를 체크해 스스로 점수를 매긴다 (자가 채점).
 */
const props = defineProps<{
  practical: PracticalQuestion
  number: number
  /** 작성한 답안 */
  text: string
  /** 모범 답안·해설 공개 여부 (공개 후에는 답안 수정 불가) */
  revealed?: boolean
  /** 채점 포인트 체크 상태 (자가 채점). 없으면 체크박스를 보여주지 않는다 */
  scoring?: boolean[]
}>()

const emit = defineEmits<{ 'update:text': [text: string]; 'update:scoring': [scoring: boolean[]] }>()

const max = computed(() => props.practical.rubric.reduce((n, r) => n + r.score, 0))
const score = computed(() =>
  props.practical.rubric.reduce((n, r, i) => n + (props.scoring?.[i] ? r.score : 0), 0),
)

function toggle(i: number) {
  const next = props.practical.rubric.map((_, j) => !!props.scoring?.[j])
  next[i] = !next[i]
  emit('update:scoring', next)
}
</script>

<template>
  <div>
    <div class="mb-4 flex gap-2 text-base leading-7 font-medium">
      <span class="shrink-0 font-bold text-primary">실기 {{ number }}.</span>
      <div class="min-w-0 flex-1">
        <div class="font-semibold">{{ practical.title }} <span class="text-sm font-normal text-muted-foreground">({{ max }}점)</span></div>
      </div>
    </div>

    <div class="q-body mb-4 text-sm leading-6" v-html="renderBlock(practical.question)" />
    <CodeBlock v-if="practical.code" :code="practical.code" class="mb-4" />

    <label class="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
      <PenLine class="size-4 text-primary" /> 내 답안
    </label>
    <Textarea
      :model-value="text"
      :readonly="revealed"
      spellcheck="false"
      placeholder="SQL이나 튜닝 방안을 작성하세요. (인덱스 설계, 힌트, 개선 SQL 등)"
      :class="cn('min-h-48 font-mono text-sm', revealed && 'bg-muted/40')"
      @update:model-value="(v) => emit('update:text', String(v))"
    />

    <div v-if="revealed" class="mt-4 space-y-4">
      <div>
        <div class="mb-1.5 text-sm font-semibold">모범 답안</div>
        <CodeBlock :code="practical.answer" />
      </div>
      <div class="rounded-lg bg-muted/60 p-4 text-sm leading-6">
        <div class="q-body text-muted-foreground" v-html="renderBlock(practical.explanation)" />
      </div>
      <div class="rounded-lg border p-4">
        <div class="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <ClipboardCheck class="size-4 text-primary" /> 채점 포인트
          <span v-if="scoring" class="ml-auto font-normal text-muted-foreground tabular-nums">
            자가 채점 <b class="text-foreground">{{ score }}</b> / {{ max }}점
          </span>
        </div>
        <ul class="space-y-1.5 text-sm">
          <li v-for="(r, i) in practical.rubric" :key="i">
            <label :class="cn('flex items-start gap-2', scoring && 'cursor-pointer')">
              <input
                v-if="scoring"
                type="checkbox"
                class="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                :checked="!!scoring[i]"
                @change="toggle(i)"
              />
              <span v-else class="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              <span class="flex-1">{{ r.point }}</span>
              <span class="shrink-0 text-muted-foreground tabular-nums">{{ r.score }}점</span>
            </label>
          </li>
        </ul>
        <p v-if="scoring" class="mt-2 text-xs text-muted-foreground">내 답안이 충족한 항목을 체크하면 총점에 반영돼요.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.q-body :deep(p) { margin: 0.4rem 0; }
.q-body :deep(p:first-child) { margin-top: 0; }
.q-body :deep(.md-table) {
  margin: 0.75rem 0;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) + 2px);
}
.q-body :deep(table) { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.q-body :deep(th) { background: var(--muted); padding: 0.4rem 0.75rem; text-align: left; font-weight: 600; white-space: nowrap; }
.q-body :deep(td) { padding: 0.4rem 0.75rem; border-top: 1px solid var(--border); white-space: nowrap; }
.q-body :deep(code) { border-radius: 4px; background: var(--muted); padding: 0.05em 0.35em; font-size: 0.88em; }
.q-body :deep(pre) { overflow-x: auto; border-radius: 6px; background: var(--muted); padding: 0.75rem; font-size: 0.8rem; }
.q-body :deep(ul), .q-body :deep(ol) { margin: 0.4rem 0; padding-left: 1.25rem; list-style: disc; }
</style>
