import type { Question } from '@/types'

const circled = ['①', '②', '③', '④', '⑤']

/**
 * AI 채팅에 붙여 넣을 문제 텍스트 (마크다운).
 * 표는 원래 마크다운 표 그대로라 AI 가 그대로 읽는다. 정답이 공개된 뒤면 정답·내 답·해설과 "왜 틀렸는지" 질문까지 붙인다
 */
export function questionToText(q: Question, opts: { selected?: number | null; revealed?: boolean } = {}) {
  const parts = ['다음은 SQL 자격시험(SQLD/SQLP) 객관식 문제예요. Oracle 기준이에요.', '', q.question.trim()]
  if (q.code) parts.push('', '```sql', q.code.trim(), '```')
  parts.push('', ...q.choices.map((c, i) => `${circled[i]} ${c}`))

  const { selected, revealed } = opts
  if (revealed) {
    parts.push('', `정답: ${circled[q.answer - 1]}`)
    if (selected) parts.push(`내 답: ${circled[selected - 1]}`)
    parts.push('', '해설:', q.explanation.trim())
    parts.push(
      '',
      selected && selected !== q.answer
        ? '내가 고른 답이 왜 틀렸는지, 정답이 왜 맞는지 쉽게 설명해 주세요.'
        : '각 보기가 왜 맞고 틀린지 쉽게 설명해 주세요.',
    )
  } else {
    parts.push('', '정답은 바로 말하지 말고, 풀이 방향부터 힌트로 알려 주세요.')
  }
  return parts.join('\n')
}

/** 클립보드 복사. 안 되는 환경(오래된 웹뷰)이면 textarea 로 한 번 더 시도 */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}
