begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

select has_table('public', 'moderation_reports', 'reports table exists');
select has_table('public', 'moderation_appeals', 'appeals table exists');
select has_table('public', 'moderation_audit_log', 'audit table exists');

select has_column('public', 'anchors', 'moderation_status', 'Anchors have moderation visibility');
select has_column('public', 'iterations', 'moderation_status', 'Iterations have moderation visibility');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'moderation_reports'),
  'RLS is enabled on reports'
);
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'moderation_appeals'),
  'RLS is enabled on appeals'
);
select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'moderation_audit_log'),
  'RLS is enabled on audit log'
);

select ok(
  has_table_privilege('authenticated', 'public.moderation_reports', 'SELECT'),
  'Authenticated users can read only the rows allowed by RLS'
);
select ok(
  not has_table_privilege('anon', 'public.moderation_reports', 'SELECT'),
  'Anonymous users cannot read reports'
);
select ok(
  has_column_privilege('authenticated', 'public.moderation_reports', 'reporter_id', 'INSERT'),
  'Authenticated users can submit reports'
);
select ok(
  not has_column_privilege('authenticated', 'public.moderation_reports', 'status', 'UPDATE'),
  'Users cannot resolve or change report status directly'
);
select ok(
  not has_column_privilege('authenticated', 'public.anchors', 'moderation_status', 'UPDATE'),
  'Users cannot change Anchor moderation state directly'
);
select ok(
  not has_column_privilege('authenticated', 'public.iterations', 'moderation_status', 'UPDATE'),
  'Users cannot change Iteration moderation state directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.review_moderation(text,uuid,text,text,uuid,uuid)',
    'EXECUTE'
  ),
  'Authenticated staff RPC is available to authenticated sessions'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.review_moderation(text,uuid,text,text,uuid,uuid)',
    'EXECUTE'
  ),
  'Anonymous callers cannot invoke the staff RPC'
);

select ok(
  exists (select 1 from pg_trigger where tgname = 'auto_hold_reported_target_after_insert' and not tgisinternal),
  'A report insert invokes the auto-hold trigger'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'moderation_reports_one_open_per_reporter_idx'),
  'Duplicate active reports by the same user are constrained'
);

select jsonb_agg(test_line) as test_results from finish() as test_line;
rollback;
