import type { MarkdownIt as Md, Token } from 'markdown-it'
import container from 'markdown-it-container'

/** lucide 아이콘 (stroke) */
const icon = (paths: string, size = 18) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const ICONS = {
  tip: icon('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
  info: icon('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  warning: icon('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  example: icon('<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  summary: icon('<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'),
  copy: icon('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', 14),
}

const CALLOUTS = {
  tip: '시험 포인트',
  info: '참고',
  warning: '주의',
  example: '예시',
} as const

type CalloutType = keyof typeof CALLOUTS

function calloutOpen(md: Md, type: CalloutType, title?: string) {
  const t = md.utils.escapeHtml(title?.trim() || CALLOUTS[type])
  return `<div class="md-callout md-callout-${type}"><div class="md-callout-title">${ICONS[type]}<span>${t}</span></div><div class="md-callout-body">\n`
}

/**
 * 커스텀 블록
 *
 * ::: tip [제목]        시험 포인트 (노랑)
 * ::: info [제목]       참고 (파랑)
 * ::: warning [제목]    주의/함정 (빨강)
 * ::: example [제목]    예시 (초록)
 * ::: cards [열 수]     목록 항목을 카드 그리드로. 항목 첫 **굵은 글씨**가 카드 제목
 * ::: compare           목록 2개 항목을 VS 비교 카드로
 * ::: steps             번호 목록을 단계(스테퍼)로
 * ::: flow              목록 항목을 화살표로 이어진 흐름으로
 */
export function blocksPlugin(md: Md) {
  for (const type of Object.keys(CALLOUTS) as CalloutType[]) {
    md.use(container, type, {
      render(tokens: Token[], idx: number) {
        const tok = tokens[idx]!
        if (tok.nesting !== 1) return '</div></div>\n'
        return calloutOpen(md, type, tok.info.trim().slice(type.length))
      },
    })
  }

  md.use(container, 'cards', {
    render(tokens: Token[], idx: number) {
      const tok = tokens[idx]!
      if (tok.nesting !== 1) return '</div>\n'
      const cols = Number(tok.info.trim().slice('cards'.length).trim()) || 3
      return `<div class="md-cards" style="--cols:${cols}">\n`
    },
  })

  for (const name of ['compare', 'steps', 'flow']) {
    md.use(container, name, {
      render(tokens: Token[], idx: number) {
        return tokens[idx]!.nesting === 1 ? `<div class="md-${name}">\n` : '</div>\n'
      },
    })
  }
}

/** "> 시험 포인트: ..." 인용구를 tip 콜아웃으로 자동 변환 (기존 문서 호환) */
export function examQuotePlugin(md: Md) {
  const PREFIX = /^시험\s*포인트\s*[:：]\s*/

  md.core.ruler.push('exam_quote', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i]!
      if (open.type !== 'blockquote_open') continue
      const inline = tokens.slice(i + 1).find((t) => t.type === 'inline')
      if (!inline || !PREFIX.test(inline.content)) continue
      inline.content = inline.content.replace(PREFIX, '')
      const first = inline.children?.[0]
      if (first?.type === 'text') first.content = first.content.replace(PREFIX, '')
      open.meta = { callout: 'tip' }
      const close = tokens.slice(i + 1).find((t) => t.type === 'blockquote_close' && t.level === open.level)
      if (close) close.meta = { callout: 'tip' }
    }
  })

  const defaultOpen = md.renderer.rules.blockquote_open
  const defaultClose = md.renderer.rules.blockquote_close
  md.renderer.rules.blockquote_open = (tokens, idx, opts, env, self) =>
    tokens[idx]!.meta?.callout
      ? calloutOpen(md, 'tip')
      : defaultOpen
        ? defaultOpen(tokens, idx, opts, env, self)
        : self.renderToken(tokens, idx, opts)
  md.renderer.rules.blockquote_close = (tokens, idx, opts, env, self) =>
    tokens[idx]!.meta?.callout
      ? '</div></div>\n'
      : defaultClose
        ? defaultClose(tokens, idx, opts, env, self)
        : self.renderToken(tokens, idx, opts)
}

/** "## 핵심 요약" 섹션을 요약 카드로 감싼다 */
export function summaryPlugin(md: Md) {
  md.core.ruler.push('summary_card', (state) => {
    const tokens = state.tokens
    const isH2 = (t: Token) => t.type === 'heading_open' && t.tag === 'h2'
    const start = tokens.findIndex((t, i) => isH2(t) && tokens[i + 1]?.content.trim() === '핵심 요약')
    if (start < 0) return
    let end = tokens.findIndex((t, i) => i > start && isH2(t))
    if (end < 0) end = tokens.length

    const html = (content: string) => {
      const t = new state.Token('html_block', '', 0)
      t.content = content
      return t
    }
    tokens.splice(end, 0, html('</section>\n'))
    tokens.splice(start, 0, html(`<section class="md-summary"><div class="md-summary-icon">${ICONS.summary}</div>\n`))
  })
}

/** 표를 가로 스크롤 가능한 둥근 카드로 감싼다 */
export function tablePlugin(md: Md) {
  md.renderer.rules.table_open = () => '<div class="md-table"><table>\n'
  md.renderer.rules.table_close = () => '</table></div>\n'
}

/**
 * 코드 블록 꾸미기 (shiki 적용 후에 use)
 * - ```mermaid → 다이어그램 자리 (렌더링은 화면에서 lazy 로 처리)
 * - ```sql 등 → 언어 라벨 + 복사 버튼 헤더
 * - ```text → 헤더 없이 그대로
 */
export function fencePlugin(md: Md) {
  const highlight = md.renderer.rules.fence!
  md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
    const tok = tokens[idx]!
    const lang = tok.info.trim().split(/\s+/)[0] || 'sql'
    if (lang === 'mermaid') {
      return `<div class="md-mermaid" data-src="${encodeURIComponent(tok.content)}"><div class="md-mermaid-loading">다이어그램 불러오는 중…</div></div>\n`
    }
    const code = highlight(tokens, idx, opts, env, self)
    if (lang === 'text') return `<div class="md-code md-code-plain">${code}</div>\n`
    return `<div class="md-code"><div class="md-code-head"><span>${md.utils.escapeHtml(lang.toUpperCase())}</span><button type="button" class="md-copy" data-copy>${ICONS.copy}<span>복사</span></button></div>${code}</div>\n`
  }
}

/**
 * 예시 문장 분리: 문장이 시작되는 자리의 "예: …" / "예시: …" 를 별도 줄로 떼어 예시 라벨을 붙인다.
 * - 문단·목록 항목의 맨 앞, 줄바꿈 직후, 또는 앞 문장이 끝난 뒤(. ! ?)에 오는 경우만
 * - "(예: 사원, 물품)" 처럼 문장 안 괄호 속 짧은 예시는 그대로 둔다
 * - 예시는 그 문단/항목의 끝까지로 본다
 */
export function examplePlugin(md: Md) {
  const MARK = /(^|[.!?]\s+)예(?:시)?\s*:\s*/

  md.core.ruler.push('example_line', (state) => {
    let inHeading = false
    for (const block of state.tokens) {
      if (block.type === 'heading_open') inHeading = true
      if (block.type === 'heading_close') inHeading = false
      if (block.type !== 'inline' || inHeading || !block.children) continue

      const kids = block.children
      let depth = 0 // 굵게/기울임/링크 안에서 시작하면 태그가 엇갈리므로 건너뜀
      for (let i = 0; i < kids.length; i++) {
        const tok = kids[i]!
        if (tok.nesting === 1) depth++
        if (tok.nesting === -1) depth--
        if (tok.type !== 'text' || depth !== 0) continue

        const m = MARK.exec(tok.content)
        if (!m) continue
        // 텍스트 토큰 맨 앞이면: 문단 시작이거나 줄바꿈 직후여야 문장 시작으로 인정
        const prev = kids[i - 1]
        if (m.index === 0 && !m[1] && prev && prev.type !== 'softbreak' && prev.type !== 'hardbreak') continue

        const before = new state.Token('text', '', 0)
        before.content = tok.content.slice(0, m.index + m[1]!.length).trimEnd()
        const open = new state.Token('html_inline', '', 0)
        open.content = '<span class="md-ex"><span class="md-ex-label">예시</span>'
        const after = new state.Token('text', '', 0)
        after.content = tok.content.slice(m.index + m[0].length)
        const close = new state.Token('html_inline', '', 0)
        close.content = '</span>'
        // 예시 앞의 줄바꿈 토큰은 제거 (예시가 이미 새 줄에서 시작)
        const head = kids.slice(0, i).filter((t, j) => !(j === i - 1 && (t.type === 'softbreak' || t.type === 'hardbreak')))
        block.children = [...head, before, open, after, ...kids.slice(i + 1), close]
        break // 한 문단에 하나만
      }
    }
  })
}

/** 괄호 안의 구분자는 무시하고 ", " 또는 " / " 로 나눈다 */
function splitTopLevel(text: string) {
  const items: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (ch === '(' || ch === '（') depth++
    if (ch === ')' || ch === '）') depth = Math.max(0, depth - 1)
    if (depth === 0 && (text.startsWith(', ', i) || text.startsWith(' / ', i))) {
      items.push(cur.trim())
      cur = ''
      i += text.startsWith(' / ', i) ? 2 : 1
      continue
    }
    cur += ch
  }
  items.push(cur.trim())
  return items.filter(Boolean)
}

/**
 * "라벨: 내용" 문단·목록 항목 정리
 * - 앞의 짧은 라벨은 굵은 강조 라벨로
 * - 내용이 짧은 항목 3개 이상의 나열이면 칩으로 나눠 보여준다 (괄호 안 쉼표는 항목 구분이 아님)
 * - 서식이 섞인 문장(굵게·코드·링크 등)과 표 안, "예:" 는 대상이 아님
 */
export function leadPlugin(md: Md) {
  const LEAD = /^([^:：.!?()]{2,20})[:：]\s+(.+)$/
  const SKIP = new Set(['예', '예시', '시험 포인트', '결과', '주의'])

  md.core.ruler.push('lead_label', (state) => {
    const tokens = state.tokens
    for (let i = 1; i < tokens.length; i++) {
      const block = tokens[i]!
      if (block.type !== 'inline' || tokens[i - 1]!.type !== 'paragraph_open') continue
      const kids = block.children ?? []
      if (kids.length !== 1 || kids[0]!.type !== 'text') continue

      const m = LEAD.exec(kids[0]!.content)
      if (!m || SKIP.has(m[1]!.trim())) continue
      const esc = md.utils.escapeHtml
      const label = `<span class="md-lead">${esc(m[1]!.trim())}</span>`
      const chips = (list: string[], cls = '') =>
        `<span class="md-chips${cls}">${list
          .map((s) => `<span class="md-chip">${esc(s)}</span>`)
          .join(cls ? '<span class="md-arrow">→</span>' : '')}</span>`
      // 항목 안에 또 "라벨: " 이 있으면 한 줄에 여러 주제가 섞인 것이므로 칩으로 나누지 않음 (1:1 같은 표기는 허용)
      const short = (list: string[]) => list.every((s) => s.length <= 24 && !/[:：]\s/.test(s))
      // "A → B → C" 는 순서이므로 화살표로 이어진 단계 칩
      const steps = m[2]!.split(/\s*→\s*/).map((s) => s.trim()).filter(Boolean)
      const items = splitTopLevel(m[2]!)
      const body =
        steps.length >= 3 && short(steps)
          ? chips(steps, ' md-seq')
          : items.length >= 3 && short(items)
            ? chips(items)
            : esc(m[2]!)
      const html = new state.Token('html_inline', '', 0)
      html.content = label + body
      block.children = [html]
    }
  })
}

/**
 * 약어 풀이: 페이지에서 처음 나오는 약어 옆에 원어와 뜻을 작게 붙인다.
 * - 제목, 코드, 링크 안은 건드리지 않음
 * - 이미 "ERD(Entity ...)" 처럼 괄호로 풀어 쓴 경우는 그대로 두고 처리된 것으로 침
 */
export function abbrPlugin(md: Md, glossary: Record<string, { full: string; ko?: string }>) {
  const keys = Object.keys(glossary).sort((a, b) => b.length - a.length)
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const RE = new RegExp(`(?<![A-Za-z0-9_-])(${keys.map(escapeRe).join('|')})(?![A-Za-z0-9_-])`, 'g')

  md.core.ruler.push('abbr_gloss', (state) => {
    const seen = new Set<string>()
    let inHeading = false
    for (const block of state.tokens) {
      if (block.type === 'heading_open') inHeading = true
      if (block.type === 'heading_close') inHeading = false
      if (block.type !== 'inline' || inHeading || !block.children) continue

      const out: Token[] = []
      let linkDepth = 0
      for (const tok of block.children) {
        if (tok.type === 'link_open') linkDepth++
        if (tok.type === 'link_close') linkDepth--
        if (tok.type !== 'text' || linkDepth > 0) {
          out.push(tok)
          continue
        }
        const text = tok.content
        let last = 0
        RE.lastIndex = 0
        for (let m = RE.exec(text); m; m = RE.exec(text)) {
          const key = m[1]!
          if (seen.has(key)) continue
          // 제품명 안의 SQL (SQL Server, PL/SQL, T-SQL)은 약어 풀이 대상이 아님
          if (key === 'SQL' && (/^\s*Server/.test(text.slice(m.index + 3)) || /(PL\/|T-)$/.test(text.slice(0, m.index)))) continue
          seen.add(key)
          // 바로 뒤에 괄호로 풀이가 이미 있으면 건드리지 않음
          if (/^\s*\(/.test(text.slice(m.index + key.length))) continue
          const g = glossary[key]!
          // "다치 종속(MVD)" 처럼 한글 용어 바로 뒤 괄호 안이면 한글 뜻은 생략
          const showKo = g.ko && !/\(\s*$/.test(text.slice(0, m.index))
          const before = new state.Token('text', '', 0)
          before.content = text.slice(last, m.index)
          const abbr = new state.Token('html_inline', '', 0)
          const esc = md.utils.escapeHtml
          abbr.content =
            `<abbr class="md-abbr" title="${esc(g.full)}">${esc(key)}</abbr>` +
            `<span class="md-abbr-gloss">${esc(g.full)}${showKo ? ` · ${esc(g.ko!)}` : ''}</span>`
          out.push(before, abbr)
          last = m.index + key.length
        }
        if (last === 0) {
          out.push(tok)
        } else {
          const rest = new state.Token('text', '', 0)
          rest.content = text.slice(last)
          out.push(rest)
        }
      }
      block.children = out
    }
  })
}
