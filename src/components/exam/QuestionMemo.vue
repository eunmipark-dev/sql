<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Check, Loader2 } from '@lucide/vue'
import { Textarea } from '@/components/ui/textarea'
import { useQuestionNotesStore } from '@/stores/questionNotes'

/** 문제별 개인 메모. 입력을 멈추면 자동 저장 (비우면 삭제) */
const props = defineProps<{ examId: string; questionId: number }>()

const store = useQuestionNotesStore()
const text = ref(store.memoOf(props.examId, props.questionId))
const state = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let dirty = false

watch(
  () => [props.examId, props.questionId] as const,
  ([e, q], [prevE, prevQ]) => {
    // 저장 전에 다른 문제로 넘어가면 이전 문제에 먼저 저장한다
    if (dirty) void store.save(prevE, prevQ, text.value).catch((err) => console.error('[메모 저장 실패]', err))
    text.value = store.memoOf(e, q)
    state.value = 'idle'
    dirty = false
  },
)

async function save() {
  if (!dirty) return
  dirty = false
  state.value = 'saving'
  try {
    await store.save(props.examId, props.questionId, text.value)
    state.value = 'saved'
  } catch (e) {
    console.error('[메모 저장 실패]', e)
    state.value = 'error'
  }
}
const saveSoon = useDebounceFn(save, 800)

function onInput(v: string | number) {
  text.value = String(v)
  dirty = true
  void saveSoon()
}

onBeforeUnmount(() => void save())
</script>

<template>
  <div>
    <Textarea
      :model-value="text"
      maxlength="2000"
      placeholder="나만 보는 메모 (헷갈린 포인트, 외울 내용 등)"
      class="min-h-20 bg-background text-sm"
      @update:model-value="onInput"
      @blur="save"
    />
    <p class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
      <template v-if="state === 'saving'"><Loader2 class="size-3 animate-spin" /> 저장 중…</template>
      <template v-else-if="state === 'saved'"><Check class="size-3 text-success" /> 저장했어요</template>
      <span v-else-if="state === 'error'" class="text-destructive">저장하지 못했어요. 잠시 후 다시 입력해 주세요.</span>
      <template v-else>입력을 멈추면 자동으로 저장돼요.</template>
    </p>
  </div>
</template>
