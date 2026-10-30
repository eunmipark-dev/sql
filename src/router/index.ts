import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
    { path: '/theory', name: 'theory-index', component: () => import('@/pages/TheoryIndexPage.vue') },
    { path: '/lectures', name: 'lectures', component: () => import('@/pages/LectureIndexPage.vue') },
    { path: '/theory/:slug/lecture', name: 'lecture', component: () => import('@/pages/LecturePage.vue') },
    { path: '/theory/:slug', name: 'theory', component: () => import('@/pages/TheoryPage.vue') },
    { path: '/exams', redirect: '/mock' },
    { path: '/exams/:id', name: 'exam', component: () => import('@/pages/ExamSolvePage.vue') },
    { path: '/mock', name: 'mock', component: () => import('@/pages/MockListPage.vue'), meta: { kind: 'ai' } },
    { path: '/sqlp', name: 'sqlp', component: () => import('@/pages/MockListPage.vue'), meta: { kind: 'sqlp' } },
    { path: '/sqlp/:id', name: 'sqlp-exam', component: () => import('@/pages/ExamSolvePage.vue') },
    { path: '/sqlp/topic/:slug', name: 'sqlp-topic', component: () => import('@/pages/TopicPracticePage.vue') },
    { path: '/mock/:id', name: 'mock-exam', component: () => import('@/pages/ExamSolvePage.vue') },
    { path: '/mock/topic/:slug', name: 'mock-topic', component: () => import('@/pages/TopicPracticePage.vue') },
    { path: '/exams/topic/:slug', name: 'exam-topic', component: () => import('@/pages/TopicPracticePage.vue') },
    { path: '/bookmarks', name: 'bookmarks', component: () => import('@/pages/BookmarksPage.vue') },
    { path: '/games', name: 'games', component: () => import('@/pages/GamesPage.vue') },
    { path: '/games/daily', name: 'game-daily', component: () => import('@/pages/DailyChallengePage.vue') },
    { path: '/games/ox', name: 'game-ox', component: () => import('@/pages/OxGamePage.vue') },
    { path: '/games/order', name: 'game-order', component: () => import('@/pages/OrderPuzzlePage.vue') },
    { path: '/games/sql', name: 'game-sql', component: () => import('@/pages/SqlQuizPage.vue') },
    { path: '/sql', name: 'sql', component: () => import('@/pages/SqlPlaygroundPage.vue') },
    { path: '/audit', name: 'audit', component: () => import('@/pages/AuditPage.vue') },
    { path: '/random', name: 'random', component: () => import('@/pages/RandomPage.vue') },
    { path: '/me', name: 'me', component: () => import('@/pages/MyPage.vue') },
    { path: '/ranking', name: 'ranking', component: () => import('@/pages/RankingPage.vue') },
    { path: '/review', name: 'review', component: () => import('@/pages/ReviewPage.vue') },
    { path: '/wrong-notes', name: 'wrong-notes', component: () => import('@/pages/WrongNotesPage.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
  ],
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    // 이론 문서는 비동기 렌더링이므로 앵커 스크롤은 TheoryPage 에서 처리
    if (to.hash) return to.name === 'theory' ? false : { el: to.hash, top: 72 }
    return { top: 0 }
  },
})

export default router
