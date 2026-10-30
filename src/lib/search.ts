import MiniSearch from 'minisearch'
import { slugify } from '@/lib/markdown'
import type { TheoryDoc } from '@/types'

export interface SearchEntry {
  id: string
  slug: string
  anchor: string
  docTitle: string
  heading: string
  text: string
}

const HANGUL = /[가-힣]/

/**
 * 한글은 조사가 붙어 단어 단위 검색이 잘 안 되므로 2-gram 을 함께 색인한다.
 * 예) "정규화를" → ["정규화를", "정규", "규화", "화를"]
 */
export function tokenize(text: string): string[] {
  const out: string[] = []
  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}_]+/u)) {
    if (!word) continue
    out.push(word)
    if (HANGUL.test(word) && word.length > 2) {
      for (let i = 0; i < word.length - 1; i++) out.push(word.slice(i, i + 2))
    }
  }
  return out
}

/** 마크다운 → 평문 (대략적인 정리) */
function toPlain(md: string) {
  return md
    .replace(/```mermaid[\s\S]*?```/g, ' ') // 다이어그램 소스는 색인 제외
    .replace(/<[^>]+>/g, ' ') // 인라인 SVG/HTML 태그
    .replace(/^:::.*$/gm, ' ') // 커스텀 블록 표시
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_>#|]/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 문서를 h2 섹션 단위로 쪼개서 색인 (검색 결과에서 해당 섹션으로 바로 이동) */
function splitSections(doc: TheoryDoc): SearchEntry[] {
  const entries: SearchEntry[] = []
  const parts = doc.body.split(/^## /m)
  parts.forEach((part, i) => {
    if (i === 0) {
      const text = toPlain(part.replace(/^# .*$/m, ''))
      entries.push({ id: `${doc.slug}#`, slug: doc.slug, anchor: '', docTitle: doc.title, heading: doc.title, text })
      return
    }
    const nl = part.indexOf('\n')
    const heading = part.slice(0, nl).trim()
    entries.push({
      id: `${doc.slug}#${slugify(heading)}`,
      slug: doc.slug,
      anchor: slugify(heading),
      docTitle: doc.title,
      heading,
      text: toPlain(part.slice(nl + 1)),
    })
  })
  return entries
}

export function buildIndex(docs: TheoryDoc[]) {
  const mini = new MiniSearch<SearchEntry>({
    fields: ['docTitle', 'heading', 'text'],
    storeFields: ['slug', 'anchor', 'docTitle', 'heading', 'text'],
    tokenize,
    searchOptions: {
      boost: { heading: 3, docTitle: 2 },
      prefix: true,
      fuzzy: (term) => (HANGUL.test(term) ? false : 0.2),
      combineWith: 'AND',
      // 요약 섹션은 키워드가 몰려 있어 모든 검색에 상위로 뜨므로 가중치를 낮춘다
      boostDocument: (_id, _term, stored) => (stored?.heading === '핵심 요약' ? 0.3 : 1),
    },
  })
  mini.addAll(docs.flatMap(splitSections))
  return mini
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** 검색어 주변 문장을 잘라 <mark> 로 강조 */
export function snippet(text: string, query: string, radius = 40) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  const lower = text.toLowerCase()
  let pos = -1
  for (const w of words) {
    pos = lower.indexOf(w.toLowerCase())
    if (pos >= 0) break
  }
  const start = Math.max(0, pos - radius)
  const end = Math.min(text.length, (pos < 0 ? 0 : pos) + radius * 2)
  let out = escapeHtml(text.slice(start, end))
  for (const w of words) {
    const re = new RegExp(escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    out = out.replace(re, (m) => `<mark>${m}</mark>`)
  }
  return (start > 0 ? '…' : '') + out + (end < text.length ? '…' : '')
}

export function highlight(text: string, query: string) {
  return snippet(text, query, 1000)
}
