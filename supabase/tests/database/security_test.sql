begin;

select plan(65);

insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000001', 'manager@example.invalid', '', now()),
  ('10000000-0000-0000-0000-000000000002', 'executor-a@example.invalid', '', now()),
  ('10000000-0000-0000-0000-000000000003', 'executor-b@example.invalid', '', now());

insert into public.profiles (id, role, display_name)
values
  ('10000000-0000-0000-0000-000000000001', 'manager', 'Manager'),
  ('10000000-0000-0000-0000-000000000002', 'executor', 'Executor A'),
  ('10000000-0000-0000-0000-000000000003', 'executor', 'Executor B');

insert into public.objects (id, name, address)
values
  ('20000000-0000-0000-0000-000000000001', 'Object A', 'Address A'),
  ('20000000-0000-0000-0000-000000000002', 'Object B', 'Address B');

insert into public.tasks (id, object_id, title, description, assignee_id, author_id, status)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Task A', '', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'new'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Task B', '', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'new'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Task for review', '', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'in_review');

insert into public.task_status_history (task_id, actor_id, from_status, to_status)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', null, 'new'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', null, 'new'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', null, 'new');

select ok((
  select count(*) = 4
    and pg_catalog.bool_and(p.prosecdef)
    and pg_catalog.bool_and(p.proconfig @> array['search_path=""'])
  from pg_catalog.pg_proc as p
  where p.oid in (
    'public.create_task(uuid,text,text,uuid)'::regprocedure,
    'public.transition_task_status(uuid,text,text)'::regprocedure,
    'public.delete_task(uuid)'::regprocedure,
    'public.delete_object(uuid)'::regprocedure
  )
), 'all privileged RPCs are SECURITY DEFINER with an empty search_path');
select ok((
  (select count(*) = 4
   from pg_catalog.pg_proc as p
   where p.oid in (
     'public.create_task(uuid,text,text,uuid)'::regprocedure,
     'public.transition_task_status(uuid,text,text)'::regprocedure,
     'public.delete_task(uuid)'::regprocedure,
     'public.delete_object(uuid)'::regprocedure
   )
     and pg_catalog.pg_get_userbyid(p.proowner) = 'crm_rpc_owner')
  and (select not r.rolcanlogin and r.rolbypassrls
       from pg_catalog.pg_roles as r where r.rolname = 'crm_rpc_owner')
  and not pg_catalog.has_schema_privilege('crm_rpc_owner', 'public', 'CREATE')
), 'privileged RPCs use a non-login owner with only scoped database grants');
select ok((
  select count(*) = 4
  from pg_catalog.pg_proc as p
  where p.oid in (
    'public.create_task(uuid,text,text,uuid)'::regprocedure,
    'public.transition_task_status(uuid,text,text)'::regprocedure,
    'public.delete_task(uuid)'::regprocedure,
    'public.delete_object(uuid)'::regprocedure
  )
    and not exists (
      select 1 from pg_catalog.aclexplode(p.proacl) as acl
      where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    )
), 'PUBLIC has no EXECUTE privilege on privileged RPCs');
select ok((
  select count(*) = 4
  from pg_catalog.pg_proc as p
  where p.oid in (
    'public.create_task(uuid,text,text,uuid)'::regprocedure,
    'public.transition_task_status(uuid,text,text)'::regprocedure,
    'public.delete_task(uuid)'::regprocedure,
    'public.delete_object(uuid)'::regprocedure
  )
    and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
), 'only authenticated can execute privileged RPCs');
select ok(
  not pg_catalog.has_table_privilege('service_role', 'public.profiles', 'SELECT')
  and not pg_catalog.has_table_privilege('service_role', 'public.objects', 'INSERT')
  and not pg_catalog.has_table_privilege('service_role', 'public.tasks', 'INSERT')
  and not pg_catalog.has_table_privilege('service_role', 'public.tasks', 'UPDATE')
  and not pg_catalog.has_table_privilege('service_role', 'public.task_status_history', 'INSERT'),
  'service_role has no direct access to CRM tables'
);
select ok((
  select p.prosecdef
    and p.proconfig @> array['search_path=""']
    and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
    and pg_catalog.has_function_privilege('crm_rpc_owner', p.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    and not pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
  from pg_catalog.pg_proc as p
  where p.oid = 'private.current_user_id()'::regprocedure
), 'auth.uid helper only returns the current id to the restricted RPC owner');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::integer from public.tasks), 2, 'executor sees only assigned active tasks');
select is((select count(*)::integer from public.objects), 1, 'executor sees only objects with assigned active tasks');
select ok(not exists (select 1 from public.tasks where id = '30000000-0000-0000-0000-000000000002'), 'executor cannot see another executor task');
select throws_ok($$select public.create_task('20000000-0000-0000-0000-000000000001', 'Forbidden', null, '10000000-0000-0000-0000-000000000002')$$, '42501', 'manager role required', 'executor cannot create tasks');
select lives_ok($$update public.tasks set title = 'Changed' where id = '30000000-0000-0000-0000-000000000001'$$, 'RLS filters executor task edits');
select is((select title from public.tasks where id = '30000000-0000-0000-0000-000000000001'), 'Task A', 'executor cannot edit task title directly');
select lives_ok($$update public.tasks set assignee_id = '10000000-0000-0000-0000-000000000003' where id = '30000000-0000-0000-0000-000000000001'$$, 'RLS filters executor reassignment attempts');
select is((select assignee_id from public.tasks where id = '30000000-0000-0000-0000-000000000001'), '10000000-0000-0000-0000-000000000002'::uuid, 'executor cannot reassign tasks directly');
select throws_ok($$update public.tasks set status = 'accepted' where id = '30000000-0000-0000-0000-000000000001'$$, '42501', 'permission denied for table tasks', 'executor cannot change status directly');
select throws_ok($$update public.profiles set role = 'manager' where id = '10000000-0000-0000-0000-000000000002'$$, '42501', 'permission denied for table profiles', 'executor cannot promote their profile');
select throws_ok($$insert into public.objects (name, address) values ('Forbidden', 'Nowhere')$$, '42501', 'new row violates row-level security policy for table "objects"', 'executor cannot create objects');
select lives_ok($$update public.objects set address = 'Changed' where id = '20000000-0000-0000-0000-000000000001'$$, 'RLS filters executor object edits');
select is((select address from public.objects where id = '20000000-0000-0000-0000-000000000001'), 'Address A', 'executor cannot edit objects');
select throws_ok($$delete from public.objects where id = '20000000-0000-0000-0000-000000000001'$$, '42501', 'permission denied for table objects', 'executor cannot physically delete objects');
select throws_ok($$select public.delete_task('30000000-0000-0000-0000-000000000001')$$, '42501', 'manager role required', 'executor cannot logically delete tasks');
select throws_ok($$select public.delete_object('20000000-0000-0000-0000-000000000001')$$, '42501', 'manager role required', 'executor cannot logically delete objects');
select throws_ok($$insert into public.tasks (object_id, title, assignee_id, author_id) values ('20000000-0000-0000-0000-000000000001', 'Direct insert', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001')$$, '42501', 'permission denied for table tasks', 'executor cannot create tasks directly');
select throws_ok($$insert into public.profiles (id, role, display_name) values ('10000000-0000-0000-0000-000000000004', 'manager', 'Forged')$$, '42501', 'permission denied for table profiles', 'client cannot create profiles');
select throws_ok($$delete from public.profiles where id = '10000000-0000-0000-0000-000000000002'$$, '42501', 'permission denied for table profiles', 'client cannot delete profiles');
select ok(not exists (select 1 from public.task_status_history where task_id = '30000000-0000-0000-0000-000000000002'), 'executor cannot read another task history');
select throws_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000002', 'in_progress', null)$$, '42501', 'task is assigned to another executor', 'executor cannot transition another executor task');
select throws_ok($$insert into public.task_status_history (task_id, actor_id, to_status) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'in_progress')$$, '42501', 'permission denied for table task_status_history', 'client cannot insert status history');
select throws_ok($$update public.task_status_history set comment = 'forged' where task_id = '30000000-0000-0000-0000-000000000001'$$, '42501', 'permission denied for table task_status_history', 'client cannot update status history');
select throws_ok($$delete from public.task_status_history where task_id = '30000000-0000-0000-0000-000000000001'$$, '42501', 'permission denied for table task_status_history', 'client cannot delete status history');
select lives_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000001', 'in_progress', null)$$, 'assigned executor can make a permitted transition');
select lives_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000001', 'in_review', null)$$, 'assigned executor can submit a task for review');

reset role;
select is((select status from public.tasks where id = '30000000-0000-0000-0000-000000000001'), 'in_review', 'permitted transitions update task status');
select is((select count(*)::integer from public.task_status_history where task_id = '30000000-0000-0000-0000-000000000001'), 3, 'each permitted transition adds exactly one history entry');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000002', 'accepted', null)$$, '22023', 'transition is not allowed', 'manager cannot skip the review transition');
select throws_ok($$update public.tasks set status = 'accepted' where id = '30000000-0000-0000-0000-000000000001'$$, '42501', 'permission denied for table tasks', 'manager cannot update status outside the RPC');
select throws_ok($$update public.tasks set assignee_id = '10000000-0000-0000-0000-000000000001' where id = '30000000-0000-0000-0000-000000000001'$$, '23514', 'assignee must have executor role', 'manager cannot assign a task to a non-executor');
select throws_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000003', 'rework', null)$$, '22023', 'comment is required when returning a task for rework', 'returning a task requires a comment');
select throws_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000003', 'rework', '   ')$$, '22023', 'comment is required when returning a task for rework', 'whitespace is not a valid rework comment');
select throws_ok($$select public.create_task('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Missing object', null, '10000000-0000-0000-0000-000000000002')$$, 'P0002', 'active object not found', 'manager cannot create a task on a missing object');
select throws_ok($$select public.create_task('20000000-0000-0000-0000-000000000001', 'Invalid assignee', null, '10000000-0000-0000-0000-000000000001')$$, '22023', 'assignee must have executor role', 'manager cannot create a task assigned to a non-executor');
select lives_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000001', 'rework', 'Please correct the work')$$, 'manager can return a reviewed task for rework with a comment');

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000001', 'in_progress', null)$$, 'assigned executor can resume a task returned for rework');
select lives_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000001', 'in_review', null)$$, 'assigned executor can resubmit a task after rework');

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000001', 'accepted', null)$$, 'manager can accept a reviewed task');
reset role;
select is((select status from public.tasks where id = '30000000-0000-0000-0000-000000000001'), 'accepted', 'task completes the full permitted transition sequence');
select is((select count(*)::integer from public.task_status_history where task_id = '30000000-0000-0000-0000-000000000001'), 7, 'full transition sequence records every history event');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select pg_catalog.set_config('test.created_task_id', public.create_task('20000000-0000-0000-0000-000000000001', 'Created by RPC', 'Description', '10000000-0000-0000-0000-000000000002')::text, true)$$, 'manager creates task through RPC');
select ok((select status = 'new' and author_id = '10000000-0000-0000-0000-000000000001' from public.tasks where id = pg_catalog.current_setting('test.created_task_id')::uuid), 'RPC creates a new task with author from auth.uid()');
select is((select count(*)::integer from public.task_status_history where task_id = pg_catalog.current_setting('test.created_task_id')::uuid), 1, 'task creation writes one initial history row');
select ok((select from_status is null and to_status = 'new' and actor_id = '10000000-0000-0000-0000-000000000001' from public.task_status_history where task_id = pg_catalog.current_setting('test.created_task_id')::uuid), 'initial history records null to new and the manager actor');
select lives_ok($$update public.tasks set title = 'Manager edit' where id = pg_catalog.current_setting('test.created_task_id')::uuid$$, 'manager can edit an allowed task field');
select lives_ok($$insert into public.objects (name, address) values ('Manager object', 'Manager address')$$, 'manager can create an object');
select lives_ok($$update public.objects set address = 'Updated address' where id = '20000000-0000-0000-0000-000000000002'$$, 'manager can edit an object');
select lives_ok($$select public.delete_task('30000000-0000-0000-0000-000000000002')$$, 'manager can logically delete a task');
select throws_ok($$delete from public.tasks where id = '30000000-0000-0000-0000-000000000002'$$, '42501', 'permission denied for table tasks', 'manager cannot physically delete a task');
select throws_ok($$delete from public.objects where id = '20000000-0000-0000-0000-000000000001'$$, '42501', 'permission denied for table objects', 'client cannot physically delete an object');
select lives_ok($$select public.delete_object('20000000-0000-0000-0000-000000000001')$$, 'manager can logically delete an object');

reset role;
select ok((select deleted_at is not null from public.tasks where id = '30000000-0000-0000-0000-000000000002'), 'logical task deletion sets deleted_at');
select is((select count(*)::integer from public.task_status_history where task_id = '30000000-0000-0000-0000-000000000002'), 1, 'logical task deletion preserves history');
select throws_ok($$select public.transition_task_status('30000000-0000-0000-0000-000000000002', 'in_progress', null)$$, 'P0002', 'active task not found', 'deleted task cannot transition');
select ok((select deleted_at is not null from public.objects where id = '20000000-0000-0000-0000-000000000001'), 'logical object deletion sets deleted_at');
select is((select count(*)::integer from public.tasks where object_id = '20000000-0000-0000-0000-000000000001' and deleted_at is not null), 3, 'object deletion logically deletes all active child tasks');
select is((select count(*)::integer from public.task_status_history h join public.tasks t on t.id = h.task_id where t.object_id = '20000000-0000-0000-0000-000000000001'), 9, 'object deletion preserves all child task history');

set local role anon;
select throws_ok($$select * from public.objects$$, '42501', 'permission denied for table objects', 'anonymous users cannot read CRM objects');

select * from finish();
rollback;
