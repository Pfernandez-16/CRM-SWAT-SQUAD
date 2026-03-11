---
phase: 05-comparativa-personalizada-+-ranking-sdrs
plan: 01
subsystem: api
tags: [google-apps-script, es5, analytics, sdr-ranking, custom-dates]

# Dependency graph
requires:
  - phase: 04-deals-backend-+-frontend
    provides: calculateDealsReport_() and dealsReport in getSDRReport() response
provides:
  - getSDRReport() accepting compareType='custom' with customPrevDateIn/customPrevDateOut params
  - calculateSDRRankingReport_() returning per-SDR CVR ranking sorted descending
  - sdrRanking key in getSDRReport() JSON response
affects:
  - frontend compareType selector (Personalizado mode)
  - Ranking SDRs table component

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom date branch: compareType='custom' guard before prev_period else block"
    - "SDR aggregation: for-in loop over union of current+previous SDR IDs"
    - "Name lookup: readTable_(T_VENDEDORES) indexed by id_vendedor, fallback to id string"

key-files:
  created: []
  modified:
    - Analytics.js

key-decisions:
  - "compareType normalization changed from ternary to if-guard to allow 'custom' through without becoming 'prev_period'"
  - "calculateSDRRankingReport_ placed before MAIN ORCHESTRATOR section, consistent with calculateDealsReport_ placement"
  - "CVR computed as Math.round(ratio * 10000) / 100 for 2-decimal precision without toFixed string conversion"
  - "sdrRanking uses union of current+previous SDR IDs so SDRs with only previous-period leads still appear"

patterns-established:
  - "Custom date params: added as trailing optional params on function signature, checked with truthy guard inside body (ES5 no-default-params rule)"
  - "SDR name resolution: readTable_(T_VENDEDORES) -> vendedoresIdx[id] || id fallback pattern"

requirements-completed: [CUSTOM-01, CUSTOM-02, CUSTOM-03, SDR-01, SDR-02, SDR-03]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 5 Plan 1: Comparativa Personalizada + Ranking SDRs Summary

**getSDRReport() extended with custom date comparison mode and new calculateSDRRankingReport_() delivering per-SDR CVR ranking with dim_vendedores name resolution**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-11T20:48:56Z
- **Completed:** 2026-03-11T20:50:55Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- getSDRReport() now accepts compareType='custom' plus customPrevDateIn/customPrevDateOut; when provided, skips internal date calculation and uses the supplied range directly
- prev_period and yoy paths remain identical to before — zero regression
- calculateSDRRankingReport_() aggregates leads + closed deals per SDR for both periods, looks up nombres via T_VENDEDORES (falls back to id_vendedor_sdr), returns array sorted by cvrCurrent descending
- sdrRanking key added to getSDRReport() JSON response

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend getSDRReport() for custom comparison dates** - `ba34a61` (feat)
2. **Task 2: Add calculateSDRRankingReport_() function** - `8754bd3` (feat)

## Files Created/Modified
- `Analytics.js` - Extended getSDRReport() signature/normalization/date-calc block; added calculateSDRRankingReport_() function and sdrRanking wiring

## Decisions Made
- compareType normalization changed from ternary `(yoy) ? 'yoy' : 'prev_period'` to an if-guard `if (compareType !== 'yoy' && compareType !== 'custom')` to allow the new 'custom' value through cleanly
- CVR uses integer arithmetic `Math.round(ratio * 10000) / 100` rather than `toFixed` — keeps it a Number not a string, matching calcDelta_ expectations
- sdrRanking builds a union of current + previous SDR IDs so that SDRs active in only one period still appear in the ranking with zeroed opposite-period stats

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend contract is complete: sdrRanking array and custom-date support are fully available
- Frontend can now implement the "Personalizado" compareType selector and wire customPrevDateIn/customPrevDateOut to the API call
- Ranking SDRs table component can consume the sdrRanking array directly (id, nombre, totalLeads, cvrCurrent, cvrPrevious, delta fields)

---
*Phase: 05-comparativa-personalizada-+-ranking-sdrs*
*Completed: 2026-03-11*
