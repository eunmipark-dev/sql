// 미니게임 데이터 검사: O/X 문장(src/content/games/ox/<이론 slug>.json), 순서 퍼즐(src/content/games/order/*.json)
// node scripts/check-games.mjs
import fs from 'node:fs'

let failed = 0
const fail = (where, msg) => (failed++, console.error(`✗ ${where}: ${msg}`))
const norm = (s) => s.replace(/[\s.·,'"`()]/g, '').toLowerCase()
const slugs = new Set(fs.readdirSync('src/content/theory').map((f) => f.replace(/\.md$/, '')))

// ── O/X ──
const OX = 'src/content/games/ox/'
const seenText = new Map()
let oxCount = 0
for (const f of fs.readdirSync(OX).filter((f) => f.endsWith('.json'))) {
  const slug = f.replace(/\.json$/, '')
  if (!slugs.has(slug)) fail(f, '파일 이름은 이론 문서 slug 여야 함')
  let list
  try {
    list = JSON.parse(fs.readFileSync(OX + f, 'utf8'))
  } catch (e) {
    fail(f, `JSON 오류 ${e.message}`)
    continue
  }
  if (!Array.isArray(list)) {
    fail(f, '배열이어야 함')
    continue
  }
  let o = 0
  list.forEach((s, i) => {
    const at = `${f}[${i}]`
    if (typeof s.text !== 'string' || s.text.length < 10 || s.text.length > 130) fail(at, `text 는 10~130자 (${s.text?.length})`)
    if (typeof s.answer !== 'boolean') fail(at, 'answer 는 true/false')
    if (typeof s.explain !== 'string' || s.explain.length < 8 || s.explain.length > 220) fail(at, `explain 은 8~220자 (${s.explain?.length})`)
    if (/[①②③④⑤]|다음 중|보기/.test(s.text ?? '')) fail(at, '문제 보기처럼 쓰지 않음')
    const k = norm(s.text ?? '')
    if (seenText.has(k)) fail(at, `같은 문장이 ${seenText.get(k)} 에 있음`)
    seenText.set(k, at)
    if (s.answer) o++
  })
  oxCount += list.length
  if (list.length >= 6 && (o / list.length < 0.3 || o / list.length > 0.7)) fail(f, `O 비율 ${Math.round((o / list.length) * 100)}% (30~70%)`)
}

// ── 순서 퍼즐 ──
const ORDER = 'src/content/games/order/'
const ids = new Set()
const titles = new Set()
let orderCount = 0
for (const f of fs.readdirSync(ORDER).filter((f) => f.endsWith('.json'))) {
  const list = JSON.parse(fs.readFileSync(ORDER + f, 'utf8'))
  list.forEach((p, i) => {
    const at = `${f}[${i}] ${p.id}`
    if (!p.id || ids.has(p.id)) fail(at, 'id 없음/중복')
    ids.add(p.id)
    if (titles.has(norm(p.title ?? ''))) fail(at, '제목 중복')
    titles.add(norm(p.title ?? ''))
    if (!['sqld', 'sqlp'].includes(p.cert)) fail(at, 'cert 는 sqld | sqlp')
    for (const k of ['title', 'prompt', 'explain']) if (typeof p[k] !== 'string' || !p[k].trim()) fail(at, `${k} 없음`)
    if (!Array.isArray(p.items) || p.items.length < 3 || p.items.length > 7) fail(at, 'items 는 3~7개')
    else if (new Set(p.items).size !== p.items.length) fail(at, 'items 중복')
    if (p.theory && !slugs.has(p.theory)) fail(at, `theory slug 없음 ${p.theory}`)
  })
  orderCount += list.length
}

console.log(failed ? `\n${failed}건 실패` : `미니게임 데이터 통과: O/X ${oxCount}문장, 순서 퍼즐 ${orderCount}개`)
process.exit(failed ? 1 : 0)
