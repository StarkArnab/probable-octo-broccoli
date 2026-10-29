# Orbit — personal Kanban

Next.js dashboard with Supabase email and password authentication, owner-restricted database policies, multiple personal boards, draggable cards, priorities, labels, due dates, search, archive, board/list views, and Vercel Analytics.

## Development

Use Node.js 24. `npm ci`, copy `.env.example` to `.env.local` and supply the project URL and publishable key. Run `npm run dev`. Checks: `npm run typecheck` and `npm run build`.

Database migration: `supabase/migrations/202610300001_personal_kanban.sql` (already applied to the connected Kanban project).

## Authentication

The owner user ID in `lib/supabase.ts` matches the confirmed Supabase account ID allowed by the database policies. Changing the account email does not change access. Changing owners requires updating both. Never expose a Supabase service-role key to the browser. Create the owner account in Supabase Authentication → Users → Add user → Create new user, using the owner email and a strong password. Confirm the email during creation. If the account already exists, set its password through Supabase’s account recovery/admin flow. Sign in at the deployed URL using that email and password. Do not send passwords through chat or commit them. Password recovery is managed through Supabase; the app does not expose public registration.

## Deployment

GitHub `main` deploys to the existing Vercel project. Required public environment variables are listed in `.env.example`. Vercel Analytics is mounted in the root layout. No database secrets are needed by the application.

## Bugs and Linear

Use the connected Freelancing team in Linear for dashboard bugs. Include reproduction steps, expected behavior, actual behavior, and screenshots where useful. Ask Codex in this chat to work on the issue identifier. The app links to Linear; it does not sync private cards to Linear.

Unattended Linear issue → Codex fix → review → production deployment is not enabled by connecting these accounts. It requires an authorized event-triggered runner and model credentials/budget. Until configured, request a fix in Codex; pushes to main trigger Vercel deployment.
