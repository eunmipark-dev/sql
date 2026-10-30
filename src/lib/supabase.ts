import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isNative } from '@/lib/native'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined

/**
 * .env.local 에 Supabase 설정이 없으면 null (로그인 없이 브라우저 저장만 사용).
 * 안드로이드 앱은 로그인 후 딥링크로 돌아오므로 PKCE(code 교환) 방식을 쓰고, 주소에서 세션을 읽지 않는다.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, isNative ? { auth: { flowType: 'pkce', detectSessionInUrl: false } } : undefined)
    : null
