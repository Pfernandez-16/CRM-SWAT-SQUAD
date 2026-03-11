---
phase: 2
slug: funnel-incontactables-cross-selling
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
audited: 2026-03-11
---

# Phase 2 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser smoke tests (GAS/CDN — no test runner) |
| **Quick run command** | clasp push && open app in browser, navigate to Reportes |
| **Full suite command** | Full checklist below |
| **Estimated runtime** | ~5 minutes manual |

## Per-Task Verification Map

| Task ID | Plan | Req | Test Type | Verify Command | Status |
|---------|------|-----|-----------|----------------|--------|
| 2-01-01 | 02-01 | FUNNEL-06 | auto | `grep -n "prevCount" App.html` — confirms CVR fix | ✅ pass |
| 2-01-02 | 02-01 | FUNNEL-01..08 | manual | All 13 embudo rows visible, CVR column non-zero | ✅ approved |
| 2-02-01 | 02-02 | INCONT-01..03 | manual | 3 incontactables rows with Mfg/Ind + delta | ✅ approved |
| 2-02-02 | 02-02 | CROSS-01 | manual | Cross-selling row with Mfg/Ind + delta | ✅ approved |

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 13 Embudo rows render | FUNNEL-01..05 | GAS SPA | Open Reportes, generate report, count rows |
| CVR column shows non-zero ratios | FUNNEL-06 | Requires live data | Check "Deals Cerrados" CVR is not 0.0% |
| Delta arrows show ↑↓ correctly | FUNNEL-07 | Requires two periods | Change period, verify delta arrows update |
| Mfg/Ind columns populated | FUNNEL-08 | Requires data | Check both segment columns have values |
| Incontactables 3 rows visible | INCONT-01..03 | GAS SPA | Duplicado/Equivocado/Spam rows present |
| Cross-selling row visible | CROSS-01 | GAS SPA | Cross-Selling count with breakdown |
| Tables update on period change | All | Reactivity | Change date range, all tables refresh |

## Wave 0 Requirements

None — existing infrastructure covers all phase requirements.

## Validation Sign-Off

- [x] CVR fix verified by grep — prevCountRow on 3 lines, rawRows[i-1].metric: 0 hits
- [x] All tables render with real data — user approved
- [x] Period change triggers table updates — user approved
- [x] `nyquist_compliant: true` set when all checks pass

**Approval:** approved (2026-03-11)

## Grep Audit Results (02-02 Task 1)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `grep -n "prevCountRow" App.html` | 2+ hits | 3 hits (lines 204, 206, 208) | PASS |
| `grep -n "Con Interés" App.html` | 1 hit | 1 hit (line 190) | PASS |
| `grep -n "rawRows\[i - 1\]\.metric" App.html` | 0 hits | 0 hits | PASS |
| `grep -n "embudoRows, incontactablesRows, crossSellingRows" App.html` | 1 hit | 1 hit (line 2042) | PASS |
| `grep -n "section.id" Index.html` (3 tables) | 3 hits | 3 hits (lines 436, 574, 703) | PASS |
