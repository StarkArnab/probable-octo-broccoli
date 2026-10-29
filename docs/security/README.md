# Security review workflow

Cloudflare's MIT-licensed audit skill is pinned in `.agents/skills/security-audit`.
Its `UPSTREAM.md` records provenance. Ask the coding agent to read `SKILL.md`, audit
`app/`, `lib/`, and supporting Supabase migrations, and write output outside this
public repository. `./src` does not exist. The skill uses independent hunters,
verifiers and coverage checks; installing it does not start an automatic scan.

Runtime validation is permitted only with the skill's OS-enforced isolation;
otherwise source-grounded unresolved leads remain needs_validation. Do not use
live credentials, deployed services, or provider APIs as audit test targets.

For a pull request, ask for a review of its exact head SHA and scope. General code
review and a full security audit have different costs and deliverables. Keep PR
checks/tests and human approval before production. An automated review is evidence,
not permission to merge. Request independent review agents when available.

## Automatic GitHub reviews

Codex's GitHub review service is separate from this chat. In Codex Cloud settings,
open [Code review](https://chatgpt.com/settings/code-review), select `StarkArnab/probable-octo-broccoli`, enable Automatic
review under Review code, and select the PR trigger/coverage you want. Personal
Automatic review preferences also apply. This repository cannot enable the account
setting by adding files; verify it in the UI. On an existing PR, comment exactly:

```
@codex review
```

For the separate Security Review feature, if available in your account, enable
Auto security review and use its configured trigger, or comment:

```
@codex security review
```

See https://learn.chatgpt.com/docs/third-party/github for current setup and plan
requirements. The root AGENTS.md includes repository-specific review rules and
requests independent subagents where supported. Neither GitHub reviewer assignment
nor installation of this skill guarantees that the native reviewer uses subagents
or runs the full six-phase audit. This chat cannot subscribe itself to every PR.
