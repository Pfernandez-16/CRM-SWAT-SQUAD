---
phase: 04-deals-backend-+-frontend
plan: 02
subsystem: ui
tags: [google-apps-script, vue3, deals, funnel, accordion, ES5]

requires:
  - phase: 04-deals-backend-+-frontend
    plan: 01
    provides: dealsReport key in getSDRReport() JSON with stages/montoCotizacion/montoCierre/razonesPerdida

provides:
  - dealsReportRows computed in App.html mapping dealsReport.stages into 6 funnel rows with Si/No/Monto
  - dealsLossRows computed in App.html mapping dealsReport.razonesPerdida into reason rows with current/previous/delta
  - Index.html deals accordion section with Si/No/Monto funnel table (Contactado through Fondeo)
  - Index.html dealsLoss accordion section with loss-reason table including delta arrows and empty-state row
  - Two new entries in reportSections array (deals, dealsLoss) visible in Reportes view accordion

affects: [any future phase consuming reportData.dealsReport, accordion section ordering]

tech-stack:
  added: []
  patterns:
    - "Guard pattern: if (!reportData.value || !reportData.value.dealsReport) return [] — standard for all report computeds"
    - "Object.keys() iteration for razonesPerdida map to dealsLossRows array"
    - "Monto column uses v-if row.monto !== null for conditional display, showing formatAmount() or '--'"

key-files:
  created: []
  modified:
    - gas-crm-project/App.html
    - gas-crm-project/Index.html

key-decisions:
  - "dealsLossRows uses Object.keys() instead of Array.map() because razonesPerdida is a plain object keyed by reason string — consistent with how razonesNoPasoRows and razonesPerdioRows are built"
  - "Monto column rendered only for Cotizado (montoCotizacion) and Fondeo (montoCierre) rows; all others show '--' via row.monto === null guard"
  - "Empty-state row added to dealsLoss table (v-if='!dealsLossRows.length') — necessary because razonesPerdida may be empty if no Perdido deals exist in the selected period"

patterns-established:
  - "New reportSections entries always added at END of array — preserve existing section ordering"
  - "New computeds always added to setup() return after the last existing report computed to prevent merge conflicts"

requirements-completed: [DEALS-03, DEALS-04, DEALS-05]

duration: ~15min
completed: 2026-03-11
---

# Phase 4 Plan 02: Deals Frontend Tables Summary

**dealsReportRows and dealsLossRows Vue computeds wired into App.html; two new accordion sections in Index.html render a 6-stage Deals funnel table (Si/No/Monto) and a Razones de Perdida table with delta arrows — verified live in browser**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-11T20:20:00Z
- **Completed:** 2026-03-11T20:38:50Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments

- Added dealsReportRows computed to App.html: guards against missing dealsReport, maps 6 stage keys (contactado through fondeo) to label/stage/monto rows; Cotizado gets montoCotizacion and Fondeo gets montoCierre
- Added dealsLossRows computed to App.html: uses Object.keys() on razonesPerdida to produce current/previous/delta rows; exported alongside dealsReportRows in setup() return
- Extended reportSections array with deals and dealsLoss entries, making both sections appear in the accordion
- Added deals v-else-if block in Index.html: 4-column table (Etapa / Si / No / Monto) with formatAmount() for money cells and '--' fallback
- Added dealsLoss v-else-if block in Index.html: 4-column table (Razon / Periodo Actual / Periodo Anterior / Delta%) with full delta arrow pattern and empty-state row
- Deployed via clasp push; user confirmed both sections render correctly in browser with no console errors

## Task Commits

Each task was committed atomically:

1. **Task 1: dealsReportRows + dealsLossRows computeds + reportSections update** - `7a0cbfb` (feat)
2. **Task 2: Index.html Deals funnel table + DealsLoss table markup** - `ca05922` (feat)
3. **Task 3: clasp push + browser verify** - verified by user (no code commit — deploy-only task)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `gas-crm-project/App.html` - Added dealsReportRows and dealsLossRows computeds; added deals/dealsLoss entries to reportSections; exported both computeds in setup() return
- `gas-crm-project/Index.html` - Added two v-else-if accordion blocks for deals funnel table and dealsLoss reason table between perdioVenta block and fallback v-else

## Decisions Made

- dealsLossRows uses Object.keys() iteration because razonesPerdida is a plain object map, not an array — consistent with existing razones computed patterns.
- Monto column shows formatAmount(row.monto) only where row.monto is non-null; all other stages display '--' using a v-else span. Avoids showing "$0" for stages with no monto meaning.
- Empty-state row inside dealsLoss tbody (v-if="!dealsLossRows.length") provides clear user feedback when no Perdido deals exist in the selected period instead of an empty table body.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 is now fully complete: Analytics.js backend and both frontend tables are live and verified
- Both Deals accordion sections update dynamically when the date range changes and the report is re-generated
- Concern still open: GAS 6-minute timeout risk if report data grows — may need to split into a separate getDealsReport call in a future phase

---
*Phase: 04-deals-backend-+-frontend*
*Completed: 2026-03-11*
