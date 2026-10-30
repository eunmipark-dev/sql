import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { estimateMs, getSpeaker } from '@/lib/tts'
import type { Lecture, LectureScene } from '@/types'

/** 단계 사이·장면 사이 쉬는 시간 (ms) */
const STEP_GAP = 500
const SCENE_GAP = 900
const CIRCLED = ['①', '②', '③', '④', '⑤']
/** 퀴즈에서 답을 기다리는 시간(초). 지나면 정답을 공개하고 해설을 읽는다 (운전 중처럼 누르기 어려울 때) */
const QUIZ_WAIT_SEC = 8
/** 보기 글자를 소리로 읽을 수 있게 마크다운 기호를 뺀다 */
const plain = (md: string) => md.replace(/\*\*|`/g, '')

/**
 * 강의 재생기.
 * - 장면(scene) 안의 단계(step)를 하나씩 읽고, 다 읽으면 다음 단계·장면으로 자동으로 넘어간다
 * - 퀴즈 장면은 문제를 읽은 뒤 답을 고를 때까지 기다리고, 고르면 해설을 읽고 이어간다
 * - 음성을 끄거나 쓸 수 없으면 자막만 보여주며 읽는 시간만큼 기다렸다 넘어간다
 * - 이전/다음/장면 이동은 언제든 가능하며, 진행 중인 읽기는 즉시 끊는다
 */
export function useLecturePlayer(lecture: Ref<Lecture | undefined>) {
  const speaker = getSpeaker()

  const sceneIndex = ref(0)
  const stepIndex = ref(0)
  const playing = ref(false)
  const finished = ref(false)
  /** 퀴즈 답을 기다리는 중 */
  const waiting = ref(false)
  const rate = ref(1)
  /** 음성 켜기 (끄면 자막만) */
  const voice = ref(speaker.available)
  /** 퀴즈 장면 id → 고른 답 */
  const quizAnswers = ref<Record<string, number>>({})
  /** 시간이 지나 정답을 자동으로 공개한 퀴즈 장면 id */
  const autoRevealed = ref<Record<string, boolean>>({})
  /** 정답 공개까지 남은 초 (기다리는 중일 때만) */
  const quizCountdown = ref<number>()
  let quizTimer: ReturnType<typeof setInterval> | undefined
  /** 지금 자막 (퀴즈 해설을 읽을 때는 해설) */
  const caption = ref('')
  /** 음성 읽기에 실패한 이유 (예: 한국어 음성 데이터 없음). 있으면 화면에 안내 */
  const voiceProblem = ref<string>()

  const scenes = computed(() => lecture.value?.scenes ?? [])
  const scene = computed<LectureScene | undefined>(() => scenes.value[sceneIndex.value])
  const step = computed(() => scene.value?.steps[stepIndex.value])
  /** 진행률 0~1 (장면 기준) */
  const progress = computed(() =>
    scenes.value.length ? (sceneIndex.value + (finished.value ? 1 : 0)) / scenes.value.length : 0,
  )

  /** 이 장면에서 지금까지 강조된 대상 (points 는 펼친 항목 수 계산에 쓴다) */
  const focus = computed(() => step.value?.focus ?? [])
  const revealed = computed(() => {
    const s = scene.value
    if (!s) return 0
    const seen = s.steps.slice(0, stepIndex.value + 1).flatMap((st) => st.focus ?? [])
    // focus 를 하나도 쓰지 않는 장면은 처음부터 전부 보인다
    return s.steps.some((st) => st.focus?.length) ? Math.max(-1, ...seen) + 1 : Infinity
  })

  // ── 실행 제어: 이동·정지할 때마다 run 을 올려 이전 흐름을 끝낸다 ──
  let run = 0
  const alive = (id: number) => id === run && playing.value

  /** 진행 중인 대기들. interrupt() 하면 기다리지 않고 바로 끝낸다 */
  const pendingSleeps = new Set<() => void>()

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        pendingSleeps.delete(done)
        resolve()
      }
      const timer = setTimeout(done, ms)
      pendingSleeps.add(done)
    })
  }

  async function say(text: string) {
    caption.value = text
    await speak(text)
  }

  /** 자막은 그대로 두고 읽기만 한다 (퀴즈 보기는 화면에 이미 있다) */
  async function speak(text: string) {
    if (voice.value && speaker.available) {
      await speaker.speak(text, rate.value)
      voiceProblem.value = speaker.problem
    } else await sleep(estimateMs(text, rate.value))
  }

  function interrupt() {
    run++
    speaker.stop()
    for (const done of [...pendingSleeps]) done()
    stopQuizTimer()
  }

  // ── 퀴즈 자동 공개 ──
  function stopQuizTimer() {
    clearInterval(quizTimer)
    quizTimer = undefined
    quizCountdown.value = undefined
  }

  /** 재생 중에 답을 기다리기 시작하면 센다. 일시정지·이동하면 멈춘다 (interrupt) */
  function startQuizTimer() {
    stopQuizTimer()
    quizCountdown.value = QUIZ_WAIT_SEC
    quizTimer = setInterval(() => {
      if (!waiting.value || !playing.value) return stopQuizTimer()
      quizCountdown.value = (quizCountdown.value ?? 1) - 1
      if (quizCountdown.value <= 0) {
        stopQuizTimer()
        void revealAnswer()
      }
    }, 1000)
  }

  /** 현재 단계를 읽고, 끝나면 다음으로 넘어간다 (재생 중일 때만) */
  async function playCurrent() {
    const id = ++run
    const s = scene.value
    const st = step.value
    if (!s || !st) return
    caption.value = st.say
    if (!playing.value) return

    await say(st.say)
    if (!alive(id)) return

    // 퀴즈: 문제를 끝까지 읽고 보기도 읽은 뒤 답을 기다린다 (화면 없이 듣는 사람도 풀 수 있게)
    if (s.type === 'quiz' && quizAnswers.value[s.id] === undefined && stepIndex.value === s.steps.length - 1) {
      await speak(s.choices.map((c, i) => `${i + 1}번, ${plain(c)}.`).join(' '))
      if (!alive(id)) return
      waiting.value = true
      startQuizTimer()
      return
    }
    await advanceAfter(id)
  }

  async function advanceAfter(id: number) {
    const lastStep = stepIndex.value >= (scene.value?.steps.length ?? 1) - 1
    await sleep(lastStep ? SCENE_GAP : STEP_GAP)
    if (!alive(id)) return
    if (moveNext()) void playCurrent()
  }

  /** 다음 단계(없으면 다음 장면)로. 마지막이면 끝내고 false */
  function moveNext() {
    const s = scene.value
    if (!s) return false
    if (stepIndex.value < s.steps.length - 1) {
      stepIndex.value++
      return true
    }
    if (sceneIndex.value < scenes.value.length - 1) {
      sceneIndex.value++
      stepIndex.value = 0
      return true
    }
    finished.value = true
    playing.value = false
    return false
  }

  function movePrev() {
    if (stepIndex.value > 0) stepIndex.value--
    else if (sceneIndex.value > 0) {
      sceneIndex.value--
      stepIndex.value = Math.max(0, (scene.value?.steps.length ?? 1) - 1)
    }
  }

  // ── 조작 ──
  function play() {
    if (finished.value) goScene(0)
    playing.value = true
    if (!waiting.value) void playCurrent()
    else startQuizTimer() // 퀴즈를 기다리던 중이면 처음부터 다시 센다
  }

  function pause() {
    playing.value = false
    interrupt()
  }

  const toggle = () => (playing.value ? pause() : play())

  function afterManualMove() {
    interrupt()
    waiting.value = false
    finished.value = false
    caption.value = step.value?.say ?? ''
    if (playing.value) void playCurrent()
  }

  function next() {
    if (waiting.value) waiting.value = false // 퀴즈를 건너뛴다
    if (moveNext()) afterManualMove()
    else interrupt()
  }

  function prev() {
    movePrev()
    afterManualMove()
  }

  function goScene(i: number) {
    sceneIndex.value = Math.min(Math.max(0, i), scenes.value.length - 1)
    stepIndex.value = 0
    afterManualMove()
  }

  /** 퀴즈 답 선택 → 정오와 해설을 읽고 이어간다 */
  async function answer(choice: number) {
    const s = scene.value
    if (!s || s.type !== 'quiz' || quizAnswers.value[s.id] !== undefined) return
    quizAnswers.value[s.id] = choice
    waiting.value = false
    interrupt()
    const id = run
    const feedback =
      (choice === s.answer ? '정답입니다. ' : `아쉬워요. 정답은 ${CIRCLED[s.answer - 1]}번입니다. `) + s.explanation
    if (!playing.value) {
      caption.value = feedback
      return
    }
    await say(feedback)
    if (alive(id)) await advanceAfter(id)
  }

  /** 시간이 지나도 답이 없으면: 정답을 표시하고 정답·해설을 읽은 뒤 이어간다 */
  async function revealAnswer() {
    const s = scene.value
    if (!s || s.type !== 'quiz' || quizAnswers.value[s.id] !== undefined) return
    quizAnswers.value[s.id] = s.answer
    autoRevealed.value[s.id] = true
    waiting.value = false
    interrupt()
    const id = run
    const feedback = `정답은 ${CIRCLED[s.answer - 1]}번, ${plain(s.choices[s.answer - 1] ?? '')}입니다. ${s.explanation}`
    if (!playing.value) {
      caption.value = feedback
      return
    }
    await say(feedback)
    if (alive(id)) await advanceAfter(id)
  }

  function reset() {
    interrupt()
    sceneIndex.value = 0
    stepIndex.value = 0
    playing.value = false
    finished.value = false
    waiting.value = false
    quizAnswers.value = {}
    autoRevealed.value = {}
    caption.value = scenes.value[0]?.steps[0]?.say ?? ''
  }

  // 새 강의를 열면 처음부터 (동기 실행: 강의를 받은 직후 화면에서 장면을 옮겨도 덮어쓰지 않게)
  watch(lecture, reset, { flush: 'sync' })
  // 음성을 켜고 끄면 지금 단계부터 다시 읽는다
  watch(voice, () => playing.value && !waiting.value && afterManualMove())

  onBeforeUnmount(interrupt)

  return {
    scenes,
    scene,
    step,
    sceneIndex,
    stepIndex,
    playing,
    finished,
    waiting,
    rate,
    voice,
    voiceAvailable: speaker.available,
    voiceProblem,
    openVoiceSettings: speaker.openSettings?.bind(speaker),
    quizAnswers,
    autoRevealed,
    quizCountdown,
    caption,
    progress,
    focus,
    revealed,
    play,
    pause,
    toggle,
    next,
    prev,
    goScene,
    answer,
    reset,
  }
}

export type LecturePlayer = ReturnType<typeof useLecturePlayer>
