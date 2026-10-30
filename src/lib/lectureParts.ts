import lectureMeta from '@/content/lecture-meta.json'

/**
 * 강의를 3~4분짜리 '파트'로 나눈다 (Speak 처럼 짧게 끝내고 다음으로).
 * - 소단원(section) 경계에서만 자르고, 너무 짧은 마지막 파트는 앞 파트에 붙인다
 * - 강의 데이터는 그대로 두고 화면에서만 나누므로, 장면을 고치면 파트도 알아서 바뀐다
 * - 길이는 scripts/check-lectures.mjs 가 만드는 요약(content/lecture-meta.json)으로 계산한다
 *   (강의 본문을 받지 않아도 목록에서 길이·파트를 보여줄 수 있게)
 */
export interface LecturePart {
  /** 0부터 */
  index: number
  /** 첫 장면 번호 (강의 전체 기준, 0부터) */
  start: number
  /** 마지막 장면 다음 번호 */
  end: number
  /** 파트 이름 (첫 소단원) */
  title: string
  sections: string[]
  /** 예상 재생 시간 (1배속, ms) */
  ms: number
  quizzes: number
}

/** 장면별 [소단원, 퀴즈면 1, 예상 ms] */
type SceneMeta = [section: string, quiz: number, ms: number]
const META = lectureMeta as unknown as Record<string, SceneMeta[]>

/** 한 파트 목표 길이. 이보다 길어지면 다음 소단원부터 새 파트 */
const TARGET_MS = 4 * 60_000
/** 이보다 짧은 앞 파트(제목 장면만 있는 '시작' 등)는 다음 소단원과 합친다 */
const MIN_MS = 60_000
/** 이보다 짧은 마지막 파트는 앞 파트에 붙인다 */
const MIN_LAST_MS = 100_000
/** 파트 이름으로 쓰지 않는 소단원 */
const GENERIC = new Set(['시작', '핵심 요약'])

const cache = new Map<string, LecturePart[]>()

/** 강의의 파트 목록. 요약이 없으면(새로 만든 강의를 아직 검사 안 함) 빈 배열 */
export function lectureParts(slug: string): LecturePart[] {
  const hit = cache.get(slug)
  if (hit) return hit
  const scenes = META[slug] ?? []
  // 같은 소단원이 이어지는 장면 묶음
  const groups: { section: string; start: number; end: number; ms: number }[] = []
  scenes.forEach(([section, , ms], i) => {
    const last = groups[groups.length - 1]
    if (last && last.section === section) {
      last.end = i + 1
      last.ms += ms
    } else groups.push({ section, start: i, end: i + 1, ms })
  })

  const ranges: { start: number; end: number; ms: number; sections: string[] }[] = []
  for (const g of groups) {
    const cur = ranges[ranges.length - 1]
    if (cur && (cur.ms + g.ms <= TARGET_MS || cur.ms < MIN_MS)) {
      cur.end = g.end
      cur.ms += g.ms
      cur.sections.push(g.section)
    } else ranges.push({ start: g.start, end: g.end, ms: g.ms, sections: [g.section] })
  }
  const last = ranges[ranges.length - 1]
  if (ranges.length > 1 && last && last.ms < MIN_LAST_MS) {
    const prev = ranges[ranges.length - 2]!
    prev.end = last.end
    prev.ms += last.ms
    prev.sections.push(...last.sections)
    ranges.pop()
  }

  const parts = ranges.map((r, index) => {
    const sections = [...new Set(r.sections.filter((s) => !GENERIC.has(s)))]
    return {
      index,
      start: r.start,
      end: r.end,
      title: sections[0] ?? r.sections[0] ?? '',
      sections,
      ms: r.ms,
      quizzes: scenes.slice(r.start, r.end).filter(([, quiz]) => quiz).length,
    }
  })
  cache.set(slug, parts)
  return parts
}

/** 강의 전체 예상 시간 (ms) */
export const lectureMs = (slug: string) => lectureParts(slug).reduce((n, p) => n + p.ms, 0)

/** 장면 번호(강의 전체 기준)가 속한 파트 */
export const partOf = (parts: LecturePart[], sceneIndex: number) =>
  parts.find((p) => sceneIndex >= p.start && sceneIndex < p.end) ?? parts[0]

/** '약 4분' (반올림, 최소 1분) */
export const minutesLabel = (ms: number) => `약 ${Math.max(1, Math.round(ms / 60_000))}분`
