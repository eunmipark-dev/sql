<script setup lang="ts">
import { cellText, type SqlResult } from '@/lib/sqlEngine'

/** SQL 실행 결과 표. NULL 은 흐리게, 숫자는 오른쪽 정렬 */
const props = defineProps<{ result: SqlResult }>()
const isNum = (v: unknown) => typeof v === 'number' || typeof v === 'bigint' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))
/** 값이 있는 칸이 모두 숫자인 열 (제목도 오른쪽 정렬) */
const numCol = (i: number) => props.result.rows.some((r) => r[i] !== null) && props.result.rows.every((r) => r[i] === null || isNum(r[i]))
</script>

<template>
  <div>
    <p v-if="!result.columns.length" class="text-sm text-muted-foreground">
      실행했어요{{ result.affected !== undefined ? ` · ${result.affected}행 변경` : '' }}
    </p>
    <template v-else>
      <div class="max-h-80 overflow-auto rounded-lg border">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-muted">
            <tr>
              <th
                v-for="(c, i) in result.columns"
                :key="i"
                :class="['px-3 py-1.5 font-mono text-xs font-semibold whitespace-nowrap uppercase', numCol(i) ? 'text-right' : 'text-left']"
              >{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in result.rows" :key="r" class="border-t">
              <td
                v-for="(v, i) in row"
                :key="i"
                :class="['px-3 py-1 font-mono text-xs whitespace-nowrap', v === null && 'text-muted-foreground/70 italic', numCol(i) && 'text-right tabular-nums']"
              >
                {{ cellText(v) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!result.rows.length" class="px-3 py-3 text-center text-xs text-muted-foreground">결과 없음 (0행)</p>
      </div>
      <p class="mt-1 text-xs text-muted-foreground tabular-nums">{{ result.rows.length }}행</p>
    </template>
  </div>
</template>
