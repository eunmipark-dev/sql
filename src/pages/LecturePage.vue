<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import { BookOpen, Check, CircleHelp, Clock, Flame, Layers, ListOrdered, PencilLine, Play, RotateCcw, SkipForward, Target, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import LectureControls from '@/components/lecture/LectureControls.vue'
import LectureProgress from '@/components/lecture/LectureProgress.vue'
import LectureStage from '@/components/lecture/LectureStage.vue'
import SceneList from '@/components/lecture/SceneList.vue'
import { useLecturePlayer } from '@/composables/useLecturePlayer'
import { findDoc } from '@/lib/content'
import { KIND_ROUTE, loadBankIndex } from '@/lib/exams'
import { lectureIcon } from '@/lib/lectureIcons'
import { lectureParts, minutesLabel, partOf, type LecturePart } from '@/lib/lectureParts'
import { hasLecture, loadLecture, markPartDone, readDoneParts, readLecturePos, writeLecturePos } from '@/lib/lectures'
import { getSpeaker } from '@/lib/tts'
import { cn } from '@/lib/utils'
import { useActivityStore } from '@/stores/activity'
import { useTheoryStore } from '@/stores/theory'
import { useCertStore } from '@/stores/cert'
import type { Lecture } from '@/types'

const route = useRoute()
const router = useRouter()
const theory = useTheoryStore()
const certStore = useCertStore()
const activity = useActivityStore()
const slug = computed(() => String(route.params.slug))
const doc = computed(() => findDoc(slug.value))

const lecture = ref<Lecture>()
const loadError = ref('')

// ── 파트: 강의를 3~4분 단위로 나눠 하나씩 재생한다 (lib/lectureParts) ──
const partIndex = ref(0)
const parts = computed<LecturePart[]>(() => {
  const l = lecture.value
  if (!l) return []
  const list = lectureParts(slug.value)
  // 요약이 강의와 안 맞으면(새로 고친 강의를 아직 검사 안 함) 한 파트로
  if (list.length && list[list.length - 1]!.end === l.scenes.length) return list
  const quizzes = l.scenes.filter((s) => s.type === 'quiz').length
  return [{ index: 0, start: 0, end: l.scenes.length, title: l.title, sections: [], ms: 0, quizzes }]
})
const part = computed(() => parts.value[partIndex.value])
const isLastPart = computed(() => partIndex.value >= parts.value.length - 1)
const totalMs = computed(() => parts.value.reduce((n, p) => n + p.ms, 0))
/** 재생기에는 지금 파트의 장면만 넘긴다 (바뀌면 재생기가 처음으로 돌아간다) */
const partLecture = computed<Lecture | undefined>(() =>
  lecture.value && part.value ? { ...lecture.value, scenes: lecture.value.scenes.slice(part.value.start, part.value.end) } : undefined,
)
const player = useLecturePlayer(partLecture)
const { scene, sceneIndex, playing, finished, caption, waiting } = player
/** 강의 전체 기준 장면 번호 */
const absIndex = computed(() => (part.value?.start ?? 0) + sceneIndex.value)
/** 끝까지 들은 파트 */
const doneParts = ref(new Set<number>())

const titleScene = computed(() => {
  const s = lecture.value?.scenes.find((x) => x.type === 'title')
  return s?.type === 'title' ? s : undefined
})
const coverIcon = computed(() => lectureIcon(titleScene.value?.icon) ?? BookOpen)
const quizTotal = computed(() => lecture.value?.scenes.filter((s) => s.type === 'quiz').length ?? 0)

/** 처음 들어와서 아직 재생을 누르지 않았는지 (브라우저는 사용자가 누른 뒤에만 소리를 낸다) */
const notStarted = ref(true)
const listOpen = ref(false)
/** 지난번 위치 (강의 전체 기준 장면 번호, 0이면 처음부터) */
const resumedFrom = ref(0)
const practice = ref({ ai: 0, sqlp: 0 })

// ── 들은 시간: 하루 학습량(연속 학습일)에 더하고, 완료 화면에 보여준다 ──
let playStart: number | undefined
/** 아직 하루 학습량에 더하지 않은 재생 시간 */
let unsavedMs = 0
/** 이번 파트에서 들은 시간 (완료 화면) */
const partMs = ref(0)
function tick() {
  if (playStart === undefined) return
  const now = Date.now()
  unsavedMs += now - playStart
  partMs.value += now - playStart
  playStart = now
}
watch(playing, (p) => {
  tick()
  playStart = p ? Date.now() : undefined
})
/** 들은 시간을 하루 학습량에 더한다 (파트를 다 들었으면 파트 수도) */
function flushTime(partDone = false) {
  tick()
  if (partDone || unsavedMs >= 5_000) void activity.addLecture(unsavedMs, partDone)
  unsavedMs = 0
}

/** 이번 파트 퀴즈 결과 (시간이 지나 자동 공개된 건 못 맞힌 것으로) */
const quizResult = computed(() => {
  let total = 0
  let correct = 0
  for (const s of player.scenes.value) {
    if (s.type !== 'quiz') continue
    total++
    if (player.quizAnswers.value[s.id] === s.answer && !player.autoRevealed.value[s.id]) correct++
  }
  return { total, correct }
})

// ── 다음 파트·강의 자동 재생 (운전 중처럼 화면을 보기 어려울 때 이어서 듣기) ──
const NEXT_DELAY_SEC = 8
const AUTO_NEXT_KEY = 'sql-cert:lecture-autonext'
function readAutoNext() {
  try {
    return localStorage.getItem(AUTO_NEXT_KEY) !== 'off'
  } catch {
    return true
  }
}
/** 연속 재생 켜기 (기본 켜짐, 이 기기에 기억) */
const autoNext = ref(readAutoNext())
watch(autoNext, (on) => {
  try {
    localStorage.setItem(AUTO_NEXT_KEY, on ? 'on' : 'off')
  } catch {
    // 저장이 막혀 있으면 이번 방문 동안만
  }
  if (!on) cancelNext()
})

/** 선택한 자격증 범위에서 이 강의 다음 강의 (이론 순서) */
const nextDoc = computed(() => {
  const list = certStore.docs.filter((d) => hasLecture(d.slug))
  const i = list.findIndex((d) => d.slug === slug.value)
  return i >= 0 ? list[i + 1] : undefined
})
/** 다 들은 뒤 이어서 들을 것: 다음 파트, 마지막 파트면 다음 강의 */
const nextUp = computed(() => {
  if (!isLastPart.value) {
    const p = parts.value[partIndex.value + 1]!
    return { label: '다음 파트', title: `${p.index + 1}. ${p.title}`, notice: `이어서 파트 ${p.index + 1}, ${p.title}입니다.` }
  }
  const d = nextDoc.value
  return d ? { label: '다음 강의', title: d.title, notice: `다음 강의는 ${d.title}입니다. 잠시 뒤 이어서 들려드릴게요.` } : undefined
})
/** 다음까지 남은 초 (세는 중일 때만) */
const nextCountdown = ref<number>()
let nextTimer: ReturnType<typeof setInterval> | undefined

function cancelNext() {
  clearInterval(nextTimer)
  nextTimer = undefined
  if (nextCountdown.value !== undefined) getSpeaker().stop()
  nextCountdown.value = undefined
}

/** 다 들으면: 다음 것을 소리로 알리고 몇 초 뒤 넘어간다 (화면을 못 봐도 알 수 있게) */
function scheduleNext(done: string) {
  const target = nextUp.value
  if (!autoNext.value || !target) return
  nextCountdown.value = NEXT_DELAY_SEC
  const notice = `${done} ${target.notice}`
  caption.value = notice
  const speaker = getSpeaker()
  if (player.voice.value && speaker.available) void speaker.speak(notice, player.rate.value)
  nextTimer = setInterval(() => {
    nextCountdown.value = (nextCountdown.value ?? 1) - 1
    if (nextCountdown.value <= 0) goNext()
  }, 1000)
}

function goNext() {
  cancelNext()
  if (!isLastPart.value) return startPart(partIndex.value + 1)
  const target = nextDoc.value
  if (target) void router.replace({ name: 'lecture', params: { slug: target.slug }, query: { autoplay: '1' } })
}

/** 파트를 처음부터 재생 */
function startPart(i: number) {
  cancelNext()
  flushTime()
  partMs.value = 0
  // 다른 파트면 재생기가 새 장면 목록을 받아 처음으로 돌아가고, 같은 파트면 직접 처음으로
  if (i === partIndex.value) player.reset()
  else partIndex.value = i
  start()
}

onBeforeUnmount(() => {
  cancelNext()
  flushTime()
})

watch(
  slug,
  async (s) => {
    cancelNext()
    flushTime()
    lecture.value = undefined
    loadError.value = ''
    notStarted.value = true
    partMs.value = 0
    try {
      const l = await loadLecture(s)
      const saved = readLecturePos(s)
      resumedFrom.value = saved > 0 && saved < l.scenes.length ? saved : 0
      doneParts.value = readDoneParts(s)
      partIndex.value = 0
      lecture.value = l
      document.title = `${l.title} 강의 · SQL 자격증`
      const p = partOf(parts.value, resumedFrom.value)
      partIndex.value = p?.index ?? 0
      if (resumedFrom.value) player.goScene(resumedFrom.value - (p?.start ?? 0))
      void theory.view(s)
      // 앞 강의에서 자동으로 넘어왔으면 표지 없이 바로 재생
      if (route.query.autoplay) start()
    } catch (e) {
      loadError.value = String(e instanceof Error ? e.message : e)
    }
    Promise.all([loadBankIndex('ai'), loadBankIndex('sqlp')])
      .then(([ai, sqlp]) => (practice.value = { ai: ai[s]?.count ?? 0, sqlp: sqlp[s]?.count ?? 0 }))
      .catch(() => {})
  },
  { immediate: true },
)

watch(absIndex, (i) => lecture.value && !notStarted.value && writeLecturePos(slug.value, i, lecture.value.scenes.length))

// 파트를 끝까지 들으면 기록하고, 마지막 파트면 이론 '학습 완료' + 다음에 열면 처음부터
watch(finished, (done) => {
  const l = lecture.value
  if (!done || !l || !part.value) return
  flushTime(true)
  markPartDone(slug.value, partIndex.value)
  doneParts.value = readDoneParts(slug.value)
  if (isLastPart.value) {
    writeLecturePos(slug.value, 0, l.scenes.length)
    if (!theory.records[slug.value]?.completedAt) void theory.setCompleted(slug.value, true)
    scheduleNext('강의를 모두 들었어요.')
  } else {
    // 다음에 열면 다음 파트부터
    writeLecturePos(slug.value, part.value.end, l.scenes.length)
    scheduleNext(`파트 ${partIndex.value + 1}을 마쳤어요.`)
  }
})

function start() {
  notStarted.value = false
  player.play()
}

/** 처음부터: 첫 파트부터 다시 */
function restart() {
  resumedFrom.value = 0
  startPart(0)
}

/** 장면 목록에서 고른 장면 (강의 전체 기준 번호) */
function select(i: number) {
  listOpen.value = false
  notStarted.value = false
  cancelNext()
  const p = partOf(parts.value, i)
  if (p && p.index !== partIndex.value) {
    flushTime()
    partMs.value = 0
    partIndex.value = p.index
  }
  player.goScene(i - (p?.start ?? 0))
}

/** 닫기: 들어온 화면으로 돌아가고, 바로 열었으면 강의 목록으로 */
function close() {
  cancelNext()
  player.pause()
  if (window.history.state?.back) router.back()
  else void router.push('/lectures')
}

// 키보드: Space 재생/정지, ←/→ 이전/다음, Esc 닫기 (버튼·입력창에 포커스가 있으면 그쪽 동작을 따른다)
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (listOpen.value) listOpen.value = false
    else close()
    return
  }
  const el = e.target as HTMLElement | null
  if (el?.closest('button, input, select, textarea, a')) return
  if (e.key === ' ') {
    e.preventDefault()
    if (notStarted.value) start()
    else player.toggle()
  } else if (e.key === 'ArrowRight') player.next()
  else if (e.key === 'ArrowLeft') player.prev()
})

const goalPct = computed(() => Math.min(100, Math.round((activity.todayPoints / activity.goal) * 100)))
</script>

<template>
  <!-- 강의는 Speak 처럼 화면 전체를 쓴다 (헤더·하단 탭 위에 덮음). 시스템 바 여백은 --inset-* -->
  <div
    class="fixed inset-0 z-50 flex flex-col bg-background pt-(--inset-top) pr-(--inset-right) pb-(--inset-bottom) pl-(--inset-left)"
    role="dialog"
    :aria-label="`${lecture?.title ?? doc?.title ?? ''} 강의`"
  >
    <div v-if="loadError" class="m-auto p-6 text-center text-muted-foreground">
      {{ loadError }}
      <Button variant="outline" class="mt-4" @click="close"><X class="size-4" /> 닫기</Button>
    </div>

    <div v-else class="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4">
      <!-- 상단: 닫기 · 제목 · 장면 목록 / 진행 막대 -->
      <header class="flex items-center gap-2 pt-2 pb-2">
        <Button variant="ghost" size="icon" class="size-10 rounded-full" aria-label="강의 닫기 (Esc)" @click="close">
          <X class="size-5" />
        </Button>
        <div class="min-w-0 flex-1 text-center">
          <div class="truncate text-sm font-semibold">{{ lecture?.title ?? doc?.title }}</div>
          <div v-if="lecture && !notStarted" class="truncate text-xs text-muted-foreground">
            <template v-if="parts.length > 1">파트 {{ partIndex + 1 }}/{{ parts.length }} · </template>{{ scene?.section }}
          </div>
        </div>
        <Button variant="ghost" size="icon" class="size-10 rounded-full" aria-label="장면 목록" @click="listOpen = true">
          <ListOrdered class="size-5" />
        </Button>
      </header>
      <LectureProgress v-if="lecture && !notStarted" :player="player" />

      <!-- 무대: 장면은 스크롤 없이 한 화면에 맞춰진다 -->
      <div class="relative mt-3 min-h-0 flex-1">
        <div v-if="!lecture" class="h-full animate-pulse rounded-3xl bg-muted" />
        <LectureStage
          v-else-if="scene && !notStarted"
          :scene="scene"
          :focus="player.focus.value"
          :step-index="player.stepIndex.value"
          :tables="lecture.tables"
          :revealed="player.revealed.value"
          :chosen="player.quizAnswers.value[scene.id]"
          :auto="player.autoRevealed.value[scene.id]"
          :countdown="player.quizCountdown.value"
          @answer="player.answer"
        />

        <!-- 표지: 무엇을 얼마나 듣는지 보여주고 시작 -->
        <div
          v-if="lecture && notStarted"
          class="absolute inset-0 flex flex-col items-center justify-center-safe gap-5 overflow-y-auto px-1 py-4 text-center"
        >
          <span class="pop-in grid size-20 shrink-0 place-items-center rounded-[1.75rem] bg-highlight text-ink shadow-lg shadow-highlight/40">
            <component :is="coverIcon" class="size-10" />
          </span>
          <div>
            <h1 class="text-3xl font-bold tracking-tight break-keep">{{ lecture.title }}</h1>
            <p v-if="titleScene?.subtitle" class="mt-1.5 text-muted-foreground break-keep">{{ titleScene.subtitle }}</p>
          </div>
          <div class="flex flex-wrap justify-center gap-2 text-sm">
            <span v-if="totalMs" class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1"><Clock class="size-4" /> {{ minutesLabel(totalMs) }}</span>
            <span v-if="parts.length > 1" class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1"><Layers class="size-4" /> 파트 {{ parts.length }}</span>
            <span class="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1"><CircleHelp class="size-4" /> 퀴즈 {{ quizTotal }}</span>
          </div>

          <!-- 파트 목록: 눌러서 그 파트부터 -->
          <ol v-if="parts.length > 1" class="w-full max-w-sm space-y-2 text-left">
            <li v-for="p in parts" :key="p.index">
              <button
                type="button"
                :class="
                  cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:border-primary',
                    resumedFrom && p.index === partIndex && 'border-primary bg-primary/5',
                  )
                "
                @click="startPart(p.index)"
              >
                <span
                  :class="
                    cn(
                      'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                      doneParts.has(p.index) ? 'bg-success text-white' : 'bg-muted text-muted-foreground',
                    )
                  "
                >
                  <Check v-if="doneParts.has(p.index)" class="size-4" stroke-width="3" />
                  <template v-else>{{ p.index + 1 }}</template>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{{ p.title }}</span>
                  <span class="block truncate text-xs text-muted-foreground">
                    {{ minutesLabel(p.ms) }}<template v-if="p.quizzes"> · 퀴즈 {{ p.quizzes }}</template
                    ><template v-if="p.sections.length > 1"> · {{ p.sections.slice(1).join(', ') }}</template>
                  </span>
                </span>
                <Play class="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          </ol>

          <!-- 이어 듣기·처음부터는 운전 중에도 누르기 쉽게 같은 크기로 -->
          <div class="flex w-full max-w-sm flex-col gap-3">
            <Button size="lg" class="h-16 w-full rounded-full text-lg shadow-lg shadow-primary/30" @click="start">
              <Play class="size-6" />
              <template v-if="resumedFrom">이어 듣기<span v-if="parts.length > 1" class="font-normal opacity-80"> · 파트 {{ partIndex + 1 }}</span></template>
              <template v-else>강의 시작</template>
            </Button>
            <Button v-if="resumedFrom" variant="outline" size="lg" class="h-16 w-full rounded-full text-lg" @click="restart">
              <RotateCcw class="size-6" /> 처음부터 듣기
            </Button>
          </div>
          <p class="hidden text-xs text-muted-foreground sm:block">Space 재생·정지 · ←/→ 이전·다음 · Esc 닫기</p>
        </div>

        <!-- 파트·강의를 다 들었을 때 -->
        <div
          v-if="finished"
          class="absolute inset-0 flex flex-col items-center justify-center-safe gap-4 overflow-y-auto bg-background px-1 py-4 text-center"
        >
          <span class="pop-in grid size-16 shrink-0 place-items-center rounded-full bg-highlight text-ink">
            <Check class="size-9" stroke-width="3" />
          </span>
          <div>
            <p class="text-2xl font-bold">{{ isLastPart ? '강의를 다 들었어요' : `파트 ${partIndex + 1} 완료` }}</p>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ isLastPart ? "이론 목차에 '학습 완료'로 기록했어요." : `${parts.length}개 중 ${partIndex + 1}번째 파트를 마쳤어요.` }}
            </p>
          </div>

          <!-- 이번 파트 결과 -->
          <dl class="grid w-full max-w-sm grid-cols-3 gap-2">
            <div class="rounded-2xl border p-3">
              <dt class="text-xs text-muted-foreground">퀴즈</dt>
              <dd class="mt-0.5 text-xl font-bold tabular-nums">
                <template v-if="quizResult.total">{{ quizResult.correct }}<span class="text-sm font-normal text-muted-foreground">/{{ quizResult.total }}</span></template>
                <template v-else>-</template>
              </dd>
            </div>
            <div class="rounded-2xl border p-3">
              <dt class="text-xs text-muted-foreground">들은 시간</dt>
              <dd class="mt-0.5 text-xl font-bold tabular-nums">{{ Math.max(1, Math.round(partMs / 60_000)) }}<span class="text-sm font-normal">분</span></dd>
            </div>
            <div class="rounded-2xl border p-3">
              <dt class="text-xs text-muted-foreground">연속 학습</dt>
              <dd class="mt-0.5 flex items-center justify-center gap-0.5 text-xl font-bold tabular-nums">
                <Flame class="size-5 fill-orange-400 text-orange-500" />{{ activity.streak }}<span class="text-sm font-normal">일</span>
              </dd>
            </div>
          </dl>
          <div class="w-full max-w-sm rounded-2xl bg-muted/60 px-4 py-3 text-left">
            <div class="flex items-center gap-1.5 text-sm font-medium">
              <Target class="size-4 text-primary" />
              <template v-if="activity.goalMet">오늘 목표 달성! 🎉</template>
              <template v-else>오늘 목표 {{ activity.todayPoints }} / {{ activity.goal }}</template>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-background">
              <div class="h-full rounded-full bg-primary transition-[width] duration-700" :style="{ width: `${goalPct}%` }" />
            </div>
          </div>

          <!-- 다음 파트·강의: 남은 시간을 원으로 보여주고 0이 되면 넘어간다 -->
          <div v-if="nextUp" class="w-full max-w-sm rounded-2xl border bg-card p-4">
            <div class="flex items-center gap-3 text-left">
              <div class="relative size-14 shrink-0">
                <svg viewBox="0 0 36 36" class="size-14 -rotate-90">
                  <circle cx="18" cy="18" r="16" fill="none" stroke="var(--muted)" stroke-width="3" />
                  <circle
                    v-if="nextCountdown !== undefined"
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="var(--primary)"
                    stroke-width="3"
                    stroke-linecap="round"
                    :stroke-dasharray="100.5"
                    :stroke-dashoffset="100.5 * (1 - nextCountdown / NEXT_DELAY_SEC)"
                    class="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  />
                </svg>
                <span class="absolute inset-0 flex items-center justify-center text-lg font-bold tabular-nums">
                  <template v-if="nextCountdown !== undefined">{{ nextCountdown }}</template>
                  <SkipForward v-else class="size-5 text-muted-foreground" />
                </span>
              </div>
              <div class="min-w-0">
                <div class="text-xs text-muted-foreground">{{ nextUp.label }}</div>
                <div class="truncate font-semibold">{{ nextUp.title }}</div>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <Button class="flex-1" @click="goNext"><Play class="size-4" /> 바로 듣기</Button>
              <Button v-if="nextCountdown !== undefined" variant="outline" class="flex-1" @click="cancelNext">취소</Button>
            </div>
            <label class="mt-3 flex cursor-pointer items-center justify-center gap-2 text-xs text-muted-foreground">
              <input v-model="autoNext" type="checkbox" class="size-4 accent-[var(--primary)]" /> 다 들으면 이어서 자동 재생
            </label>
          </div>
          <p v-else class="text-sm text-muted-foreground">{{ certStore.info.label }} 범위의 마지막 강의예요. 🎉</p>

          <div class="flex w-full max-w-sm flex-col gap-2">
            <template v-if="isLastPart">
              <template v-for="k in [certStore.examKind]" :key="k">
                <Button v-if="practice[k]" size="lg" as-child>
                  <RouterLink :to="`${KIND_ROUTE[k]}/topic/${slug}`">
                    <PencilLine class="size-4" /> {{ certStore.info.label }} 문제 {{ practice[k] }}개 풀기
                  </RouterLink>
                </Button>
              </template>
              <Button variant="outline" as-child>
                <RouterLink :to="{ name: 'theory', params: { slug } }"><BookOpen class="size-4" /> 문서로 복습</RouterLink>
              </Button>
            </template>
            <div class="flex gap-2">
              <Button variant="ghost" class="flex-1" @click="startPart(partIndex)">
                <RotateCcw class="size-4" /> {{ parts.length > 1 ? '이 파트 다시' : '다시 듣기' }}
              </Button>
              <Button variant="ghost" class="flex-1" @click="close"><X class="size-4" /> 그만 듣기</Button>
            </div>
          </div>
        </div>
      </div>

      <template v-if="!notStarted">
        <!-- 자막: 지금 읽는 문장을 크게 -->
        <p
          class="mt-3 flex min-h-[5.5rem] items-center justify-center px-2 text-center text-lg leading-relaxed font-medium break-keep sm:text-xl"
          aria-live="polite"
        >
          <span v-if="waiting" class="text-primary">
            답을 골라 보세요<template v-if="player.quizCountdown.value"> · {{ player.quizCountdown.value }}초 뒤 정답 공개</template>
          </span>
          <span v-else>{{ caption }}</span>
        </p>

        <LectureControls class="pt-1 pb-3" :player="player" />
      </template>
      <p v-if="!player.voiceAvailable" class="pb-2 text-center text-xs text-muted-foreground">
        이 브라우저는 음성 읽기를 지원하지 않아 자막만 보여드려요.
      </p>
      <p
        v-else-if="player.voiceProblem.value && player.voice.value"
        class="flex flex-wrap items-center justify-center gap-2 pb-2 text-center text-xs text-muted-foreground"
      >
        {{ player.voiceProblem.value }}
        <Button v-if="player.openVoiceSettings" variant="link" size="sm" class="h-auto p-0 text-xs" @click="player.openVoiceSettings()">
          한국어 음성 데이터 설치
        </Button>
      </p>
      <span class="sr-only">{{ playing ? '재생 중' : '일시정지' }}</span>
    </div>

    <!-- 장면 목록 서랍 -->
    <div v-if="listOpen" class="fixed inset-0 z-10 bg-black/40" @click="listOpen = false" />
    <aside
      class="fixed top-(--inset-top) right-(--inset-right) bottom-(--inset-bottom) z-20 w-72 max-w-[85vw] overflow-y-auto rounded-l-2xl border-l bg-background p-4 transition-transform"
      :class="listOpen ? 'translate-x-0' : 'translate-x-[110%]'"
    >
      <SceneList :scenes="lecture?.scenes ?? []" :parts="parts.length > 1 ? parts : undefined" :current="absIndex" @select="select" />
    </aside>
  </div>
</template>

<style scoped>
.pop-in { animation: pop-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes pop-in {
  from { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  to { opacity: 1; transform: scale(1) rotate(0); }
}
@media (prefers-reduced-motion: reduce) { .pop-in { animation: none; } }
</style>
