<script setup lang="ts">
import { ref } from 'vue'
import { Bell, BellOff } from '@lucide/vue'
import { markReminderAsked, reminder, requestReminderPermission } from '@/lib/reminder'
import { cn } from '@/lib/utils'

/** 학습 알림 설정 (앱 전용): 켜기 + 시각. 켤 때 알림 권한을 묻는다 */
const denied = ref(false)

async function toggle() {
  if (reminder.value.on) {
    reminder.value = { ...reminder.value, on: false }
    return
  }
  denied.value = false
  const ok = await requestReminderPermission()
  markReminderAsked()
  if (ok) reminder.value = { ...reminder.value, on: true }
  else denied.value = true
}

function setTime(e: Event) {
  const time = (e.target as HTMLInputElement).value
  if (/^\d\d:\d\d$/.test(time)) reminder.value = { ...reminder.value, time }
}
</script>

<template>
  <section class="rounded-2xl border p-5">
    <div class="flex items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-highlight text-ink">
        <Bell v-if="reminder.on" class="size-5" />
        <BellOff v-else class="size-5" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="font-semibold">학습 알림</div>
        <div class="text-xs text-muted-foreground">그날 아직 공부하지 않았으면 정한 시각에 알려 드려요.</div>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="reminder.on"
        aria-label="학습 알림"
        :class="cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', reminder.on ? 'bg-primary' : 'bg-muted-foreground/30')"
        @click="toggle"
      >
        <span :class="cn('absolute top-0.5 left-0.5 size-6 rounded-full bg-background shadow transition-transform', reminder.on && 'translate-x-5')" />
      </button>
    </div>
    <label v-if="reminder.on" class="mt-4 flex items-center gap-3 text-sm">
      <span class="text-muted-foreground">알림 시각</span>
      <input type="time" :value="reminder.time" class="ml-auto h-9 rounded-md border bg-background px-2 tabular-nums" @change="setTime" />
    </label>
    <p v-if="denied" class="mt-3 text-xs text-destructive">알림 권한이 꺼져 있어요. 휴대폰 설정 → 앱 → Pass SQLD → 알림에서 켜 주세요.</p>
  </section>
</template>
