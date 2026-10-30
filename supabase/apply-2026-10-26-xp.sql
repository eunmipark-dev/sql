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
ㄹ
create or replace function public.add_xp(uid uuid, pts integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.solve_daily (user_id, day, xp)ㅇ
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
