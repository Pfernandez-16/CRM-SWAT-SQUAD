---
phase: 3
slug: toques-semaforos-razones
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 3 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser smoke tests + grep (GAS/CDN) |
| **Quick run command** | grep checks on App.html / Index.html |
| **Full suite command** | Full checklist below |
| **Estimated runtime** | ~5 minutes manual |

## Per-Task Verification Map

| Task ID | Plan | Req | Test Type | Verify Command | Status |
|---------|------|-----|-----------|----------------|--------|
| 3-01-01 | 03-01 | TOQUES-01..02 | auto | `grep -n "matrizContactabilidadRows" App.html` | ⬜ pending |
| 3-01-02 | 03-01 | TOQUES-03..04 | auto | `grep -n "semaforoContestoRows\|semaforoNoContestoRows" App.html` | ⬜ pending |
| 3-01-03 | 03-01 | TOQUES-05 | auto | `grep -n "sinRespuestaRows" App.html` | ⬜ pending |
| 3-02-01 | 03-02 | RAZNES-01..03 | auto | `grep -n "noPasoVentasRows" App.html` | ⬜ pending |
| 3-02-02 | 03-02 | RAZPERD-01..03 | auto | `grep -n "perdioVentaRows" App.html` | ⬜ pending |
| 3-02-03 | 03-02 | All | manual | Browser: all 6 sections render with real data | ⬜ pending |
| 3-03-01 | 03-03 | RAZNES-02 | auto | `grep -n "Math.min" App.html` — mixPct cap | ⬜ pending |

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toques matrix vertical (rows=toques, cols=products) | TOQUES-01 | Requires live data | Open Reportes, find Contactabilidad table, verify rows are Toque1..10 |
| Semáforo Contesto: 3 channels × toques | TOQUES-03 | Requires live data | Verify Telefono(3), WhatsApp(3), Correo(4) rows |
| Semáforo No Contesto: 2 channels only | TOQUES-04 | Requires live data | Verify no Correo row in No Contesto grid |
| Sin Respuesta 6to Toque indicator | TOQUES-05 | Requires live data | Verify count displays for 6+ toque leads |
| Razones % representatividad (base 100) | RAZNES-02 | Requires data | Verify % bars sum to ~100% |
| Razones delta % vs period | RAZNES-03 | Requires two periods | Change period, verify delta updates |

## Wave 0 Requirements

None — existing infrastructure covers all phase requirements.

## Validation Sign-Off

- [ ] All 6 section computeds confirmed in App.html
- [ ] mixPct cap (Math.min 100) applied
- [ ] Browser: all 6 table sections render
- [ ] `nyquist_compliant: true` set when all checks pass

**Approval:** pending
