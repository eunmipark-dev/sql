import type { Router } from 'vue-router'

/**
 * 렌더링된 마크다운 본문의 클릭 처리 (이벤트 위임)
 * - 코드 블록 복사 버튼
 * - 내부 링크(/theory/...)는 새로고침 없이 라우터로 이동
 */
export function handleProseClick(e: MouseEvent, router?: Router) {
  const target = e.target as HTMLElement

  const copyBtn = target.closest<HTMLButtonElement>('[data-copy]')
  if (copyBtn) {
    const code = copyBtn.closest('.md-code')?.querySelector('pre')?.textContent ?? ''
    navigator.clipboard?.writeText(code).then(() => {
      const label = copyBtn.querySelector('span')
      if (!label) return
      label.textContent = '복사됨'
      copyBtn.dataset.copied = 'true'
      setTimeout(() => {
        label.textContent = '복사'
        delete copyBtn.dataset.copied
      }, 1500)
    })
    return
  }

  const href = target.closest('a')?.getAttribute('href')
  if (!router || !href?.startsWith('/') || e.ctrlKey || e.metaKey || e.shiftKey) return
  e.preventDefault()
  router.push(href)
}
