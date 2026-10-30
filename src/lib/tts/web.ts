import { speechChunks } from './speechText'
import { estimateMs, type Speaker } from './types'

/**
 * 브라우저 speechSynthesis 로 읽는다.
 * - 한국어 음성을 고른다 (Google·Microsoft 온라인 음성 우선)
 * - 기호를 글자로 읽지 않게 문장 부호 자리에서 나눠 조각마다 읽는다 (speechText.ts)
 * - end 이벤트가 오지 않는 브라우저 버그에 대비해 예상 시간이 지나면 끝난 것으로 본다
 */
export function createWebSpeaker(): Speaker {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
  let voice: SpeechSynthesisVoice | undefined
  /** stop() 할 때마다 올려서, 이전에 시작한 읽기를 끝낸다 */
  let generation = 0

  const pickVoice = () => {
    const ko = (synth?.getVoices() ?? []).filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ko'))
    voice = ko.find((v) => /google/i.test(v.name)) ?? ko.find((v) => /online|natural/i.test(v.name)) ?? ko[0]
  }
  if (synth) {
    pickVoice()
    synth.addEventListener?.('voiceschanged', pickVoice)
  }

  function speakOne(text: string, rate: number, gen: number) {
    return new Promise<void>((resolve) => {
      if (!synth || gen !== generation) return resolve()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = voice?.lang ?? 'ko-KR'
      if (voice) u.voice = voice
      u.rate = rate
      const done = () => {
        clearTimeout(guard)
        resolve()
      }
      const guard = setTimeout(done, estimateMs(text, rate) * 2 + 3000)
      u.onend = done
      u.onerror = done
      synth.speak(u)
    })
  }

  return {
    get available() {
      return !!synth
    },
    async speak(text, rate) {
      const gen = generation
      for (const s of speechChunks(text)) {
        if (gen !== generation) return
        await speakOne(s, rate, gen)
      }
    },
    stop() {
      generation++
      synth?.cancel()
    },
  }
}
