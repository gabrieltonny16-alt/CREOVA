create schema if not exists private;

create or replace function private.validate_iteration_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_iteration_id is not null and not exists (
    select 1 from public.iterations parent
    where parent.id = new.parent_iteration_id
      and parent.anchor_id = new.anchor_id
  ) then
    raise exception 'Parent iteration must belong to the same Anchor';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_iteration_parent() from public, anon, authenticated;

drop trigger if exists validate_iteration_parent_before_write on public.iterations;
create trigger validate_iteration_parent_before_write
before insert or update of anchor_id, parent_iteration_id on public.iterations
for each row execute function private.validate_iteration_parent();

drop policy if exists "Users create valid iterations" on public.iterations;
drop policy if exists "Creators update their iterations" on public.iterations;

create policy "Users create valid iterations" on public.iterations
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and exists (
      select 1 from public.anchors a
      where a.id = iterations.anchor_id and a.status = 'active'
    )
  );

create policy "Creators update their iterations" on public.iterations
  for update to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));
