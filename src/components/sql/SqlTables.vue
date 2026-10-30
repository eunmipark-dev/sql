<script setup lang="ts">
import { ref, watch } from 'vue'
import ResultTable from '@/components/sql/ResultTable.vue'
import { runSql, SQL_TABLES, type SqlResult } from '@/lib/sqlEngine'
import { cn } from '@/lib/utils'

/** 연습 테이블 내용 보기 (탭으로 하나씩) */
const active = ref(SQL_TABLES[0]!.name)
const data = ref<Record<string, SqlResult>>({})
const error = ref('')

watch(
  active,
  async (name) => {
    if (data.value[name]) return
    try {
      const [r] = await runSql(`SELECT * FROM ${name}`)
      data.value = { ...data.value, [name]: r! }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="연습 테이블">
      <button
        v-for="t in SQL_TABLES"
        :key="t.name"
        type="button"
        role="tab"
        :aria-selected="active === t.name"
        :class="
          cn(
            'rounded-full border px-3 py-1 font-mono text-xs uppercase transition-colors',
            active === t.name ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )
        "
        @click="active = t.name"
      >
        {{ t.name }} <span class="font-sans normal-case opacity-70">{{ t.label }}</span>
      </button>
    </div>
    <p v-if="error" class="mt-2 text-sm text-destructive">{{ error }}</p>
    <ResultTable v-else-if="data[active]" :result="data[active]!" class="mt-2" />
    <div v-else class="mt-2 h-40 animate-pulse rounded-lg bg-muted" />
  </div>
</template>
