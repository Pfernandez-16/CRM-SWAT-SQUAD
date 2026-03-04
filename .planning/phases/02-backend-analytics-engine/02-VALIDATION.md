---
phase: 02
slug: backend-analytics-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual Testing + Logger validation (GAS has no native test runner) |
| **Config file** | None — GAS executes in cloud environment |
| **Quick run command** | `clasp run getSDRReport` with sample dates, verify no errors in Logs |
| **Full suite command** | Manual: Open Script Editor → Run → getSDRReport → View Logs → Compare against reference |
| **Estimated runtime** | ~30 seconds per manual test cycle |

---

## Sampling Rate

- **After every task commit:** Manual smoke test — call `getSDRReport()` with sample dates, verify no errors, spot-check 2-3 metric values
- **After every plan wave:** Full manual validation — compare ALL metrics against reference "Reporte SS.xlsx" for same date range
- **Before `/gsd:verify-work`:** Full validation green + performance test (execution completes in <30 seconds for 2000 leads)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | ANLYT-01 | smoke | `clasp status` (verify Analytics.js in file list) | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | ANLYT-02 | unit | Manual: call getSDRReport(), verify JSON has 8 sections | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | ANLYT-03 | unit | Manual: test boundary dates (on dateIn, before dateIn, after dateOut) | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | ANLYT-04 | unit | Manual: verify sum(segments) = total for each metric | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | ANLYT-05 | unit | Manual: test delta with known values (prev=100, curr=150 → delta=50%) | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 1 | ANLYT-06 | integration | Manual: compare Embudo output to reference report for sample leads | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 1 | ANLYT-07 | unit | Manual: filter fact_leads by Duplicado/Equivocado/SPAM, verify count | ❌ W0 | ⬜ pending |
| 02-01-08 | 01 | 1 | ANLYT-08 | unit | Manual: verify cross-selling identification logic | ❌ W0 | ⬜ pending |
| 02-01-09 | 01 | 1 | ANLYT-09 | unit | Manual: verify Contestó counting by tipo_interaccion + toque (9 buckets) | ❌ W0 | ⬜ pending |
| 02-01-10 | 01 | 1 | ANLYT-10 | unit | Manual: verify No Contestó counting (6 buckets) | ❌ W0 | ⬜ pending |
| 02-01-11 | 01 | 1 | ANLYT-11 | unit | Manual: verify leads with 6+ toques and no Contestó | ❌ W0 | ⬜ pending |
| 02-01-12 | 01 | 1 | ANLYT-12 | integration | Manual: verify reason counts sum to total descartados | ❌ W0 | ⬜ pending |
| 02-01-13 | 01 | 1 | ANLYT-13 | integration | Manual: verify reason counts match deal records | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `testPerformance()` function in Analytics.js — measures execution time, logs results
- [ ] Reference comparison data — extract key metrics from "Reporte SS.xlsx" as expected values

*Note: GAS lacks native automated testing. Wave 0 creates logging/validation helpers, not a test suite.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Analytics.js deploys via clasp | ANLYT-01 | Requires GAS deployment | Run `clasp push`, verify file appears in Script Editor |
| getSDRReport returns complete JSON | ANLYT-02 | Requires GAS runtime | Open Script Editor → Run → getSDRReport('2024-01-01','2024-12-31') → View Logs |
| Date boundaries correct | ANLYT-03 | Requires real data | Test with known lead dates, verify inclusion/exclusion |
| Segmentation sums to total | ANLYT-04 | Requires real data | Sum Manufacturers + Individuals for each metric, compare to Total |
| Delta calculation correct | ANLYT-05 | Requires two period comparison | Run for known period, manually calculate expected delta |
| All 8 sections populated | ANLYT-06-13 | Requires real data + reference | Compare each section against Reporte SS.xlsx for same date range |
| Performance under 30s for 2000 leads | SC-5 | Requires load testing | Run testPerformance() with production data |

---

## Validation Sign-Off

- [ ] All tasks have manual verify or Wave 0 dependencies
- [ ] Sampling continuity: every section validated against reference report
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
