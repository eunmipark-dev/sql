<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="py-24 text-center">
    <p class="text-5xl font-bold">404</p>
    <p class="mt-2 text-muted-foreground">페이지를 찾을 수 없습니다.</p>
    <Button class="mt-6" as-child><RouterLink to="/">홈으로</RouterLink></Button>
  </div>
</template>
