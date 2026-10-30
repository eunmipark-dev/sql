export interface TheoryDoc {
  slug: string
  title: string
  /** 과목 (예: 1과목 · 데이터 모델링의 이해) */
  subject: string
  /** 장 (예: 1-1. 데이터 모델링의 이해) */
  chapter: string
  summary: string
  /** 마크다운 원문 (frontmatter 제외) */
  body: string
}

export interface Heading {
  level: 2 | 3
  id: string
  text: string
}

/** 과목 번호. 3과목(SQL 고급활용 및 튜닝)은 SQLP 전용 */
export type Subject = 1 | 2 | 3

export interface Question {
  id: number
  subject: Subject
  /** 관련 이론 문서 slug (틀렸을 때 "관련 이론 보기") */
  theory?: string
  /** 문제 본문 (마크다운, 표 가능) */
  question: string
  /** 보기 지문 (SQL 코드 등, 선택) */
  code?: string
  choices: string[]
  /** 정답 번호 (1부터 시작) */
  answer: number
  /** 해설 (마크다운) */
  explanation: string
}

/** past: 기출 (권리를 확보한 복원 문제) / ai: AI가 만든 SQLD 모의고사 / sqlp: AI가 만든 SQLP 모의고사 */
export type ExamKind = 'past' | 'ai' | 'sqlp'

/** SQLP 실기 (서술형). 자동 채점 대신 채점 포인트로 자가 채점한다 */
export interface PracticalQuestion {
  id: number
  title: string
  /** 지문: 테이블·인덱스·실행계획·요구사항 (마크다운) */
  question: string
  /** 분석할 SQL (선택) */
  code?: string
  /** 모범 답안 SQL */
  answer: string
  /** 해설 (마크다운) */
  explanation: string
  /** 채점 포인트. score 합 = 문항 배점 */
  rubric: { point: string; score: number }[]
}

/** 목록(index.json)에 들어가는 시험 정보. 문제 본문은 포함하지 않는다 */
export interface ExamMeta {
  id: string
  kind: ExamKind
  title: string
  description: string
  round: number | null
  date: string | null
  /** 제한 시간(분). 없으면 시간 제한 없음 */
  timeLimitMin: number | null
  questionCount: number
  subjectCounts: Record<Subject, number>
  /** 실기 문항 수 (SQLP) */
  practicalCount: number
  /** public/data/exams 기준 파일 경로 (?v=해시 포함) */
  file: string
}

export interface Exam {
  id: string
  kind: ExamKind
  title: string
  description?: string
  round?: number
  date?: string
  timeLimitMin?: number
  questions: Question[]
  /** SQLP 실기 */
  practicals?: PracticalQuestion[]
}

/** 분류별 문제은행의 문항 (출처 시험 정보 포함) */
export interface BankQuestion extends Question {
  examId: string
  examTitle: string
  /** 출처 시험에서의 문항 번호 */
  number: number
}

export interface BankEntry {
  count: number
  file: string
}

/** kind → 이론 slug → 문제은행 정보 */
export type BankIndex = Partial<Record<ExamKind, Record<string, BankEntry>>>

/** 문항별 풀이 기록 (진행률·오답률 계산용) */
export interface ProgressRecord {
  /** `${examId}:${questionId}` */
  key: string
  examId: string
  questionId: number
  /** 이론 절 slug (분류별 집계용) */
  theory?: string
  lastAnswer: number
  correct: boolean
  attempts: number
  updatedAt: string
}

export interface WrongNote {
  /** `${examId}:${questionId}` */
  key: string
  examId: string
  questionId: number
  lastAnswer: number
  wrongCount: number
  correctCount: number
  memo: string
  resolved: boolean
  /**
   * 간격 복습 단계 (0~2). 맞히면 다음 복습까지 1일 → 3일 → 7일, 7일 뒤에도 맞히면 '해결'.
   * 예전 기록엔 없다 (0 으로 본다)
   */
  reviewStage?: number
  /** 다음 복습 날짜 'YYYY-MM-DD'. 이 날부터 '오늘 복습'에 나온다. 예전 기록엔 없다 (틀린 다음 날로 본다) */
  dueOn?: string
  createdAt: string
  updatedAt: string
}

/** 하루 학습량 (연속 학습일·하루 목표·주간 그래프) */
export interface StudyDay {
  /** 'YYYY-MM-DD' (기기 시간대) */
  day: string
  /** 푼 문제 수 (같은 문제를 다시 풀어도 센다) */
  questions: number
  /** 그중 맞힌 수 */
  correct: number
  /** 끝까지 들은 강의 파트 수 */
  lectureParts: number
  /** 강의를 재생한 시간 (ms) */
  lectureMs: number
  updatedAt: string
}

export interface Bookmark {
  /** `${examId}:${questionId}` */
  key: string
  examId: string
  questionId: number
  createdAt: string
  updatedAt: string
}

/** 제출 전 회차 풀이 (이어 풀기용 임시 저장) */
export interface ExamDraft {
  /** examId (로그인 시 합치기 기준) */
  key: string
  examId: string
  /** 문항 id → 고른 선택지 */
  answers: Record<number, number>
  /** 바로 채점한 문항 id */
  checked: Record<number, boolean>
  /** 남은 시간(초) */
  remaining: number
  /** 마지막으로 답을 고른 문항 id */
  lastAnswered?: number
  /** SQLP 실기 답안: 실기 id → 작성한 답안, 모범 답안 공개 여부 */
  practical?: Record<number, PracticalDraft>
  updatedAt: string
}

export interface PracticalDraft {
  text: string
  revealed?: boolean
}

/** 이론 문서 학습 기록 */
export interface TheoryRecord {
  /** 문서 slug */
  key: string
  /** 연 횟수 */
  viewCount: number
  /** 마지막으로 연 시각 */
  lastViewedAt: string
  /** '학습 완료'로 표시한 시각 (해제하면 undefined) */
  completedAt?: string
  updatedAt: string
}

// ── 인터랙티브 강의 (content/lectures/<slug>.json, 이론 문서 slug 와 1:1) ──

/** 장면 안의 한 단계: 읽어줄 대본 + 강조할 대상 */
export interface LectureStep {
  /** TTS 로 읽고 자막으로 보여줄 문장 */
  say: string
  /**
   * 강조 대상 (장면 종류마다 의미가 다르다)
   * - points: 여기까지 펼칠 항목 번호(0부터, 가장 큰 값까지 보임)
   * - code: 강조할 줄 번호(1부터)
   * - table: 강조할 행 번호(0부터)
   * - compare: 0 = 왼쪽, 1 = 오른쪽
   * - cards · flow · layers · checklist: 항목 번호(0부터). points 처럼 가장 큰 번호까지 차례로 나타난다
   * - data: 함께 보여주는 SQL(code)의 줄 번호(1부터)
   */
  focus?: number[]
  /** data 장면: 표 이름 → 이 단계에서 표에 일어나는 일 */
  t?: Record<string, TableOp>
}

/** 강의 안에서 여러 장면이 함께 쓰는 예제 표 (Lecture.tables). 값은 모두 문자열, 빈 값은 'NULL' */
export interface LectureTable {
  columns: string[]
  rows: string[][]
}

/**
 * data 장면에서 한 단계 동안 표에 일어나는 일. 행 번호는 늘 원래 표의 행 번호(0부터), 컬럼은 이름.
 * - 그 단계에만: rows(행 반짝) · cells(칸 반짝) · cols(컬럼 강조) · notes(칸 옆 말풍선) · tint(행 묶음마다 다른 색, 조인 짝)
 * - 다음 단계에도 남음: filter · sort · group · add · set · result (null 이면 되돌림)
 */
export interface TableOp {
  rows?: number[]
  cells?: [number, string][]
  cols?: string[]
  /** [행, 컬럼, 짧은 말] */
  notes?: [number, string, string][]
  tint?: number[][]
  /** 남길 행. 이 단계에서는 빠질 행에 줄이 그어지고, 다음 단계부터 사라진다 */
  filter?: number[] | null
  /** [컬럼, 방향] 순서대로 정렬 (Oracle 처럼 NULL 은 오름차순 맨 뒤) */
  sort?: [string, 'asc' | 'desc'][] | null
  /** 이 컬럼 값끼리 모으고 묶음마다 색을 칠한다 */
  group?: string | null
  /** 새 컬럼 [이름, 원래 행 순서대로 값] (계산 컬럼·순위 등) */
  add?: [string, string[]]
  /** 칸 값 바꾸기 [행, 컬럼, 새 값] */
  set?: [number, string, string][]
  /** 표 아래에 조립되는 결과표 (집계·PIVOT·조인 결과) */
  result?: { title?: string; columns: string[]; rows: string[][] } | null
}

interface LectureSceneBase {
  id: string
  /** 장면이 속한 소단원 (장면 목록에서 묶어 보여준다) */
  section: string
  title?: string
  steps: LectureStep[]
}

/** 강의 그림에 쓰는 아이콘 이름 (lib/lectureIcons.ts 에 등록된 것) */
export type LectureIcon = string

/** 그림 항목: 아이콘 + 제목 + 짧은 설명 */
export interface LectureVisualItem {
  icon?: LectureIcon
  title: string
  desc?: string
  /** 색 강조: good(초록) · bad(빨강) · warn(주황) */
  tone?: 'good' | 'bad' | 'warn'
}

export type LectureScene =
  | (LectureSceneBase & { type: 'title'; subtitle?: string; icon?: LectureIcon })
  /** 아이콘 카드 그리드 (2~6개) */
  | (LectureSceneBase & { type: 'cards'; items: LectureVisualItem[]; cols?: 2 | 3 })
  /** 화살표로 이어진 흐름 (방향: 아래 또는 오른쪽). edges 는 화살표 위 글자 */
  | (LectureSceneBase & { type: 'flow'; nodes: LectureVisualItem[]; direction?: 'down' | 'right'; edges?: string[] })
  /** 위에서 아래로 쌓인 단계 (axis 는 양 끝 설명, 예: 추상화 높음 ↔ 구체성 높음) */
  | (LectureSceneBase & { type: 'layers'; layers: LectureVisualItem[]; axis?: { top: string; bottom: string } })
  /** 체크 표시가 하나씩 켜지는 요약 */
  | (LectureSceneBase & { type: 'checklist'; items: string[] })
  | (LectureSceneBase & { type: 'points'; items: string[] })
  | (LectureSceneBase & { type: 'code'; code: string; caption?: string })
  | (LectureSceneBase & { type: 'table'; columns: string[]; rows: string[][]; caption?: string })
  /** 예제 표(Lecture.tables 의 이름, 1~2개)를 띄워 두고 단계마다 반짝이고·거르고·정렬하고·묶고·결과표를 조립한다. code 가 있으면 SQL 도 함께 */
  | (LectureSceneBase & { type: 'data'; tables: string[]; code?: string; caption?: string })
  | (LectureSceneBase & {
      type: 'compare'
      left: { title: string; items: string[]; icon?: LectureIcon; tone?: 'good' | 'bad' }
      right: { title: string; items: string[]; icon?: LectureIcon; tone?: 'good' | 'bad' }
    })
  | (LectureSceneBase & { type: 'callout'; tone: 'tip' | 'info' | 'warning'; text: string })
  | (LectureSceneBase & {
      type: 'quiz'
      question: string
      choices: string[]
      /** 정답 번호 (1부터) */
      answer: number
      explanation: string
    })

export interface Lecture {
  /** 이론 문서 slug */
  slug: string
  title: string
  /** 여러 장면이 함께 쓰는 예제 표 (이름 → 표). data 장면이 이름으로 불러 쓴다 */
  tables?: Record<string, LectureTable>
  scenes: LectureScene[]
}

/** 문제별 개인 메모 (나만 보기) */
export interface QuestionNote {
  /** `${examId}:${questionId}` */
  key: string
  examId: string
  questionId: number
  memo: string
  updatedAt: string
}
