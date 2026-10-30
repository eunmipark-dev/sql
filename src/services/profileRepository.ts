import { supabase } from '@/lib/supabase'

export interface MyProfile {
  /** 랭킹에 보이는 이름 */
  nickname: string
  /** 직접 정한 닉네임인지 (false 면 Google 이름) */
  custom: boolean
}

const db = () => {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다')
  return supabase
}

/** 내 프로필 (Supabase get_my_profile, 로그인 사용자만) */
export async function getMyProfile(): Promise<MyProfile | undefined> {
  const { data, error } = await db().rpc('get_my_profile')
  if (error) throw error
  const row = (data as MyProfile[] | null)?.[0]
  return row ? { nickname: row.nickname, custom: row.custom } : undefined
}

/**
 * 닉네임 변경. 규칙(2~12자, 한글·영문·숫자·밑줄, 중복 불가)은 서버 set_nickname 이 검사하고,
 * 어긋나면 그 이유를 담은 Error 를 던진다
 */
export async function setNickname(nickname: string): Promise<string> {
  const { data, error } = await db().rpc('set_nickname', { new_nickname: nickname })
  if (error) {
    // 동시에 같은 닉네임을 정한 경우 등 고유 인덱스에서 막힌 때
    if (error.code === '23505') throw new Error('이미 다른 사람이 쓰고 있는 닉네임이에요')
    throw new Error(error.message)
  }
  return data as string
}

/** 서버와 같은 규칙으로 미리 검사 (입력 중 안내용). 문제 없으면 undefined */
export function checkNickname(value: string) {
  const n = value.trim().replace(/\s+/g, ' ')
  if (n.length < 2 || n.length > 12) return '닉네임은 2~12자로 정해 주세요'
  if (!/^[가-힣A-Za-z0-9_ ]+$/.test(n)) return '한글·영문·숫자·밑줄(_)만 쓸 수 있어요'
  return undefined
}
