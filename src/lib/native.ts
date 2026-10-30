import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { Router } from 'vue-router'

/**
 * 안드로이드 앱(Capacitor) 전용 처리. 웹에서는 아무것도 하지 않는다.
 * - 하드웨어 뒤로가기: 앱 안에서 뒤로, 더 갈 곳이 없으면 앱 종료
 * - 상태바: 다크 모드에 맞춰 글자색 변경
 * - Google 로그인: 외부 브라우저에서 로그인 → 딥링크로 앱에 돌아오면 세션으로 교환
 */
export const isNative = Capacitor.isNativePlatform()

/** 로그인 후 돌아올 앱 주소. AndroidManifest 의 intent-filter, Supabase Redirect URLs 와 같아야 한다 */
export const AUTH_REDIRECT = 'app.passcert.sql://auth-callback'

export function setupNativeShell(router: Router) {
  if (!isNative) return
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) router.back()
    else void App.exitApp()
  })
}

export function syncStatusBar(dark: boolean) {
  if (!isNative) return
  void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
}

/** 로그인 페이지를 앱 밖 브라우저(커스텀 탭)로 연다 */
export async function openAuthPage(url: string) {
  await Browser.open({ url })
}

/** 로그인 딥링크를 받으면 handler(code) 를 부른다 */
export function onAuthCallback(handler: (code: string) => void) {
  if (!isNative) return
  void App.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith(AUTH_REDIRECT)) return
    const code = new URL(url).searchParams.get('code')
    void Browser.close().catch(() => {})
    if (code) handler(code)
  })
}

/** 바깥 사이트 열기 (앱: 커스텀 탭, 웹: 새 탭) */
export function openExternal(url: string) {
  if (isNative) void Browser.open({ url })
  else window.open(url, '_blank', 'noopener')
}
