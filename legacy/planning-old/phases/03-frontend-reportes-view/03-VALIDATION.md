---
phase: 03
slug: frontend-reportes-view
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-04
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual UI testing — No automated test framework for GAS HTML Service |
| **Config file** | None |
| **Quick run command** | Manual: open Reportes view, check console for errors |
| **Full suite command** | Manual checklist of UI-01 through UI-11 |
| **Estimated runtime** | ~5 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual smoke test (open Reportes view, verify no console errors)
- **After every plan wave:** Manual checklist of all 11 UI requirements
- **Before `/gsd:verify-work`:** Full manual test pass
- **Max feedback latency:** ~60 seconds (deploy + refresh)

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Test Instructions | Status |
|--------|----------|-----------|-------------------|--------|
| UI-01 | "Reportes" nav visible only to ADMIN | manual | Login as SDR → no "Reportes". Login as ADMIN → "Reportes" visible | ⬜ pending |
| UI-02 | Date range picker filters report data | manual | Select range → verify comparison period label → verify getSDRReport called with correct dates | ⬜ pending |
| UI-03 | Embudo General table: 13 metrics x 3 segments | manual | Open Embudo General → count rows (13) and column groups (3) | ⬜ pending |
| UI-04 | Incontactables table renders | manual | Open Incontactables → verify 3 rows (Duplicado, Equivocado, SPAM) | ⬜ pending |
| UI-05 | Cross Selling table renders | manual | Open Cross Selling → verify data present | ⬜ pending |
| UI-06 | Semaforo Contesto grid (channels x toques) | manual | Open section → verify grid layout (3 channels x 3-4 toques) | ⬜ pending |
| UI-07 | Semaforo No Contesto grid | manual | Open section → verify grid (2 channels x 3 toques) | ⬜ pending |
| UI-08 | Sin Respuesta 6to Toque table | manual | Open section → verify data | ⬜ pending |
| UI-09 | Por que no paso a Ventas (6 reasons) | manual | Open section → count rows | ⬜ pending |
| UI-10 | Por que perdio la venta (13 reasons) | manual | Open section → count rows | ⬜ pending |
| UI-11 | Loading indicator + cancel button | manual | Click Generate → verify spinner → click Cancel → verify stop | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Manual test checklist document — covers UI-01 through UI-11
- [ ] Browser DevTools console error monitoring

*Note: GAS HTML Service apps cannot be unit tested due to google.script.run dependency. Manual testing is standard practice.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All UI rendering | UI-01 to UI-11 | GAS HTML Service has no automated test harness | Deploy via clasp, open web app, visual inspection |
| Date picker interaction | UI-02 | Flatpickr requires DOM interaction | Click date inputs, verify calendar popup, select range |
| Role-based visibility | UI-01 | Requires different user sessions | Login as SDR (no Reportes), login as ADMIN (Reportes visible) |

---

## Validation Sign-Off

- [x] All tasks have manual verify instructions
- [x] Sampling continuity: manual smoke test after every task
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
