# Roadmap: CRM SWAT Squad — Módulo de Reportería

## Overview

The CRM core is already complete. This roadmap covers only the reports module: scaffolding the Reportes view with period selection and API wiring, then building each report section incrementally. The final phase adds the one missing backend piece (Deals/Negociaciones) and its frontend. Four phases, each delivering a coherent, verifiable capability on top of the existing system.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Scaffolding** - Reportes view skeleton, period selector, and getSDRReport API wiring with live data flowing into Vue state
- [ ] **Phase 2: Funnel + Incontactables + Cross-Selling** - First three report tables rendered with deltas and Mfg/Ind breakdowns
- [ ] **Phase 3: Toques + Semáforos + Razones** - Vertical contactability matrix, semaphore grids, and loss-reason tables
- [ ] **Phase 4: Deals Backend + Frontend** - New Analytics function for Deals report, schema update, and full Deals table in the UI

## Phase Details

### Phase 1: Scaffolding
**Goal**: The Reportes view exists, the period selector works, and real data flows from the backend into the Vue app
**Depends on**: Nothing (brownfield — existing CRM infrastructure already live)
**Requirements**: PERIOD-01, PERIOD-02, PERIOD-03
**Success Criteria** (what must be TRUE):
  1. User can navigate to the Reportes view from the main CRM navigation without a page reload
  2. User can set a date range (start + end) and choose "vs período anterior" or "vs año anterior"
  3. After changing the period, the app calls getSDRReport() and the response JSON is available in Vue reactive state
  4. A loading indicator is visible while the API call is in flight and disappears on completion
  5. If the API call fails, an error message is displayed rather than a silent blank state
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Audit and verify existing Reportes scaffolding (nav wiring, flatpickr, controls bar, states)
- [ ] 01-02-PLAN.md — Close two gaps: add watch(compareType) auto-trigger and fix YOY comparisonRange

### Phase 2: Funnel + Incontactables + Cross-Selling
**Goal**: Users can read the Embudo General, Incontactables, and Cross-Selling report tables with full breakdowns and period comparisons
**Depends on**: Phase 1
**Requirements**: FUNNEL-01, FUNNEL-02, FUNNEL-03, FUNNEL-04, FUNNEL-05, FUNNEL-06, FUNNEL-07, FUNNEL-08, INCONT-01, INCONT-02, INCONT-03, CROSS-01
**Success Criteria** (what must be TRUE):
  1. User can see all Embudo metrics (leads through closings) in a single table with Manufacturados vs Individuales columns
  2. Every Embudo row shows a conversion ratio to the prior stage and a delta % vs the selected comparison period
  3. User can see Incontactables (Duplicados, Equivocados, Spam) with Mfg/Ind breakdown and delta arrows
  4. User can see Cross-Selling deals count with Mfg/Ind breakdown and delta
  5. All three tables update when the user changes the period selector
**Plans**: TBD

Plans:
- [ ] 02-01: Embudo General table (FUNNEL-01 through FUNNEL-08)
- [ ] 02-02: Incontactables table (INCONT-01 through INCONT-03) and Cross-Selling table (CROSS-01)

### Phase 3: Toques + Semáforos + Razones
**Goal**: Users can read the vertical contactability matrix, the Contesto/No-Contesto semaphore grids, and both Razones tables
**Depends on**: Phase 2
**Requirements**: TOQUES-01, TOQUES-02, TOQUES-03, TOQUES-04, TOQUES-05, RAZNES-01, RAZNES-02, RAZNES-03, RAZPERD-01, RAZPERD-02, RAZPERD-03
**Success Criteria** (what must be TRUE):
  1. User can see the contactability table with toques as rows (Toque 1 through 10) and products/countries as columns
  2. User can see two semaphore grids (Contesto / No Contesto) showing canal x toque cell counts
  3. User can see the Sin Respuesta al 6to toque indicator
  4. User can see Razones No Paso a Ventas with 6 categories, % representatividad, and delta %
  5. User can see Razones Perdio la Venta with 13+ categories, % representatividad, and delta %
**Plans**: TBD

Plans:
- [ ] 03-01: Toques vertical matrix and semaphore grids (TOQUES-01 through TOQUES-05)
- [ ] 03-02: Razones No Paso a Ventas and Razones Perdio la Venta tables (RAZNES-01 through RAZPERD-03)
- [ ] 03-03: Remaining report table polish and cross-section integration verification

### Phase 4: Deals Backend + Frontend
**Goal**: The Deals/Negociaciones report exists end-to-end: schema updated, backend calculating, frontend displaying the full funnel with Si/No counts and amounts
**Depends on**: Phase 3
**Requirements**: DEALS-01, DEALS-02, DEALS-03, DEALS-04, DEALS-05
**Success Criteria** (what must be TRUE):
  1. fact_deals sheet has the five boolean columns (cotizo, en_negociacion, asistio_demo, firmo_contrato, fondeo) and existing records have defaults applied
  2. calculateDealsReport_() exists in Analytics.js and getSDRReport() returns its data in the existing response envelope
  3. User can see the Deals funnel table (Contactado through Fondeo) with Si/No counts per stage
  4. User can see monto cotizado and monto de cierre on the relevant funnel stages
  5. User can see deal loss reasons with counts
**Plans**: TBD

Plans:
- [ ] 04-01: fact_deals schema update and calculateDealsReport_() backend function
- [ ] 04-02: Deals frontend table integrated with getSDRReport response

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffolding | 0/2 | Not started | - |
| 2. Funnel + Incontactables + Cross-Selling | 0/2 | Not started | - |
| 3. Toques + Semáforos + Razones | 0/3 | Not started | - |
| 4. Deals Backend + Frontend | 0/2 | Not started | - |
