revoke all on public.comment_reactions from anon, authenticated;
grant select, insert, delete on public.comment_reactions to authenticated;
grant update (reaction_type, updated_at) on public.comment_reactions to authenticated;

drop policy if exists comment_reactions_update_self_visible on public.comment_reactions;
create policy comment_reactions_update_self_visible
on public.comment_reactions for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.post_comments c
    where c.id = comment_reactions.comment_id
  )
)
with check (
  user_id = (select auth.uid())
  and reaction_type in ('like', 'love', 'laugh', 'wow', 'sad', 'angry')
  and exists (
    select 1 from public.post_comments c
    where c.id = comment_reactions.comment_id
  )
);