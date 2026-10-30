import MarkdownIt from 'markdown-it'
import { fromHighlighter } from '@shikijs/markdown-it/core'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { Heading } from '@/types'
import { abbrPlugin, blocksPlugin, examplePlugin, examQuotePlugin, fencePlugin, leadPlugin, summaryPlugin, tablePlugin } from '@/lib/markdown-blocks'
import { GLOSSARY } from '@/lib/glossary'

/** 한글을 유지하는 슬러그 */
export function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
}

function createMd() {
  // 이론 문서는 저장소에 있는 신뢰된 콘텐츠라 그림용 인라인 SVG/HTML 을 허용
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false })
  md.use(blocksPlugin).use(examQuotePlugin).use(summaryPlugin).use(tablePlugin).use(examplePlugin).use(leadPlugin).use(abbrPlugin, GLOSSARY)

  // h2/h3 에 id 부여 + 목차 수집 (env.headings)
  md.core.ruler.push('heading_ids', (state) => {
    const headings: Heading[] = []
    const used = new Map<string, number>()
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i]!
      if (tok.type !== 'heading_open' || (tok.tag !== 'h2' && tok.tag !== 'h3')) continue
      const text = tokens[i + 1]!.children?.map((c) => c.content).join('') ?? ''
      let id = slugify(text)
      const n = used.get(id) ?? 0
      used.set(id, n + 1)
      if (n) id = `${id}-${n}`
      tok.attrSet('id', id)
      headings.push({ level: tok.tag === 'h2' ? 2 : 3, id, text })
    }
    state.env.headings = headings
  })

  return md
}

let ready: Promise<ReturnType<typeof createMd>> | null = null

/** shiki 하이라이터를 한 번만 로드해서 MarkdownIt 인스턴스를 반환 */
export function getMarkdown() {
  ready ??= (async () => {
    const highlighter = await createHighlighterCore({
      themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
      langs: [import('shiki/langs/sql.mjs')],
      engine: createJavaScriptRegexEngine(),
    })
    const md = createMd()
    md.use(
      fromHighlighter(highlighter as never, {
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultLanguage: 'sql',
        // 'text'(일반 텍스트)는 shiki 내장이지만 타입 정의에 없어서 단언
        fallbackLanguage: 'text' as never,
      }),
    )
    md.use(fencePlugin) // shiki 하이라이트 결과를 감싸므로 반드시 shiki 다음
    return md
  })()
  return ready
}

export async function renderMarkdown(src: string) {
  const md = await getMarkdown()
  const env: { headings?: Heading[] } = {}
  const html = md.render(src, env)
  return { html, headings: env.headings ?? [] }
}

const inlineMd = new MarkdownIt({ html: false, linkify: false })
const blockMd = new MarkdownIt({ html: false, linkify: false, breaks: true }).use(tablePlugin)

/** 문제 본문·해설용 블록 마크다운 (표 가능, 하이라이터 없이 동기 렌더링) */
export function renderBlock(src: string) {
  return blockMd.render(src)
}

/** 인라인 마크다운 (문제 본문, 보기 등) — 하이라이터 없이 동기 렌더링 */
export function renderInline(src: string) {
  return inlineMd.renderInline(src)
}
