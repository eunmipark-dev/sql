import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { speechChunks } from './speechText'
import { estimateMs, type Speaker } from './types'

/**
 * 안드로이드 기본 TTS 엔진으로 읽는다 (앱 전용).
 * - 기호를 글자로 읽지 않게 문장 부호 자리에서 나눠 조각마다 읽는다 (speechText.ts)
 * - 플러그인의 speak 는 다 읽으면 끝나지만, stop 했을 때 끝나는지는 기기마다 달라서 stop() 이 직접 끝낸다
 * - 한국어 음성 데이터가 없는 기기는 speak 가 실패한다 → 이유를 남기고 읽는 시간만큼 기다려 자막으로 이어간다
 */
export function createNativeSpeaker(): Speaker {
  /** stop() 할 때마다 올려서, 진행 중인 읽기를 끝낸다 */
  let generation = 0
  let cancelWait: (() => void) | undefined
  let problem: string | undefined

  /** 조각 하나를 읽는다. stop() 하면 결과를 기다리지 않고 바로 끝난다 */
  function speakOne(text: string, rate: number, gen: number) {
    return new Promise<'ok' | 'fail' | 'stopped'>((resolve) => {
      cancelWait = () => resolve('stopped')
      TextToSpeech.speak({ text, lang: 'ko-KR', rate, category: 'playback' })
        .then(() => resolve(gen === generation ? 'ok' : 'stopped'))
        .catch((e) => {
          console.error('[TTS]', e)
          resolve(gen === generation ? 'fail' : 'stopped')
        })
    })
  }

  function wait(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms)
      cancelWait = () => (clearTimeout(timer), resolve())
    })
  }

  return {
    available: true,
    get problem() {
      return problem
    },
    openSettings() {
      void TextToSpeech.openInstall().catch(() => {})
    },
    async speak(text, rate) {
      const gen = ++generation
      for (const chunk of speechChunks(text)) {
        if (gen !== generation) return
        const result = await speakOne(chunk, rate, gen)
        if (result === 'stopped') return
        if (result === 'fail') {
          // 음성이 안 나오면 남은 내용을 읽는 시간만큼 기다려 자막으로 이어간다
          problem = '기기에 한국어 음성 데이터가 없어 자막만 보여드려요.'
          await wait(estimateMs(text, rate))
          return
        }
        problem = undefined
      }
    },
    stop() {
      generation++
      cancelWait?.()
      void TextToSpeech.stop().catch(() => {})
    },
  }
}
