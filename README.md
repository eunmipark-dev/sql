# Pass SQLD/SQLP

SQLD · SQLP 자격증 학습 앱 (Pass 시리즈). 이론 · 기출문제 · 오답노트로 구성.

## 스택

- Vite + Vue 3 + TypeScript + Vue Router + Pinia
- Tailwind CSS v4 + shadcn-vue (reka-ui), 아이콘 `@lucide/vue`
- 이론 문서: markdown-it + Shiki(SQL 하이라이팅) + MiniSearch(한글 2-gram 검색)
- (예정) Supabase Auth(Google) + Postgres

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 타입 체크 + 빌드
```

## 콘텐츠 추가

**이론 문서** — `src/content/theory/<과목>-<장>-<순서>-<slug>.md` (예: `2-2-04-window-functions.md`)

```md
---
title: 윈도우 함수
subject: 2과목 · SQL 기본과 활용
chapter: 2-2. SQL 활용
summary: 목록 카드에 보이는 한 줄 요약
---

# 윈도우 함수

## 섹션 (검색 단위 · 목차에 표시)

> 시험 포인트: 이렇게 시작하는 인용구는 강조 박스로 표시됩니다.
```

- 파일명 앞 숫자는 정렬용이며 URL에서는 빠집니다 (`/theory/window-functions`).
- 사이드바와 `/theory` 목차는 `subject` → `chapter` → 문서 순서로 자동 구성됩니다.
- `##` 섹션 단위로 검색 색인되고, 검색 결과에서 해당 섹션으로 바로 이동합니다.
- 다른 문서 링크는 `[표준 조인](/theory/standard-join)` 형태로 씁니다.
- `## 핵심 요약` 섹션은 자동으로 요약 카드가 됩니다.

### 꾸밈 블록 (예시: `1-1-01-data-model.md`)

| 문법 | 모양 |
|---|---|
| `> 시험 포인트: ...` 또는 `::: tip [제목]` | 노란 시험 포인트 박스 |
| `::: info [제목]` / `::: warning [제목]` / `::: example [제목]` | 파랑 참고 / 빨강 주의 / 초록 예시 박스 |
| `::: cards [열 수]` + 목록 | 카드 그리드. 항목 첫 `**굵은 글씨**`가 카드 제목 |
| `::: compare` + 목록 2개 | VS 비교 카드 |
| `::: steps` + 번호 목록 | 단계 스테퍼 |
| `::: flow` + 목록 | 화살표로 이어진 흐름 (모바일은 세로) |
| ` ```mermaid ` | 다이어그램 (flowchart, erDiagram 등, 다크모드 자동 대응) |
| `<figure class="md-figure"><svg>…</svg><figcaption>…</figcaption></figure>` | 직접 그린 그림. 색은 `var(--primary)` 등 테마 변수 사용 |

블록은 모두 `:::` 로 닫습니다.

### 약어 자동 풀이

`src/lib/glossary.ts`에 등록된 약어(ERD, DBMS, PK, DDL, ACID, BCNF …)는 페이지에서 **처음 나올 때** 옆에 원어와 뜻이 작은 라벨로 자동 표시됩니다. 새 약어는 이 파일에 한 줄 추가하면 모든 문서에 적용됩니다. 제목·코드·링크 안은 제외되고, 본문에 이미 `ERD(Entity Relationship Diagram)`처럼 풀어 쓴 경우는 그대로 둡니다.

작성 시 주의:
- `<figure>` 안에는 빈 줄을 넣지 않습니다 (빈 줄에서 HTML 블록이 끝나 그림이 깨짐).
- SVG에서 `clipPath`/`mask` 대신 `<path>`로 직접 그립니다 (페이지 이동 시 가끔 안 그려짐).
- 괄호·따옴표로 끝나는 굵은 글씨 바로 뒤에 글자가 붙으면 `**집합(타입)**과`처럼 닫히지 않으므로 `<strong>집합(타입)</strong>과`로 씁니다.

**시험 (기출문제 / AI 모의고사)** — `public/data/exams/<id>.json`

- JS 번들에 넣지 않고 정적 JSON으로 두며, 회차를 열 때만 내려받습니다.
- `npm run dev` / `npm run build` 전에 `scripts/build-exam-index.mjs`가 자동 실행되어 형식을 검사하고 목록 `index.json`(회차 정보 + `?v=해시`)을 만듭니다. 형식이 틀리면 실행이 멈춥니다. 수동 실행: `npm run exams`
- `kind`: `"past"`(기출문제 메뉴) / `"ai"`(AI 모의고사 = SQLD, `/mock`) / `"sqlp"`(SQLP 모의고사, `/sqlp`). 기출은 권리를 확보한 복원 문제만 넣습니다.
- `subject`: 1·2 (SQLD), 3은 SQLP 전용(SQL 고급활용 및 튜닝, 이론 `3-*.md`).
- **SQLP**: 객관식 70문항(1과목 10 / 2과목 20 / 3과목 40, 문항당 1점) + `practicals` 실기 2문항(15점씩). 실기는 `{ id, title, question, code?, answer(모범 답안), explanation, rubric: [{ point, score }] }`이고 rubric 합은 15여야 합니다. 제출 후 채점 포인트를 체크해 자가 채점하며, 총점 75점 이상·과목별 40% 이상이면 합격(`lib/exams.ts`의 `PASS_RULE`, `judge`).

```json
{
  "id": "ai-01", "kind": "ai", "title": "AI 모의고사 1회", "round": 1, "timeLimitMin": 90,
  "questions": [
    { "id": 1, "subject": 1, "theory": "data-model",
      "question": "문제 (마크다운, 표 가능)", "code": "SQL (선택)",
      "choices": ["①", "②", "③", "④"], "answer": 2, "explanation": "해설 (마크다운)" }
  ]
}
```

- `answer`는 1부터, `theory`는 이론 문서 slug (해설 아래 "관련 이론" 링크), `timeLimitMin`이 있으면 타이머가 돌고 0이 되면 자동 제출됩니다.
- **분류별(이론 절별) 보기**: 빌드 스크립트가 모든 회차에서 `theory`가 같은 문항을 모아 `bank/<kind>/<slug>.json`을 자동 생성합니다. 화면은 `/mock?view=topic` → `/mock/topic/<slug>`, 이론 문서 하단에도 "이 절 문제 풀기"가 붙습니다.
- 채점은 SQLD 기준(총점 60점 이상, 과목별 40% 미만 과락)입니다.

## 구조

```
src/
  content/theory/     이론 마크다운
  data/exams/         문제 JSON
  lib/                content(로더) · markdown · search
  services/           wrongNoteRepository (localStorage → 추후 Supabase로 교체)
  stores/             wrongNotes, auth(로그인 자리)
  components/         layout · theory · exam · ui(shadcn-vue)
  pages/              Home · Theory · ExamList · ExamSolve · WrongNotes
```

## SQLD / SQLP 선택

헤더에서 공부할 자격증을 고른다 (`stores/cert.ts`, 마지막 선택은 localStorage `sql-cert:cert`에 기억).

- **SQLD**: 이론 1~2과목, 기출문제, AI 모의고사(`/mock`)
- **SQLP**: 이론 1~3과목, SQLP 모의고사(`/sqlp`)
- 이론 목차·사이드바·진행률·검색·홈 화면이 선택한 범위만 보여준다. 다른 자격증 주소(예: `/sqlp`, 3과목 문서)로 들어오면 선택도 따라 바뀐다.
- 오답노트·북마크(목록과 헤더·홈의 개수)도 선택한 자격증의 회차만 보여준다 (`certStore.ownsExam`, 기출은 SQLD). 진행률 집계는 회차별이라 전체 기록을 그대로 쓴다.

## 학습 기록 (진행률 · 오답률)

- **이론**: 문서를 열면 마지막으로 본 날짜를, 문서 끝 '학습 완료' 버튼으로 완료 날짜를 기록합니다 (`stores/theory.ts`). 이론 목차·사이드바에 과목·장(n-n)별 완료 진행률이 표시됩니다.

- 문제를 푸는 모든 화면(회차 제출, 분류별 연습, 오답노트 다시 풀기)은 `stores/progress.ts`의 `answer()`로 기록하고, 오답노트도 함께 갱신합니다.
- **진행률** = 푼 문항 ÷ 전체, **오답률** = 해결하지 않은 오답 ÷ 푼 문항 (오답노트에서 '해결' 표시 시 제외).
- 저장소는 `services/progressRepository.ts`, `services/wrongNoteRepository.ts` (지금은 localStorage).
- 회차 파일을 지우거나 문항 수를 줄이면, 없어진 문제를 가리키는 기록(풀이·오답노트·북마크)은 지우지 않고 집계·목록에서만 뺍니다 (`lib/exams.ts`의 `questionExists`).
- **북마크**: 문제 오른쪽 위 책갈피 아이콘으로 저장하고 `/bookmarks`에서 모아 봅니다 (`stores/bookmarks.ts`, `services/bookmarkRepository.ts`).
- **회차 풀이**: 모든 문항에 답해야 제출할 수 있고(시간 종료 시는 자동 제출), '바로 채점'으로 한 문항씩 정답·해설을 확인할 수 있습니다. 기록은 제출할 때 한 번에 남깁니다.
- **이어 풀기**: 제출 전 풀이(답·바로 채점·남은 시간)는 임시 저장(비로그인: localStorage `sql-cert:exam-drafts` / 로그인: Supabase `exam_drafts`, `services/examDraftRepository.ts`)되어 다른 기기에서도 이어 풀 수 있고, 다시 들어오면 마지막으로 답한 문제 다음의 미응답 문제부터 보여줍니다. 임시 저장이 없으면 아직 안 푼 첫 문제부터, 분류별 연습은 가장 최근에 푼 문제 다음의 안 푼 문제부터 시작합니다.
- **이미 푼 문제 표시**: 문제 위에 `SolvedStatus`(최근 결과·풀이 횟수), 회차 번호판에는 작은 점으로 표시합니다.

## 로그인 · 사용자별 저장 (Supabase)

- 설정: `.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (예시는 `.env.example`). 비어 있으면 로그인 없이 브라우저 저장만 사용합니다.
- DB: `supabase/schema.sql`을 Supabase SQL Editor에서 실행 (`progress`, `wrong_notes`, `bookmarks`, `exam_drafts`, `theory_progress` 테이블 + RLS로 본인 행만 접근). 테이블이 추가되면 다시 실행합니다 (여러 번 실행해도 안전).
- 동작: 비로그인 → localStorage / 로그인 → 브라우저 기록을 서버로 합친 뒤(최신 `updatedAt` 우선) 브라우저 기록은 비우고, 이후 서버에 저장.
- 코드: `stores/auth.ts`(로그인·동기화), `services/*Repository.ts`(Local / Supabase 구현), `lib/supabase.ts`.

## 안드로이드 앱 (Capacitor)

웹 빌드(`dist`)를 그대로 앱에 담는다. 코드는 하나이고, 앱에서만 필요한 처리는 `src/lib/native.ts`와 `src/lib/tts/native.ts`에 모았다.

- 준비: JDK 21, Android Studio(Android SDK 포함)
- `npm run android` — 웹 빌드 → `android/`에 복사 → Android Studio 열기 (여기서 기기/에뮬레이터 실행, APK 빌드)
- `npm run android:sync` — 웹 코드만 고친 뒤 앱에 반영
- 설정: `capacitor.config.ts` (appId `app.passcert.sql` — 스토어 출시 후에는 변경 불가)

앱에서 달라지는 점

- **TTS**: WebView의 speechSynthesis 대신 기기 TTS(`@capacitor-community/text-to-speech`). 기기에 한국어 음성 데이터가 없으면 설정 → 텍스트 음성 변환에서 설치한다.
- **Google 로그인**: 앱 WebView에서는 Google이 로그인을 막으므로 외부 브라우저(커스텀 탭)로 열고, `app.passcert.sql://auth-callback` 딥링크로 돌아와 PKCE code를 세션으로 교환한다.
  - Supabase → Authentication → URL Configuration → Redirect URLs에 `app.passcert.sql://auth-callback` 추가 필요
  - 딥링크 주소는 `AndroidManifest.xml`의 intent-filter, `src/lib/native.ts`의 `AUTH_REDIRECT`와 같아야 한다
- **뒤로가기 버튼**: 앱 안에서 뒤로, 더 갈 곳이 없으면 종료
- **시스템 바 여백**: Android 15부터 화면이 상태바·하단 버튼(3버튼/제스처 바) 밑까지 그려진다. `style.css`의 `--inset-top/right/bottom/left`(= `env(safe-area-inset-*)`와 Capacitor가 넣는 `--safe-area-inset-*` 중 큰 값)로 헤더, 하단 탭, 페이지 아래 여백, 서랍, 강의 화면 높이를 맞춘다. 화면 아래·옆에 붙는 요소를 새로 만들 때는 이 변수를 쓴다.
- **상태바**: 다크 모드에 맞춰 글자색 변경

## 강의 화면과 장면 종류

강의는 화면 전체를 쓰는 플레이어(닫기·진행 막대 / 무대 / 큰 자막 / 재생 버튼)다. 무대의 장면이 화면보다 크면 비율을 유지한 채 줄여 **스크롤 없이 한 화면**에 보인다(`LectureStage`의 자동 맞춤). 항목은 처음부터 자리를 잡아 두고 대본에 맞춰 나타나므로 화면이 흔들리지 않는다.

- 그림형 장면(권장): `cards`(아이콘 카드), `flow`(화살표 흐름, `direction: down|right`, `edges` 화살표 글자), `layers`(계단식 단계, `axis` 양 끝 설명), `checklist`(요약 체크), `compare`(양쪽 `icon`·`tone`), `title`(`icon`)
- 글형 장면: `points`, `code`, `table`, `callout`, `quiz`
- **인터랙티브 표 `data`**: 강의 최상위 `tables`(이름 → 예제 표)를 장면에서 이름으로 불러(`tables: ["EMP"]`, 1~2개, 2개면 나란히) 화면에 띄워 둔 채 단계마다 `t: { 표이름: TableOp }`로 바꾼다 (`components/lecture/scenes/DataScene.vue`, 상태 계산 `lib/lectureTable.ts`). `code`가 있으면 SQL을 위에 두고 `focus`가 SQL 줄을 강조한다.
  - 그 단계에만: `rows`(행 반짝) · `cells`(칸 맥박) · `cols`(컬럼 강조) · `notes`(칸 옆 말풍선) · `tint`(묶음 색, 조인 짝)
  - 쌓임: `filter`(빠질 행에 줄 → 다음 단계에 사라짐) · `sort`(행이 자리 이동) · `group`(같은 값끼리 모아 색칠) · `add`(계산 컬럼 채우기) · `set`(값 번쩍 변경) · `result`(아래 결과표 조립)
  - 같은 예제는 같은 표를 여러 장면에서 다시 띄운다 — 앞 장면의 표를 기억에 의존해 말로 설명하지 않게 (검사 스크립트가 표 이름·행 번호·컬럼·말풍선 길이를 확인하고, 화면에 없는 표를 '앞의 표'처럼 가리키는 대본을 막는다)
- 아이콘은 `src/lib/lectureIcons.ts`에 등록된 이름만 쓴다 (검증 스크립트가 확인).
- 대본은 듣기 위주로: 한 단계에 한 가지, 짧은 문장, 기호 대신 말. 새 형식의 예시는 `content/lectures/data-model.json`.
- **화면 없이 듣기(운전 중)**: 퀴즈는 문제와 보기(1번~4번)를 소리로 읽고, 8초 안에 답하지 않으면 정답을 공개하고 해설을 읽은 뒤 이어간다(`useLecturePlayer`). 강의가 끝나면 다음 강의를 소리로 알리고 8초 뒤 자동으로 넘어간다(선택한 자격증 범위의 이론 순서, `?autoplay=1`로 시작 화면 없이 재생). 끝 화면에서 취소·바로 듣기, '다음 강의 자동 재생' 끄기(localStorage `sql-cert:lecture-autonext`).

- **파트**: 강의는 화면에서 3~4분짜리 파트로 나눠 재생한다 (`lib/lectureParts.ts`, 소단원 경계에서만 자르고 짧은 마지막 파트는 앞에 붙임). 강의 JSON은 그대로이고, 길이는 `scripts/check-lectures.mjs`가 만드는 요약 `content/lecture-meta.json`(장면별 소단원·퀴즈 여부·예상 ms)으로 계산한다 — 강의를 고치면 `npm run lectures`(dev/build 전 자동)로 다시 만들어진다. 끝까지 들은 파트는 localStorage `sql-cert:lecture-parts:<slug>`.
- **표지·완료 화면**: 시작 전에 예상 시간·파트·퀴즈 수와 파트 목록(눌러서 그 파트부터)을 보여준다. 파트를 마치면 퀴즈 결과·들은 시간·연속 학습일·오늘 목표를 보여주고 8초 뒤 다음 파트(마지막 파트면 다음 강의)로 넘어간다.
- **퀴즈 간격**: 퀴즈 없이 설명 장면이 7개 이상 이어지면 검사 스크립트가 오류를 낸다 (듣기만 하는 구간이 길지 않게).
- **숫자 규칙**(검사 스크립트): 말하는 숫자와 화면 숫자(표 칸·결과표·카드 글자)는 3자리까지 — 어림수(1000, 10000)·연도·날짜·0으로 시작하는 코드는 예외. 강의 예제 숫자는 이론 문서와 같을 필요가 없다. 그 밖에 소수 둘째 자리 이상 금지, 말하는 3자리 이상 숫자는 그 장면 화면에 있어야 함, 한 단계에 숫자 4개 이상 금지 — 앞 장면의 표를 기억해야 따라올 수 있는 설명을 막는다.

## 강의 목록 (`/lectures`)

상단 메뉴 '강의'. 맨 위에 이어 들을 강의(없으면 아직 안 끝낸 첫 강의)를 크게 보여주고, 아래는 과목 → 장별로 한 줄씩(상태 아이콘 · 제목 · 파트 진행 칸 · 예상 분) 보여준다. 상태별(완료 / 학습 중 / 미학습)로 걸러 볼 수 있다. 강의 재생 화면에서는 '이론' 대신 '강의' 메뉴가 활성화된다.

## 홈 = 오늘 할 것 (`/`)

Speak 처럼 열자마자 할 일 하나를 크게 보여준다 (`pages/HomePage.vue`).
- 연속 학습일(🔥)과 오늘 목표 링, 최근 7일 표시
- 시험일(D-day): 공식 일정(`lib/examSchedule.ts`, 데이터자격검정 사이트 기준)에서 오늘 이후 가장 가까운 회차로 정하고 D-day·회차·접수 상태와 '하루 강의 N개씩' 계획 한 줄을 보여준다 (`composables/useExamPlan.ts`). 마이페이지에서 다른 날짜를 직접 정할 수 있고(자격증별로 이 기기에 저장 `sql-cert:exam-date`, 지나면 다시 공식 일정), 다음 일정이 발표 전이면 그렇게 안내한다. **해마다 새 일정이 나오면 `EXAM_SCHEDULE` 에 덧붙인다.** 남은 강의를 시험 7일 전까지 끝내는 기준이고, 마지막 주는 모의고사·복습을 권한다.
- **이어서 하기**: 듣다 만 강의·풀다 만 모의고사 중 가장 최근 것 (`composables/useResume.ts`), 없으면 다음 강의
- 오늘 복습 N문제 · 랜덤 문제
- 오늘의 챌린지(진행·연속 일수) · 미니게임
- 내 실력: 예상 점수(과목마다 10문제 이상 풀면, 실제 시험 문항 비중으로 계산)와 과목별 정답률 (`composables/useStudySummary.ts`)

## 연속 학습일 · 하루 목표 (`stores/activity.ts`)

하루 학습량(`StudyDay`: 푼 문제 수·맞힌 수·끝까지 들은 강의 파트 수·재생 시간)을 날짜별로 쌓는다. 비로그인 localStorage `sql-cert:study-days` / 로그인 `study_days`(RLS 본인 행, 로그인하면 브라우저 기록을 더해 옮김).
- 연속 학습일: 문제를 하나라도 풀거나 강의 파트를 하나라도 들은 날이 이어진 수 (오늘 아직이면 어제까지)
- 하루 목표: 문제 5·10·20·30개 중 선택(이 기기에 기억), 강의 1파트 = 문제 5개(`PART_POINTS`)
- 문제 풀이는 `progress.answerMany`, 강의는 파트를 끝까지 들을 때 기록된다

## 간격 복습 · 오늘 복습 (`/review`)

틀린 문제는 다음 날 '오늘 복습'에 나온다. 복습 날에 맞히면 3일 뒤, 또 맞히면 7일 뒤, 그때도 맞히면 '해결'로 바뀐다 (`stores/wrongNotes.ts`의 `REVIEW_DAYS`, 오답의 `reviewStage`·`dueOn`). 복습 날 전에 맞힌 건 단계를 올리지 않고, 틀리면 처음부터. '복습 필요'로 되돌리면 오늘부터 다시. 하단 탭·상단 메뉴의 오답노트 빨간 숫자는 오늘 복습할 수다. DB에 열이 없으면(SQL 실행 전) 복습 일정 없이 저장하고 경고만 남긴다.

## 학습 알림 (앱)

마이페이지(또는 홈의 권유)에서 켜면 매일 정한 시각에 알림을 보낸다 (`lib/reminder.ts`, `@capacitor/local-notifications`). 기기 알림은 보낼 때 조건을 볼 수 없어서 앞으로 14일치를 예약해 두고, 앱을 열거나 공부할 때마다 다시 예약한다 — 오늘 이미 공부했으면 오늘 알림은 빠진다. 정확한 알람 권한(`SCHEDULE_EXACT_ALARM`)은 매니페스트에서 뺐다(스토어 정책). 표시줄 아이콘은 `res/drawable/ic_stat_notify.xml`.

## 모의고사 목록

회차는 4~5열 격자(회차 번호 · 진행 막대 · 다 풀면 정답률, `components/exam/ExamGrid.vue`)로 보여주고, AI 문제 안내는 한 줄로 접어 둔다. 기출은 기존 목록(`ExamList`).

## 랜덤 문제 (`/random`)

선택한 자격증의 모의고사 전체 객관식 문항에서 회차·문항을 무작위로 하나씩 보여준다 (출처: 모의고사 n회 · m번 · 과목 · 관련 이론). 답을 고르면 바로 채점하고 풀이 기록·오답노트에 남긴다. 과목 필터, '안 푼 문제만'(기본으로 켜짐), 이번 방문에서 나온 문제 제외. 페이지를 열 때 해당 자격증 회차를 한 번에 받는다(SQLD 약 1.2MB, SQLP 약 0.7MB). 상단 메뉴, 모의고사 목록, 마이페이지 바로가기에서 들어간다.

## 미니게임 (`/games`)

짧게 한 판씩 하는 게임 (`lib/games.ts`, 데이터·푼 기록은 `lib/gameContent.ts`). **맞힌 문제는 다시 내지 않는다**: 안 푼 문제 → 틀린 문제 순서로 내고, 다 맞히면 처음부터 다시 돈다. 푼 기록(`lib/gameHistory.ts`)은 비로그인이면 이 기기(`sql-cert:game-history`), 로그인하면 계정(`game_history` 테이블)에 저장하고, 로그인할 때 이 기기 기록을 계정에 합친다. 오늘의 챌린지 완료 기록도 계정에 남는다. 처음 맞힌 문제는 서버가 경험치를 준다(아래 랭킹). 게임 한 판은 하루 목표에서 문제 3개(`GAME_POINTS`)로 친다. 최고 기록·챌린지 진행 중 상태는 이 기기에만 남는다(`sql-cert:game-best`, `sql-cert:challenge:*`).
- **오늘의 챌린지** (`/games/daily`): 날짜로 정해지는 5문제(SQLD 1과목 2·2과목 3, SQLP 1·2·2). 같은 날 같은 자격증이면 누구나 같은 문제(`challengeQuestions`, 날짜 시드 난수). 실제 모의고사 문제라 풀이 기록·오답노트·랭킹에 그대로 들어간다. 중간에 나가도 이어서 풀고, 끝나면 🟩🟥 결과를 공유(공유 창이 없으면 클립보드)
- **60초 O/X** (`/games/ox`): 이론 문서별로 쓴 문장(`content/games/ox/<이론 파일 이름>.json`, 54개 문서 1032문장, 해설 포함) + 모의고사의 '○○에 대한 설명으로 옳은/옳지 않은 것은?' 한 줄 문제에서 보기 문장을 뽑아 O/X 로 낸다(`oxStatements`). SQLD 835문장(1·2과목), SQLP 1324문장. 같은 주제가 연달아 나오지 않게, O·X 가 반반 나오게 뽑는다. 맞히면 10점, 5연속마다 ×2·×3, 틀리면 3초 감점. 끝나면 틀린 문장을 정답·관련 이론과 함께 보여준다
- **SQL 결과 맞히기** (`/games/sql`): 연습 테이블에 SQL 을 실행하면 몇 행인지 / 무슨 값인지 고른다(`content/sql/puzzles/*.json`, NULL·함수·조인·서브쿼리·집합 연산·ROLLUP·윈도우 함수·Top-N 등 192개). **정답은 데이터에 적지 않고 그 자리에서 실행해서 정한다.** 풀고 나면 실제 결과 표와 'SQL 고쳐서 실행해 보기'
- **순서 퍼즐** (`/games/order`): 카드를 눌러 순서대로 채운다(`content/games/order/*.json`, SELECT 실행 순서·정규화·격리 수준·Lock 모드·실행계획 읽기 등 46개. `cert: 'sqlp'` 퍼즐은 SQLP 에만 → SQLD 25개). 한 판 5문제, 점수 = 맞힌 퍼즐 × 100 + (150 − 걸린 초)

## SQL 실습장 (`/sql`) · SQL 엔진

브라우저 안에서 PostgreSQL 을 돌린다 (`lib/sqlEngine.ts`, `@electric-sql/pglite`). 엔진 파일이 약 17MB(전송 시 약 5MB)라 SQL 화면을 처음 열 때만 받는다(`vite.config.ts` 의 `optimizeDeps.exclude`).
- 연습 데이터: `content/sql/dataset.sql` (Oracle 예제 EMP·DEPT + 집합 연습 T1·T2, Oracle 에 익숙하게 DUAL·NVL·NVL2)
- 모든 실행은 트랜잭션 안에서 하고 끝나면 ROLLBACK (COMMIT 을 직접 쓰면 데이터를 다시 만든다) → 늘 같은 데이터
- Oracle 과 다른 점(MINUS→EXCEPT, ROWNUM 없음, '' ≠ NULL, 정수 나눗셈 등)은 화면에 안내(`SQL_DIFFERENCES`). 그래서 퍼즐은 두 엔진의 결과가 같은 것만 낸다
- `npm run sql-puzzles` (빌드 전에 자동): 퍼즐을 실제로 실행해 `expect`·해설과 결과가 같은지, 값 문제는 1행 1열인지, 오답 보기에 정답이 없는지 검사
- 무한 반복 쿼리(재귀 CTE 등)는 멈출 수 없으니 주의 (화면 스레드에서 돈다)
- `npm run games` (빌드 전에 자동): O/X 문장(길이·중복·파일당 O 비율 30~70%)과 순서 퍼즐(id·항목 수·중복) 형식 검사

## 문제 검수 (`/audit`)

AI 문제의 오류를 찾는 두 신호를 모아 본다 (비로그인도 볼 수 있음, 마이페이지·모의고사 안내에서 링크).
- **오류 제보**: 문제 코멘트에서 '오류 제보'로 쓴 글을 문제별로 (제보 수·최근 글) — Supabase `audit_reports()`
- **정답률 이상**: 첫 답이 10명 이상 쌓인 문제 중 정답률 25% 미만이거나 한 오답에 정답보다 많이 몰린 문제 — `audit_stats()` 가 보기별 숫자만 주고, 정답 번호와 비교는 화면에서
- 펼치면 문제·정답·해설·코멘트를 바로 본다. 함수는 `schema.sql` 의 '문제 검수' 부분

## 문제별 메모 · 코멘트

문제 아래 '내 메모 / 코멘트' (`components/exam/QuestionExtras.vue`). 시험 중 힌트가 되지 않게 정답이 공개된 뒤에만 보이고, 오답노트·북마크에서는 항상 보인다(`QuestionView`의 `alwaysExtras`).

- **내 메모**: 나만 보기. 입력을 멈추면 자동 저장, 비우면 삭제. 비로그인 localStorage / 로그인 `question_notes`(RLS 본인 행). 예전 오답노트 메모는 서버에서 한 번 옮기고, 화면에서도 메모가 없으면 오답노트 메모를 대신 보여준다 (`stores/questionNotes.ts`).
- **코멘트**: 로그인 사용자끼리 공유. `question_comments`는 직접 접근 불가, 함수(`get_comments`·`add_comment`·`edit_comment`·`delete_comment`·`report_comment`·`comment_count`)로만. 작성자는 닉네임만 표시, 500자, 30초에 1개·하루 50개, 본인 글만 수정·삭제(삭제는 자리만 남김), 신고 3회면 자동 숨김, '문제 오류 제보' 표시. 본문은 글자 그대로 표시(마크다운·HTML 해석 안 함). 개수는 화면에 보일 때만 조회한다.
- 오류 제보 모아 보기(관리자): SQL Editor에서 `select * from question_comments where is_error_report and not deleted order by created_at desc;`

## 문제별 정답률

정답이 공개된 뒤 해설 위에 '정답률 N% · M명 첫 시도 기준'과 보기별 선택 비율(막대·%)을 보여 준다. 오답 중 20% 이상 고른 보기가 있으면 '함정'으로 알려 준다.
- **첫 시도 기준**: `progress.first_answer`는 트리거(`keep_first_answer`)가 처음 들어온 기록에서만 정하고 이후 수정은 무시한다. 다시 풀어 맞힌 기록은 정답률에 넣지 않는다. 기능 전 기록은 한 번만 푼 것만 넣었다.
- **조회**: `question_stats(q_key)` 함수가 보기별 수만 돌려준다(개인 정보 없음, 비로그인도 조회 가능). 화면에 보일 때 한 번 묻고 앱이 켜진 동안 기억한다(`services/questionStatsRepository.ts`).
- 푼 사람이 10명(`MIN_SOLVERS`) 미만이면 비율 대신 '아직 푼 사람이 적어요'를 보여 준다.

## 하단 탭 (휴대폰)

`md` 미만 화면에서는 상단 가로 메뉴 대신 하단 탭(이론·강의·모의고사·오답노트·마이, `components/layout/BottomTabBar.vue`)을 쓴다. 북마크·랭킹·기출문제는 마이페이지 바로가기로 들어간다. 강의 재생·문제 풀이 화면에서는 탭을 숨긴다.

## 랭킹 (`/ranking`)

경험치(XP)로 주간(한국 시간 월요일 0시 초기화)·전체 순위를 매긴다 (푼 문제 수도 함께 보여준다). 조회는 누구나(비로그인 포함), 참여·내 순위는 로그인 사용자만. 10위까지는 사람이 적어도 자리를 보여주고 남은 자리는 움직이지 않는 점선 '빈 자리'로 표시한다(로딩 표시와 구분). 홈에는 주간(왼쪽)·전체(오른쪽) 상위 3명 요약.

- 경험치: 서버 트리거만 `solve_daily.xp`(사용자·날짜별)에 더한다. 클라이언트는 경험치를 보내지 않는다.
  - 모의고사 문제 처음 풀기 정답 10 / 오답 2, 다시 풀기 1회 2 (`progress` 트리거 `count_solves`, 푼 수 `solved` 도 함께)
  - 이론·강의 학습 완료 20, 문서마다 한 번 (`theory_progress.xp_rewarded`)
  - 미니게임 처음 맞힌 문제 O/X 2, 순서 퍼즐·SQL 결과 8, 오늘의 챌린지 완료 20(그날 것만) (`game_history.rewarded`, 삭제 권한 없음)
  - 규칙 표시는 `XP_RULES`(`services/rankingRepository.ts`), 서버와 같게 고친다
  - 기능 전 기록은 SQL 실행 때 한 번 경험치로 바꿨다
- 조작 방지: 한 번에 늘 수 있는 양 제한(새 기록 20, 수정 5), 하루 최대 푼 수 3000 · 경험치 3000. `profiles`·`solve_daily`는 직접 읽고 쓸 수 없고 함수로만 다룬다.
- 조회: `get_leaderboard(period, max_rows)` RPC — 상위 N명 + 내 순위, 동점은 같은 순위 (`services/rankingRepository.ts`).
- 닉네임을 정하지 않은 사용자는 Google 이름 그대로 표시한다 (예전엔 홍*동처럼 가렸다). 사진·이메일은 노출하지 않는다.

## 마이페이지 (`/me`)

프로필 아이콘 → 마이페이지. 로그인 여부와 상관없이 학습 습관(연속 학습일·최고 기록·하루 목표 선택·최근 14일 학습량, `components/me/HabitCard.vue`), 학습 알림(앱), 내 실력(예상 점수·과목별 정답률과 이론 진도·먼저 보강할 절 3개와 바로 연습/강의, `SkillCard.vue`)을 보여준다. 로그인하면 프로필(Google 이름·이메일·가입일), 닉네임 변경, 이번 주·전체 랭킹 순위, SQLD/SQLP별 학습 현황도 보여준다.

- 닉네임: 처음에는 Google 이름. `set_nickname` RPC로 변경 — 2~12자, 한글·영문·숫자·밑줄, 다른 사람과 중복 불가(직접 정한 닉네임끼리), `*` 금지. 규칙은 서버가 검사하고 화면도 같은 규칙으로 미리 안내한다 (`services/profileRepository.ts`).

## 브랜드 (로고·색)

- **로고**: 형광펜 노랑 타일 위 잉크색 세미콜론(;). SQL 문장을 끝맺는 기호 = '끝까지 해낸다'. 웹은 `public/logo.svg`(파비콘)·`components/brand/AppLogo.vue`(헤더), 앱은 `android/app/src/main/res/mipmap-*`(런처 아이콘, 적응형 배경 `#F5E04B`)·`drawable*/splash.png`.
- **색**: 잉크 `#1B2A4E` + 형광펜 `#F5E04B`, 종이 느낌 바탕 `#FAF8F2`. 라이트는 잉크가 주색(primary), 다크는 형광펜이 주색. 토큰은 `src/style.css` (`--ink`, `--highlight`, `--mark`; Tailwind `bg-highlight`·`text-ink`).
- **포인트**: `.hl` 클래스 = 글자 아래 절반만 칠하는 형광펜 밑줄 (홈 제목, 헤더의 현재 메뉴). 검색 강조 `<mark>`도 같은 색.
