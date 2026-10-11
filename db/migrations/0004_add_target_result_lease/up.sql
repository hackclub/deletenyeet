alter table target_results add column claimed_until timestamptz;

create index target_results_due_idx on target_results (next_attempt_at)
  where status in ('pending', 'retrying');
