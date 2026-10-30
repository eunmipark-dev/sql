import type { CapacitorConfig } from '@capacitor/cli'

/**
 * 안드로이드 앱 설정 (Capacitor). 웹 빌드(dist)를 그대로 앱에 담는다.
 *   npm run android   → 웹 빌드 + android 프로젝트에 복사 + Android Studio 열기
 * appId 는 스토어에 올린 뒤에는 바꿀 수 없으니 출시 전에 확정한다.
 */
const config: CapacitorConfig = {
  appId: 'kr.co.clobot.sqlcert',
  appName: 'SQL 자격증',
  webDir: 'dist',
  plugins: {
    // 학습 알림: 표시줄 아이콘(res/drawable/ic_stat_notify.xml)과 강조색(로고 남색)
    LocalNotifications: { smallIcon: 'ic_stat_notify', iconColor: '#1B2A4E' },
  },
}

export default config
