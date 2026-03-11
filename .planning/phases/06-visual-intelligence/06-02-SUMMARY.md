---
phase: 06-visual-intelligence
plan: 02
subsystem: analytics-frontend
tags: [chart.js, vue3-watch, computed, horizontal-bar-chart, velocity-metric, ES5]

dependency_graph:
  requires:
    - phase: 06-01
      provides: avgDaysToClose, prevAvgDaysToClose in Analytics.js calculateDealsReport_()
    - phase: 02-funnel-incontactables-cross-selling
      provides: embudoRows computed with type/metric/label shape
  provides:
    - Chart.js CDN loaded globally in Index.html
    - canvas#embudoChart horizontal bar chart above Embudo General table
    - watch(embudoRows) with destroy/recreate pattern for period change
    - dealsVelocity computed returning { current, previous, delta } or null
    - Velocity stat block above Deals funnel table
  affects: [Index.html, App.html]

tech-stack:
  added: [chart.js@4.4.0 via CDN]
  patterns: [Chart.js destroy/recreate on watch, Vue3-computed-null-guard, CDN-before-App-include]

key-files:
  created: []
  modified:
    - Index.html
    - App.html

key-decisions:
  - "Chart.js CDN loaded in Index.html before include('App') so new Chart() is globally available inside App.html"
  - "Destroy/recreate pattern (embudoChartInstance.destroy()) prevents Canvas already in use error on period change"
  - "dealsVelocity returns null (not 0) when no dealsReport data — v-if guard hides the stat block completely when null"
  - "watch(embudoRows) filters to type=count rows only — amount rows have no meaningful count value for the funnel visual"

patterns-established:
  - "Chart.js lifecycle: var instance = null; watch destroys then recreates on each data change"
  - "Velocity computed: null-guard first, then read nested fields with || 0, delta formula handles prev=0 edge case"

requirements-completed: [CHART-01, VELOCITY-01]

duration: ~5min
completed: "2026-03-11"
---

# Phase 06 Plan 02: Chart.js Funnel Chart and Deal Velocity Summary

**Chart.js 4.4.0 horizontal bar chart added above Embudo General table via watch(embudoRows) with destroy/recreate pattern; dealsVelocity computed surfaces avgDaysToClose with delta% above the Deals funnel table.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-11T22:17:08Z
- **Completed:** 2026-03-11T22:22:00Z
- **Tasks:** 2 (plus checkpoint)
- **Files modified:** 2

## Accomplishments

- Chart.js 4.4.0 CDN added to Index.html; canvas#embudoChart wired in Embudo section
- watch(embudoRows) draws horizontal bar chart using count-type rows; destroys old instance before each redraw
- dealsVelocity computed returns `{ current, previous, delta }` or null; null guard hides stat block when no deals data
- Velocity stat block with delta arrow and delta-alert threshold displayed above Deals funnel table
- clasp push deployed all 6 files to Google Apps Script

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Chart.js CDN + canvas + velocity stat block to Index.html** - `e95ace7` (feat)
2. **Task 2: Add dealsVelocity computed and watch(embudoRows) funnel chart in App.html** - `5786825` (feat)

## Files Created/Modified

- `Index.html` - Chart.js CDN script tag; canvas#embudoChart above Embudo table; velocity stat block above Deals table
- `App.html` - dealsVelocity computed; embudoChartInstance var; watch(embudoRows) chart draw; dealsVelocity in return

## Decisions Made

- Chart.js CDN placed before `<?!= include('App') ?>` so `new Chart()` is globally available inside App.html at runtime
- Destroy/recreate pattern chosen over chart.update() to handle label count changes when period switches (different row counts)
- dealsVelocity returns null not zero when dealsReport is missing — template v-if suppresses the block entirely, no "0 dias" shown for missing data
- watch filters embudoRows to `type === 'count'` rows — amount rows (Monto Inversion, Monto Cierres) have no meaningful count

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 06 plan 02 complete — funnel chart and velocity stat deployed
- checkpoint:human-verify pending — user must open CRM web app and visually confirm chart renders above Embudo table, velocity stat appears in Deals section, and chart redraws on period change without JS errors

---
*Phase: 06-visual-intelligence*
*Completed: 2026-03-11*
