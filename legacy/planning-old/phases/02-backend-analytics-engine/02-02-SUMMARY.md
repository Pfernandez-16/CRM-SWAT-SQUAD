---
phase: 02-backend-analytics-engine
plan: 02
subsystem: analytics
tags: [funnel-metrics, embudo, incontactables, segmentation, delta-calculation]
dependencies:
  requires:
    - phase: 02-01
      provides: "Analytics.js infrastructure (helpers, orchestrator, indexes, stubs)"
  provides:
    - "calculateEmbudoGeneral_ with 13 funnel metrics (segmented + delta)"
    - "calculateIncontactables_ with 3 sub-metrics (Duplicado, Equivocado, SPAM)"
    - "Updated testSDRReport_ validating both sections"
  affects: [02-03, 02-04]
tech_stack:
  added: []
  patterns: [deal-proxy-objects-for-lead-segmentation, currentLeadIds-set-for-deal-JOIN, carry-over-allLeads-pattern]
key_files:
  created: []
  modified:
    - gas-crm-project/Analytics.js
key_decisions:
  - "Deal segmentation uses lead's segment via calificacionIdx (not deal itself)"
  - "carryOver uses allLeads with fecha_ingreso < dateIn and fecha_asignacion within period"
  - "Equivocado mapped to status 'Invalido' per cat_opciones schema"
  - "SPAM returns zeroed structure (no data source exists in current schema)"
patterns_established:
  - "Deal proxy objects: carry id_lead + _deal for amount functions while enabling lead-based segmentation"
  - "currentLeadIds lookup object for efficient deal-to-period-lead JOIN"
requirements_completed: [ANLYT-06, ANLYT-07]
duration: 2min
completed: 2026-03-04
---

# Phase 02 Plan 02: Embudo General & Incontactables Summary

**13-metric sales funnel (Embudo General) with deal JOINs, carry-over logic, and Incontactables breakdown using segmented metrics with delta comparison**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T18:36:10Z
- **Completed:** 2026-03-04T18:38:36Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Implemented all 13 Embudo General funnel metrics with segmentation (manufacturers/individuals) and delta vs previous period
- carryOver correctly identifies leads from before the period that were assigned to sales during the period, using allLeads (not date-filtered)
- Deal-based metrics (montosInversion, dealsCerrados, montoCierres) use currentLeadIds lookup for efficient JOIN and proxy objects for lead-based segmentation
- Incontactables section with Duplicado/Equivocado(Invalido)/SPAM correctly mapped
- Updated smoke test validates all 13 Embudo metrics and 3 Incontactables sub-metrics with sample value logging

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement calculateEmbudoGeneral_ with all 13 funnel metrics** - `79bf3e9` (feat)
2. **Task 2: Implement calculateIncontactables_ and update smoke test** - `9565cd7` (feat)

## Files Created/Modified
- `gas-crm-project/Analytics.js` - Added calculateEmbudoGeneral_ (13 metrics), calculateIncontactables_ (3 sub-metrics), updated getSDRReport() wiring and testSDRReport_ validation

## Decisions Made
- **Deal segmentation via lead:** Deal-based metrics look up the LEAD's segment via calificacionIdx using deal.id_lead, not the deal object itself
- **Carry-over date logic:** Uses allLeads (unfiltered) with fecha_ingreso < dateIn AND fecha_asignacion within [dateIn, dateOut] for current period carry-over
- **Equivocado mapping:** Requirement says "Equivocado" but data uses status "Invalido" -- mapped accordingly
- **SPAM placeholder:** Returns zeroed structure since no SPAM status or data source exists in current schema
- **Deal proxy pattern:** Created lightweight proxy objects {id_lead, _deal} to pass deals through buildSegmentedAmountWithDelta_ while maintaining lead-based segmentation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Steps (Plans 03-04)

Implement remaining 6 report sections:
- Cross Selling, Semaforo Contesto, Semaforo No Contesto
- Sin Respuesta 6to Toque, Razones No Paso Ventas, Razones Perdio Venta

---
*Phase: 02-backend-analytics-engine*
*Completed: 2026-03-04*
