-- Run this once in Supabase: Project > SQL Editor > New query > paste > Run

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  company text not null,
  role text not null,
  platform text default 'Naukri',
  link text,
  date_applied date,
  status text default 'applied',
  follow_up date,
  contact text,
  notes text,
  created_at timestamptz default now()
);

alter table jobs enable row level security;

create policy "Users can view their own jobs"
  on jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own jobs"
  on jobs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own jobs"
  on jobs for delete
  using (auth.uid() = user_id);

-- Job sites (second tab: saved job portals, 2-column logo grid)
create table if not exists job_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  url text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

-- For existing installs created before the drag-reorder update:
alter table job_sites add column if not exists position int not null default 0;

alter table job_sites enable row level security;

create policy "Users can view their own job sites"
  on job_sites for select
  using (auth.uid() = user_id);

create policy "Users can insert their own job sites"
  on job_sites for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own job sites"
  on job_sites for update
  using (auth.uid() = user_id);

create policy "Users can delete their own job sites"
  on job_sites for delete
  using (auth.uid() = user_id);
