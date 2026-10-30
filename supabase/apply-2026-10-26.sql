-- ═════════════════════════════════════════════
-- 2026-10-26 반영분 (schema.sql 을 이미 실행한 DB 에 추가로 실행)
-- Supabase 대시보드 → SQL Editor → 전체 붙여넣고 Run. 여러 번 실행해도 안전
--   1. 랭킹: 비로그인도 볼 수 있게
--   2. 문제 검수 (/audit): 오류 제보 · 정답률 이상 문제 모아 보기
-- (같은 내용이 schema.sql 끝에도 들어 있다)
-- ═════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 랭킹은 비로그인도 볼 수 있다 (참여·내 순위는 로그인 사용자만: 비로그인은 is_me 가 항상 false)
-- ─────────────────────────────────────────────
grant execute on function public.get_leaderboard(text, integer) to anon;

-- ─────────────────────────────────────────────
-- 문제 검수 (/audit): 오류 제보가 달린 문제, 정답률이 이상한 문제를 모아 본다 (비로그인도 볼 수 있음)
-- 정답 번호는 앱의 문제 파일에 있으므로, 서버는 숫자만 내주고 판단은 화면에서 한다
-- ─────────────────────────────────────────────
create or replace function public.audit_reports()
returns table (question_key text, reports integer, last_at timestamptz, last_body text)
language sql stable security definer set search_path = '' as $$
  select c.question_key,
         count(*)::integer,
         max(c.created_at),
         (array_agg(c.body order by c.created_at desc))[1]
  from public.question_comments c
  where c.is_error_report and not c.deleted and not c.hidden
  group by c.question_key
  order by max(c.created_at) desc
  limit 300
$$;

-- 첫 답이 min_solvers 개 이상 쌓인 문제의 보기별 첫 답 수
create or replace function public.audit_stats(min_solvers integer default 10)
returns table (question_key text, choice smallint, picks integer)
language sql stable security definer set search_path = '' as $$
  with enough as (
    select p.key from public.progress p
    where p.first_answer is not null
    group by p.key
    having count(*) >= greatest(coalesce(min_solvers, 10), 5)
  )
  select p.key, p.first_answer, count(*)::integer
  from public.progress p
  join enough e on e.key = p.key
  where p.first_answer is not null
  group by p.key, p.first_answer
$$;
revoke all on function public.audit_reports(), public.audit_stats(integer) from public;
grant execute on function public.audit_reports(), public.audit_stats(integer) to anon, authenticated;
