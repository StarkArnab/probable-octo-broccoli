<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Security audits

When asked to audit this repository or perform a security review, read
`.agents/skills/security-audit/SKILL.md` and follow its applicable workflow.
Orbit has no `src/` directory: application source is in `app/` and `lib/`;
authorization also depends on `supabase/migrations/`. Include these boundaries
when auditing the application. Write audit artifacts outside the repository
(default requested location: `~/audits/my-project`; use a new run subdirectory
if a prior report exists). Never commit sensitive reports into this public repo.
Use read-only source analysis when the skill's complete sandbox requirements
cannot be enforced. Do not probe the deployed app or live Supabase resources.

## Code Review Rules

- Check every Supabase read/write against both row ownership and the fixed owner
  UUID in the latest SQL policies. Client-side guards are not authorization.
- Preserve the composite `(board_id, user_id)` foreign key and RLS `USING` and
  `WITH CHECK` protections. Never expose service-role or secret keys to clients.
- Trace untrusted card/board text to rendering sinks; keep React escaping intact.
- Check session/logout/error paths and distinguish mocked UI tests from real
  database-policy tests. Report unverified deployment controls explicitly.
- Review the exact PR head SHA. Use an independent review subagent when the host
  supports it; never claim independent review if that capability is unavailable.
- Return actionable findings with file/line evidence. Do not merge, promote, or
  change production as part of a review.
