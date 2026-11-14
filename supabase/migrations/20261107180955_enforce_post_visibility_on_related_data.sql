-- Enforce the same post-visibility rules on media metadata, storage objects,
-- likes and comments. This prevents private-post metadata or files being exposed
-- through related-table policies.

drop policy if exists "post_media_select_visible" on public.post_media;
create policy "post_media_select_visible"
on public.post_media for select to authenticated
using (
  exists (
    select 1
    from public.posts parent
    join public.profiles author on author.id = parent.author_id
    where parent.id = post_media.post_id
      and (
        parent.author_id = (select auth.uid())
        or (
          author.is_private = false
          and parent.visibility = 'public'
        )
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

drop policy if exists "post_likes_select_visible" on public.post_likes;
create policy "post_likes_select_visible"
on public.post_likes for select to authenticated
using (
  exists (
    select 1
    from public.posts parent
    join public.profiles author on author.id = parent.author_id
    where parent.id = post_likes.post_id
      and (
        parent.author_id = (select auth.uid())
        or (author.is_private = false and parent.visibility = 'public')
        or exists (
          select 1 from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = parent.author_id
            and relation.status = 'accepted'
        )
      )
  )
);

drop policy if exists "post_comments_select_visible" on public.post_comments;
create policy "post_comments_select_visible"
on public.post_comments for select to authenticated
using (
  exists (
    select 1
    from public.posts parent
    join public.profiles author on author.id = parent.author_id
    where parent.id = post_comments.post_id
      and (
        parent.author_id = (select auth.uid())
        or (author.is_private = false and parent.visibility = 'public')
        or exists (
          select 1 from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = parent.author_id
            and relation.status = 'accepted'
        )
      )
  )
);

drop policy if exists "creova_media_read_visible_post" on storage.objects;
create policy "creova_media_read_visible_post"
on storage.objects for select to authenticated
using (
  bucket_id = 'creova-media'
  and exists (
    select 1
    from public.post_media media
    join public.posts parent on parent.id = media.post_id
    join public.profiles author on author.id = parent.author_id
    where media.object_path = storage.objects.name
      and (
        parent.author_id = (select auth.uid())
        or (author.is_private = false and parent.visibility = 'public')
        or exists (
          select 1 from public.user_follows relation
          where relation.follower_id = (select auth.uid())
            and relation.following_id = parent.author_id
            and relation.status = 'accepted'
        )
      )
  )
);
