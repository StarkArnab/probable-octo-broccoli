# FRE-16 Implementation Plan

Goal: Deliver the approved Light/Dark/System behavior on a PR.
Architecture: next-themes provider in the root layout; one reusable native theme select; scoped CSS dark palette. No backend changes.
Spec: ../specs/2026-10-30-fre-16-theme-design.md

- [x] Add Playwright regression tests and observe failures for absent selector/theme behavior.
- [x] Implement provider and selector, root setup, and login/dashboard integration.
- [x] Add complete dark palette plus responsive selector styling, preserving light styles.
- [x] Verify system changes, overrides, persistence, cross-tab/storage restrictions, first paint, contrast, responsive layouts, login/card flows with isolated API fixtures.
- [ ] Run typecheck/build and inspect diff; commit and push feature branch; open PR and update Linear to In Review.

Global constraints: no production deployment or merge, no production-data writes, no service credentials in tests.
Review focus: hydration mismatch, first-frame light flash, restricted browser storage, system changes after override, mobile toolbar overflow, theme changes resetting unsaved form state.
