create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create table targets (
  id uuid primary key default uuidv7(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 64),
  name text not null check (length(name) between 1 and 200),
  type text not null check (type in ('endpoint', 'airtable', 'slack', 'loops', 'hackatime', 'auth')),
  audience text check (audience is null or length(audience) between 1 and 200),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint targets_endpoint_audience check (type <> 'endpoint' or audience is not null)
);

create trigger targets_updated_at before update on targets
  for each row execute function set_updated_at();

create table requests (
  id uuid primary key default uuidv7(),
  type text not null check (type in ('delete', 'export')),
  status text not null default 'received' check (
    status in (
      'received', 'resolving', 'dry_running', 'awaiting_approval',
      'executing', 'completed', 'partially_failed', 'rejected'
    )
  ),
  source text not null check (source in ('manual', 'airtable')),
  source_ref text check (source_ref is null or length(source_ref) between 1 and 200),
  created_by text,
  decision text check (decision in ('approved', 'rejected')),
  decided_by_type text check (decided_by_type in ('staff', 'slack')),
  decided_by text,
  decided_at timestamptz,
  completed_at timestamptz,
  redacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_source_ref check ((source = 'airtable') = (source_ref is not null)),
  constraint requests_manual_creator check (source <> 'manual' or created_by is not null),
  constraint requests_decision_complete check (
    (decision is null and decided_by_type is null and decided_by is null and decided_at is null)
    or (decision is not null and decided_by_type is not null and decided_by is not null and decided_at is not null)
  ),
  constraint requests_execution_approved check (
    status not in ('executing', 'completed', 'partially_failed') or decision is not distinct from 'approved'
  ),
  constraint requests_rejection_recorded check (
    status <> 'rejected' or decision is not distinct from 'rejected'
  ),
  constraint requests_redaction_finished check (
    redacted_at is null or status in ('completed', 'partially_failed', 'rejected')
  )
);

create unique index requests_source_ref_idx on requests (source, source_ref) where source_ref is not null;
create index requests_status_idx on requests (status, created_at);

create trigger requests_updated_at before update on requests
  for each row execute function set_updated_at();

create table request_identifiers (
  id bigint generated always as identity primary key,
  request_id uuid not null references requests (id) on delete restrict,
  kind text not null check (kind in ('email', 'identity_id', 'slack_id')),
  value text not null check (length(value) between 1 and 320),
  source text not null check (source in ('intake', 'hackclub_auth')),
  hashed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint request_identifiers_email_normalized check (
    kind <> 'email' or hashed or value = lower(btrim(value))
  )
);

create unique index request_identifiers_unique_idx on request_identifiers (request_id, kind, value);

create table target_results (
  id bigint generated always as identity primary key,
  request_id uuid not null references requests (id) on delete restrict,
  target_id uuid not null references targets (id) on delete restrict,
  phase text not null check (phase in ('dry_run', 'execute')),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed', 'retrying')),
  attempts integer not null default 0 check (attempts >= 0),
  found boolean,
  deleted jsonb check (deleted is null or jsonb_typeof(deleted) = 'object'),
  retained jsonb check (retained is null or jsonb_typeof(retained) = 'array'),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,64}$'),
  http_status integer check (http_status is null or http_status between 100 and 599),
  next_attempt_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_results_done_has_result check (
    status <> 'done' or (found is not null and deleted is not null and retained is not null)
  ),
  constraint target_results_failed_has_error check (status <> 'failed' or error_code is not null),
  constraint target_results_retry_scheduled check ((status = 'retrying') = (next_attempt_at is not null)),
  constraint target_results_finished check ((status in ('done', 'failed')) = (finished_at is not null))
);

create unique index target_results_unique_idx on target_results (request_id, target_id, phase);
create index target_results_target_idx on target_results (target_id);

create trigger target_results_updated_at before update on target_results
  for each row execute function set_updated_at();
