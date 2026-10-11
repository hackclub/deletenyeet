create table audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('staff', 'slack', 'system')),
  actor_id text,
  action text not null check (length(action) > 0),
  request_id uuid,
  detail jsonb not null default '{}'::jsonb
);

create index audit_events_request_idx on audit_events (request_id, occurred_at)
  where request_id is not null;

create function audit_events_reject_change() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_events is append-only';
end
$$;

create trigger audit_events_no_update_or_delete
  before update or delete on audit_events
  for each row execute function audit_events_reject_change();

create trigger audit_events_no_truncate
  before truncate on audit_events
  for each statement execute function audit_events_reject_change();
