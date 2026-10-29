# FRE-16: Orbit theme support

The approved Linear issue is the specification: Light, Dark, System; default System; persistent browser choice; all login/dashboard surfaces; responsive and readable; existing authentication and card operations preserved. Delivery is a tested feature branch and PR; no merge or production deployment.

Use next-themes to apply a root `data-theme` attribute before hydration, persist the preference as `orbit-theme`, and follow live OS changes. A labelled native theme select belongs in the login header and dashboard topbar so keyboard and touch users can reach it. The component must render stable server markup, then synchronize after mount. Preserve the green Orbit identity with a charcoal/green dark palette.

Approaches: next-themes handles system changes, storage, synchronization and first-paint initialization without duplicating that machinery. A bespoke provider would add maintenance and edge cases with no user benefit. All routine presentation choices here are implementer decisions under the user's explicit request to implement FRE-16.

Scope: theme provider, selector, layout integration, scoped dark CSS palette, and browser regression tests. No Supabase schema/policy changes or credential changes. Keep existing light styles intact. Prefer a dedicated dark-theme stylesheet to recoloring the entire compressed original CSS, with explicit surface/text/accent groups.

Verification: real Chromium with a local app and intercepted Supabase API fixtures; no live user credentials, no production data writes. Check system default and live changes, manual override, reload persistence, cross-tab changes, unavailable storage, early first-paint theme, desktop/mobile overflow and keyboard use, both dialogs, login and card operations in both themes. Run TypeScript and a production build. Document actual limitations. Update Linear to In Review with PR URL after verification.
