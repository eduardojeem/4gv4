create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  excerpt text,
  category text,
  tags text[] default '{}',
  status text check (status in ('draft', 'published', 'archived')) default 'draft',
  published_at timestamptz,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  user_id uuid default auth.uid(),
  featured boolean default false,
  image_url text,
  views_count integer default 0,
  likes_count integer default 0,
  comments_count integer default 0,
  shares_count integer default 0,
  read_time integer default 0
);

alter table public.posts enable row level security;

create policy "Public posts are viewable by everyone" on public.posts
  for select using (true);

create policy "Authenticated users can insert posts" on public.posts
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update posts" on public.posts
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete posts" on public.posts
  for delete using (auth.role() = 'authenticated');
