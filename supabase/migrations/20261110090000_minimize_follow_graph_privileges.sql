-- Keep follow requests limited to the operations used by the app.
-- Status is the only mutable column; no user should be able to TRUNCATE the graph.

revoke all privileges on table public.user_follows from anon, authenticated;

grant select, insert, delete on public.user_follows to authenticated;
grant update (status) on public.user_follows to authenticated;
