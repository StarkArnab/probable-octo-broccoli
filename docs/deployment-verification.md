# Owner deployment verification

This checklist is for the project owner through normal Supabase/Vercel administration. Local tests do not establish deployed policy state. Do not use production records as attack fixtures, change production policies/grants, or run adversarial requests against the live application.

## Migration and database state (FRE-18)

- Confirm deployment migration history includes **both**, in order:
  1. `202610300001_personal_kanban.sql`
  2. `202610300002_bind_owner_user_id.sql`
- In Supabase's normal administration UI, compare the migration history, boards/cards RLS switches, policies, and grants with the two source migrations. Migration 002 replaces the email predicate with the fixed owner UUID. Both policy `USING` and `WITH CHECK` must bind `auth.uid()` to `user_id` and that UUID, with policies scoped to `authenticated`.
- Use the following read-only catalog queries in the normal SQL editor if preferred. Confirm the only applicable policies are the expected owner policies; extra permissive policies can broaden access. Confirm `anon` has no effective table CRUD access, `authenticated` has exactly the intended CRUD grants, and neither application role has superuser/bypass-RLS privileges. Inspect inherited and PUBLIC grants, not only directly named grants.

```sql
select version, name from supabase_migrations.schema_migrations order by version;
select n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('boards','cards');
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname='public' and tablename in ('boards','cards');
select r.role_name, t.table_name, p.privilege,
       has_table_privilege(r.role_name, 'public.' || t.table_name, p.privilege) as effective_grant
from (values ('anon'), ('authenticated')) r(role_name)
cross join (values ('boards'), ('cards')) t(table_name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege);
select rolname, rolsuper, rolbypassrls from pg_roles
where rolname in ('anon','authenticated');
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid in ('public.boards'::regclass,'public.cards'::regclass);
```

- Check the composite foreign key is `(board_id, user_id) → boards(id, user_id)` and auth user references remain in place. Check schema usage and Data API exposed-schema settings through normal administration; table grants and RLS are separate controls.
- Record project/deployment identity, verification date, source commit, migration versions, and any drift. Resolve unexpected state through a separately authorized change. This checklist performs no writes.

## Related framing follow-up (FRE-19)

**NEEDS VALIDATION.** Header inspection and future isolated reproduction are separate from the RLS tests. No complete offline browser/session sandbox or runtime framing validation is supplied by this PR.

- The owner should inspect the effective response headers and Vercel/project configuration through normal administration, including `Content-Security-Policy: frame-ancestors` and `X-Frame-Options`. Record redirects and final-document headers; report-only CSP does not enforce framing restrictions.
- If runtime reproduction is later authorized and a complete offline sandbox exists, use a disposable local app/database with only dummy identities and data, and two genuine distinct sites that both resolve to loopback. Different ports alone establish different origins, not different sites.
- Establish the dummy session only by normal top-level login with browser protections enabled. Attempt framing solely inside this isolated setup. Stop if framing is blocked or storage/cookie partitioning prevents the normal session from being available in the frame; record the limitation and keep the finding NEEDS VALIDATION.
- Do not inject session tokens/cookies, disable browser protections, bypass partitioning, or use a production session/data to force a result. A header observation alone does not prove an authenticated framing exploit.
