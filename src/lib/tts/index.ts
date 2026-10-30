import { Capacitor } from '@capacitor/core'
import type { Speaker } from './types'
import { createNativeSpeaker } from './native'
import { createWebSpeaker } from './web'

export type { Speaker } from './types'
export { estimateMs } from './types'

let speaker: Speaker | undefined

/**
 * 현재 환경의 음성 엔진 (한 번만 만든다).
 * - 안드로이드 앱: 기기 TTS (WebView 의 speechSynthesis 는 동작하지 않거나 불안정)
 * - 브라우저: speechSynthesis
 */
export function getSpeaker(): Speaker {
  speaker ??= Capacitor.isNativePlatform() ? createNativeSpeaker() : createWebSpeaker()
  return speaker
}
