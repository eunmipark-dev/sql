import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AUTH_REDIRECT, isNative, onAuthCallback, openAuthPage } from '@/lib/native'
import { localProgress, remoteProgress } from '@/services/progressRepository'
import { localWrongNotes, remoteWrongNotes } from '@/services/wrongNoteRepository'
import { localBookmarks, remoteBookmarks } from '@/services/bookmarkRepository'
import { localExamDrafts, remoteExamDrafts } from '@/services/examDraftRepository'
import { localTheory, remoteTheory } from '@/services/theoryRepository'
import { localQuestionNotes, remoteQuestionNotes } from '@/services/questionNoteRepository'
import { localStudyDays, remoteStudyDays } from '@/services/studyDayRepository'
import { syncGameHistory } from '@/lib/gameHistory'
import { useActivityStore } from '@/stores/activity'
import { useQuestionNotesStore } from '@/stores/questionNotes'
import { useTheoryStore } from '@/stores/theory'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useProgressStore } from '@/stores/progress'
import { useWrongNotesStore } from '@/stores/wrongNotes'

export interface AuthUser {
  id: string
  name: string
  email: string
  avatarUrl?: string
  /** 가입 시각 */
  createdAt?: string
}

const toAuthUser = (u: User): AuthUser => ({
  id: u.id,
  name: (u.user_metadata.full_name ?? u.user_metadata.name ?? u.email ?? '사용자') as string,
  email: u.email ?? '',
  avatarUrl: (u.user_metadata.avatar_url ?? u.user_metadata.picture) as string | undefined,
  createdAt: u.created_at,
})

/** updatedAt 이 더 최신인 쪽을 남기며 합친다 */
function newer<T extends { key: string; updatedAt: string }>(local: T[], remote: T[]) {
  const remoteMap = new Map(remote.map((r) => [r.key, r]))
  return local.filter((l) => {
    const r = remoteMap.get(l.key)
    return !r || l.updatedAt > r.updatedAt
  })
}

/**
 * 인증 (Supabase + Google OAuth)
 * - 비로그인: 학습 기록을 브라우저(localStorage)에 저장
 * - 로그인: 브라우저에 쌓인 기록을 서버로 옮기고, 이후로는 서버에 저장
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const ready = ref(!supabase) // 세션 확인이 끝났는지
  const syncing = ref(false)
  const error = ref('')
  const isLoggedIn = computed(() => !!user.value)
  const isAvailable = !!supabase

  /** 풀던 회차(이어 풀기)도 서버로 옮긴다. 실패해도 학습 기록 동기화는 막지 않는다 */
  async function migrateDrafts() {
    try {
      const [local, remote] = await Promise.all([localExamDrafts.list(), remoteExamDrafts.list()])
      await remoteExamDrafts.saveMany(newer(local, remote))
      await localExamDrafts.clear()
    } catch (e) {
      console.error('[이어 풀기 동기화 실패]', e)
    }
  }

  /** 이론 학습 기록도 서버로 옮긴다. 실패해도 다른 기록 동기화는 막지 않는다 */
  async function migrateTheory() {
    try {
      const [local, remote] = await Promise.all([localTheory.list(), remoteTheory.list()])
      await remoteTheory.saveMany(newer(local, remote))
      await localTheory.clear()
      await useTheoryStore().reload(true)
    } catch (e) {
      console.error('[이론 학습 기록 동기화 실패]', e)
    }
  }

  /** 문제별 메모도 서버로 옮긴다. 실패해도 다른 기록 동기화는 막지 않는다 */
  /** 비로그인 때 쌓은 하루 학습량을 계정 기록에 더한다 (연속 학습일이 끊기지 않게) */
  async function migrateStudyDays() {
    try {
      const [local, remote] = await Promise.all([localStudyDays.list(), remoteStudyDays.list()])
      const byDay = new Map(remote.map((d) => [d.day, d]))
      for (const l of local) {
        const r = byDay.get(l.day)
        await remoteStudyDays.save(
          r
            ? {
                ...r,
                questions: r.questions + l.questions,
                correct: r.correct + l.correct,
                lectureParts: r.lectureParts + l.lectureParts,
                lectureMs: r.lectureMs + l.lectureMs,
                updatedAt: new Date().toISOString(),
              }
            : l,
        )
      }
      await localStudyDays.clear()
    } catch (e) {
      // study_days 테이블이 아직 없으면 브라우저 기록을 그대로 둔다
      console.error('[학습 기록 동기화 실패]', e)
    }
    await useActivityStore().reload(true)
  }

  async function migrateQuestionNotes() {
    try {
      const [local, remote] = await Promise.all([localQuestionNotes.list(), remoteQuestionNotes.list()])
      await remoteQuestionNotes.saveMany(newer(local, remote))
      await localQuestionNotes.clear()
      await useQuestionNotesStore().reload(true)
    } catch (e) {
      console.error('[메모 동기화 실패]', e)
    }
  }

  /** 로그인 직후: 브라우저 기록을 서버로 합치고, 서버 기준으로 다시 불러온다 */
  async function migrateAndLoad() {
    syncing.value = true
    try {
      const [lp, ln, lb, rp, rn, rb] = await Promise.all([
        localProgress.list(),
        localWrongNotes.list(),
        localBookmarks.list(),
        remoteProgress.list(),
        remoteWrongNotes.list(),
        remoteBookmarks.list(),
      ])
      await remoteProgress.saveMany(newer(lp, rp))
      await remoteWrongNotes.saveMany(newer(ln, rn))
      await remoteBookmarks.saveMany(newer(lb, rb))
      // 옮긴 뒤 브라우저 기록은 비운다 (로그아웃 후 다른 사람이 써도 섞이지 않게)
      await Promise.all([localProgress.clear(), localWrongNotes.clear(), localBookmarks.clear()])
      await Promise.all([
        useProgressStore().reload(true),
        useWrongNotesStore().reload(true),
        useBookmarksStore().reload(true),
      ])
      await Promise.all([migrateDrafts(), migrateTheory(), migrateQuestionNotes(), migrateStudyDays(), syncGameHistory(true)])
    } catch (e) {
      console.error('[로그인 동기화 실패]', e)
      error.value = '학습 기록을 서버와 동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    } finally {
      syncing.value = false
    }
  }

  async function applyUser(next: User | null) {
    const prevId = user.value?.id
    user.value = next ? toAuthUser(next) : null
    if (next && next.id !== prevId) await migrateAndLoad()
    if (!next && prevId) {
      await Promise.all([
        useProgressStore().reload(false),
        useWrongNotesStore().reload(false),
        useBookmarksStore().reload(false),
        useTheoryStore().reload(false),
        useQuestionNotesStore().reload(false),
        useActivityStore().reload(false),
        syncGameHistory(false),
      ])
    }
    ready.value = true
  }

  async function init() {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    await applyUser(data.session?.user ?? null)
    supabase.auth.onAuthStateChange((_event, session) => {
      // 콜백 안에서 바로 Supabase 를 호출하면 잠금이 걸릴 수 있어 다음 틱으로 미룬다
      setTimeout(() => applyUser(session?.user ?? null), 0)
    })
    // 앱: 브라우저에서 로그인하고 딥링크로 돌아오면 code 를 세션으로 바꾼다 (이후 onAuthStateChange 가 처리)
    onAuthCallback(async (code) => {
      const { error: e } = await supabase!.auth.exchangeCodeForSession(code)
      if (e) error.value = e.message
    })
  }

  async function signInWithGoogle() {
    if (!supabase) return
    error.value = ''
    if (isNative) {
      // 앱 안 WebView 에서는 Google 로그인이 막혀 있어 외부 브라우저로 연다
      const { data, error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
      })
      if (e) error.value = e.message
      else if (data.url) await openAuthPage(data.url)
      return
    }
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    })
    if (e) error.value = e.message
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  return { user, ready, syncing, error, isLoggedIn, isAvailable, init, signInWithGoogle, signOut }
})
