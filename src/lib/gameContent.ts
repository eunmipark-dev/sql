import { findDoc, subjectNo } from '@/lib/content'
import type { OxStatement } from '@/lib/games'
import type { Cert } from '@/stores/cert'

/**
 * 미니게임 문제 데이터와 '푼 기록'.
 * - 순서 퍼즐: content/games/order/*.json, SQL 결과 맞히기: content/sql/puzzles/*.json (작아서 바로 넣는다)
 * - O/X: content/games/ox/<이론 slug>.json (이론 문서별로 쓴 문장, 게임을 열 때 받는다)
 * - 푼 기록: 맞힌 문제는 다시 내지 않고, 안 푼 문제 → 틀린 문제 순서로 낸다. 다 맞히면 처음부터 다시
 *   (비로그인은 이 기기, 로그인하면 계정에 저장. 처음 맞힌 문제는 서버가 경험치를 준다)
 */

export interface OrderPuzzle {
  id: string
  cert: Cert
  title: string
  prompt: string
  code?: string
  /** 정답 순서대로 (화면에서 섞는다) */
  items: string[]
  explain: string
  theory?: string
}

export interface SqlPuzzle {
  id: string
  topic: string
  sql: string
  ask: 'rows' | 'value'
  /** 해설이 실제 결과와 맞는지 scripts/check-sql-puzzles.mjs 가 검사할 때만 쓴다 (정답은 실행해서 정한다) */
  expect: string
  distractors?: string[]
  note?: string
  explain: string
}

const byFile = <T>(files: Record<string, T[]>) =>
  Object.keys(files)
    .sort()
    .flatMap((k) => files[k]!)

export const ORDER_PUZZLES = byFile(import.meta.glob<OrderPuzzle[]>('@/content/games/order/*.json', { eager: true, import: 'default' }))
export const SQL_PUZZLES = byFile(import.meta.glob<SqlPuzzle[]>('@/content/sql/puzzles/*.json', { eager: true, import: 'default' }))

/** 자격증에 나오는 순서 퍼즐 (SQLP 는 SQLD 범위 포함) */
export const orderPuzzlesFor = (cert: Cert) => ORDER_PUZZLES.filter((p) => cert === 'sqlp' || p.cert === 'sqld')

// ── O/X 문장 (이론 문서별) ──

const oxFiles = import.meta.glob<{ text: string; answer: boolean; explain: string }[]>('@/content/games/ox/*.json', { import: 'default' })

/** 문장 → 짧은 고정 id (문장을 고치면 새 문장으로 친다) */
function hashText(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/** 이론 문서에서 쓴 O/X 문장. SQLD 는 1·2과목 문서만, SQLP 는 전부 */
export async function loadOxBank(cert: Cert): Promise<OxStatement[]> {
  // 파일 이름은 이론 파일과 같고(1-2-01-normalization), 문서 slug 는 앞의 숫자를 뗀 것(normalization)
  const entries = Object.entries(oxFiles).map(
    ([path, load]) => [path.split('/').pop()!.replace(/\.json$/, '').replace(/^(\d+-)+/, ''), load] as const,
  )
  const wanted = entries.filter(([slug]) => {
    const doc = findDoc(slug)
    return doc && (cert === 'sqlp' || subjectNo(doc) <= 2)
  })
  const lists = await Promise.all(
    wanted.map(async ([slug, load]) =>
      (await load()).map((s) => ({
        id: `ox:${slug}:${hashText(s.text)}`,
        topic: findDoc(slug)!.title,
        text: s.text,
        answer: s.answer,
        explain: s.explain,
        theory: slug,
      })),
    ),
  )
  return lists.flat()
}

// ── 푼 기록 ── (lib/gameHistory, 로그인 동기화 때문에 따로 둔다)
export * from '@/lib/gameHistory'
