create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'crm_rpc_owner'
  ) then
    create role crm_rpc_owner;
  end if;
  alter role crm_rpc_owner nologin bypassrls;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('manager', 'executor')),
  display_name text not null
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  address text not null,
  deleted_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  description text not null default '',
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'in_review', 'accepted', 'rework')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  from_status text check (from_status is null or from_status in ('new', 'in_progress', 'in_review', 'accepted', 'rework')),
  to_status text not null check (to_status in ('new', 'in_progress', 'in_review', 'accepted', 'rework')),
  comment text,
  created_at timestamptz not null default now()
);

grant usage on schema public, private to crm_rpc_owner;
grant select on public.profiles, public.objects, public.tasks to crm_rpc_owner;
grant insert on public.tasks, public.task_status_history to crm_rpc_owner;
grant update (status, deleted_at) on public.tasks to crm_rpc_owner;
grant update (deleted_at) on public.objects to crm_rpc_owner;

create index tasks_active_object_idx on public.tasks (object_id) where deleted_at is null;
create index tasks_active_assignee_idx on public.tasks (assignee_id) where deleted_at is null;
create index task_status_history_task_created_idx on public.task_status_history (task_id, created_at, id);

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

create function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid()
$$;

revoke all on function private.current_user_id() from public, anon, authenticated, service_role;
grant execute on function private.current_user_id() to crm_rpc_owner;

create function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select private.current_user_id())
$$;

revoke all on function private.current_role() from public, anon, authenticated, service_role;
grant execute on function private.current_role() to authenticated, crm_rpc_owner;

create function private.enforce_executor_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles as p
    where p.id = new.assignee_id
      and p.role = 'executor'
  ) then
    raise exception 'assignee must have executor role' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_executor_assignee() from public, anon, authenticated, service_role;

create trigger tasks_assignee_must_be_executor
before insert or update of assignee_id on public.tasks
for each row execute function private.enforce_executor_assignee();

revoke all on public.profiles, public.objects, public.tasks, public.task_status_history from public, anon, authenticated, service_role;
grant select on public.profiles, public.objects, public.tasks, public.task_status_history to authenticated;
grant insert (name, address) on public.objects to authenticated;
grant update (name, address) on public.objects to authenticated;
grant update (title, description, assignee_id) on public.tasks to authenticated;

create policy profiles_read_own_or_manager
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.current_role()) = 'manager');

create policy objects_read_active
on public.objects for select to authenticated
using (
  deleted_at is null
  and (
    (select private.current_role()) = 'manager'
    or exists (
      select 1
      from public.tasks as t
      where t.object_id = objects.id
        and t.assignee_id = (select auth.uid())
        and t.deleted_at is null
    )
  )
);

create policy objects_insert_manager
on public.objects for insert to authenticated
with check ((select private.current_role()) = 'manager');

create policy objects_update_manager
on public.objects for update to authenticated
using (deleted_at is null and (select private.current_role()) = 'manager')
with check (deleted_at is null and (select private.current_role()) = 'manager');

create policy tasks_read_active
on public.tasks for select to authenticated
using (
  deleted_at is null
  and (
    (select private.current_role()) = 'manager'
    or assignee_id = (select auth.uid())
  )
);

create policy tasks_update_manager
on public.tasks for update to authenticated
using (deleted_at is null and (select private.current_role()) = 'manager')
with check (deleted_at is null and (select private.current_role()) = 'manager');

create policy task_status_history_read_visible_task
on public.task_status_history for select to authenticated
using (
  exists (
    select 1
    from public.tasks as t
    where t.id = task_status_history.task_id
      and t.deleted_at is null
      and (
        (select private.current_role()) = 'manager'
        or t.assignee_id = (select auth.uid())
      )
  )
);

create function public.create_task(
  p_object_id uuid,
  p_title text,
  p_description text,
  p_assignee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
  v_task_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if private.current_role() is distinct from 'manager' then
    raise exception 'manager role required' using errcode = '42501';
  end if;

  if p_title is null or pg_catalog.btrim(p_title) = '' then
    raise exception 'task title must not be empty' using errcode = '22023';
  end if;

  perform 1
  from public.objects as o
  where o.id = p_object_id
    and o.deleted_at is null
  for update;

  if not found then
    raise exception 'active object not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = p_assignee_id
      and p.role = 'executor'
  ) then
    raise exception 'assignee must have executor role' using errcode = '22023';
  end if;

  insert into public.tasks (object_id, title, description, assignee_id, author_id, status)
  values (p_object_id, p_title, coalesce(p_description, ''), p_assignee_id, v_user_id, 'new')
  returning id into v_task_id;

  insert into public.task_status_history (task_id, actor_id, from_status, to_status)
  values (v_task_id, v_user_id, null, 'new');

  return v_task_id;
end;
$$;

revoke all on function public.create_task(uuid, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.create_task(uuid, text, text, uuid) to authenticated;

create function public.transition_task_status(
  p_task_id uuid,
  p_new_status text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.current_user_id();
  v_role text;
  v_current_status text;
  v_assignee_id uuid;
  v_deleted_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_role := private.current_role();
  if v_role is null then
    raise exception 'profile required' using errcode = '42501';
  end if;

  select t.status, t.assignee_id, t.deleted_at
  into v_current_status, v_assignee_id, v_deleted_at
  from public.tasks as t
  where t.id = p_task_id
  for update;

  if not found or v_deleted_at is not null then
    raise exception 'active task not found' using errcode = 'P0002';
  end if;

  if v_role = 'executor' and v_assignee_id is distinct from v_user_id then
    raise exception 'task is assigned to another executor' using errcode = '42501';
  end if;

  if not (
    (v_role = 'executor'
      and v_assignee_id = v_user_id
      and (
        (v_current_status = 'new' and p_new_status = 'in_progress')
        or (v_current_status = 'in_progress' and p_new_status = 'in_review')
        or (v_current_status = 'rework' and p_new_status = 'in_progress')
      ))
    or (v_role = 'manager'
      and v_current_status = 'in_review'
      and p_new_status in ('accepted', 'rework'))
  ) then
    raise exception 'transition is not allowed' using errcode = '22023';
  end if;

  if p_new_status = 'rework' and (p_comment is null or pg_catalog.btrim(p_comment) = '') then
    raise exception 'comment is required when returning a task for rework' using errcode = '22023';
  end if;

  update public.tasks as t
  set status = p_new_status
  where t.id = p_task_id;

  insert into public.task_status_history (task_id, actor_id, from_status, to_status, comment)
  values (p_task_id, v_user_id, v_current_status, p_new_status, p_comment);
end;
$$;

revoke all on function public.transition_task_status(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.transition_task_status(uuid, text, text) to authenticated;

create function public.delete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_id() is null or private.current_role() is distinct from 'manager' then
    raise exception 'manager role required' using errcode = '42501';
  end if;

  update public.tasks as t
  set deleted_at = pg_catalog.clock_timestamp()
  where t.id = p_task_id
    and t.deleted_at is null;

  if not found then
    raise exception 'active task not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_task(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_task(uuid) to authenticated;

create function public.delete_object(p_object_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamptz := pg_catalog.clock_timestamp();
begin
  if private.current_user_id() is null or private.current_role() is distinct from 'manager' then
    raise exception 'manager role required' using errcode = '42501';
  end if;

  perform 1
  from public.objects as o
  where o.id = p_object_id
    and o.deleted_at is null
  for update;

  if not found then
    raise exception 'active object not found' using errcode = 'P0002';
  end if;

  update public.objects as o
  set deleted_at = v_deleted_at
  where o.id = p_object_id;

  update public.tasks as t
  set deleted_at = v_deleted_at
  where t.object_id = p_object_id
    and t.deleted_at is null;
end;
$$;

revoke all on function public.delete_object(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_object(uuid) to authenticated;

grant create on schema public, private to crm_rpc_owner;
grant crm_rpc_owner to postgres;
alter function private.current_role() owner to crm_rpc_owner;
alter function private.enforce_executor_assignee() owner to crm_rpc_owner;
alter function public.create_task(uuid, text, text, uuid) owner to crm_rpc_owner;
alter function public.transition_task_status(uuid, text, text) owner to crm_rpc_owner;
alter function public.delete_task(uuid) owner to crm_rpc_owner;
alter function public.delete_object(uuid) owner to crm_rpc_owner;
revoke create on schema public, private from crm_rpc_owner;
revoke crm_rpc_owner from postgres;
