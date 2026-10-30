import { supabase } from '@/lib/supabase'

/** 문제별 공유 코멘트 (Supabase 함수로만 다룬다. 규칙·제한은 서버가 검사) */
export interface QuestionComment {
  id: number
  /** 작성자 닉네임 (사진·이메일은 없음) */
  nickname: string
  /** 삭제·숨김 글은 빈 문자열 */
  body: string
  isErrorReport: boolean
  createdAt: string
  edited: boolean
  deleted: boolean
  /** 신고가 쌓여 숨겨짐 */
  hidden: boolean
  isMine: boolean
  reportedByMe: boolean
}

const db = () => {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
  return supabase
}

/** 서버가 보낸 이유(예: '30초에 한 번…')를 그대로 보여준다 */
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const commentKey = (examId: string, questionId: number) => `${examId}:${questionId}`

export async function countComments(key: string) {
  return call<number>('comment_count', { q_key: key })
}

export async function loadComments(key: string): Promise<QuestionComment[]> {
  const rows = await call<
    {
      id: number
      nickname: string
      body: string
      is_error_report: boolean
      created_at: string
      edited: boolean
      deleted: boolean
      hidden: boolean
      is_mine: boolean
      reported_by_me: boolean
    }[]
  >('get_comments', { q_key: key })
  return rows.map((r) => ({
    id: Number(r.id),
    nickname: r.nickname,
    body: r.body,
    isErrorReport: r.is_error_report,
    createdAt: r.created_at,
    edited: r.edited,
    deleted: r.deleted,
    hidden: r.hidden,
    isMine: r.is_mine,
    reportedByMe: r.reported_by_me,
  }))
}

export const addComment = (key: string, body: string, errorReport: boolean) =>
  call<number>('add_comment', { q_key: key, comment_body: body, error_report: errorReport })

export const editComment = (id: number, body: string) => call<void>('edit_comment', { comment_id: id, comment_body: body })

export const deleteComment = (id: number) => call<void>('delete_comment', { comment_id: id })

export const reportComment = (id: number) => call<void>('report_comment', { comment_id: id })
