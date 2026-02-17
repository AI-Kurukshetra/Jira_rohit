create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null,
  summary text not null,
  description text not null,
  acceptance_criteria text not null,
  issue_type text not null,
  priority text not null,
  story_points integer,
  start_date date,
  due_date date,
  sprint text,
  status text not null default 'backlog',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint issues_priority_check
    check (priority = any (array['P0','P1','P2','P3'])),
  constraint issues_status_check
    check (status = any (array['backlog','sprint','in_progress','done','released']))
);
