/** mermaid 는 무거우므로 다이어그램이 있는 문서에서만 불러온다 */
let mermaidPromise: Promise<typeof import('mermaid').default> | null = null
let seq = 0

const FONT = '"Pretendard Variable", Pretendard, system-ui, sans-serif'

const THEMES = {
  light: {
    background: 'transparent',
    primaryColor: '#eef1f8',
    primaryBorderColor: '#2f4373',
    primaryTextColor: '#1b2a4e',
    secondaryColor: '#fcf5c4',
    secondaryBorderColor: '#c9a908',
    secondaryTextColor: '#3d3302',
    tertiaryColor: '#f4f2ec',
    tertiaryBorderColor: '#d9d5ca',
    tertiaryTextColor: '#1b2238',
    lineColor: '#8a90a3',
    textColor: '#2c3550',
    clusterBkg: '#faf8f2',
    clusterBorder: '#d9d5ca',
    edgeLabelBackground: '#ffffff',
    attributeBackgroundColorOdd: '#ffffff',
    attributeBackgroundColorEven: '#faf8f2',
    rowOdd: '#ffffff',
    rowEven: '#faf8f2',
  },
  dark: {
    background: 'transparent',
    primaryColor: '#24305a',
    primaryBorderColor: '#f5e04b',
    primaryTextColor: '#f4f2ea',
    secondaryColor: '#3a3510',
    secondaryBorderColor: '#f59e0b',
    secondaryTextColor: '#fcf5c4',
    tertiaryColor: '#232b44',
    tertiaryBorderColor: '#3f4864',
    tertiaryTextColor: '#e2e8f0',
    lineColor: '#64748b',
    textColor: '#cbd5e1',
    clusterBkg: '#1a2135',
    clusterBorder: '#3a4360',
    edgeLabelBackground: '#1d2438',
    attributeBackgroundColorOdd: '#1d2438',
    attributeBackgroundColorEven: '#232b44',
    rowOdd: '#1d2438',
    rowEven: '#232b44',
  },
}

/** root 안의 .md-mermaid 요소들을 현재 테마로 렌더링 (테마가 바뀌면 다시 호출) */
export async function renderMermaid(root: HTMLElement, dark: boolean) {
  const nodes = [...root.querySelectorAll<HTMLElement>('.md-mermaid')]
  if (!nodes.length) return

  mermaidPromise ??= import('mermaid').then((m) => m.default)
  const mermaid = await mermaidPromise
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    fontFamily: FONT,
    themeVariables: {
      ...(dark ? THEMES.dark : THEMES.light),
      fontFamily: FONT,
      fontSize: '14px',
      dropShadow: 'none', // 기본 그림자(글로우) 제거
    },
    flowchart: { curve: 'basis', padding: 12 },
    securityLevel: 'strict',
  })

  for (const node of nodes) {
    const src = decodeURIComponent(node.dataset.src ?? '')
    try {
      const { svg } = await mermaid.render(`mmd-${++seq}`, src)
      node.innerHTML = svg
    } catch (e) {
      node.innerHTML = `<pre class="md-mermaid-error">다이어그램 오류: ${String(e).replace(/</g, '&lt;')}</pre>`
    }
  }
}
