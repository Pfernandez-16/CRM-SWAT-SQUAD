---
phase: 1
slug: bug-fixes-stabilization
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-03
updated: 2026-03-04
---

# Phase 1 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Structural grep verification (code-level) + Manual verification (runtime) |
| **Config file** | None -- GAS lacks native test infrastructure |
| **Quick run command** | `grep -c "_FACT_CALIFICACION_" "gas-crm-project/Código.js"` (structural check) |
| **Full suite command** | Run all grep checks from Per-Task Verification Map below |
| **Estimated runtime** | < 10 seconds (grep checks) + ~5 minutes (manual test cycle) |

---

## Sampling Rate

- **After every task commit:** Run automated grep checks from verify sections; developer manually tests affected behavior
- **After every plan wave:** Full grep suite + full manual test suite (all 4 scenarios) before marking wave complete
- **Before `/gsd:verify-work`:** All automated grep checks green + complete manual verification checklist green
- **Max feedback latency:** < 10 seconds for structural checks; ~5 minutes for manual runtime tests

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| Task 1a | 01 | 1 | BUG-01 | structural grep | `grep -c "_FACT_CALIFICACION_" "gas-crm-project/Código.js"` -- must return 9+ (8 BANT mappings + routing branch) | pending |
| Task 1b | 01 | 1 | BUG-01 | structural grep | `grep -c "calificacionUpdates" "gas-crm-project/Código.js"` -- must return 3+ (declaration, collection, write) | pending |
| Task 1c | 01 | 1 | BUG-01 | structural grep | `grep -c "calificacionIdx" "gas-crm-project/Código.js"` -- must return 2+ (creation in getLeads + usage in lead object) | pending |
| Task 1d | 01 | 1 | BUG-01 | structural grep | `grep -c "Toques de Contactación" "gas-crm-project/Código.js"` -- must return 2+ (LEAD_FIELD_MAP entry + lead object field) | pending |
| Task 1e | 01 | 1 | BUG-01 | cross-check | For each BANT field, run `grep -F "{field_name}" "gas-crm-project/Código.js" "gas-crm-project/App.html"` and confirm matches in BOTH files. Fields to check: `¿Entendió la información de Marketing?`, `¿Mostró Interés genuino?`, `¿Cuál es tu necesidad puntual?`, `¿El perfil del prospecto es el adecuado?`, `¿Necesitas tocar base con alguién para decidir la compra?`, `¿Tienes presupuesto asignado para este proyecto, en este año?`, `¿Cuánto?`, `¿han sido parte de alguna asociación de la industria?`, `Toques de Contactación`, `¿En qué toque va?`. Each must appear in both files; single-file match = mismatch = silent runtime failure. | pending |
| Task 2a | 01 | 1 | BUG-02 | structural grep | `grep -c "selectedLead.value._source" gas-crm-project/App.html` -- must return 2+ (updateLeadMultiple call + dataset selection) | pending |
| Task 2b | 01 | 1 | BUG-02 | structural grep | `grep -n "currentView.value === 'negociaciones'" gas-crm-project/App.html` -- must NOT appear in saveLeadChanges (lines ~454-542). Lines 108, 113, 119 are acceptable (view filtering logic). | pending |
| Task 2c | 01 | 1 | BUG-02 | structural grep | `grep -n "userRole.value === 'AE'" gas-crm-project/App.html` -- must NOT appear inside saveLeadChanges (lines ~454-542). May appear elsewhere in file. | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] Automated grep verification commands defined for each task (see Per-Task Verification Map above)
- [x] Field name cross-check procedure defined (Task 1e) with concrete grep -F commands to catch accent/character mismatches
- [x] Manual test procedures documented (see Manual-Only Verifications below)

*Wave 0 complete: structural verification commands cover all code-level checks including field name cross-validation. Manual procedures cover runtime behavior.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BANT fields persist after save and reload | BUG-01 | GAS requires runtime execution against Sheets; no mock available | 1. Fill BANT fields in Calificacion tab 2. Save and reload 3. Verify fields display saved values 4. Check fact_calificacion sheet |
| Toques de Contactacion persists | BUG-01 | Same GAS limitation | 1. Edit Toques field 2. Save 3. Verify fact_leads.numero_toques updated |
| AE cross_lead saves to fact_leads | BUG-02 | Requires multi-role scenario in live environment | 1. As AE on negociaciones view, open cross_lead and edit 2. Save 3. Verify fact_leads updated, NOT fact_deals |
| AE own deal saves to fact_deals (regression) | BUG-02 | Same multi-role requirement | 1. As AE, open own deal 2. Edit and save 3. Verify fact_deals updated correctly |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: grep checks after every task commit
- [x] Wave 0 covers all verification requirements including field name cross-check
- [x] No watch-mode flags
- [x] Feedback latency documented (< 10 seconds structural, ~5 min manual)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** granted
