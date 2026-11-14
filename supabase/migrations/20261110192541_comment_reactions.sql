create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null default 'like'
    check (reaction_type in ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comment_reactions_one_per_user unique (comment_id, user_id)
);

create index if not exists comment_reactions_comment_id_idx
  on public.comment_reactions (comment_id);

alter table public.comment_reactions enable row level security;

revoke all on public.comment_reactions from anon, authenticated;
grant select, insert, update, delete on public.comment_reactions to authenticated;

drop policy if exists comment_reactions_select_visible on public.comment_reactions;
create policy comment_reactions_select_visible
on public.comment_reactions for select to authenticated
using (
  exists (
    select 1
    from public.post_comments c
    where c.id = comment_reactions.comment_id
  )
);

drop policy if exists comment_reactions_insert_self_visible on public.comment_reactions;
create policy comment_reactions_insert_self_visible
on public.comment_reactions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.post_comments c
    where c.id = comment_reactions.comment_id
  )
);

drop policy if exists comment_reactions_update_self_visible on public.comment_reactions;
create policy comment_reactions_update_self_visible
on public.comment_reactions for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and reaction_type in ('like', 'love', 'laugh', 'wow', 'sad', 'angry')
);

drop policy if exists comment_reactions_delete_self on public.comment_reactions;
create policy comment_reactions_delete_self
on public.comment_reactions for delete to authenticated
using (user_id = (select auth.uid()));

comment on table public.comment_reactions is
  'One reaction per authenticated user per comment; comment visibility is inherited through post_comments RLS.';