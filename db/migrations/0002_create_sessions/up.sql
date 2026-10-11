create table sessions (
  id_hash text primary key,
  data jsonb not null,
  staff_sub text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sessions_expires_at_idx on sessions (expires_at);

create index sessions_staff_sub_idx on sessions (staff_sub) where staff_sub is not null;
