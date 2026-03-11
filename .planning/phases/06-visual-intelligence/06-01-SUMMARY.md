---
phase: 06-visual-intelligence
plan: 01
subsystem: analytics-frontend
tags: [velocity-metric, delta-alert, css, analytics, ES5]
dependency_graph:
  requires: []
  provides: [avgDaysToClose, prevAvgDaysToClose, delta-alert-css, delta-alert-bindings]
  affects: [Analytics.js, Styles.html, Index.html]
tech_stack:
  added: []
  patterns: [ES5-var-for-loop, Vue3-class-binding-array, CSS-rgba-overlay]
key_files:
  created: []
  modified:
    - Analytics.js
    - Styles.html
    - Index.html
decisions:
  - avgDaysToClose measures days from fecha_pase_ventas to today (not to period end) — reflects real-world deal velocity
  - prevClosedCount guard ensures 0 (not NaN) when no fondeo deals exist in either period
  - delta-alert uses replace_all=true on identical repeated table blocks — 3 sections share same segment pattern
  - Semaforo grids use separate replace pattern due to toque/semaforoSegment variable names and style="font-size:0.7rem;" attribute
metrics:
  duration: ~5 min
  completed_date: "2026-03-11"
  tasks_completed: 3
  files_modified: 3
requirements_satisfied:
  - VELOCITY-01
  - ALERT-01
---

# Phase 06 Plan 01: Velocity Metric and Delta Alert Highlighting Summary

**One-liner:** avgDaysToClose velocity metric added to calculateDealsReport_() (ES5) and amber delta-alert CSS class wired to all 44 delta spans across 9 report sections via :class array bindings.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add avgDaysToClose to calculateDealsReport_() | 85d4d97 | Analytics.js |
| 2 | Add .delta-alert CSS rule to Styles.html | df782f8 | Styles.html |
| 3 | Apply delta-alert class binding to ALL delta spans | 441eaaf | Index.html |

## What Was Built

### Task 1: avgDaysToClose in Analytics.js (ES5)

Added Step 4b inside `calculateDealsReport_()` to compute average days from `fecha_pase_ventas` to `new Date()` for all `fondeo === true` deals in both current and previous periods.

- `avgDaysToClose`: current period average (0 when no fondeo deals)
- `prevAvgDaysToClose`: previous period average (0 when no fondeo deals)
- ES5 constraint maintained: `var`, `for` loops, no `const`/`let`/arrow functions
- Empty-array guard: `closedCount > 0 ? ... : 0` prevents NaN
- Both fields added to return object, accessible as `reportData.value.dealsReport.avgDaysToClose`

### Task 2: .delta-alert CSS in Styles.html

Added after the `.delta-neutral` rule block in the "Delta% Column" section:

```css
.delta-alert {
    background-color: rgba(255, 193, 7, 0.18);
    border-radius: 4px;
    padding: 1px 4px;
    font-weight: 700;
}
```

Amber background overlay that works on top of existing `delta-positive`/`delta-negative` text colors in the dark glassmorphism theme.

### Task 3: delta-alert bindings in Index.html

Converted all 22 delta span pairs (positive + negative) from static `class="delta-positive/negative"` to Vue `:class` array bindings with inline threshold check. Total 44 occurrences of `delta-alert` conditional.

Sections covered:
- Embudo (total, manufacturers, individuals) — 3 segment sets
- Incontactables (total, manufacturers, individuals) — 3 segment sets
- Cross-Selling (total, manufacturers, individuals) — 3 segment sets
- Semaforo Contesto (toque cells) — 2 grid cells
- Semaforo No Contesto (toque cells) — 2 grid cells
- Razones No Paso a Ventas (total, manufacturers, individuals) — 3 segment sets
- Razones Perdio la Venta (total, manufacturers, individuals) — 3 segment sets
- Deals Loss/razonesPerdida (row.delta) — Pattern B
- Ranking SDRs (row.delta) — Pattern B

## Verification Results

1. `grep avgDaysToClose Analytics.js` — 4 lines (computation current, computation prev, return current, return prev)
2. `grep delta-alert Styles.html` — 1 line (CSS rule at line 1719)
3. `delta-alert count in Index.html` — 44 occurrences
4. `static class="delta-positive"` remaining — 0
5. `closedCount > 0` guard — present at line 1074

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- Analytics.js modified: avgDaysToClose at lines 1074, 1088, 1143, 1144
- Styles.html modified: .delta-alert rule at line 1719
- Index.html modified: 0 static delta-positive/negative remain, 44 delta-alert bindings present
- Commits: 85d4d97, df782f8, 441eaaf — all verified in git log
