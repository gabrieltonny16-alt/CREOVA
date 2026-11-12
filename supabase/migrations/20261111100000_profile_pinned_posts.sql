-- CREOVA profile pinning. Additive and safe for existing posts.
alter table public.posts
  add column if not exists is_pinned boolean not null default false;

create index if not exists posts_author_pinned_created_idx
  on public.posts (author_id, is_pinned desc, created_at desc);

create or replace function public.set_post_pin(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_author_id uuid;
  v_pinned_count integer;
begin
  if v_user_id is null then
    raise exception 'You must be signed in to pin posts.';
  end if;

  -- Serialize pin changes per account so concurrent requests cannot exceed three.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select author_id into v_author_id
  from public.posts
  where id = p_post_id;

  if v_author_id is null or v_author_id <> v_user_id then
    raise exception 'You can only pin your own posts.';
  end if;

  if p_pinned then
    select count(*) into v_pinned_count
    from public.posts
    where author_id = v_user_id and is_pinned = true and id <> p_post_id;

    if v_pinned_count >= 3 then
      raise exception 'You can pin up to three posts. Unpin one before pinning another.';
    end if;
  end if;

  update public.posts set is_pinned = p_pinned, updated_at = now()
  where id = p_post_id and author_id = v_user_id;
end;
$$;

revoke all on function public.set_post_pin(uuid, boolean) from public, anon;
grant execute on function public.set_post_pin(uuid, boolean) to authenticated;
