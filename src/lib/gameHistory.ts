import { ref, watch } from 'vue'
import { logChallenge, readChallengeLog, shuffle } from '@/lib/games'
import { remoteGameHistory, type GameRow } from '@/services/gameHistoryRepository'
import type { ExamKind } from '@/types'

/**
 * 미니게임 푼 기록. 맞힌 문제는 다시 내지 않는다 (pickFresh).
 * 비로그인은 이 기기(localStorage), 로그인하면 계정(game_history)에 저장하고, 처음 맞힌 문제는 서버가 경험치를 준다
 */

// ── 푼 기록 (비로그인: 이 기기 / 로그인: 계정) ──

export type GameKey = 'ox' | 'order' | 'sql'
const HISTORY_KEY = 'sql-cert:game-history'

function readHistory(): Record<string, Record<string, 1 | 0>> {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
/** 게임 → 문제 id → 1(맞힘) | 0(틀림) */
export const gameHistory = ref(readHistory())
/** true 면 로그인 상태 → 계정(Supabase)에 저장 */
let remote = false
watch(
  gameHistory,
  (v) => {
    if (remote) return
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(v))
    } catch {
      // 저장이 막혀 있으면 이번 방문 동안만
    }
  },
  { deep: true },
)

/** 오늘의 챌린지 기록이 있을 수 있는 종류 */
const CHALLENGE_KINDS: ExamKind[] = ['past', 'ai', 'sqlp']

const saveRemote = (rows: GameRow[]) => remoteGameHistory.saveMany(rows).catch((e) => console.error('[게임 기록 저장 실패]', e))

/**
 * 로그인 / 로그아웃 때 저장 위치를 바꾼다.
 * 로그인: 이 기기에서 푼 기록을 계정에 합치고(계정에 없거나, 여기서 맞힌 것) 이 기기 기록은 비운다.
 * 오늘의 챌린지 기록은 양쪽을 합쳐 둔다. game_history 테이블이 없으면(SQL 미반영) 이 기기에 계속 저장한다
 */
export async function syncGameHistory(useRemote: boolean) {
  if (!useRemote) {
    remote = false
    gameHistory.value = readHistory()
    return
  }
  try {
    const rows = await remoteGameHistory.list()
    const byKey = new Map(rows.map((r) => [`${r.game}|${r.itemId}`, r]))
    const upload: GameRow[] = []
    for (const [game, items] of Object.entries(readHistory()))
      for (const [itemId, v] of Object.entries(items)) {
        const r = byKey.get(`${game}|${itemId}`)
        if (!r || r.ok === null || (v === 1 && !r.ok)) upload.push({ game: game as GameKey, itemId, ok: v === 1, score: null })
      }
    for (const kind of CHALLENGE_KINDS)
      for (const [day, correct] of Object.entries(readChallengeLog(kind)))
        if (!byKey.has(`daily|${kind}:${day}`)) upload.push({ game: 'daily', itemId: `${kind}:${day}`, ok: true, score: correct })
    await remoteGameHistory.saveMany(upload)

    const next: Record<string, Record<string, 1 | 0>> = {}
    for (const r of [...rows, ...upload]) {
      if (r.game === 'daily') {
        const [kind, day] = r.itemId.split(':') as [ExamKind, string]
        if (!(day in readChallengeLog(kind))) logChallenge(kind, day, r.score ?? 0)
      } else if (r.ok !== null) (next[r.game] ??= {})[r.itemId] = r.ok ? 1 : 0
    }
    remote = true
    gameHistory.value = next
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch {
      // 비울 수 없으면 그대로 (다음 로그인 때 다시 합쳐도 같은 결과)
    }
  } catch (e) {
    console.error('[게임 기록 동기화 실패]', e)
  }
}

export function recordResult(game: GameKey, id: string, ok: boolean) {
  const g = (gameHistory.value[game] ??= {})
  g[id] = ok ? 1 : 0
  if (remote) void saveRemote([{ game, itemId: id, ok, score: null }])
}

/** 오늘의 챌린지를 끝냈을 때 (계정에 저장하면 경험치) */
export function recordChallenge(kind: ExamKind, day: string, correct: number) {
  logChallenge(kind, day, correct)
  if (remote) void saveRemote([{ game: 'daily', itemId: `${kind}:${day}`, ok: true, score: correct }])
}

/** 문제 하나의 상태: 안 풂 / 틀림 / 맞힘 */
export const statusOf = (game: GameKey, id: string) => {
  const v = gameHistory.value[game]?.[id]
  return v === undefined ? 'new' : v ? 'correct' : 'wrong'
}

/** 전체 중 맞힌 수 */
export function solvedCount(game: GameKey, ids: string[]) {
  const g = gameHistory.value[game] ?? {}
  return ids.filter((id) => g[id] === 1).length
}

/**
 * 안 푼 문제 → 틀린 문제 순서로 n개. 둘 다 모자라면 맞힌 문제의 기록을 지우고 처음부터 다시 돈다
 * (recycled: 이번에 한 바퀴를 다 돌아 다시 시작했는지)
 */
export function pickFresh<T>(game: GameKey, list: T[], n: number, idOf: (x: T) => string) {
  const fresh = shuffle(list.filter((x) => statusOf(game, idOf(x)) === 'new'))
  const wrong = shuffle(list.filter((x) => statusOf(game, idOf(x)) === 'wrong'))
  let picked = [...fresh, ...wrong].slice(0, n)
  let recycled = false
  if (picked.length < n) {
    recycled = true
    const g = gameHistory.value[game] ?? {}
    const cleared = list.map(idOf).filter((id) => g[id] === 1)
    for (const id of cleared) delete g[id]
    if (remote) void remoteGameHistory.reset(game, cleared).catch((e) => console.error('[게임 기록 저장 실패]', e))
    const rest = shuffle(list.filter((x) => !picked.includes(x)))
    picked = [...picked, ...rest].slice(0, n)
  }
  return { picked, recycled }
}
