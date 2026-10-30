/** 문장을 읽어주는 음성 엔진. 웹(speechSynthesis)과 앱(안드로이드 TTS)이 같은 모양으로 구현한다 */
export interface Speaker {
  /** 이 환경에서 음성을 낼 수 있는지 */
  readonly available: boolean
  /** 읽기에 실패한 이유 (예: 기기에 한국어 음성 데이터가 없음). 실패하면 자막만 보여주며 읽는 시간만큼 기다린다 */
  readonly problem?: string
  /** 기기의 음성 데이터 설치 화면 열기 (앱 전용) */
  openSettings?(): void
  /** 다 읽으면 끝나는 Promise. stop() 으로 끊기면 바로 끝난다 */
  speak(text: string, rate: number): Promise<void>
  stop(): void
}

/** 음성 없이 읽는 데 걸릴 시간 (자막만 보여줄 때 자동 넘김 간격). 한국어 기준 1초에 약 7자 */
export const estimateMs = (text: string, rate: number) => Math.max(1500, (text.length / 7) * 1000) / rate
