import { ref, watch } from 'vue'
import { App } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'
import { addDays, dayKey } from '@/lib/date'
import { isNative } from '@/lib/native'
import { useActivityStore } from '@/stores/activity'
import { useCertStore } from '@/stores/cert'

/**
 * 학습 알림 (앱 전용): 매일 정한 시각에 "오늘 아직 공부 안 했어요"를 알린다.
 * 기기 알림은 보낼 때 조건을 볼 수 없어서, 앞으로 14일치를 미리 예약해 두고
 * 앱을 열거나 공부할 때마다 다시 예약한다 (오늘 이미 했으면 오늘 것은 빼고).
 * 설정은 이 기기에 저장한다
 */
export interface ReminderSettings {
  on: boolean
  /** 'HH:MM' */
  time: string
}

const KEY = 'sql-cert:reminder'
const DAYS_AHEAD = 14
/** 예약 번호 (다른 알림과 겹치지 않게 이 범위만 쓴다) */
const ID_BASE = 7000

export const reminderSupported = isNative

function read(): ReminderSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (s && typeof s.on === 'boolean' && /^\d\d:\d\d$/.test(s.time)) return s
  } catch {
    // 기본값
  }
  return { on: false, time: '20:00' }
}

export const reminder = ref<ReminderSettings>(read())
/** 홈의 '알림 켜기' 안내를 닫았는지 */
export const reminderAsked = ref(readAsked())
function readAsked() {
  try {
    return localStorage.getItem(`${KEY}:asked`) === '1'
  } catch {
    return false
  }
}
export function markReminderAsked() {
  reminderAsked.value = true
  try {
    localStorage.setItem(`${KEY}:asked`, '1')
  } catch {
    // 무시
  }
}

/** 날마다 다른 문구 (같은 말만 반복하면 무시하게 된다) */
const MESSAGES = [
  '강의 한 파트, 4분이면 돼요.',
  '랜덤 문제 5개로 가볍게 시작해 볼까요?',
  '틀렸던 문제, 지금 다시 풀면 오래 기억나요.',
  '오늘 목표까지 얼마 안 남았어요.',
  '출퇴근길에 강의 하나 들어 볼까요?',
]

/** 알림 권한을 묻는다 (켤 때만). 거절하면 false */
export async function requestReminderPermission() {
  if (!isNative) return false
  const now = await LocalNotifications.checkPermissions()
  if (now.display === 'granted') return true
  const asked = await LocalNotifications.requestPermissions()
  return asked.display === 'granted'
}

/** 설정과 오늘 학습 여부에 맞춰 앞으로의 알림을 다시 예약한다 */
export async function rescheduleReminders() {
  if (!isNative) return
  const ids = Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => ({ id: ID_BASE + i }))
  await LocalNotifications.cancel({ notifications: ids }).catch(() => {})
  const s = reminder.value
  if (!s.on) return
  const perm = await LocalNotifications.checkPermissions().catch(() => undefined)
  if (perm?.display !== 'granted') return

  const activity = useActivityStore()
  const cert = useCertStore()
  const [h, m] = s.time.split(':').map(Number)
  const today = dayKey()
  const now = Date.now()
  const notifications = []
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const day = addDays(today, i)
    // 오늘 이미 공부했으면 오늘 알림은 보내지 않는다
    if (i === 0 && activity.studiedToday) continue
    const [y, mo, d] = day.split('-').map(Number)
    const at = new Date(y!, mo! - 1, d!, h, m)
    if (at.getTime() <= now + 60_000) continue
    // 오늘·내일 알림은 지금 이어지는 연속 학습일을 알려 준다 (그 뒤는 알 수 없으니 일반 문구)
    const streak = activity.streak + (activity.studiedToday ? 1 : 0)
    const title = i <= 1 && streak > 0 ? `🔥 ${streak}일 연속 학습 중이에요` : `오늘의 ${cert.info.label} 공부`
    notifications.push({
      id: ID_BASE + i,
      title,
      body: i <= 1 && streak > 0 ? '오늘도 이어가 볼까요? 한 파트면 충분해요.' : MESSAGES[(new Date(at).getDate() + i) % MESSAGES.length]!,
      schedule: { at },
    })
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications }).catch((e) => console.error('[알림 예약 실패]', e))
}

/** 앱 시작 시 한 번: 설정·학습 기록이 바뀌거나 앱으로 돌아오면 다시 예약 */
export function setupReminders() {
  if (!isNative) return
  const activity = useActivityStore()
  watch(
    reminder,
    (s) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(s))
      } catch {
        // 무시
      }
    },
    { deep: true },
  )
  watch([reminder, () => activity.studiedToday, () => activity.loaded], () => void rescheduleReminders(), { deep: true, immediate: true })
  void App.addListener('resume', () => void rescheduleReminders())
}
