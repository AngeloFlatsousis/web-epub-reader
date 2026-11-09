-- OpenBook — Supabase schema (Milestone 2: optional cloud sync)
-- Run in Supabase SQL editor. Requires `auth` enabled.
-- Tables mirror the local IndexedDB model so sync is a straight upsert.

create table if not exists public.books (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text not null default 'Unknown author',
  file_name text not null default '',
  file_size bigint not null default 0,
  file_hash text not null default '',
  cover_url text,
  progress double precision not null default 0 check (progress >= 0 and progress <= 1),
  cfi text,
  toc_label text,
  added_at timestamptz not null default now(),
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_positions (
  book_id text not null references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cfi text not null default '',
  fraction double precision not null default 0 check (fraction >= 0 and fraction <= 1),
  toc_label text,
  updated_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create table if not exists public.annotations (
  id text primary key,
  book_id text not null references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cfi text not null,
  color text not null default 'yellow' check (color in ('yellow','green','blue','pink','orange')),
  note text not null default '',
  excerpt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  id text primary key,
  book_id text not null references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cfi text not null,
  label text not null default 'Bookmark',
  created_at timestamptz not null default now()
);

create index if not exists books_user_idx on public.books (user_id, last_read_at desc);
create index if not exists annotations_book_idx on public.annotations (book_id);
create index if not exists bookmarks_book_idx on public.bookmarks (book_id);

-- Row Level Security: users only see their own rows
alter table public.books enable row level security;
alter table public.reading_positions enable row level security;
alter table public.annotations enable row level security;
alter table public.bookmarks enable row level security;

drop policy if exists "books own" on public.books;
create policy "books own" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "positions own" on public.reading_positions;
create policy "positions own" on public.reading_positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "annotations own" on public.annotations;
create policy "annotations own" on public.annotations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "bookmarks own" on public.bookmarks;
create policy "bookmarks own" on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists books_touch on public.books;
create trigger books_touch before update on public.books
  for each row execute function public.touch_updated_at();

drop trigger if exists positions_touch on public.reading_positions;
create trigger positions_touch before update on public.reading_positions
  for each row execute function public.touch_updated_at();

drop trigger if exists annotations_touch on public.annotations;
create trigger annotations_touch before update on public.annotations
  for each row execute function public.touch_updated_at();
