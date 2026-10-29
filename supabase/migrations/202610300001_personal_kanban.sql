create table public.boards (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 80), description text not null default '' check(length(description)<=500), created_at timestamptz not null default now(), unique(id,user_id)
);
create table public.cards (
 id uuid primary key default gen_random_uuid(), board_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200), description text not null default '' check(length(description)<=10000),
 status text not null default 'todo' check(status in ('backlog','todo','progress','done')),
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
 due_date date, labels text[] not null default '{}', position double precision not null default 0,
 archived boolean not null default false, created_at timestamptz not null default now(),
 foreign key(board_id,user_id) references public.boards(id,user_id) on delete cascade,
 check(cardinality(labels)<=8)
);
create index cards_board_position_idx on public.cards(board_id,position);
create index boards_user_idx on public.boards(user_id);
create index cards_user_idx on public.cards(user_id);
alter table public.boards enable row level security;
alter table public.cards enable row level security;
create policy owner_boards on public.boards for all to authenticated
 using ((select auth.uid())=user_id and lower((select auth.jwt())->>'email')='rockarnab367@gmail.com')
 with check ((select auth.uid())=user_id and lower((select auth.jwt())->>'email')='rockarnab367@gmail.com');
create policy owner_cards on public.cards for all to authenticated
 using ((select auth.uid())=user_id and lower((select auth.jwt())->>'email')='rockarnab367@gmail.com')
 with check ((select auth.uid())=user_id and lower((select auth.jwt())->>'email')='rockarnab367@gmail.com');
revoke all on public.boards, public.cards from anon;
grant select,insert,update,delete on public.boards, public.cards to authenticated;
