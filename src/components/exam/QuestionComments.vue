<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Flag, Loader2, LogIn, Pencil, TriangleAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { fullDate, relativeTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import {
  addComment,
  commentKey,
  deleteComment,
  editComment,
  loadComments,
  reportComment,
  type QuestionComment,
} from '@/services/commentRepository'
import { useAuthStore } from '@/stores/auth'

/**
 * 문제별 공유 코멘트. 로그인 사용자만 읽고 쓴다 (작성자는 닉네임으로).
 * 정답이 드러날 수 있어 문제를 푼 뒤에만 이 컴포넌트를 보여준다 (QuestionExtras)
 */
const props = defineProps<{ examId: string; questionId: number }>()
const emit = defineEmits<{ count: [n: number] }>()

const auth = useAuthStore()
const key = computed(() => commentKey(props.examId, props.questionId))

const comments = ref<QuestionComment[]>([])
const loading = ref(false)
const error = ref('')
const newest = ref(false)

async function load() {
  if (!auth.user) return
  loading.value = true
  error.value = ''
  try {
    comments.value = await loadComments(key.value)
    emit('count', comments.value.filter((c) => !c.deleted && !c.hidden).length)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch([key, () => auth.user?.id], load)

const sorted = computed(() => (newest.value ? [...comments.value].reverse() : comments.value))

// ── 쓰기 ──
const body = ref('')
const errorReport = ref(false)
const posting = ref(false)
const formError = ref('')

async function submit() {
  if (!body.value.trim()) return
  posting.value = true
  formError.value = ''
  try {
    await addComment(key.value, body.value, errorReport.value)
    body.value = ''
    errorReport.value = false
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  } finally {
    posting.value = false
  }
}

// ── 내 글 수정·삭제 ──
const editingId = ref<number>()
const editBody = ref('')
function startEdit(c: QuestionComment) {
  editingId.value = c.id
  editBody.value = c.body
}
async function saveEdit() {
  if (!editingId.value) return
  try {
    await editComment(editingId.value, editBody.value)
    editingId.value = undefined
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  }
}

// 삭제·신고는 브라우저 확인창 대신 버튼 자리에서 한 번 더 묻는다
const confirming = ref<{ id: number; action: 'delete' | 'report' }>()
async function confirmAction() {
  const c = confirming.value
  if (!c) return
  confirming.value = undefined
  try {
    if (c.action === 'delete') await deleteComment(c.id)
    else await reportComment(c.id)
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div>
    <!-- 비로그인 -->
    <div v-if="!auth.user" class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      로그인하면 다른 사람들의 코멘트를 보고 쓸 수 있어요.
      <Button variant="link" size="sm" class="h-auto p-0 pl-1" :disabled="!auth.isAvailable" @click="auth.signInWithGoogle">
        <LogIn class="size-3.5" /> 로그인
      </Button>
    </div>

    <template v-else>
      <div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{{ comments.length ? `코멘트 ${comments.filter((c) => !c.deleted && !c.hidden).length}개` : '' }}</span>
        <button v-if="comments.length > 1" type="button" class="ml-auto hover:text-foreground" @click="newest = !newest">
          {{ newest ? '최신순' : '오래된순' }} ↕
        </button>
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <div v-else-if="loading && !comments.length" class="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 class="size-4 animate-spin" /> 불러오는 중…
      </div>
      <p v-else-if="!comments.length" class="py-2 text-sm text-muted-foreground">첫 코멘트를 남겨 보세요. 헷갈렸던 점, 외우는 요령 모두 좋아요.</p>

      <ul class="space-y-2">
        <li
          v-for="c in sorted"
          :key="c.id"
          :class="cn('rounded-lg border bg-background p-3 text-sm', c.isMine && 'border-primary/40', c.isErrorReport && !c.deleted && !c.hidden && 'border-amber-400/60')"
        >
          <p v-if="c.deleted" class="text-muted-foreground italic">삭제된 코멘트예요.</p>
          <p v-else-if="c.hidden" class="text-muted-foreground italic">신고가 쌓여 숨겨진 코멘트예요.</p>
          <template v-else>
            <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span class="font-semibold text-foreground">{{ c.nickname }}</span>
              <span v-if="c.isMine" class="text-primary">(나)</span>
              <span
                v-if="c.isErrorReport"
                class="inline-flex items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400"
              >
                <TriangleAlert class="size-3" /> 오류 제보
              </span>
              <span class="text-muted-foreground" :title="fullDate(c.createdAt)">
                {{ relativeTime(c.createdAt) }}<template v-if="c.edited"> (수정됨)</template>
              </span>

              <!-- 내 글: 수정·삭제 / 남의 글: 신고 -->
              <span class="ml-auto flex items-center gap-2 text-muted-foreground">
                <template v-if="confirming?.id === c.id">
                  <span class="text-foreground">{{ confirming.action === 'delete' ? '지울까요?' : '신고할까요?' }}</span>
                  <button type="button" class="font-semibold text-destructive" @click="confirmAction">예</button>
                  <button type="button" @click="confirming = undefined">아니오</button>
                </template>
                <template v-else-if="c.isMine">
                  <button type="button" class="hover:text-foreground" @click="startEdit(c)"><Pencil class="inline size-3" /> 수정</button>
                  <button type="button" class="hover:text-destructive" @click="confirming = { id: c.id, action: 'delete' }">삭제</button>
                </template>
                <button
                  v-else
                  type="button"
                  :disabled="c.reportedByMe"
                  :class="cn('hover:text-destructive', c.reportedByMe && 'opacity-50')"
                  @click="confirming = { id: c.id, action: 'report' }"
                >
                  <Flag class="inline size-3" /> {{ c.reportedByMe ? '신고함' : '신고' }}
                </button>
              </span>
            </div>

            <form v-if="editingId === c.id" @submit.prevent="saveEdit">
              <Textarea v-model="editBody" maxlength="500" class="min-h-16 text-sm" />
              <div class="mt-1.5 flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" @click="editingId = undefined">취소</Button>
                <Button type="submit" size="sm" :disabled="!editBody.trim()">저장</Button>
              </div>
            </form>
            <!-- 본문은 글자 그대로 (마크다운·HTML 해석 안 함) -->
            <p v-else class="leading-6 break-words whitespace-pre-wrap">{{ c.body }}</p>
          </template>
        </li>
      </ul>

      <!-- 쓰기 -->
      <form class="mt-3" @submit.prevent="submit">
        <Textarea v-model="body" maxlength="500" placeholder="다른 사람과 나눌 코멘트 (500자)" class="min-h-16 bg-background text-sm" />
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input v-model="errorReport" type="checkbox" class="size-3.5 accent-[var(--primary)]" />
            <TriangleAlert class="size-3.5 text-amber-500" /> 문제 오류 제보
          </label>
          <span class="ml-auto text-xs text-muted-foreground tabular-nums">{{ body.length }}/500</span>
          <Button type="submit" size="sm" :disabled="posting || !body.trim()">
            <Loader2 v-if="posting" class="size-3.5 animate-spin" /> 등록
          </Button>
        </div>
        <p v-if="formError" class="mt-1 text-xs text-destructive">{{ formError }}</p>
        <p v-else class="mt-1 text-xs text-muted-foreground">닉네임으로 표시돼요. 30초에 한 번, 하루 50개까지 쓸 수 있어요.</p>
      </form>
    </template>
  </div>
</template>
