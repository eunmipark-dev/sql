import type { TheoryDoc } from '@/types'

const rawDocs = import.meta.glob('@/content/theory/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function parseFrontmatter(raw: string) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const meta: Record<string, string> = {}
  if (!match) return { meta, body: raw }
  for (const line of match[1]!.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { meta, body: raw.slice(match[0].length) }
}

const fileName = (path: string) => path.split('/').pop()!.replace(/\.md$/, '')

/** 파일명 `1-2-01-normalization.md` → slug `normalization` (앞의 숫자는 정렬용) */
const toSlug = (path: string) => fileName(path).replace(/^(\d+-)+/, '')

export const theoryDocs: TheoryDoc[] = Object.entries(rawDocs)
  .sort(([a], [b]) => fileName(a).localeCompare(fileName(b), undefined, { numeric: true }))
  .map(([path, raw]) => {
    const { meta, body } = parseFrontmatter(raw)
    return {
      slug: toSlug(path),
      title: meta.title ?? toSlug(path),
      subject: meta.subject ?? '기타',
      chapter: meta.chapter ?? '기타',
      summary: meta.summary ?? '',
      body,
    }
  })

const unique = <T,>(xs: T[]) => [...new Set(xs)]

/** 과목 번호 (frontmatter subject 의 앞 숫자, 예: '3과목 · …' → 3). 3과목은 SQLP 전용 */
export const subjectNo = (doc: TheoryDoc) => Number.parseInt(doc.subject, 10) || 0

/** 문서 목록 → 과목 → 장 → 문서 트리 */
export function buildTree(docs: TheoryDoc[]) {
  return unique(docs.map((d) => d.subject)).map((subject) => {
    const inSubject = docs.filter((d) => d.subject === subject)
    return {
      name: subject,
      chapters: unique(inSubject.map((d) => d.chapter)).map((chapter) => ({
        name: chapter,
        docs: inSubject.filter((d) => d.chapter === chapter),
      })),
    }
  })
}

/** 전체 문서 트리 (SQLD/SQLP 구분 없이) */
export const theoryTree = buildTree(theoryDocs)

export function findDoc(slug: string) {
  return theoryDocs.find((d) => d.slug === slug)
}
