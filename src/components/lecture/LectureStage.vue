<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import CalloutScene from '@/components/lecture/scenes/CalloutScene.vue'
import CardsScene from '@/components/lecture/scenes/CardsScene.vue'
import ChecklistScene from '@/components/lecture/scenes/ChecklistScene.vue'
import CodeScene from '@/components/lecture/scenes/CodeScene.vue'
import CompareScene from '@/components/lecture/scenes/CompareScene.vue'
import DataScene from '@/components/lecture/scenes/DataScene.vue'
import FlowScene from '@/components/lecture/scenes/FlowScene.vue'
import LayersScene from '@/components/lecture/scenes/LayersScene.vue'
import PointsScene from '@/components/lecture/scenes/PointsScene.vue'
import QuizScene from '@/components/lecture/scenes/QuizScene.vue'
import TableScene from '@/components/lecture/scenes/TableScene.vue'
import TitleScene from '@/components/lecture/scenes/TitleScene.vue'
import type { LectureScene, LectureTable } from '@/types'

/**
 * 장면 종류에 맞는 화면을 골라 그린다.
 * 장면이 무대보다 크면 비율을 유지한 채 줄여서 스크롤 없이 한 화면에 다 보이게 한다 (휴대폰 대응)
 */
const props = defineProps<{
  scene: LectureScene
  focus: number[]
  /** 장면 안에서 지금 단계 (data 장면은 처음부터 지금까지의 변화를 쌓는다) */
  stepIndex: number
  /** 강의의 예제 표 (data 장면) */
  tables?: Record<string, LectureTable>
  revealed: number
  chosen?: number
  /** 퀴즈: 시간이 지나 정답을 자동 공개함 */
  auto?: boolean
  /** 퀴즈: 자동 공개까지 남은 초 */
  countdown?: number
}>()
const emit = defineEmits<{ answer: [choice: number] }>()

const VIEWS: Record<LectureScene['type'], Component> = {
  title: TitleScene,
  points: PointsScene,
  code: CodeScene,
  table: TableScene,
  data: DataScene,
  compare: CompareScene,
  callout: CalloutScene,
  quiz: QuizScene,
  cards: CardsScene,
  flow: FlowScene,
  layers: LayersScene,
  checklist: ChecklistScene,
}
const view = computed(() => VIEWS[props.scene.type])

/** 장면 종류마다 필요한 값만 넘긴다 */
const viewProps = computed(() => {
  const { scene, focus, revealed, chosen, auto, countdown, stepIndex, tables } = props
  switch (scene.type) {
    case 'points':
    case 'cards':
    case 'flow':
    case 'layers':
    case 'checklist':
      return { scene, focus, revealed }
    case 'code':
    case 'table':
    case 'compare':
      return { scene, focus }
    case 'data':
      return { scene, focus, stepIndex, tables }
    case 'quiz':
      return { scene, chosen, auto, countdown, onAnswer: (c: number) => emit('answer', c) }
    default:
      return { scene }
  }
})

// ── 한 화면에 맞추기 ──
const box = ref<HTMLElement>()
const content = ref<HTMLElement>()
const scale = ref(1)
function fit() {
  const b = box.value
  const c = content.value
  if (!b || !c || !c.offsetHeight) return
  // transform 은 레이아웃 크기를 바꾸지 않으므로 offset 크기가 원래 크기다
  scale.value = Math.min(1, b.clientHeight / c.offsetHeight, b.clientWidth / c.offsetWidth)
}
useResizeObserver(box, fit)
useResizeObserver(content, fit)
watch(() => props.scene.id, () => nextTick(fit))
</script>

<template>
  <div ref="box" class="lecture-stage relative h-full w-full overflow-hidden">
    <div
      ref="content"
      class="absolute top-1/2 left-1/2 w-full max-w-2xl px-1"
      :style="{ transform: `translate(-50%, -50%) scale(${scale})` }"
    >
      <Transition name="scene" mode="out-in" @after-enter="fit">
        <component :is="view" :key="scene.id" v-bind="viewProps" class="w-full py-2" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.scene-enter-active,
.scene-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.scene-enter-from { opacity: 0; transform: translateX(24px); }
.scene-leave-to { opacity: 0; transform: translateX(-24px); }

/* 한국어는 단어 중간에서 줄이 바뀌지 않게 (좁은 카드에서 '한 곳 / 에만' 방지) */
.lecture-stage { word-break: keep-all; overflow-wrap: anywhere; }

.lecture-stage :deep(.lecture-inline code) {
  border-radius: 4px;
  background: var(--muted);
  padding: 0.05em 0.35em;
  font-size: 0.9em;
}
</style>
