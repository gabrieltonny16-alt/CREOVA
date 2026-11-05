begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('72000000-0000-4000-8000-000000000001', 'creova-flow-author@example.test', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"username":"flow_author","display_name":"Flow Author"}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000002', 'creova-flow-reporter1@example.test', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"username":"flow_reporter1","display_name":"Flow Reporter 1"}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000003', 'creova-flow-reporter2@example.test', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"username":"flow_reporter2","display_name":"Flow Reporter 2"}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000004', 'creova-flow-reporter3@example.test', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"username":"flow_reporter3","display_name":"Flow Reporter 3"}'::jsonb, now(), now()),
  ('72000000-0000-4000-8000-000000000005', 'creova-flow-moderator@example.test', '', now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"username":"flow_moderator","display_name":"Flow Moderator"}'::jsonb, now(), now());

insert into private.moderator_roles (user_id, role)
values ('72000000-0000-4000-8000-000000000005', 'admin');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.anchors (creator_id, title, description, skill)
values (
  '72000000-0000-4000-8000-000000000001',
  'Moderation flow pgTAP anchor',
  'Temporary test content for the full moderation and appeal lifecycle.',
  'Testing'
);

reset role;
select set_config('creova_test.anchor_id',
  (select id::text from public.anchors where title='Moderation flow pgTAP anchor'), true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.moderation_reports (reporter_id, target_type, target_id, category)
values ('72000000-0000-4000-8000-000000000002','anchor',current_setting('creova_test.anchor_id')::uuid,'spam');

select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
insert into public.moderation_reports (reporter_id, target_type, target_id, category)
values ('72000000-0000-4000-8000-000000000003','anchor',current_setting('creova_test.anchor_id')::uuid,'spam');

select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
insert into public.moderation_reports (reporter_id, target_type, target_id, category)
values ('72000000-0000-4000-8000-000000000004','anchor',current_setting('creova_test.anchor_id')::uuid,'spam');

reset role;
select is(
  (select moderation_status from public.anchors where id=current_setting('creova_test.anchor_id')::uuid),
  'held',
  'Three distinct reporters automatically hold a contribution'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select set_config('creova_test.reporter_can_see_held',
  ((select count(*)=0 from public.anchors where id=current_setting('creova_test.anchor_id')::uuid))::text, true);

select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config('creova_test.creator_can_see_held',
  ((select count(*)=1 from public.anchors where id=current_setting('creova_test.anchor_id')::uuid))::text, true);

reset role;
select ok(current_setting('creova_test.reporter_can_see_held')='true',
  'Held content is hidden from other users');
select ok(current_setting('creova_test.creator_can_see_held')='true',
  'The creator can still access their held contribution to appeal');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select public.review_moderation(
  'anchor', current_setting('creova_test.anchor_id')::uuid,
  'remove', 'Temporary moderation flow test removal', null, null
);

reset role;
select is(
  (select moderation_status from public.anchors where id=current_setting('creova_test.anchor_id')::uuid),
  'removed',
  'Authorized staff can remove a held contribution'
);
select is(
  (select count(*)::integer from public.moderation_reports
   where target_id=current_setting('creova_test.anchor_id')::uuid and status='actioned'),
  3,
  'Staff removal resolves the open reports'
);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.moderation_appeals (user_id, target_type, target_id, reason)
values (
  '72000000-0000-4000-8000-000000000001',
  'anchor',
  current_setting('creova_test.anchor_id')::uuid,
  'This test contribution was created only to verify the appeal workflow.'
);

reset role;
select set_config('creova_test.appeal_id',
  (select id::text from public.moderation_appeals
   where target_id=current_setting('creova_test.anchor_id')::uuid
     and user_id='72000000-0000-4000-8000-000000000001'), true);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"72000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select public.review_moderation(
  'anchor', current_setting('creova_test.anchor_id')::uuid,
  'overturn_appeal', 'Temporary flow test appeal overturned',
  current_setting('creova_test.appeal_id')::uuid, null
);

reset role;
select is(
  (select status from public.moderation_appeals where id=current_setting('creova_test.appeal_id')::uuid),
  'overturned',
  'Staff can overturn a pending appeal'
);
select is(
  (select moderation_status from public.anchors where id=current_setting('creova_test.anchor_id')::uuid),
  'visible',
  'An overturned appeal restores contribution visibility'
);
select is(
  (select string_agg(action, ',' order by id)
   from public.moderation_audit_log
   where target_id=current_setting('creova_test.anchor_id')::uuid),
  'auto_hold,remove,overturn_appeal',
  'Every automated and staff decision is audited'
);

select jsonb_agg(test_line) as test_results from finish() as test_line;
rollback;
