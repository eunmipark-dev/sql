/**
 * 대본 문장을 소리 내기 좋은 조각으로 바꾼다.
 * 기기 TTS 는 '?', ',', '·', '→' 같은 기호를 글자로 읽어 버리기도 해서, 기호는 넘기지 않고
 * 마침표·물음표·쉼표 자리에서 잘라 조각마다 따로 읽게 한다 (조각 사이가 자연스러운 쉼이 된다).
 */
const CIRCLED = '①②③④⑤⑥⑦⑧⑨'

export function speechChunks(text: string): string[] {
  const t = text
    // 숫자 안의 기호는 말로 (문장 부호로 오해하지 않게)
    .replace(/(\d)\.(\d)/g, '$1 점 $2')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/(\d)\s*~\s*(\d)/g, '$1에서 $2')
    .replace(/[①-⑨]/g, (c) => String(CIRCLED.indexOf(c) + 1))
    // 화살표·가운뎃점·빗금·세로줄 → 쉼 (조각 경계)
    .replace(/→|->|←|↔|⇒/g, ',')
    .replace(/[·•|/]/g, ',')
    // 괄호·따옴표·마크다운 기호는 지운다
    .replace(/[()[\]{}"'`*_#「」『』<>~]/g, ' ')
  return t
    .split(/[.?!,;:…。、\n]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}
