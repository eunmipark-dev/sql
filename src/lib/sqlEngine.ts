import dataset from '@/content/sql/dataset.sql?raw'
import type { PGlite } from '@electric-sql/pglite'

/**
 * 브라우저 안에서 도는 SQL 엔진 (PGlite = PostgreSQL 을 wasm 으로).
 * - 엔진(약 17MB, 압축 약 5MB)은 SQL 화면을 처음 열 때만 받는다
 * - 연습 데이터(content/sql/dataset.sql: EMP·DEPT·T1·T2)를 넣어 두고, 모든 실행은 끝나면 되돌린다
 *   → 퍼즐의 정답·해설이 늘 같은 데이터 기준이 된다
 * - Oracle 과 다른 점은 SQL_DIFFERENCES 로 화면에 알린다
 */

export interface SqlResult {
  columns: string[]
  rows: unknown[][]
  /** SELECT 가 아닌 문장의 영향 받은 행 수 */
  affected?: number
}

let engine: Promise<PGlite> | null = null

export function sqlEngine() {
  engine ??= (async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const db = await PGlite.create()
    await db.exec(dataset)
    return db
  })()
  engine.catch(() => (engine = null)) // 받기에 실패하면 다음에 다시
  return engine
}

/** 하나 이상의 문장을 실행하고 되돌린다. 문장마다 결과 하나 */
export async function runSql(sql: string): Promise<SqlResult[]> {
  const db = await sqlEngine()
  await db.exec('BEGIN')
  try {
    const results = await db.exec(sql, { rowMode: 'array' })
    return results.map((r) => ({
      columns: r.fields.map((f) => f.name),
      rows: r.rows as unknown[][],
      affected: r.fields.length ? undefined : r.affectedRows,
    }))
  } finally {
    await db.exec('ROLLBACK').catch(() => {})
    // COMMIT 을 직접 썼으면 ROLLBACK 으로 되돌릴 수 없으니 데이터를 처음 상태로 다시 만든다
    if (/(^|;)\s*(commit|end)\b/i.test(sql)) await resetData()
  }
}

/** 연습 데이터를 처음 상태로 */
export async function resetData() {
  const db = await sqlEngine()
  await db.exec(`DROP SCHEMA public CASCADE; CREATE SCHEMA public; ${dataset}`)
}

/** 결과 한 칸을 화면용 글자로 (NULL 은 'NULL') */
export function cellText(v: unknown) {
  if (v === null || v === undefined) return 'NULL'
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

/** 연습 테이블 */
export const SQL_TABLES = [
  { name: 'emp', label: '사원' },
  { name: 'dept', label: '부서' },
  { name: 't1', label: '집합 연습' },
  { name: 't2', label: '집합 연습' },
]

/** 이 엔진(PostgreSQL)과 Oracle 의 차이 중 시험에 자주 나오는 것 */
export const SQL_DIFFERENCES = [
  'MINUS 대신 EXCEPT 를 써요.',
  'ROWNUM 이 없어요. FETCH FIRST n ROWS ONLY 를 쓰세요.',
  "빈 문자열 '' 은 NULL 이 아니에요 (Oracle 은 NULL).",
  '정수끼리 나누면 몫만 남아요 (7 / 2 = 3). 7.0 / 2 처럼 쓰세요.',
  "NULL || '문자' 는 NULL 이에요 (Oracle 은 '문자').",
  'CONNECT BY 계층 질의 대신 WITH RECURSIVE 를 써요.',
  'DECODE 는 없어요. CASE 를 쓰세요. NVL, NVL2, DUAL 은 쓸 수 있게 만들어 뒀어요.',
]
