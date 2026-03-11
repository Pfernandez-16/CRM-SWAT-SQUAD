---
phase: 1
slug: scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser smoke tests (no test framework available in GAS environment) |
| **Config file** | none — GAS deployment, no local test runner |
| **Quick run command** | Open deployed GAS web app URL in browser, navigate to Reportes |
| **Full suite command** | Full smoke test checklist below |
| **Estimated runtime** | ~3 minutes manual |

---

## Sampling Rate

- **After every task commit:** Visual check in deployed app (or clasp push + browser verify)
- **After every plan wave:** Full manual smoke test checklist
- **Before `/gsd:verify-work`:** All manual checklist items must pass
- **Max feedback latency:** ~5 minutes (clasp push + reload)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01-01 | 1 | PERIOD-01 | manual | Navigate to Reportes tab in browser | ✅ App.html | ⬜ pending |
| 1-01-02 | 01-01 | 1 | PERIOD-01 | manual | Verify nav item visible for correct roles | ✅ App.html | ⬜ pending |
| 1-02-01 | 01-02 | 2 | PERIOD-02 | manual | Set date range, verify selector state | ✅ App.html | ⬜ pending |
| 1-02-02 | 01-02 | 2 | PERIOD-02 | manual | Select compareType, verify label updates | ✅ App.html | ⬜ pending |
| 1-02-03 | 01-02 | 2 | PERIOD-03 | manual | Change period, verify report data updates | ✅ App.html | ⬜ pending |
| 1-02-04 | 01-02 | 2 | PERIOD-03 | manual | Verify loading spinner appears/disappears | ✅ App.html | ⬜ pending |
| 1-02-05 | 01-02 | 2 | PERIOD-03 | manual | Simulate backend error, verify error state | ✅ App.html | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No automated test framework to install — GAS environment does not support local runners.

*Existing infrastructure covers all phase requirements via manual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reportes tab visible in nav | PERIOD-01 | GAS SPA — no headless browser | Open app, check nav bar shows "Reportes" item |
| Clicking Reportes loads view without page reload | PERIOD-01 | SPA navigation | Click Reportes, verify URL doesn't change, view renders |
| Date range picker works | PERIOD-02 | flatpickr UI | Set start and end date, verify dates stored in reactive state |
| Compare type selector updates label | PERIOD-02 | Vue reactivity | Switch between "período anterior" / "año anterior", verify comparisonLabel shows correct dates |
| Period change triggers auto-refresh | PERIOD-03 | watch() behavior | Change compare type or date, verify generateReport() fires |
| Loading indicator visible during API call | PERIOD-03 | GAS cold start | Click generate, verify spinner shows for 1-5 seconds |
| Error state shown on API failure | PERIOD-03 | withFailureHandler | Force error (wrong date format), verify error message renders |

---

## Validation Sign-Off

- [ ] All tasks have manual verify steps documented
- [ ] Sampling continuity: each task has clear manual check
- [ ] No automated commands to install (GAS limitation accepted)
- [ ] Feedback latency < 5 min (clasp push cycle)
- [ ] `nyquist_compliant: true` set in frontmatter when all checks pass

**Approval:** pending
