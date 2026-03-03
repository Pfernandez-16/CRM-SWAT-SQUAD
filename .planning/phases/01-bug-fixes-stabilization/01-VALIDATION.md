---
phase: 1
slug: bug-fixes-stabilization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (no automated test framework — Google Apps Script) |
| **Config file** | None — GAS lacks native test infrastructure |
| **Quick run command** | N/A — manual testing via CRM UI |
| **Full suite command** | N/A — manual testing via CRM UI |
| **Estimated runtime** | ~5 minutes per manual test cycle |

---

## Sampling Rate

- **After every task commit:** Developer manually tests affected behavior before committing
- **After every plan wave:** Full manual test suite (all 4 scenarios) before marking wave complete
- **Before `/gsd:verify-work`:** Complete manual verification checklist must be green
- **Max feedback latency:** N/A (manual testing)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | BUG-01 | manual | N/A | N/A | ⬜ pending |
| TBD | 01 | 1 | BUG-01 | manual | N/A | N/A | ⬜ pending |
| TBD | 02 | 1 | BUG-02 | manual | N/A | N/A | ⬜ pending |
| TBD | 02 | 1 | BUG-02 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Document manual test procedures (verification queries in Apps Script)
- [ ] Capture baseline screenshots/data dumps of current buggy behavior
- [ ] Create verification helper function `verifyCalificacion()` in Apps Script

*Existing infrastructure covers automated testing — manual procedures needed for GAS environment.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BANT fields persist after save & reload | BUG-01 | GAS requires runtime execution against Sheets; no mock available | 1. Fill BANT fields in Calificacion tab 2. Save & reload 3. Verify fields display saved values 4. Check fact_calificacion sheet |
| Toques de Contactacion persists | BUG-01 | Same GAS limitation | 1. Edit Toques field 2. Save 3. Verify fact_leads.numero_toques updated |
| AE cross_lead saves to fact_leads | BUG-02 | Requires multi-role scenario in live environment | 1. As SDR, move lead to Calificado 2. As AE, open cross_lead and edit 3. Verify fact_leads updated, NOT fact_deals |
| AE own deal saves to fact_deals (regression) | BUG-02 | Same multi-role requirement | 1. As AE, open own deal 2. Edit and save 3. Verify fact_deals updated correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency documented
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
