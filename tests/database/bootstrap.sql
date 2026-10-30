-- Minimal Supabase Auth contract, only in an empty disposable PostgreSQL cluster.
create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(auth.jwt()->>'sub', '')::uuid $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated;
-- The owner's literal UUID is the policy contract; these are dummy local rows.
insert into auth.users values ('30485ccc-d3cf-4618-b78f-d864368baf35'),
 ('00000000-0000-0000-0000-000000000002');
