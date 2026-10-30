<script setup lang="ts">
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Volume2, VolumeX } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { LecturePlayer } from '@/composables/useLecturePlayer'

/** 재생 컨트롤: 속도 · 이전 · 재생/정지 · 다음 · 음성 켜기 (엄지로 누르기 쉽게 크게) */
defineProps<{ player: LecturePlayer }>()

const RATES = [0.8, 1, 1.25, 1.5]
</script>

<template>
  <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
    <select
      v-model.number="player.rate.value"
      class="h-10 w-16 justify-self-start rounded-full border bg-background px-2 text-center text-sm"
      aria-label="읽기 속도"
    >
      <option v-for="r in RATES" :key="r" :value="r">{{ r }}x</option>
    </select>

    <div class="flex items-center gap-3">
      <Button variant="outline" size="icon" class="size-12 rounded-full" aria-label="이전 (←)" title="이전 (←)" @click="player.prev()">
        <ChevronLeft class="size-6" />
      </Button>
      <Button
        size="icon"
        class="size-16 rounded-full shadow-lg shadow-primary/30"
        :aria-label="player.playing.value ? '일시정지 (Space)' : '재생 (Space)'"
        @click="player.toggle()"
      >
        <RotateCcw v-if="player.finished.value" class="size-7" />
        <Pause v-else-if="player.playing.value" class="size-7" />
        <Play v-else class="size-7 translate-x-0.5" />
      </Button>
      <Button variant="outline" size="icon" class="size-12 rounded-full" aria-label="다음 (→)" title="다음 (→)" @click="player.next()">
        <ChevronRight class="size-6" />
      </Button>
    </div>

    <Button
      variant="ghost"
      size="icon"
      class="size-10 justify-self-end rounded-full"
      :disabled="!player.voiceAvailable"
      :aria-label="player.voice.value ? '음성 끄기 (자막만)' : '음성 켜기'"
      :title="player.voiceAvailable ? (player.voice.value ? '음성 끄기 (자막만)' : '음성 켜기') : '이 브라우저는 음성 읽기를 지원하지 않아요'"
      @click="player.voice.value = !player.voice.value"
    >
      <Volume2 v-if="player.voice.value" class="size-5" />
      <VolumeX v-else class="size-5" />
    </Button>
  </div>
</template>
