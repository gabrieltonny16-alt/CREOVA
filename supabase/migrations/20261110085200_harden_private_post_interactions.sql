-- Make write permissions follow the same visibility rules as post reads.
-- A user must be able to view a post before liking or commenting on it.
-- Comment edits must also remain attached to a post the editor can currently view.

drop policy if exists "post_likes_insert_self" on public.post_likes;
create policy "post_likes_insert_self"
on public.post_likes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts parent
    join public.profiles author on author.id = parent.author_id
    where parent.id = post_likes.post_id
      and (
        parent.author_id = (select auth.uid())
        or (author.is_private = false and parent.visibility = 'public')
        or exists (
          select 1
          from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = parent.author_id
            and relation.status = 'accepted'
        )
      )
  )
);

drop policy if exists "post_comments_insert_self" on public.post_comments;
create policy "post_comments_insert_self"
on public.post_comments for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts parent
    join public.profiles author on author.id = parent.author_id
    where parent.id = post_comments.post_id
      and (
        parent.author_id = (select auth.uid())
        or (author.is_private = false and parent.visibility = 'public')
        or exists (
          select 1
          from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = parent.author_id
            and relation.status = 'accepted'
        )
      )
  )
);

drop policy if exists "post_comments_update_self" on public.post_comments;
create policy "post_comments_update_self"
on public.post_comments for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts parent
    join public.profiles author on author.id = parent.author_id
    where parent.id = post_comments.post_id
      and (
        parent.author_id = (select auth.uid())
        or (author.is_private = false and parent.visibility = 'public')
        or exists (
          select 1
          from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = parent.author_id
            and relation.status = 'accepted'
        )
      )
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts parent
    join public.profiles author on author.id = parent.author_id
    where parent.id = post_comments.post_id
      and (
        parent.author_id = (select auth.uid())
        or (author.is_private = false and parent.visibility = 'public')
        or exists (
          select 1
          from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = parent.author_id
            and relation.status = 'accepted'
        )
      )
  )
);
