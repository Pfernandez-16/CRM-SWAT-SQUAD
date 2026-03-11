---
phase: 04-deals-backend-+-frontend
plan: 01
subsystem: api
tags: [google-apps-script, analytics, deals, funnel, ES5]

requires:
  - phase: 03-toques-semaforos-razones
    provides: Analytics.js with getSDRReport() and calcDelta_() helper

provides:
  - calculateDealsReport_() function in Analytics.js returning totalDeals/stages/montoCotizacion/montoCierre/razonesPerdida
  - dealsReport key in getSDRReport() JSON envelope
  - fact_deals Google Sheet with 5 boolean funnel columns (cotizo/en_negociacion/asistio_demo/firmo_contrato/fondeo)

affects: [04-deals-backend-+-frontend frontend plans, any consumer of getSDRReport JSON]

tech-stack:
  added: []
  patterns:
    - "Date-filter on fecha_pase_ventas with isNaN guard — mirrors filterByDateRange_ pattern used for leads"
    - "Loss reason merge: collect keys from both current/previous maps before building razonesPerdida object"

key-files:
  created: []
  modified:
    - Analytics.js

key-decisions:
  - "calculateDealsReport_ placed immediately before MAIN ORCHESTRATOR section — keeps deal logic separate from lead-based calculators"
  - "contactado stage always si=totalDeals, no=0 — every row in fact_deals represents a contacted deal by definition"
  - "Empty reason string normalized to 'Sin razon' to avoid blank keys in razonesPerdida object"

patterns-established:
  - "Funnel boolean fields accessed as deal.cotizo etc. — readTable_() lowercases all headers"
  - "Two-pass approach: filter current period, filter previous period, then count/sum separately"

requirements-completed: [DEALS-01, DEALS-02]

duration: 10min
completed: 2026-03-11
---

# Phase 4 Plan 01: Deals Backend Foundation Summary

**calculateDealsReport_() added to Analytics.js delivering 6-stage boolean funnel counts, monto aggregates, and razon_perdida breakdowns with current/previous/delta; dealsReport key wired into getSDRReport() envelope**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-11T19:30:00Z
- **Completed:** 2026-03-11T19:40:00Z
- **Tasks:** 2 (Task 1 by user, Task 2 by agent)
- **Files modified:** 1

## Accomplishments

- User added 5 boolean checkbox columns to fact_deals sheet: cotizo, en_negociacion, asistio_demo, firmo_contrato, fondeo (all default FALSE)
- Implemented calculateDealsReport_() in ES5 — filters allDeals by fecha_pase_ventas, counts Si/No per 6 funnel stages, sums monto_cotizacion and monto_cierre, builds razonesPerdida with delta
- Wired dealsReport into getSDRReport() call site and result object without altering any of the existing 9 sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Add five boolean columns to fact_deals Google Sheet** - done manually by user (no commit)
2. **Task 2: Implement calculateDealsReport_() and wire into getSDRReport()** - `3351d90` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `Analytics.js` - Added calculateDealsReport_() (lines 996-1094) and wired dealsReport into getSDRReport() at lines 1186 and 1209

## Decisions Made

- calculateDealsReport_ placed immediately before the MAIN ORCHESTRATOR section to keep deal-specific logic grouped separately from lead-based calculators.
- contactado stage always has si=totalDeals and no=0 because every row in fact_deals represents a deal that reached the AE — contacted is the entry condition, not a boolean field.
- Empty razon_perdida values normalized to 'Sin razon' string to prevent blank keys in the razonesPerdida map.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The Google Sheet columns were already added by the user prior to Task 2.

## Next Phase Readiness

- Backend data contract for Deals is fully defined: getSDRReport() now returns dealsReport with the shape frontend components need
- Frontend can read result.dealsReport.stages for Si/No counts, result.dealsReport.montoCotizacion/montoCierre for amounts, result.dealsReport.razonesPerdida for the loss reasons table
- Concern: GAS timeout risk still open — if full report takes >6 min, may need to split getDealsReport into a separate call

---
*Phase: 04-deals-backend-+-frontend*
*Completed: 2026-03-11*
