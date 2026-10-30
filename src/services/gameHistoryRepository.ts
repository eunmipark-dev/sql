import { supabase } from '@/lib/supabase'

/**
 * 미니게임 푼 기록 (로그인: Supabase game_history 테이블, RLS 로 본인 행만).
 * 비로그인 기록은 lib/gameContent 가 localStorage 에 둔다.
 * 경험치는 서버 트리거가 처음 맞힌 문제에만 준다 (여기서 보내는 값으로 정하지 않는다)
 */
export interface GameRow {
  game: 'ox' | 'order' | 'sql' | 'daily'
  itemId: string
  /** true 맞힘 / false 틀림 / null 다 맞혀서 다시 도는 중 */
  ok: boolean | null
  /** 오늘의 챌린지: 맞힌 수 */
  score: number | null
}

interface Row {
  game: GameRow['game']
  item_id: string
  ok: boolean | null
  score: number | null
}

const PAGE = 1000

function db() {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
  return supabase
}

export const remoteGameHistory = {
  async list(): Promise<GameRow[]> {
    // 한 번에 최대 1000행이라 나눠 받는다 (O/X 는 1000문장이 넘는다)
    const rows: Row[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db()
        .from('game_history')
        .select('game,item_id,ok,score')
        .order('game')
        .order('item_id')
        .range(from, from + PAGE - 1)
      if (error) throw error
      rows.push(...(data as Row[]))
      if (data.length < PAGE) break
    }
    return rows.map((r) => ({ game: r.game, itemId: r.item_id, ok: r.ok, score: r.score }))
  },

  async saveMany(rows: GameRow[]) {
    for (let i = 0; i < rows.length; i += 500) {
      // user_id 는 DB 기본값 auth.uid() 로 채워진다
      const { error } = await db()
        .from('game_history')
        .upsert(
          rows.slice(i, i + 500).map((r) => ({ game: r.game, item_id: r.itemId, ok: r.ok, score: r.score })),
          { onConflict: 'user_id,game,item_id' },
        )
      if (error) throw error
    }
  },

  /** 다 맞혀서 처음부터 다시 돌 때: 맞힌 기록을 '안 푼 것'으로 */
  async reset(game: GameRow['game'], ids: string[]) {
    if (!ids.length) return
    const { error } = await db().rpc('reset_game_items', { g: game, ids })
    if (error) throw error
  },
}
