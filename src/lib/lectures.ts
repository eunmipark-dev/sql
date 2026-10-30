import type { Lecture } from '@/types'

/**
 * 인터랙티브 강의: content/lectures/<slug>.json (이론 문서 slug 와 같은 이름).
 * 강의 본문은 열 때만 받아온다 (파일마다 별도 청크).
 */
const loaders = import.meta.glob<Lecture>('@/content/lectures/*.json', { import: 'default' })

const slugOf = (path: string) => path.split('/').pop()!.replace(/\.json$/, '')
const bySlug = new Map(Object.entries(loaders).map(([path, load]) => [slugOf(path), load]))

/** 강의가 있는 이론 문서인지 (목록·버튼 표시용, 본문은 받지 않는다) */
export const hasLecture = (slug: string) => bySlug.has(slug)

// ── 마지막으로 본 장면 (이 브라우저에만 저장하는 편의 기능. 저장이 막혀 있으면 이어 보기만 안 된다) ──
// 값은 '장면번호/전체장면수' (예: 5/39). 예전 형식 '5' 도 읽는다
const posKey = (slug: string) => `sql-cert:lecture-pos:${slug}`

/** 이어 볼 장면 번호(0이면 처음부터)와 전체 장면 수(모르면 undefined) */
export function readLectureProgress(slug: string): { pos: number; total?: number } {
  try {
    const [pos, total] = (localStorage.getItem(posKey(slug)) ?? '0').split('/').map(Number)
    return { pos: pos || 0, total: total || undefined }
  } catch {
    return { pos: 0 }
  }
}

export const readLecturePos = (slug: string) => readLectureProgress(slug).pos

export function writeLecturePos(slug: string, sceneIndex: number, total: number) {
  try {
    localStorage.setItem(posKey(slug), `${sceneIndex}/${total}`)
  } catch {
    // 무시
  }
}

// ── 끝까지 들은 파트 (이 브라우저에 저장. 목록에서 파트 진행을 보여주는 데만 쓴다) ──
const partsKey = (slug: string) => `sql-cert:lecture-parts:${slug}`

export function readDoneParts(slug: string): Set<number> {
  try {
    return new Set((localStorage.getItem(partsKey(slug)) ?? '').split(',').filter(Boolean).map(Number))
  } catch {
    return new Set()
  }
}

export function markPartDone(slug: string, index: number) {
  try {
    const done = readDoneParts(slug)
    done.add(index)
    localStorage.setItem(partsKey(slug), [...done].sort((a, b) => a - b).join(','))
  } catch {
    // 무시
  }
}

export async function loadLecture(slug: string): Promise<Lecture> {
  const load = bySlug.get(slug)
  if (!load) throw new Error(`강의를 찾을 수 없습니다: ${slug}`)
  return load()
}
