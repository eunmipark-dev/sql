import type { LectureStep, LectureTable, TableOp } from '@/types'

/**
 * 강의 data 장면: 표에 단계별 변화(TableOp)를 처음부터 지금 단계까지 쌓아서, 지금 화면에 그릴 모습을 만든다.
 * filter·sort·group·add·set·result 는 쌓이고, rows·cells·cols·notes·tint 는 지금 단계에만 적용한다
 */

export interface ViewCell {
  text: string
  hot: boolean
  /** 이 단계에서 값이 바뀜 (번쩍) */
  changed: boolean
  /** 이 단계에서 새 컬럼으로 채워짐 */
  fresh: boolean
  note?: string
}
export interface ViewRow {
  /** 원래 행 번호 (애니메이션 key) */
  id: number
  cells: ViewCell[]
  hot: boolean
  /** 이 단계에서 걸러짐 (줄 긋기, 다음 단계에 사라진다) */
  rejected: boolean
  /** 색 묶음 번호 (group 또는 tint) */
  tint?: number
  /** group 일 때 묶음 첫 행에만 값 */
  groupLabel?: string
}
export interface ViewColumn {
  name: string
  hot: boolean
  fresh: boolean
}
export interface TableView {
  columns: ViewColumn[]
  rows: ViewRow[]
  grouped: boolean
  /** 결과표. newRows: 앞 단계 결과표에 없던 행 (이번에 조립된 행만 움직이고 빛난다) */
  result?: { title?: string; columns: string[]; rows: string[][]; fresh: boolean; newRows: boolean[] }
}

export const isNull = (v: string | undefined) => v === undefined || v === 'NULL' || v === ''

/** 값 비교: 숫자는 숫자로, NULL 은 가장 큰 값처럼 (Oracle: 오름차순 맨 뒤, 내림차순 맨 앞) */
export function compareValues(a: string, b: string) {
  const an = isNull(a)
  const bn = isNull(b)
  if (an || bn) return an === bn ? 0 : an ? 1 : -1
  const x = Number(a.replace(/,/g, ''))
  const y = Number(b.replace(/,/g, ''))
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y
  return a < b ? -1 : a > b ? 1 : 0
}

export function tableView(table: LectureTable, steps: LectureStep[], name: string, stepIndex: number): TableView {
  let filter: number[] | null = null
  let filterBefore: number[] | null = null
  let sort: [string, 'asc' | 'desc'][] | null = null
  let group: string | null = null
  type Result = NonNullable<TableOp['result']> & { at: number }
  let result: Result | null = null
  let resultBefore: Result | null = null
  const added: { name: string; values: string[]; at: number }[] = []
  const sets = new Map<string, { value: string; at: number }>()

  for (let i = 0; i <= stepIndex && i < steps.length; i++) {
    if (i === stepIndex) {
      filterBefore = filter
      resultBefore = result
    }
    const op = steps[i]!.t?.[name]
    if (!op) continue
    if ('filter' in op) filter = op.filter ?? null
    if ('sort' in op) sort = op.sort ?? null
    if ('group' in op) group = op.group ?? null
    if (op.add) {
      const at = added.findIndex((a) => a.name === op.add![0])
      if (at >= 0) added.splice(at, 1)
      added.push({ name: op.add[0], values: op.add[1], at: i })
    }
    for (const [r, c, v] of op.set ?? []) sets.set(`${r}|${c}`, { value: v, at: i })
    if ('result' in op) result = op.result ? { ...op.result, at: i } : null
  }
  const now: TableOp = steps[stepIndex]?.t?.[name] ?? {}

  const base = table.columns.length
  const columns: ViewColumn[] = [
    ...table.columns.map((c) => ({ name: c, hot: !!now.cols?.includes(c), fresh: false })),
    ...added.map((a) => ({ name: a.name, hot: !!now.cols?.includes(a.name), fresh: a.at === stepIndex })),
  ]
  const colIndex = (c: string) => columns.findIndex((x) => x.name === c)
  const value = (r: number, c: string) => {
    const set = sets.get(`${r}|${c}`)
    if (set) return set.value
    const i = colIndex(c)
    return i < base ? (table.rows[r]![i] ?? '') : (added[i - base]!.values[r] ?? '')
  }

  // 앞 단계까지 걸러진 행은 숨기되, 이 단계에서 거르기를 풀어 다시 남게 된 행은 바로 나타난다
  let ids = table.rows.map((_, i) => i).filter((r) => !filterBefore || filterBefore.includes(r) || !filter || filter.includes(r))
  const byKeys = (a: number, b: number) => {
    for (const [c, dir] of sort ?? []) {
      const d = compareValues(value(a, c), value(b, c))
      if (d) return dir === 'desc' ? -d : d
    }
    return 0
  }
  ids = [...ids].sort((a, b) => (group ? compareValues(value(a, group), value(b, group)) : 0) || byKeys(a, b))

  const groupOrder = group ? [...new Set(ids.map((r) => value(r, group!)))] : []
  const tintOf = (r: number) => {
    if (group) return groupOrder.indexOf(value(r, group))
    const t = now.tint?.findIndex((g) => g.includes(r)) ?? -1
    return t >= 0 ? t : undefined
  }

  const rows: ViewRow[] = ids.map((r, pos) => ({
    id: r,
    hot: !!now.rows?.includes(r),
    rejected: !!filter && !filter.includes(r),
    tint: tintOf(r),
    groupLabel: group && (pos === 0 || value(ids[pos - 1]!, group) !== value(r, group)) ? value(r, group) : undefined,
    cells: columns.map((c) => ({
      text: value(r, c.name),
      hot: !!now.cells?.some(([cr, cc]) => cr === r && cc === c.name),
      changed: sets.get(`${r}|${c.name}`)?.at === stepIndex,
      fresh: c.fresh,
      note: now.notes?.find(([nr, nc]) => nr === r && nc === c.name)?.[2],
    })),
  }))

  return {
    columns,
    rows,
    grouped: !!group,
    result: result
      ? {
          title: result.title,
          columns: result.columns,
          rows: result.rows,
          fresh: result.at === stepIndex,
          // 컬럼이 같으면 이어서 조립하는 것: 앞 결과표에 없던 행만 새 행
          newRows: result.rows.map((row) =>
            result!.at !== stepIndex
              ? false
              : !resultBefore || resultBefore.columns.join('|') !== result!.columns.join('|') || !resultBefore.rows.some((p) => p.join('|') === row.join('|')),
          ),
        }
      : undefined,
  }
}
