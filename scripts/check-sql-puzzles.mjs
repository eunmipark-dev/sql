// SQL 결과 맞히기 퍼즐 검사: 실제 엔진(PGlite)으로 실행해서 expect·해설과 맞는지 본다.
// 앱은 정답을 실행해서 정하므로, 여기서는 '쓴 해설이 실제 결과와 같은지'를 지킨다.
// node scripts/check-sql-puzzles.mjs
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const dataset = fs.readFileSync('src/content/sql/dataset.sql', 'utf8')
// src/content/sql/puzzles/*.json 을 모두 모은다 (파일은 주제별로 나눠 둔다)
const DIR = 'src/content/sql/puzzles/'
const puzzles = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(fs.readFileSync(DIR + f, 'utf8')).map((p) => ({ ...p, file: f })))
const db = await PGlite.create()
await db.exec(dataset)

const show = (v) => (v === null || v === undefined ? 'NULL' : String(v))
const ids = new Set()
const sqls = new Map()
let failed = 0
for (const p of puzzles) {
  const fail = (msg) => (failed++, console.error(`✗ ${p.file} ${p.id}: ${msg}`))
  if (ids.has(p.id)) fail('id 중복')
  ids.add(p.id)
  for (const k of ['id', 'topic', 'sql', 'ask', 'expect', 'explain']) if (typeof p[k] !== 'string' || !p[k].trim()) fail(`${k} 없음`)
  // 공백·대소문자만 다른 같은 SQL
  const norm = p.sql?.replace(/\s+/g, ' ').trim().toLowerCase()
  if (sqls.has(norm)) fail(`SQL 이 ${sqls.get(norm)} 와 같음`)
  sqls.set(norm, p.id)
  let res
  try {
    res = await db.query(p.sql, [], { rowMode: 'array' })
  } catch (e) {
    fail(`실행 오류 ${e.message}`)
    continue
  }
  let got
  if (p.ask === 'rows') got = String(res.rows.length)
  else if (p.ask === 'value') {
    if (res.rows.length !== 1 || res.fields.length !== 1) fail(`값 문제는 1행 1열이어야 함 (${res.rows.length}행 ${res.fields.length}열)`)
    got = show(res.rows[0]?.[0])
    const d = p.distractors ?? []
    if (d.length !== 3 || new Set(d).size !== 3) fail('오답 보기는 서로 다른 3개')
    if (d.includes(got)) fail(`오답 보기에 정답 ${got} 이 있음`)
  } else fail(`ask 는 rows | value (${p.ask})`)
  if (got !== p.expect) fail(`expect ${p.expect} ≠ 실제 ${got}`)
}
console.log(failed ? `\n${failed}건 실패` : `SQL 퍼즐 ${puzzles.length}개 통과`)
process.exit(failed ? 1 : 0)
