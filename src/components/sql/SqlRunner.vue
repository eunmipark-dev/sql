<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoaderCircle, Play, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import ResultTable from '@/components/sql/ResultTable.vue'
import { runSql, type SqlResult } from '@/lib/sqlEngine'

/**
 * SQL 을 고쳐서 실행해 보는 칸. Ctrl(⌘)+Enter 로도 실행.
 * 실행이 끝나면 데이터는 되돌려지므로 INSERT 후 SELECT 는 한 번에 함께 실행한다
 */
const props = defineProps<{ initial: string; autorun?: boolean }>()
const sql = ref(props.initial)
const results = ref<SqlResult[]>([])
const error = ref('')
const running = ref(false)

watch(
  () => props.initial,
  (v) => {
    sql.value = v
    results.value = []
    error.value = ''
    if (props.autorun) void run()
  },
  { immediate: true },
)

async function run() {
  if (running.value || !sql.value.trim()) return
  running.value = true
  error.value = ''
  try {
    results.value = (await runSql(sql.value)).filter((r) => r.columns.length || r.affected !== undefined)
  } catch (e) {
    results.value = []
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    running.value = false
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void run()
  }
}
</script>

<template>
  <div>
    <textarea
      v-model="sql"
      spellcheck="false"
      wrap="off"
      autocapitalize="off"
      autocomplete="off"
      :rows="Math.min(14, Math.max(4, sql.split('\n').length + 1))"
      class="w-full resize-y rounded-lg border bg-muted/40 p-3 font-mono text-sm leading-relaxed focus:border-primary focus:outline-none"
      aria-label="SQL"
      @keydown="onKey"
    />
    <div class="mt-2 flex items-center gap-2">
      <Button size="sm" :disabled="running" @click="run">
        <LoaderCircle v-if="running" class="size-4 animate-spin" />
        <Play v-else class="size-4" />
        실행
      </Button>
      <Button v-if="sql !== initial" size="sm" variant="ghost" @click="sql = initial"><RotateCcw class="size-4" /> 처음 SQL</Button>
      <span class="ml-auto hidden text-xs text-muted-foreground sm:inline">Ctrl + Enter</span>
    </div>
    <p v-if="error" class="mt-3 rounded-lg bg-destructive/10 p-3 font-mono text-xs break-all text-destructive" role="alert">{{ error }}</p>
    <ResultTable v-for="(r, i) in results" :key="i" :result="r" class="mt-3" />
  </div>
</template>
