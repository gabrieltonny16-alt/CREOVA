-- Store story video duration so the viewer can advance at the correct time.
alter table public.stories
  add column if not exists duration_seconds numeric(6,2);

alter table public.stories
  drop constraint if exists stories_duration_seconds_check;

alter table public.stories
  add constraint stories_duration_seconds_check
  check (
    (media_type = 'image' and duration_seconds is null)
    or (
      media_type = 'video'
      and (duration_seconds is null or duration_seconds between 0.1 and 30)
    )
  );
