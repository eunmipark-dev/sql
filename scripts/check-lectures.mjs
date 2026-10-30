// 인터랙티브 강의 데이터 검증
//   src/content/lectures/<slug>.json  (이론 문서 slug 와 같은 이름)
// npm run dev / build 전에 자동 실행된다 (package.json 의 predev / prebuild)
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('src/content/lectures')
const THEORY = new Set(
  fs.readdirSync('src/content/theory').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3).replace(/^(\d+-)+/, '')),
)
const TYPES = new Set(['title', 'points', 'code', 'table', 'data', 'compare', 'callout', 'quiz', 'cards', 'flow', 'layers', 'checklist'])
// 강의 그림에 쓸 수 있는 아이콘 이름 (src/lib/lectureIcons.ts 의 키)
const ICONS = new Set(
  [...fs.readFileSync('src/lib/lectureIcons.ts', 'utf8').matchAll(/^\s+'?([a-z-]+)'?: [A-Z]\w*,$/gm)].map((m) => m[1]),
)
const TONES = new Set(['tip', 'info', 'warning'])

/**
 * 듣기·읽기를 방해하는 큰 숫자: 4자리 이상. 단 읽기 쉬운 것은 괜찮다
 * - 끝자리가 모두 0인 어림수(1000, 5000, 10000), 연도·연월·날짜(2024, 202410, 20240101)
 * - 식별자: 0으로 시작하는 코드, 이벤트 번호 10046
 */
const isBigNumber = (n) =>
  n.split('.')[0].length >= 4 &&
  !/^[1-9]0{3,4}$/.test(n) &&
  !/^0/.test(n) &&
  !/^(19|20)\d\d(\d\d)?(\d\d)?$/.test(n) &&
  n !== '10046'

const errors = []
/** 강의 목록·파트 나누기에 쓰는 요약 (강의 본문을 받지 않고도 길이·파트를 알 수 있게) */
const meta = {}
// 장면 하나를 듣는 예상 시간 (ms): 1초에 약 7자 + 단계 사이 쉼, 퀴즈는 보기 읽기·답 기다림·해설 포함
//  (src/lib/tts/types.ts 의 estimateMs, useLecturePlayer 의 쉬는 시간과 맞춘다)
const speakMs = (text) => Math.max(1500, (text.length / 7) * 1000)
const sceneMs = (s) =>
  Math.round(
    (s.steps ?? []).reduce((n, st) => n + speakMs(st.say ?? '') + 500, 400) +
      (s.type === 'quiz' ? speakMs((s.choices ?? []).map((c, i) => `${i + 1}번, ${c}.`).join(' ')) + 8000 + speakMs(s.explanation ?? '') : 0),
  )
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')) : []

for (const file of files) {
  const slug = file.slice(0, -5)
  const fail = (msg) => errors.push(`${file}: ${msg}`)
  let lecture
  try {
    lecture = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))
  } catch (e) {
    fail(`JSON 파싱 실패: ${e.message}`)
    continue
  }
  if (lecture.slug !== slug) fail(`slug(${lecture.slug})가 파일명과 다름`)
  if (!THEORY.has(slug)) fail(`같은 slug 의 이론 문서가 없음`)
  if (!lecture.title) fail('title 없음')
  if (!Array.isArray(lecture.scenes) || !lecture.scenes.length) fail('scenes 없음')
  meta[slug] = (lecture.scenes ?? []).map((s) => [s.section, s.type === 'quiz' ? 1 : 0, sceneMs(s)])

  // 예제 표 (data 장면이 이름으로 불러 쓴다)
  const tables = lecture.tables ?? {}
  for (const [name, t] of Object.entries(tables)) {
    if (!t.columns?.length || !t.rows?.length) fail(`표 ${name}: columns/rows 없음`)
    if (t.rows?.some((r) => r.length !== t.columns.length || r.some((v) => typeof v !== 'string')))
      fail(`표 ${name}: 행의 칸 수가 컬럼 수와 다르거나 문자열이 아닌 값이 있음`)
    if (t.rows?.length > 10) fail(`표 ${name}: 행이 ${t.rows.length}개 — 한눈에 보이게 10행까지`)
  }

  // 듣기만 하는 구간이 길면 집중이 풀린다: 퀴즈 없이 이어지는 설명 장면은 6개까지
  let plainRun = 0
  for (const [i, s] of (lecture.scenes ?? []).entries()) {
    if (s.type === 'quiz') plainRun = 0
    else if (s.type !== 'title' && s.type !== 'checklist' && ++plainRun === 7)
      fail(`장면 #${i + 1}(${s.id}): 퀴즈 없이 설명 장면이 7개째 이어져요 (6개마다 퀴즈 하나)`)
  }

  const ids = new Set()
  for (const [i, s] of (lecture.scenes ?? []).entries()) {
    const at = `장면 #${i + 1}(${s.id})`
    if (!s.id || ids.has(s.id)) fail(`${at}: id 없음 또는 중복`)
    ids.add(s.id)
    if (!TYPES.has(s.type)) fail(`${at}: 알 수 없는 type ${s.type}`)
    if (!s.section) fail(`${at}: section 없음`)
    if (!Array.isArray(s.steps) || !s.steps.length || s.steps.some((st) => !st.say)) fail(`${at}: steps(say) 없음`)

    // focus 범위: code 는 줄 번호(1부터), table 은 행·points 는 항목(0부터), compare 는 0/1
    const range = {
      code: s.code ? [1, s.code.split('\n').length] : null,
      table: [0, (s.rows?.length ?? 0) - 1],
      data: s.code ? [1, s.code.split('\n').length] : null,
      points: [0, (s.items?.length ?? 0) - 1],
      compare: [0, 1],
      cards: [0, (s.items?.length ?? 0) - 1],
      flow: [0, (s.nodes?.length ?? 0) - 1],
      layers: [0, (s.layers?.length ?? 0) - 1],
      checklist: [0, (s.items?.length ?? 0) - 1],
    }[s.type]
    for (const st of s.steps ?? []) {
      for (const f of st.focus ?? []) {
        if (!range || f < range[0] || f > range[1]) fail(`${at}: focus ${f} 가 범위를 벗어남`)
      }
    }

    if (s.type === 'code' && !s.code) fail(`${at}: code 없음`)
    if (s.type === 'points' && !s.items?.length) fail(`${at}: items 없음`)
    if (s.type === 'table' && (!s.columns?.length || s.rows?.some((r) => r.length !== s.columns.length)))
      fail(`${at}: columns 와 rows 의 열 수가 다름`)
    if (s.type === 'data') checkData(s, at, tables, fail)
    else if ((s.steps ?? []).some((st) => st.t)) fail(`${at}: 표 변화(t)는 data 장면에만`)
    if (s.type === 'compare' && (!s.left?.items || !s.right?.items)) fail(`${at}: left/right 없음`)
    if (s.type === 'cards' && !s.items?.length) fail(`${at}: items 없음`)
    if (s.type === 'flow' && !s.nodes?.length) fail(`${at}: nodes 없음`)
    if (s.type === 'layers' && !s.layers?.length) fail(`${at}: layers 없음`)
    if (s.type === 'checklist' && !s.items?.length) fail(`${at}: items 없음`)
    // 아이콘 이름 확인 (title·cards·flow·layers·compare)
    const icons = [
      s.icon,
      s.left?.icon,
      s.right?.icon,
      ...[...(s.items ?? []), ...(s.nodes ?? []), ...(s.layers ?? [])].map((i) => i?.icon),
    ]
    for (const icon of icons) if (icon && !ICONS.has(icon)) fail(`${at}: 등록되지 않은 아이콘 '${icon}' (src/lib/lectureIcons.ts)`)
    if (s.type === 'callout' && (!TONES.has(s.tone) || !s.text)) fail(`${at}: tone(tip|info|warning)/text 확인`)
    // 귀로만 듣는 강의라서: 말하는 숫자는 짧게, 그리고 지금 화면에 보이는 숫자만 말한다
    //  (앞 장면의 표를 기억해야 따라올 수 있는 설명을 막는다)
    const { steps: _steps, ...visible } = s
    // data 장면은 띄운 표와 단계별 변화(새 컬럼·결과표·말풍선)도 화면이다
    const shown = s.type === 'data' ? [visible, (s.tables ?? []).map((n) => tables[n]), (s.steps ?? []).map((st) => st.t)] : visible
    const screen = JSON.stringify(shown).replace(/(\d),(?=\d{3})/g, '$1')
    // 화면 숫자도 짧게: 표·결과표 칸의 숫자 값, 그림·글 장면에 보이는 숫자는 3자리까지 (연도 제외)
    //  강의는 이론 문서와 숫자가 같을 필요 없다. 예제는 작은 숫자로 바꿔 쓴다 (예: 급여 3000 → 300)
    //  식별자는 숫자가 아니다: 오류 코드(ORA-08177), 0으로 시작하는 코드, 날짜(20240101), 이벤트 번호(10046), 전화번호 조각(010-1234)
    const bigNumbers = (text) =>
      [...text.matchAll(/(?<![\w.\-])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\w\-])/g)]
        .map((m) => m[0].replace(/,/g, ''))
        .filter(isBigNumber)
    const shownText = s.type === 'data' ? JSON.stringify(shown) : JSON.stringify(visible)
    for (const n of new Set(bigNumbers(shownText))) fail(`${at}: 화면 숫자 ${n} 가 너무 길어요 (3자리까지, 예제를 작은 숫자로)`)
    // 앞 장면의 표를 말로만 다시 쓰지 않는다: 표를 가리키는 설명은 그 표를 띄운 장면(data·table)에서
    if (s.type !== 'data' && s.type !== 'table')
      for (const st of s.steps ?? [])
        if (/(앞의|앞에서 본|위의|위|아까|방금|이|그) ?표(에서|를|의|로|에)/.test(st.say))
          fail(`${at}: 화면에 없는 표를 말로 가리켜요 — data 장면으로 표를 띄우세요 — "${st.say}"`)
    for (const st of s.steps ?? []) {
      const nums = (st.say.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ''))
      const isYear = (n) => /^(19|20)\d\d$/.test(n)
      for (const n of nums) {
        if (isYear(n)) continue
        if (isBigNumber(n)) fail(`${at}: 숫자 ${n} 가 너무 길어요 (듣기·읽기 방해, 3자리까지) — "${st.say}"`)
        if (/\.\d\d/.test(n)) fail(`${at}: 소수 ${n} 가 너무 길어요 — "${st.say}"`)
        if (n.replace('.', '').length >= 3 && !screen.includes(n)) fail(`${at}: 말하는 숫자 ${n} 가 이 장면 화면에 없어요 — "${st.say}"`)
      }
      if (nums.filter((n) => !isYear(n)).length >= 4) fail(`${at}: 한 문장에 숫자가 너무 많아요 — "${st.say}"`)
    }
    if (s.type === 'quiz' && (!s.question || s.choices?.length < 2 || !(s.answer >= 1 && s.answer <= s.choices.length) || !s.explanation))
      fail(`${at}: question/choices/answer/explanation 확인`)
  }
}

/** data 장면: 표 이름, 단계별 변화의 행 번호·컬럼 이름·값 개수 */
function checkData(s, at, tables, fail) {
  if (!Array.isArray(s.tables) || s.tables.length < 1 || s.tables.length > 2) return fail(`${at}: tables 는 표 이름 1~2개`)
  for (const n of s.tables) if (!tables[n]) fail(`${at}: 강의에 없는 표 ${n} (lecture.tables)`)
  if (!s.code && s.steps?.some((st) => st.focus?.length)) fail(`${at}: code 가 없는 data 장면에는 focus 를 쓰지 않아요`)
  const cols = Object.fromEntries(s.tables.map((n) => [n, new Set(tables[n]?.columns ?? [])]))
  const changes = (s.steps ?? []).filter((st) => st.t).length
  if (!changes) fail(`${at}: 표가 한 번도 바뀌지 않아요 (t 로 반짝·거르기·정렬·묶기·결과표)`)
  for (const [k, st] of (s.steps ?? []).entries()) {
    for (const [n, op] of Object.entries(st.t ?? {})) {
      const t = tables[n]
      const where = `${at} 단계 ${k + 1} 표 ${n}`
      if (!s.tables.includes(n) || !t) {
        fail(`${where}: 이 장면에 띄우지 않은 표`)
        continue
      }
      const KEYS = ['rows', 'cells', 'cols', 'notes', 'tint', 'filter', 'sort', 'group', 'add', 'set', 'result']
      for (const key of Object.keys(op)) if (!KEYS.includes(key)) fail(`${where}: 알 수 없는 변화 ${key}`)
      if (op.add) {
        if (!Array.isArray(op.add) || typeof op.add[0] !== 'string' || op.add[1]?.length !== t.rows.length)
          fail(`${where}: add 는 [컬럼, 원래 행 수(${t.rows.length})만큼 값]`)
        else cols[n].add(op.add[0])
      }
      const row = (r) => Number.isInteger(r) && r >= 0 && r < t.rows.length
      const col = (c) => cols[n].has(c)
      for (const r of [...(op.rows ?? []), ...(op.filter ?? []), ...(op.tint ?? []).flat()]) if (!row(r)) fail(`${where}: 행 번호 ${r} 가 범위를 벗어남 (0~${t.rows.length - 1})`)
      for (const [r, c] of [...(op.cells ?? []), ...(op.notes ?? []), ...(op.set ?? [])]) {
        if (!row(r)) fail(`${where}: 행 번호 ${r} 가 범위를 벗어남`)
        if (!col(c)) fail(`${where}: 없는 컬럼 ${c}`)
      }
      for (const c of [...(op.cols ?? []), ...(op.sort ?? []).map((x) => x[0]), ...(op.group ? [op.group] : [])]) if (!col(c)) fail(`${where}: 없는 컬럼 ${c}`)
      for (const x of op.sort ?? []) if (!['asc', 'desc'].includes(x[1])) fail(`${where}: sort 방향은 asc|desc`)
      for (const x of op.notes ?? []) if (typeof x[2] !== 'string' || x[2].length > 14) fail(`${where}: 말풍선은 14자까지 (${x[2]})`)
      if (op.result && (!op.result.columns?.length || op.result.rows?.some((r) => r.length !== op.result.columns.length)))
        fail(`${where}: result 의 columns 와 rows 칸 수가 다름`)
    }
  }
}

if (errors.length) {
  console.error(`\n[lectures] 강의 데이터 오류 ${errors.length}건\n  ` + errors.join('\n  '))
  process.exit(1)
}
// 내용이 같으면 다시 쓰지 않는다 (개발 서버가 괜히 새로고침하지 않게)
const META_FILE = path.resolve('src/content/lecture-meta.json')
const metaJson = JSON.stringify(meta) + '\n'
if (!fs.existsSync(META_FILE) || fs.readFileSync(META_FILE, 'utf8') !== metaJson) fs.writeFileSync(META_FILE, metaJson)
console.log(`[lectures] 강의 ${files.length}개`)
