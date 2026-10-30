<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, Database, LoaderCircle, TerminalSquare } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import SqlRunner from '@/components/sql/SqlRunner.vue'
import SqlTables from '@/components/sql/SqlTables.vue'
import { SQL_DIFFERENCES, sqlEngine } from '@/lib/sqlEngine'
import { cn } from '@/lib/utils'

/**
 * SQL 실습장: 연습 테이블(EMP · DEPT · T1 · T2)에 아무 SQL 이나 실행해 본다.
 * 실행이 끝나면 데이터는 되돌려진다 (늘 같은 데이터로 연습)
 */
document.title = 'SQL 실습장 · Pass SQLD/SQLP'

const EXAMPLES = [
  { label: '부서별 급여 합계', sql: 'SELECT deptno, COUNT(*) AS cnt, SUM(sal) AS total\nFROM emp\nGROUP BY deptno\nORDER BY deptno' },
  { label: 'OUTER JOIN', sql: 'SELECT d.dname, e.ename\nFROM dept d\nLEFT OUTER JOIN emp e\n  ON e.deptno = d.deptno\nORDER BY d.deptno, e.ename' },
  { label: '순위 함수', sql: 'SELECT ename, sal,\n       RANK()       OVER (ORDER BY sal DESC) AS rnk,\n       DENSE_RANK() OVER (ORDER BY sal DESC) AS dense,\n       ROW_NUMBER() OVER (ORDER BY sal DESC) AS rn\nFROM emp' },
  { label: 'ROLLUP', sql: 'SELECT deptno, job, SUM(sal)\nFROM emp\nGROUP BY ROLLUP(deptno, job)\nORDER BY deptno, job' },
  { label: '계층 (WITH RECURSIVE)', sql: "WITH RECURSIVE org (empno, ename, mgr, lvl) AS (\n  SELECT empno, ename, mgr, 1 FROM emp WHERE mgr IS NULL\n  UNION ALL\n  SELECT e.empno, e.ename, e.mgr, o.lvl + 1\n  FROM emp e JOIN org o ON e.mgr = o.empno\n)\nSELECT lpad(' ', (lvl - 1) * 2) || ename AS tree, lvl\nFROM org" },
  { label: 'INSERT 후 확인', sql: "INSERT INTO dept VALUES (50, 'IT', 'SEOUL');\nSELECT * FROM dept;" },
]

const state = ref<'loading' | 'ready' | 'error'>('loading')
const error = ref('')
sqlEngine()
  .then(() => (state.value = 'ready'))
  .catch((e) => {
    state.value = 'error'
    error.value = e instanceof Error ? e.message : String(e)
  })

const sql = ref(EXAMPLES[0]!.sql)
const showDiff = ref(false)
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 sm:py-10">
    <h1 class="flex items-center gap-2 text-2xl font-bold"><TerminalSquare class="size-6 text-primary" /> SQL 실습장</h1>
    <p class="mt-1 text-sm text-muted-foreground break-keep">
      연습 테이블에 SQL 을 직접 실행해 보세요. 실행이 끝나면 데이터는 처음 상태로 돌아가요.
    </p>

    <div v-if="state === 'loading'" class="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
      <LoaderCircle class="size-5 animate-spin" /> SQL 엔진 준비 중… (처음 한 번 약 5MB)
    </div>
    <p v-else-if="state === 'error'" class="mt-8 text-center text-destructive">엔진을 불러오지 못했어요. {{ error }}</p>

    <template v-else>
      <!-- Oracle 과 다른 점 -->
      <div class="mt-4 rounded-xl border border-dashed p-3 text-sm">
        <button type="button" class="flex w-full items-center gap-2 text-left" :aria-expanded="showDiff" @click="showDiff = !showDiff">
          <Database class="size-4 shrink-0 text-primary" />
          <span class="min-w-0 flex-1">PostgreSQL 엔진이에요. <b>Oracle 과 다른 점</b></span>
          <ChevronDown :class="cn('size-4 shrink-0 transition-transform', showDiff && 'rotate-180')" />
        </button>
        <ul v-if="showDiff" class="mt-2 list-disc space-y-0.5 pl-6 text-muted-foreground">
          <li v-for="d in SQL_DIFFERENCES" :key="d">{{ d }}</li>
        </ul>
      </div>

      <section class="mt-5">
        <h2 class="text-sm font-semibold">테이블</h2>
        <SqlTables class="mt-2" />
      </section>

      <section class="mt-6">
        <div class="flex flex-wrap items-center gap-1.5">
          <h2 class="mr-1 text-sm font-semibold">SQL</h2>
          <Button v-for="e in EXAMPLES" :key="e.label" size="sm" variant="outline" class="h-7 rounded-full px-2.5 text-xs" @click="sql = e.sql">
            {{ e.label }}
          </Button>
        </div>
        <SqlRunner :initial="sql" autorun class="mt-3" />
      </section>
    </template>
  </div>
</template>
