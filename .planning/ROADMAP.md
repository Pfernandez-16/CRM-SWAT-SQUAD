# Roadmap: CRM SWAT Squad

## Milestones

- ✅ **v1.0 Reporteria** - Phases 1-6 (shipped 2026-03-11)
- 🚧 **v2.0 Pre-Entrega al Cliente** - Phases 7-11 (in progress)

## Phases

<details>
<summary>✅ v1.0 Reportería (Phases 1-6) — SHIPPED 2026-03-11</summary>

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
- [x] 01-01-PLAN.md — Audit and verify existing Reportes scaffolding (nav wiring, flatpickr, controls bar, states)
- [x] 01-02-PLAN.md — Close two gaps: add watch(compareType) auto-trigger and fix YOY comparisonRange

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
- [x] 02-01-PLAN.md — Fix CVR bug (Deals Cerrados reads amount row) and label accent; surgical edits to App.html lines 190 and 202-208
- [x] 02-02-PLAN.md — Deploy, audit static code, and browser-verify all 12 requirements across all three tables (checkpoint)

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
- [x] 04-01-PLAN.md — fact_deals schema update (5 checkbox columns) + calculateDealsReport_() backend function + wire into getSDRReport()
- [x] 04-02-PLAN.md — Deals frontend: dealsReportRows + dealsLossRows computeds in App.html + two new table blocks in Index.html

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
- [x] 05-01-PLAN.md — Backend: extender getSDRReport() para fechas custom + calculateSDRRankingReport_()
- [x] 05-02-PLAN.md — Frontend: UI comparativa personalizada + sección Ranking SDRs

### Phase 6: Visual Intelligence
**Goal**: Los reportes destacan automáticamente variaciones críticas y el Embudo General tiene representación visual gráfica para reuniones con el CEO
**Depends on**: Phase 5
**Requirements**: CHART-01, ALERT-01, VELOCITY-01
**Success Criteria** (what must be TRUE):
  1. La sección Embudo General incluye una gráfica de embudo (Chart.js CDN) que muestra el volumen por etapa visualmente
  2. Todas las tablas con delta destacan visualmente (color distinto) cuando la variación es ≥ ±20%
  3. La sección Deals muestra velocidad de cierre promedio en días con delta vs período anterior
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Analytics.js avgDaysToClose + Styles.html .delta-alert CSS + Index.html delta-alert class binding on all delta spans
- [x] 06-02-PLAN.md — Chart.js CDN + canvas#embudoChart + App.html watch(embudoRows) funnel chart + dealsVelocity computed + clasp deploy

</details>

---

### 🚧 v2.0 Pre-Entrega al Cliente (In Progress)

**Milestone Goal:** Corregir bugs críticos del handoff, activar routing inteligente de AEs, implementar pricing UI en fichas, reestructurar deal fichas, y QA general para la entrega a Christian.

#### Phase 7: Bug Fixes Críticos
**Goal**: El flujo SDR→AE está libre de bugs bloqueantes — routing activo, CVR correcto, sin definiciones duplicadas, status canónico
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. Al confirmar handoff, el sistema ejecuta processHandoff (con lógica de routing) y no updateLeadMultiple — el AE asignado aparece en el deal creado
  2. La sección Ranking SDRs muestra CVR real (leads con status 'Paso a Ventas' / total leads) en vez de 0% para todos los SDRs
  3. App.html contiene exactamente una definición de openHandoffModal, cancelHandoff y submitHandoff — sin código duplicado silencioso
  4. Los leads pasados a ventas tienen status 'Paso a Ventas' (sin tilde en 'Paso') en fact_leads y fact_deals
**Plans**: TBD

Plans:
- [ ] 07-01-PLAN.md

#### Phase 8: Handoff Routing End-to-End
**Goal**: El gerente puede configurar el modo de asignación de AEs, y el flujo SDR→AE opera correctamente en los tres modos (SDR Choice, Round Robin, Manager Review)
**Depends on**: Phase 7
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04
**Success Criteria** (what must be TRUE):
  1. En modo SDR_CHOICE, el SDR ve un dropdown de AEs activos en el handoff modal y el deal se crea asignado al AE seleccionado
  2. En modo AUTO (Round Robin), el dropdown de AEs se oculta y el sistema asigna el siguiente AE en turno automáticamente al confirmar
  3. En modo MANAGER_REVIEW, el deal se crea sin AE asignado y queda visible para el gerente como pendiente de aprobación
  4. El panel Admin tiene un selector de modo de routing (SDR_CHOICE / AUTO / MANAGER_REVIEW) que el gerente puede cambiar y guardar
**Plans**: TBD

Plans:
- [ ] 08-01-PLAN.md

#### Phase 9: Pricing UI
**Goal**: Tanto SDRs como AEs ven y pueden editar montos estimados y cotizados durante el flujo de handoff y en fichas de deal
**Depends on**: Phase 7
**Requirements**: PRICE-01, PRICE-02, PRICE-03
**Success Criteria** (what must be TRUE):
  1. En el handoff modal, el SDR ve el monto estimado auto-calculado (ticket promedio × factor por tipo: Fichas×12, Proyectos×1, SaaS×licencias×12) antes de confirmar
  2. En la ficha de deal, el AE puede ver y editar el monto cotizado en un campo independiente del monto estimado
  3. La calculadora de pricing muestra el desglose del cálculo (tipo de cliente, factor, resultado) tanto en el handoff modal como en el deal modal
**Plans**: TBD

Plans:
- [ ] 09-01-PLAN.md

#### Phase 10: Deal Fichas Reestructuradas
**Goal**: Las fichas de deal tienen secciones Cotización y Cierre visualmente separadas, con timestamps automáticos y soporte multi-producto con clasificación automática
**Depends on**: Phase 7
**Requirements**: DEAL-01, DEAL-02, DEAL-03, DEAL-04
**Success Criteria** (what must be TRUE):
  1. El modal de deal muestra dos secciones distinguibles visualmente: "Cotización" (monto cotizado + fecha de cotización) y "Cierre" (monto cierre + monto apartado + fecha de cierre)
  2. La fecha de cotización se graba automáticamente al ingresar monto cotizado; la fecha de cierre se graba automáticamente al cambiar status a "Vendido"
  3. El AE puede agregar múltiples productos por deal en una tabla con nombre, cantidad, precio unitario y descuento % por línea
  4. El sistema clasifica automáticamente el deal como cross-selling, up-selling o venta directa al comparar el producto de interés del SDR con el/los producto(s) de cierre del AE
**Plans**: TBD

Plans:
- [ ] 10-01-PLAN.md

#### Phase 11: QA y Limpieza Pre-Entrega
**Goal**: El sistema pasa una verificación end-to-end completa, el código muerto está eliminado, y el checklist de reunión con el cliente refleja el estado real
**Depends on**: Phases 7, 8, 9, 10 (all complete)
**Requirements**: QA-01, QA-02, QA-03
**Success Criteria** (what must be TRUE):
  1. CHECKLIST_REUNION_CLIENTE.md tiene la sección 9 (Reportería) marcada como completa con todos sus ítems verificados
  2. App.html no contiene funciones duplicadas, variables no referenciadas ni imports sin usar — auditoría de código limpia
  3. El flujo completo crear lead → toques → calificar BANT → handoff → deal creado con AE → cotizar → negociar → cerrar funciona sin errores en producción
**Plans**: TBD

Plans:
- [ ] 11-01-PLAN.md

## Progress

**Execution Order:**
Phases 7 → 8 → (9 and 10 can execute in parallel after 7) → 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffolding | v1.0 | 2/2 | Complete | 2026-03-11 |
| 2. Funnel + Incontactables + Cross-Selling | v1.0 | 2/2 | Complete | 2026-03-11 |
| 3. Toques + Semáforos + Razones | v1.0 | 3/3 | Complete | 2026-03-11 |
| 4. Deals Backend + Frontend | v1.0 | 2/2 | Complete | 2026-03-11 |
| 5. Comparativa Personalizada + Ranking SDRs | v1.0 | 2/2 | Complete | 2026-03-11 |
| 6. Visual Intelligence | v1.0 | 2/2 | Complete | 2026-03-11 |
| 7. Bug Fixes Críticos | v2.0 | 0/TBD | Not started | - |
| 8. Handoff Routing End-to-End | v2.0 | 0/TBD | Not started | - |
| 9. Pricing UI | v2.0 | 0/TBD | Not started | - |
| 10. Deal Fichas Reestructuradas | v2.0 | 0/TBD | Not started | - |
| 11. QA y Limpieza Pre-Entrega | v2.0 | 0/TBD | Not started | - |
