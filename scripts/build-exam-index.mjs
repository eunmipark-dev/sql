// 시험 데이터 검증 + 목록(index.json) 생성
//   public/data/exams/*.json  →  public/data/exams/index.json
// npm run dev / build 전에 자동 실행된다 (package.json 의 predev / prebuild)
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('public/data/exams')
const KINDS = new Set(['past', 'ai', 'sqlp'])
const THEORY = new Set(
  fs.readdirSync('src/content/theory').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3).replace(/^(\d+-)+/, '')),
)
const hash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 10)
// 분류별(이론 절별) 문제은행: bank[kind][slug] = [{ examId, examTitle, number, ...question }]
const bank = {}

const errors = []
const fail = (file, msg) => errors.push(`${file}: ${msg}`)

const exams = []
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json').sort()) {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8')
  let exam
  try {
    exam = JSON.parse(raw)
  } catch (e) {
    fail(file, `JSON 파싱 실패: ${e.message}`)
    continue
  }
  if (exam.id !== file.slice(0, -5)) fail(file, `id(${exam.id})가 파일명과 다름`)
  if (!KINDS.has(exam.kind)) fail(file, `kind 는 past | ai | sqlp 여야 함 (${exam.kind})`)
  if (!exam.title) fail(file, 'title 없음')
  if (!Array.isArray(exam.questions) || !exam.questions.length) fail(file, 'questions 없음')

  const ids = new Set()
  for (const [i, q] of (exam.questions ?? []).entries()) {
    const at = `${file} #${i + 1}`
    if (ids.has(q.id)) errors.push(`${at}: 중복 id ${q.id}`)
    ids.add(q.id)
    if (![1, 2, 3].includes(q.subject)) errors.push(`${at}: subject 는 1, 2, 3 중 하나`)
    if (q.subject === 3 && exam.kind !== 'sqlp') errors.push(`${at}: 3과목은 SQLP(sqlp) 시험에만 있음`)
    if (!q.question) errors.push(`${at}: question 없음`)
    if (!Array.isArray(q.choices) || q.choices.length !== 4) errors.push(`${at}: choices 는 4개`)
    if (!(q.answer >= 1 && q.answer <= (q.choices?.length ?? 0))) errors.push(`${at}: answer 범위 오류 (${q.answer})`)
    if (!q.explanation) errors.push(`${at}: explanation 없음`)
    if (q.theory && !THEORY.has(q.theory)) errors.push(`${at}: 존재하지 않는 이론 slug (${q.theory})`)
    if (q.theory) {
      bank[exam.kind] ??= {}
      ;(bank[exam.kind][q.theory] ??= []).push({ examId: exam.id, examTitle: exam.title, number: i + 1, ...q })
    }
  }

  // SQLP 실기: 채점 포인트 합 = 15점
  for (const [i, p] of (exam.practicals ?? []).entries()) {
    const at = `${file} 실기 #${i + 1}`
    if (!p.title || !p.question || !p.answer || !p.explanation) errors.push(`${at}: title/question/answer/explanation 필요`)
    const sum = (p.rubric ?? []).reduce((n, r) => n + (r.score ?? 0), 0)
    if (!p.rubric?.length || sum !== 15) errors.push(`${at}: rubric 점수 합이 15가 아님 (${sum})`)
  }

  const countOf = (s) => exam.questions?.filter((q) => q.subject === s).length ?? 0
  exams.push({
    id: exam.id,
    kind: exam.kind,
    title: exam.title,
    description: exam.description ?? '',
    round: exam.round ?? null,
    date: exam.date ?? null,
    timeLimitMin: exam.timeLimitMin ?? null,
    questionCount: exam.questions?.length ?? 0,
    subjectCounts: { 1: countOf(1), 2: countOf(2), 3: countOf(3) },
    practicalCount: exam.practicals?.length ?? 0,
    // 내용이 바뀌면 주소도 바뀌어 브라우저 캐시가 갱신된다
    file: `${file}?v=${hash(raw)}`,
  })
}

if (errors.length) {
  console.error(`\n[exam-index] 시험 데이터 오류 ${errors.length}건\n  ` + errors.join('\n  '))
  process.exit(1)
}

exams.sort((a, b) => a.kind.localeCompare(b.kind) || (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id))

// 문제은행 파일 쓰기 (이전 결과는 지우고 새로 만든다)
const BANK_DIR = path.join(DIR, 'bank')
fs.rmSync(BANK_DIR, { recursive: true, force: true })
const bankIndex = {}
for (const [kind, bySlug] of Object.entries(bank)) {
  fs.mkdirSync(path.join(BANK_DIR, kind), { recursive: true })
  bankIndex[kind] = {}
  for (const [slug, questions] of Object.entries(bySlug)) {
    const text = JSON.stringify(questions)
    fs.writeFileSync(path.join(BANK_DIR, kind, `${slug}.json`), text)
    bankIndex[kind][slug] = { count: questions.length, file: `bank/${kind}/${slug}.json?v=${hash(text)}` }
  }
}

fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({ exams, bank: bankIndex }, null, 2) + '\n')
const countKind = (k) => exams.filter((e) => e.kind === k).length
console.log(`[exam-index] ${exams.length}개 시험 (${countKind('past')} 기출 · ${countKind('ai')} SQLD 모의고사 · ${countKind('sqlp')} SQLP 모의고사)`)
