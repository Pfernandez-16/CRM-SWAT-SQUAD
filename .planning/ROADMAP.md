# Roadmap: CRM SWAT Squad — Módulo de Reportería

## Overview

The CRM core is already complete. This roadmap covers only the reports module: scaffolding the Reportes view with period selection and API wiring, then building each report section incrementally. The final phase adds the one missing backend piece (Deals/Negociaciones) and its frontend. Four phases, each delivering a coherent, verifiable capability on top of the existing system.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Scaffolding** - Reportes view skeleton, period selector, and getSDRReport API wiring with live data flowing into Vue state (completed 2026-03-11)
- [x] **Phase 2: Funnel + Incontactables + Cross-Selling** - First three report tables rendered with deltas and Mfg/Ind breakdowns (completed 2026-03-11)
- [x] **Phase 3: Toques + Semáforos + Razones** - Vertical contactability matrix, semaphore grids, and loss-reason tables (completed 2026-03-11)
- [x] **Phase 4: Deals Backend + Frontend** - New Analytics function for Deals report, schema update, and full Deals table in the UI (completed 2026-03-11)

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
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Fix CVR bug (Deals Cerrados reads amount row) and label accent; surgical edits to App.html lines 190 and 202-208
- [ ] 02-02-PLAN.md — Deploy, audit static code, and browser-verify all 12 requirements across all three tables (checkpoint)

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
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Audit matrizContactabilidad, semaforoContesto, semaforoNoContesto, sinRespuesta sections (TOQUES-01..05)
- [x] 03-02-PLAN.md — Audit razones tables + apply mixPct bar cap fix (RAZNES-01..03, RAZPERD-01..03)
- [x] 03-03-PLAN.md — Deploy, cross-section integration verify, and Phase 3 sign-off (all 11 requirements)

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
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — fact_deals schema update (5 checkbox columns) + calculateDealsReport_() backend function + wire into getSDRReport()
- [ ] 04-02-PLAN.md — Deals frontend: dealsReportRows + dealsLossRows computeds in App.html + two new table blocks in Index.html

### Phase 5: Comparativa Personalizada + Ranking SDRs
**Goal**: El gerente puede comparar contra cualquier período libre, y puede ver el ranking de performance de sus SDRs con CVR y delta
**Depends on**: Phase 4
**Requirements**: CUSTOM-01, CUSTOM-02, CUSTOM-03, SDR-01, SDR-02, SDR-03
**Success Criteria** (what must be TRUE):
  1. El selector de período tiene una tercera opción "Personalizado" que muestra dos date pickers adicionales para el rango de comparación
  2. Al generar reporte con modo personalizado, getSDRReport() recibe las fechas custom y calcula métricas comparativas contra ese período
  3. Todas las tablas existentes muestran deltas correctos contra el período personalizado
  4. La sección "Ranking SDRs" muestra tabla con nombre SDR, total leads, CVR actual, CVR anterior y delta, ordenada por CVR descendente
  5. El ranking se actualiza al cambiar el período
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Backend: extender getSDRReport() para fechas custom + calculateSDRRankingReport_()
- [ ] 05-02-PLAN.md — Frontend: UI comparativa personalizada + sección Ranking SDRs

### Phase 6: Visual Intelligence
**Goal**: Los reportes destacan automáticamente variaciones críticas y el Embudo General tiene representación visual gráfica para reuniones con el CEO
**Depends on**: Phase 5
**Requirements**: CHART-01, ALERT-01, VELOCITY-01
**Success Criteria** (what must be TRUE):
  1. La sección Embudo General incluye una gráfica de embudo (Chart.js CDN) que muestra el volumen por etapa visualmente
  2. Todas las tablas con delta destacan visualmente (color distinto) cuando la variación es ≥ ±20%
  3. La sección Deals muestra velocidad de cierre promedio en días con delta vs período anterior
**Plans**: TBD

Plans:
- [ ] 06-01-PLAN.md — Backend: añadir avgDaysToClose a calculateDealsReport_() + Frontend: ALERT-01 delta styling global
- [ ] 06-02-PLAN.md — Frontend: Chart.js funnel chart para Embudo General + velocity display en Deals

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffolding | 2/2 | Complete    | 2026-03-11 |
| 2. Funnel + Incontactables + Cross-Selling | 2/2 | Complete    | 2026-03-11 |
| 3. Toques + Semáforos + Razones | 3/3 | Complete    | 2026-03-11 |
| 4. Deals Backend + Frontend | 2/2 | Complete    | 2026-03-11 |
| 5. Comparativa Personalizada + Ranking SDRs | 0/2 | Not started | - |
| 6. Visual Intelligence | 0/2 | Not started | - |
