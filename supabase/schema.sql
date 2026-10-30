-- Pass SQLD/SQLP: 사용자별 학습 기록
-- Supabase 대시보드 → SQL Editor → 붙여넣고 Run (여러 번 실행해도 안전)
--
-- 문제/이론 데이터는 프론트의 정적 파일에 있고, DB에는 "사용자가 푼 기록"만 저장한다.
-- RLS(행 단위 보안)로 로그인한 사용자는 자기 행만 읽고 쓸 수 있다.

-- ─────────────────────────────────────────────
-- 풀이 기록: 문항별 마지막 풀이 결과 (진행률 계산)
-- ─────────────────────────────────────────────
create table if not exists public.progress (
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key          text        not null,               -- '{exam_id}:{question_id}'
  exam_id      text        not null,
  question_id  integer     not null,
  theory       text,                               -- 이론 절 slug (분류별 집계)
  last_answer  smallint    not null,
  correct      boolean     not null,
  attempts     integer     not null default 1,
  updated_at   timestamptz not null default now(),
  primary key (user_id, key)
);

-- ─────────────────────────────────────────────
-- 오답노트
-- ─────────────────────────────────────────────
create table if not exists public.wrong_notes (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key            text        not null,             -- '{exam_id}:{question_id}'
  exam_id        text        not null,
  question_id    integer     not null,
  last_answer    smallint    not null,
  wrong_count    integer     not null default 1,
  correct_count  integer     not null default 0,
  memo           text        not null default '',
  resolved       boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, key)
);

-- ─────────────────────────────────────────────
-- 북마크: 나중에 다시 볼 문제
-- ─────────────────────────────────────────────
create table if not exists public.bookmarks (
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key          text        not null,               -- '{exam_id}:{question_id}'
  exam_id      text        not null,
  question_id  integer     not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, key)
);

-- ─────────────────────────────────────────────
-- 제출 전 회차 풀이 (이어 풀기). 제출하거나 처음부터 다시 풀면 지운다
-- ─────────────────────────────────────────────
create table if not exists public.exam_drafts (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  exam_id        text        not null,
  answers        jsonb       not null default '{}',  -- { 문항 id: 고른 선택지 }
  checked        jsonb       not null default '{}',  -- { 문항 id: true } 바로 채점한 문항
  remaining      integer     not null default 0,     -- 남은 시간(초)
  last_answered  integer,                            -- 마지막으로 답을 고른 문항 id
  practical      jsonb       not null default '{}',  -- SQLP 실기 { 실기 id: { text, revealed } }
  updated_at     timestamptz not null default now(),
  primary key (user_id, exam_id)
);
-- 이전에 만든 테이블에 실기 컬럼 추가
alter table public.exam_drafts add column if not exists practical jsonb not null default '{}';

-- ─────────────────────────────────────────────
-- 이론 학습 기록: 문서별 마지막으로 본 날짜, 학습 완료
-- ─────────────────────────────────────────────
create table if not exists public.theory_progress (
  user_id         uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  slug            text        not null,               -- 이론 문서 slug
  view_count      integer     not null default 1,
  last_viewed_at  timestamptz not null default now(),
  completed_at    timestamptz,                        -- '학습 완료' 표시 시각 (해제하면 null)
  updated_at      timestamptz not null default now(),
  primary key (user_id, slug)
);

-- ─────────────────────────────────────────────
-- 행 단위 보안: 본인 행만 조회/추가/수정/삭제
-- ─────────────────────────────────────────────
alter table public.progress    enable row level security;
alter table public.wrong_notes enable row level security;
alter table public.bookmarks   enable row level security;
alter table public.exam_drafts enable row level security;
alter table public.theory_progress enable row level security;

drop policy if exists "본인 풀이 기록만" on public.progress;
create policy "본인 풀이 기록만" on public.progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "본인 오답노트만" on public.wrong_notes;
create policy "본인 오답노트만" on public.wrong_notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "본인 북마크만" on public.bookmarks;
create policy "본인 북마크만" on public.bookmarks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "본인 풀이 중 기록만" on public.exam_drafts;
create policy "본인 풀이 중 기록만" on public.exam_drafts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "본인 이론 기록만" on public.theory_progress;
create policy "본인 이론 기록만" on public.theory_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 로그인 사용자만 접근 (비로그인 anon 은 권한 없음)
revoke all on public.progress, public.wrong_notes, public.bookmarks, public.exam_drafts, public.theory_progress from anon;
grant select, insert, update, delete on public.progress, public.wrong_notes, public.bookmarks, public.exam_drafts, public.theory_progress to authenticated;

-- ═════════════════════════════════════════════
-- 랭킹: 푼 문제 수 (주간 / 전체)
-- - 표는 직접 읽고 쓸 수 없고(정책 없음), 트리거와 get_leaderboard 함수로만 다룬다
-- - 이름은 닉네임(정하지 않았으면 Google 이름)으로 보여준다. 사진·이메일은 노출하지 않는다 (맨 아래 '기본 닉네임' 참고)
-- ═════════════════════════════════════════════
create table if not exists public.profiles (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  nickname    text        not null,
  created_at  timestamptz not null default now()
);

-- 날짜별(한국 시간) 푼 문제 수. progress 가 바뀔 때 트리거로만 쌓인다
create table if not exists public.solve_daily (
  user_id  uuid    not null references auth.users (id) on delete cascade,
  day      date    not null,
  solved   integer not null default 0,
  primary key (user_id, day)
);

alter table public.profiles    enable row level security;
alter table public.solve_daily enable row level security;
revoke all on public.profiles, public.solve_daily from anon, authenticated;

-- 이름 가리기: 1글자 → *, 2글자 → 홍*, 3글자 이상 → 홍*동
create or replace function public.mask_name(n text) returns text
language sql immutable set search_path = '' as $$
  select case
    when n is null or length(trim(n)) = 0 then '익명'
    when length(trim(n)) = 1 then '*'
    when length(trim(n)) = 2 then left(trim(n), 1) || '*'
    else left(trim(n), 1) || repeat('*', length(trim(n)) - 2) || right(trim(n), 1)
  end
$$;

-- 새 사용자 → 프로필 (Google 이름, 없으면 이메일 앞부분을 가려서)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, nickname)
  values (new.id, public.mask_name(coalesce(new.raw_user_meta_data ->> 'full_name',
                                            new.raw_user_meta_data ->> 'name',
                                            split_part(new.email, '@', 1))))
  on conflict (user_id) do nothing;
  return new;
end
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입한 사용자의 프로필
insert into public.profiles (user_id, nickname)
select id, public.mask_name(coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(email, '@', 1)))
from auth.users
on conflict (user_id) do nothing;

-- 풀이 기록이 늘면 그만큼 오늘의 푼 문제 수에 더한다
-- 조작 방지: 한 번에 늘 수 있는 양을 제한 (새 기록 20, 수정 5), 하루 최대 3000
create or replace function public.count_solves() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  delta integer;
begin
  if tg_op = 'INSERT' then
    delta := least(greatest(new.attempts, 0), 20);
  else
    delta := least(greatest(new.attempts - old.attempts, 0), 5);
  end if;
  if delta > 0 then
    insert into public.solve_daily (user_id, day, solved)
    values (new.user_id, (now() at time zone 'Asia/Seoul')::date, delta)
    on conflict (user_id, day) do update
      set solved = least(public.solve_daily.solved + excluded.solved, 3000);
  end if;
  return new;
end
$$;
drop trigger if exists progress_count_solves on public.progress;
create trigger progress_count_solves after insert or update of attempts on public.progress
  for each row execute function public.count_solves();

-- 랭킹이 생기기 전 기록: 아직 집계가 없는 사용자만 기존 풀이 기록으로 한 번 채운다
insert into public.solve_daily (user_id, day, solved)
select p.user_id, (p.updated_at at time zone 'Asia/Seoul')::date, sum(least(p.attempts, 20))
from public.progress p
where not exists (select 1 from public.solve_daily s where s.user_id = p.user_id)
group by 1, 2
on conflict (user_id, day) do nothing;

-- 랭킹 조회: period = 'week'(이번 주, 월요일 0시 시작) | 'all'
-- 상위 max_rows 명 + 내 순위(밖에 있어도). 동점은 같은 순위
-- (아래 '경험치' 에서 반환 형식을 바꾸므로, 파일을 다시 실행할 때를 위해 지우고 만든다)
drop function if exists public.get_leaderboard(text, integer);
create function public.get_leaderboard(period text default 'week', max_rows integer default 50)
returns table (rank bigint, nickname text, solved bigint, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select s.user_id, sum(s.solved)::bigint as solved
    from public.solve_daily s
    where period <> 'week'
       or s.day >= date_trunc('week', now() at time zone 'Asia/Seoul')::date
    group by s.user_id
    having sum(s.solved) > 0
  ), ranked as (
    select t.user_id, t.solved, rank() over (order by t.solved desc) as rank
    from totals t
  )
  select r.rank, coalesce(p.nickname, '익명'), r.solved, r.user_id = auth.uid()
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  where r.rank <= least(greatest(max_rows, 1), 100) or r.user_id = auth.uid()
  order by r.rank, p.nickname
$$;
revoke all on function public.get_leaderboard(text, integer) from public, anon;
grant execute on function public.get_leaderboard(text, integer) to authenticated;

-- ═════════════════════════════════════════════
-- 닉네임 (마이페이지에서 변경)
-- - 처음에는 Google 이름(custom = false, 예전엔 가린 이름). 직접 정하면 custom = true 이고 다른 사람과 겹칠 수 없다
-- - 2~12자, 한글·영문·숫자·밑줄·공백. '*' 는 못 써서 가린 이름을 흉내 낼 수 없다
-- ═════════════════════════════════════════════
alter table public.profiles add column if not exists custom boolean not null default false;
create unique index if not exists profiles_custom_nickname_key on public.profiles (lower(nickname)) where custom;

create or replace function public.get_my_profile()
returns table (nickname text, custom boolean)
language sql stable security definer set search_path = '' as $$
  select p.nickname, p.custom from public.profiles p where p.user_id = auth.uid()
$$;

create or replace function public.set_nickname(new_nickname text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  n text := regexp_replace(btrim(coalesce(new_nickname, '')), '\s+', ' ', 'g');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요' using errcode = '28000';
  end if;
  if char_length(n) < 2 or char_length(n) > 12 then
    raise exception '닉네임은 2~12자로 정해 주세요' using errcode = '22023';
  end if;
  if n !~ '^[가-힣A-Za-z0-9_ ]+$' then
    raise exception '한글·영문·숫자·밑줄(_)만 쓸 수 있어요' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p
             where p.custom and lower(p.nickname) = lower(n) and p.user_id <> auth.uid()) then
    raise exception '이미 다른 사람이 쓰고 있는 닉네임이에요' using errcode = '23505';
  end if;
  insert into public.profiles (user_id, nickname, custom) values (auth.uid(), n, true)
  on conflict (user_id) do update set nickname = excluded.nickname, custom = true;
  return n;
end
$$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.set_nickname(text) from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.set_nickname(text) to authenticated;

-- ═════════════════════════════════════════════
-- 문제별 개인 메모 (나만 보기)
-- ═════════════════════════════════════════════
create table if not exists public.question_notes (
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key          text        not null,               -- '{exam_id}:{question_id}'
  exam_id      text        not null,
  question_id  integer     not null,
  memo         text        not null check (char_length(memo) <= 2000),
  updated_at   timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.question_notes enable row level security;
drop policy if exists "본인 메모만" on public.question_notes;
create policy "본인 메모만" on public.question_notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.question_notes from anon;
grant select, insert, update, delete on public.question_notes to authenticated;

-- 오답노트에 있던 메모를 옮겨 온다 (이미 있는 메모는 그대로)
insert into public.question_notes (user_id, key, exam_id, question_id, memo, updated_at)
select user_id, key, exam_id, question_id, left(memo, 2000), updated_at
from public.wrong_notes
where memo <> ''
on conflict (user_id, key) do nothing;

-- ═════════════════════════════════════════════
-- 문제별 공유 코멘트 (로그인 사용자끼리)
-- - 표는 직접 읽고 쓸 수 없고 아래 함수로만 다룬다 (작성자 정보는 닉네임만)
-- - 500자, 30초에 1개·하루 50개, 신고 3회면 자동으로 숨김, 본인 글만 수정·삭제
-- ═════════════════════════════════════════════
create table if not exists public.question_comments (
  id               bigint      generated always as identity primary key,
  question_key     text        not null check (question_key ~ '^[a-z0-9-]+:[0-9]+$'),
  user_id          uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  body             text        not null check (char_length(body) between 1 and 500),
  is_error_report  boolean     not null default false,   -- '문제 오류 제보'
  created_at       timestamptz not null default now(),
  edited_at        timestamptz,
  deleted          boolean     not null default false,
  hidden           boolean     not null default false    -- 신고 누적으로 숨김
);
create index if not exists question_comments_key_idx on public.question_comments (question_key, created_at);
create index if not exists question_comments_user_idx on public.question_comments (user_id, created_at);

create table if not exists public.comment_reports (
  comment_id  bigint      not null references public.question_comments (id) on delete cascade,
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.question_comments enable row level security;
alter table public.comment_reports   enable row level security;
revoke all on public.question_comments, public.comment_reports from anon, authenticated;

-- 코멘트 수 (풀기 전에는 개수만 보여준다)
create or replace function public.comment_count(q_key text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.question_comments
  where question_key = q_key and not deleted and not hidden
$$;

-- 코멘트 목록 (삭제·숨김 글은 내용을 비워서 자리만)
create or replace function public.get_comments(q_key text)
returns table (id bigint, nickname text, body text, is_error_report boolean, created_at timestamptz,
               edited boolean, deleted boolean, hidden boolean, is_mine boolean, reported_by_me boolean)
language sql stable security definer set search_path = '' as $$
  select c.id,
         coalesce(p.nickname, '익명'),
         case when c.deleted or c.hidden then '' else c.body end,
         c.is_error_report,
         c.created_at,
         c.edited_at is not null,
         c.deleted,
         c.hidden,
         c.user_id = auth.uid(),
         exists (select 1 from public.comment_reports r where r.comment_id = c.id and r.user_id = auth.uid())
  from public.question_comments c
  left join public.profiles p on p.user_id = c.user_id
  where c.question_key = q_key
  order by c.created_at
$$;

create or replace function public.add_comment(q_key text, comment_body text, error_report boolean default false)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  b text := btrim(coalesce(comment_body, ''));
  new_id bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요' using errcode = '28000'; end if;
  if char_length(b) < 1 then raise exception '내용을 입력해 주세요' using errcode = '22023'; end if;
  if char_length(b) > 500 then raise exception '500자까지 쓸 수 있어요' using errcode = '22023'; end if;
  if q_key !~ '^[a-z0-9-]+:[0-9]+$' then raise exception '잘못된 문제예요' using errcode = '22023'; end if;
  if exists (select 1 from public.question_comments
             where user_id = auth.uid() and created_at > now() - interval '30 seconds') then
    raise exception '코멘트는 30초에 한 번 쓸 수 있어요' using errcode = '54000';
  end if;
  if (select count(*) from public.question_comments
      where user_id = auth.uid() and created_at > now() - interval '1 day') >= 50 then
    raise exception '하루에 50개까지 쓸 수 있어요' using errcode = '54000';
  end if;
  insert into public.question_comments (question_key, user_id, body, is_error_report)
  values (q_key, auth.uid(), b, coalesce(error_report, false))
  returning id into new_id;
  return new_id;
end
$$;

create or replace function public.edit_comment(comment_id bigint, comment_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  b text := btrim(coalesce(comment_body, ''));
begin
  if char_length(b) < 1 or char_length(b) > 500 then
    raise exception '1~500자로 써 주세요' using errcode = '22023';
  end if;
  update public.question_comments
  set body = b, edited_at = now()
  where id = comment_id and user_id = auth.uid() and not deleted;
  if not found then raise exception '내 코멘트만 고칠 수 있어요' using errcode = '42501'; end if;
end
$$;

create or replace function public.delete_comment(comment_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.question_comments set deleted = true
  where id = comment_id and user_id = auth.uid();
  if not found then raise exception '내 코멘트만 지울 수 있어요' using errcode = '42501'; end if;
end
$$;

-- 신고: 내 글은 신고할 수 없고 같은 글은 한 번만. 3번 쌓이면 숨긴다
create or replace function public.report_comment(comment_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요' using errcode = '28000'; end if;
  if exists (select 1 from public.question_comments c where c.id = comment_id and c.user_id = auth.uid()) then
    raise exception '내 코멘트는 신고할 수 없어요' using errcode = '22023';
  end if;
  insert into public.comment_reports (comment_id, user_id) values (comment_id, auth.uid())
  on conflict do nothing;
  update public.question_comments c set hidden = true
  where c.id = comment_id
    and (select count(*) from public.comment_reports r where r.comment_id = c.id) >= 3;
end
$$;

revoke all on function public.comment_count(text), public.get_comments(text),
  public.add_comment(text, text, boolean), public.edit_comment(bigint, text),
  public.delete_comment(bigint), public.report_comment(bigint) from public, anon;
grant execute on function public.comment_count(text), public.get_comments(text),
  public.add_comment(text, text, boolean), public.edit_comment(bigint, text),
  public.delete_comment(bigint), public.report_comment(bigint) to authenticated;

-- ─────────────────────────────────────────────
-- 문제별 정답률: 각 사용자의 '첫 답'으로만 집계 (다시 풀어 맞힌 것은 넣지 않는다)
-- ─────────────────────────────────────────────
alter table public.progress add column if not exists first_answer smallint;
create index if not exists progress_key_idx on public.progress (key);

-- 첫 답은 서버가 정한다: 처음 들어올 때(한 번에 푼 기록만) 남기고, 이후 수정은 무시한다
create or replace function public.keep_first_answer() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.first_answer := case when new.attempts <= 1 then new.last_answer end;
  else
    new.first_answer := old.first_answer;
  end if;
  return new;
end
$$;
drop trigger if exists progress_keep_first_answer on public.progress;
create trigger progress_keep_first_answer before insert or update on public.progress
  for each row execute function public.keep_first_answer();

-- 기능 전 기록: 한 번만 푼 문제는 마지막 답이 곧 첫 답 (트리거를 잠시 끄고 채운다)
alter table public.progress disable trigger progress_keep_first_answer;
update public.progress set first_answer = last_answer where first_answer is null and attempts = 1;
alter table public.progress enable trigger progress_keep_first_answer;

-- 보기별 첫 답 수 (개인 정보 없이 숫자만). 화면은 푼 사람이 충분할 때만 보여준다
create or replace function public.question_stats(q_key text)
returns table (choice smallint, picks integer)
language sql stable security definer set search_path = '' as $$
  select p.first_answer, count(*)::integer
  from public.progress p
  where p.key = q_key and p.first_answer is not null
  group by p.first_answer
$$;
revoke all on function public.question_stats(text) from public;
grant execute on function public.question_stats(text) to anon, authenticated;

-- ─────────────────────────────────────────────
-- 간격 복습: 틀린 문제를 1일 → 3일 → 7일 뒤 다시 풀기 (오늘 복습)
-- ─────────────────────────────────────────────
alter table public.wrong_notes add column if not exists review_stage smallint not null default 0;  -- 0~2, 3 이 되면 해결
alter table public.wrong_notes add column if not exists due_on date;                               -- 다음 복습 날짜

-- 기능 전 오답: 틀린 다음 날을 복습 날짜로
update public.wrong_notes set due_on = (created_at at time zone 'Asia/Seoul')::date + 1
where due_on is null and not resolved;

-- ─────────────────────────────────────────────
-- 하루 학습량 (연속 학습일 · 하루 목표 · 주간 그래프)
-- ─────────────────────────────────────────────
create table if not exists public.study_days (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  day            date        not null,              -- 기기 시간대의 날짜
  questions      integer     not null default 0,    -- 푼 문제 수
  correct        integer     not null default 0,    -- 그중 맞힌 수
  lecture_parts  integer     not null default 0,    -- 끝까지 들은 강의 파트 수
  lecture_ms     bigint      not null default 0,    -- 강의 재생 시간
  updated_at     timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.study_days enable row level security;
drop policy if exists "본인 학습량만" on public.study_days;
create policy "본인 학습량만" on public.study_days
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.study_days from anon;
grant select, insert, update, delete on public.study_days to authenticated;

-- ─────────────────────────────────────────────
-- 기본 닉네임을 가리지 않는다: 닉네임을 직접 정하지 않은 사용자는 Google 이름 그대로 (홍*동 → 홍길동)
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, nickname)
  values (new.id, coalesce(nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name',
                                                new.raw_user_meta_data ->> 'name')), ''),
                           nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                           '익명'))
  on conflict (user_id) do nothing;
  return new;
end
$$;

-- 이미 있는 사용자 중 닉네임을 직접 정하지 않은 사람은 이름을 다시 채운다 (직접 정한 닉네임은 그대로)
update public.profiles p
set nickname = coalesce(nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), ''),
                        nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
                        '익명')
from auth.users u
where u.id = p.user_id and not p.custom;

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

-- ─────────────────────────────────────────────
-- 경험치(XP) 랭킹 + 미니게임 기록을 계정에 저장
-- - 경험치는 서버 트리거만 쌓는다 (앱이 직접 더할 수 없다). 같은 문제·문서·게임 문제로는 한 번만 크게 준다
--   · 모의고사 문제 처음 풀기: 정답 10 / 오답 2, 다시 풀기 1회 2
--   · 이론·강의 학습 완료 (문서마다 처음 한 번): 20
--   · 미니게임 처음 맞힌 문제: O/X 2, 순서 퍼즐 8, SQL 결과 맞히기 8
--   · 오늘의 챌린지 5문제 완료: 20 (문제는 모의고사 규칙으로 따로)
--   · 하루 최대 3000
-- - 랭킹은 경험치 순 (푼 문제 수는 함께 보여준다)
-- ─────────────────────────────────────────────
alter table public.solve_daily add column if not exists xp integer not null default 0;

create or replace function public.add_xp(uid uuid, pts integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.solve_daily (user_id, day, xp)
  select uid, (now() at time zone 'Asia/Seoul')::date, pts
  where pts > 0
  on conflict (user_id, day) do update
    set xp = least(public.solve_daily.xp + excluded.xp, 3000)
$$;
revoke all on function public.add_xp(uuid, integer) from public, anon, authenticated;

-- 이론 문서별로 경험치를 받았는지 (완료를 풀었다 다시 눌러도 한 번만)
alter table public.theory_progress add column if not exists xp_rewarded boolean not null default false;

-- 기능 전 기록을 경험치로: 아직 경험치가 없는 사용자만 한 번 (트리거를 만들기 전에)
with earned as (
  select p.user_id, (p.updated_at at time zone 'Asia/Seoul')::date as day,
         (case when p.correct then 10 else 2 end) + 2 * least(greatest(p.attempts - 1, 0), 10) as xp
  from public.progress p
  union all
  select t.user_id, (t.completed_at at time zone 'Asia/Seoul')::date, 20
  from public.theory_progress t
  where t.completed_at is not null
)
insert into public.solve_daily (user_id, day, xp)
select e.user_id, e.day, least(sum(e.xp), 3000)
from earned e
where not exists (select 1 from public.solve_daily s where s.user_id = e.user_id and s.xp > 0)
group by e.user_id, e.day
on conflict (user_id, day) do update set xp = least(public.solve_daily.xp + excluded.xp, 3000);

update public.theory_progress set xp_rewarded = true where completed_at is not null and not xp_rewarded;

-- 모의고사 풀이: 푼 문제 수(기존)와 경험치를 함께 쌓는다
create or replace function public.count_solves() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  delta integer;
begin
  if tg_op = 'INSERT' then
    delta := least(greatest(new.attempts, 0), 20);
    perform public.add_xp(new.user_id,
      (case when new.correct then 10 else 2 end) + 2 * least(greatest(new.attempts - 1, 0), 10));
  else
    delta := least(greatest(new.attempts - old.attempts, 0), 5);
    perform public.add_xp(new.user_id, 2 * delta);
  end if;
  if delta > 0 then
    insert into public.solve_daily (user_id, day, solved)
    values (new.user_id, (now() at time zone 'Asia/Seoul')::date, delta)
    on conflict (user_id, day) do update
      set solved = least(public.solve_daily.solved + excluded.solved, 3000);
  end if;
  return new;
end
$$;

-- 이론·강의 완료: 받은 표시는 서버가 정하고(앞), 경험치는 실제로 저장된 뒤에 준다(뒤)
-- (upsert 는 충돌해도 BEFORE INSERT 가 먼저 불리므로 경험치는 AFTER 에서만 준다)
create or replace function public.theory_xp_flag() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.xp_rewarded := (tg_op = 'UPDATE' and old.xp_rewarded) or new.completed_at is not null;
  return new;
end
$$;
create or replace function public.theory_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.completed_at is not null and (tg_op = 'INSERT' or not old.xp_rewarded)
     and new.slug ~ '^[a-z0-9-]{2,80}$' then
    perform public.add_xp(new.user_id, 20);
  end if;
  return new;
end
$$;
drop trigger if exists theory_progress_xp_flag on public.theory_progress;
create trigger theory_progress_xp_flag before insert or update on public.theory_progress
  for each row execute function public.theory_xp_flag();
drop trigger if exists theory_progress_xp on public.theory_progress;
create trigger theory_progress_xp after insert or update on public.theory_progress
  for each row execute function public.theory_xp();

-- 미니게임 푼 기록 (계정에 저장, 기기끼리 이어진다)
create table if not exists public.game_history (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  game        text        not null check (game in ('ox', 'order', 'sql', 'daily')),
  item_id     text        not null check (char_length(item_id) between 1 and 160),  -- daily 는 '{종류}:{날짜}'
  ok          boolean,                          -- true 맞힘 / false 틀림 / null 다 맞혀서 다시 도는 중
  score       smallint,                         -- 오늘의 챌린지: 맞힌 수
  rewarded    boolean     not null default false,  -- 경험치를 받았는지 (서버가 정한다)
  updated_at  timestamptz not null default now(),
  primary key (user_id, game, item_id)
);
alter table public.game_history enable row level security;
drop policy if exists "본인 게임 기록만" on public.game_history;
create policy "본인 게임 기록만" on public.game_history
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- 지웠다 다시 넣어 경험치를 또 받지 못하게 삭제 권한은 주지 않는다
revoke all on public.game_history from anon, authenticated;
grant select, insert, update on public.game_history to authenticated;

create or replace function public.game_xp_flag() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.rewarded := (tg_op = 'UPDATE' and old.rewarded) or coalesce(new.ok, false);
  new.updated_at := now();
  return new;
end
$$;
create or replace function public.game_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pts integer;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not coalesce(new.ok, false) or (tg_op = 'UPDATE' and old.rewarded) then
    return new;
  end if;
  pts := case new.game when 'ox' then 2 when 'order' then 8 when 'sql' then 8 else 0 end;
  -- 챌린지는 오늘(앞뒤 하루) 것만
  if new.game = 'daily' and new.item_id ~ '^[a-z]+:\d{4}-\d{2}-\d{2}$' then
    if split_part(new.item_id, ':', 2) in (to_char(today - 1, 'YYYY-MM-DD'), to_char(today, 'YYYY-MM-DD'), to_char(today + 1, 'YYYY-MM-DD')) then
      pts := 20;
    end if;
  end if;
  perform public.add_xp(new.user_id, pts);
  return new;
end
$$;
drop trigger if exists game_history_xp_flag on public.game_history;
create trigger game_history_xp_flag before insert or update on public.game_history
  for each row execute function public.game_xp_flag();
drop trigger if exists game_history_xp on public.game_history;
create trigger game_history_xp after insert or update on public.game_history
  for each row execute function public.game_xp();

-- 다 맞혀서 처음부터 다시 돌 때: 맞힌 기록을 '안 푼 것'으로 (경험치 받은 표시는 그대로)
create or replace function public.reset_game_items(g text, ids text[]) returns void
language sql set search_path = '' as $$
  update public.game_history set ok = null
  where user_id = auth.uid() and game = g and item_id = any(ids) and ok
$$;
revoke all on function public.reset_game_items(text, text[]) from public, anon;
grant execute on function public.reset_game_items(text, text[]) to authenticated;

-- 랭킹: 경험치 순 (반환 형식이 바뀌어 지우고 다시 만든다)
drop function if exists public.get_leaderboard(text, integer);
create function public.get_leaderboard(period text default 'week', max_rows integer default 50)
returns table (rank bigint, nickname text, xp bigint, solved bigint, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select s.user_id, sum(s.xp)::bigint as xp, sum(s.solved)::bigint as solved
    from public.solve_daily s
    where period <> 'week'
       or s.day >= date_trunc('week', now() at time zone 'Asia/Seoul')::date
    group by s.user_id
    having sum(s.xp) > 0
  ), ranked as (
    select t.*, rank() over (order by t.xp desc) as rank
    from totals t
  )
  select r.rank, coalesce(p.nickname, '익명'), r.xp, r.solved, r.user_id = auth.uid()
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  where r.rank <= least(greatest(max_rows, 1), 100) or r.user_id = auth.uid()
  order by r.rank, p.nickname
$$;
revoke all on function public.get_leaderboard(text, integer) from public;
grant execute on function public.get_leaderboard(text, integer) to anon, authenticated;
