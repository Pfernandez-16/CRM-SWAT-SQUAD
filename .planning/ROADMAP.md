# Roadmap: CRM SWAT Squad — Reporteria

**Created:** 2026-03-03
**Phases:** 3
**Requirements covered:** 26/26

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Bug Fixes & Stabilization | Fix known bugs so the CRM is stable before adding new features | BUG-01, BUG-02 | 2 |
| 2 | Backend Analytics Engine | Build Analytics.js with all report calculation functions | ANLYT-01 to ANLYT-13 | 5 |
| 3 | Frontend Reportes View | Build the Reports UI that displays all 8 report sections | UI-01 to UI-11 | 4 |

## Phase Details

### Phase 1: Bug Fixes & Stabilization

**Goal:** Fix known bugs in Code.js and App.html so the CRM is stable and field mappings work correctly before adding the analytics module.

**Requirements:** BUG-01, BUG-02

**Plans:** 1 plan

Plans:
- [x] 01-01-PLAN.md -- Fix LEAD_FIELD_MAP + calificacion routing + isDeal source-based detection

**Success Criteria:**
1. All qualification fields (Toques de Contactacion, En que toque va, BANT fields) are mapped in LEAD_FIELD_MAP and persist correctly when saving a lead
2. saveLeadChanges() correctly determines isDeal based on the item's _source property, not the user's role -- an AE viewing a cross_lead saves to fact_leads, not fact_deals

### Phase 2: Backend Analytics Engine

**Goal:** Create Analytics.js as a standalone GAS file that reads from the normalized database and returns complete SDR report data as JSON, matching the structure of the existing "Reporte SDR General" spreadsheet.

**Requirements:** ANLYT-01 through ANLYT-13

**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md -- Core infrastructure + helpers + date filtering + segmentation (ANLYT-01 to ANLYT-05)
- [ ] 02-02-PLAN.md -- Embudo General + Incontactables (ANLYT-06, ANLYT-07)
- [ ] 02-03-PLAN.md -- Cross Selling + Semaforo Contesto/No Contesto + Sin Respuesta 6to Toque (ANLYT-08 to ANLYT-11)
- [ ] 02-04-PLAN.md -- Razones No Paso a Ventas + Razones Perdio la Venta + deployment verification (ANLYT-12, ANLYT-13)

**Success Criteria:**
1. Analytics.js exists as a separate file deployed via clasp alongside Codigo.js
2. getSDRReport(dateIn, dateOut) returns JSON with all 8 sections, each containing Total/Manufacturers/Individuals breakdowns with count, percentage, and delta vs previous period
3. Date filtering correctly uses fecha_ingreso and segmentation uses tipo_membresia from fact_calificacion
4. Carry-over calculation correctly identifies leads from previous periods that were assigned to sales in the current period
5. Function executes within GAS 6-minute limit for up to 2000 leads

### Phase 3: Frontend Reportes View

**Goal:** Build the "Reportes" view in the CRM UI with date pickers and all 8 report tables, visible only to ADMIN role, consuming data from Analytics.js backend.

**Requirements:** UI-01 through UI-11

**Success Criteria:**
1. "Reportes" nav item appears in sidebar only for ADMIN role
2. Date range picker filters the report data and auto-calculates the comparison period
3. All 8 tables render with correct columns (Total|%|Delta%) and segment breakdown (Total/Manufacturers/Individuals)
4. Loading indicator shows while report data is being calculated

## Dependencies

```
Phase 1 (Bugs) -> Phase 2 (Analytics Backend) -> Phase 3 (Frontend UI)
```

All phases are sequential -- each depends on the previous.

---
*Roadmap created: 2026-03-03*
