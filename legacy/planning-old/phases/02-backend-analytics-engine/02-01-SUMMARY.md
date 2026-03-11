---
phase: 02-backend-analytics-engine
plan: 01
subsystem: analytics
tags: [infrastructure, helpers, orchestrator, segmentation, date-filtering]
dependencies:
  requires: [Código.js utilities (readTable_, indexBy_)]
  provides: [getSDRReport orchestrator, segmentation helpers, delta calculation, test functions]
  affects: []
tech_stack:
  added: [Analytics.js]
  patterns: [one-to-many indexing, segmented metrics, delta calculation, error handling]
key_files:
  created:
    - gas-crm-project/Analytics.js
  modified: []
decisions:
  - id: SEGMENTATION-SOURCE
    summary: "Use tipo_membresia from fact_calificacion for segmentation (Manufacturers/Individuals)"
    rationale: "Locked decision from CONTEXT.md research - servicio_interes contains service names, not segment types"
  - id: DELTA-CALCULATION
    summary: "Delta calculation handles zero division with special cases (0->N returns 100.0, 0->0 returns 0.0)"
    rationale: "Prevents NaN/Infinity in reports while providing meaningful percentage changes"
  - id: DATE-FILTERING
    summary: "Inclusive date range filtering with NaN exclusion"
    rationale: "Ensures all leads with fecha_ingreso within [dateIn, dateOut] are included; malformed dates excluded automatically"
metrics:
  duration_min: 2
  completed_date: "2026-03-04"
  tasks_completed: 2
  files_created: 1
  commits: [b26446a, 5ee46d5]
---

# Phase 02 Plan 01: Analytics Infrastructure Summary

**One-liner:** Core analytics infrastructure with getSDRReport orchestrator, date filtering, tipo_membresia-based segmentation, delta calculation helpers, and 8 section stubs.

## What Was Built

Created Analytics.js as a standalone GAS file with complete infrastructure for SDR report generation:

1. **Data Loading & Filtering**
   - `filterByDateRange_()`: Inclusive date filtering with NaN handling for fecha_ingreso
   - `buildLeadInteractionsIdx_()`: One-to-many mapping for lead→interactions (different from indexBy_ 1:1)
   - Previous period calculation: automatic duration-based offset for delta comparisons

2. **Segmentation System (LOCKED Decision)**
   - `getSegment_()`: Uses `tipo_membresia` from fact_calificacion (NOT servicio_interes)
   - Returns: 'manufacturers' | 'individuals' | 'other' | 'unknown'
   - Leads without calificacion or null tipo_membresia return 'unknown'
   - 'Attraction' membership type maps to 'other' (excluded from main segments)

3. **Metric Calculation Helpers**
   - `calcPercentage_()`: Safe percentage calculation with zero handling
   - `calcDelta_()`: Delta% vs previous period with special cases (0→N=100%, 0→0=0%)
   - `buildSegmentedMetric_()`: Apply metric function to total/manufacturers/individuals with count + pct
   - `buildSegmentedMetricWithDelta_()`: Segmented metrics + delta fields for current vs previous period
   - `buildSegmentedAmountWithDelta_()`: Same pattern for monetary amounts (no percentages)

4. **Main Orchestrator**
   - `getSDRReport(dateIn, dateOut)`: Loads all tables once, builds indexes, filters periods, calls 8 section calculators
   - Returns JSON with metadata + 8 section keys
   - Metadata includes: dateIn, dateOut, previousDateIn, previousDateOut, generatedAt, totalLeads, previousTotalLeads
   - Error handling: try/catch with Logger.log, returns {error, stack} on failure

5. **Section Calculators (Stubs)**
   - All 8 sections exist as stub functions returning `{}`
   - Plans 02-04 will implement: Embudo General, Incontactables, Cross Selling, Semáforo Contestó, Semáforo No Contestó, Sin Respuesta 6to Toque, Razones No Pasó Ventas, Razones Perdió Venta

6. **Test Functions**
   - `testSDRReport_()`: Validates JSON structure, logs timing + "INFRASTRUCTURE OK" status
   - `testPerformance_()`: Benchmarks 3 runs, reports PASS (<30s) / WARNING (<60s) / FAIL (≥60s)
   - Both runnable from GAS Script Editor Run menu

## Code Style

Followed existing Código.js conventions:
- `var` declarations (not const/let)
- `function` keyword (not arrow functions)
- Underscore suffix for private helpers: `filterByDateRange_`, `getSegment_`, etc.
- Safe string handling: `String(value || '').trim()`
- All functions deterministic given same input

## Integration Points

- **Table constants**: Uses T_LEADS, T_INTERACCIONES, T_CALIFICACION, T_CONTACTOS, T_DEALS from Código.js (shared GAS namespace)
- **Utilities**: Leverages readTable_() and indexBy_() from Código.js
- **Deployment**: Will be deployed alongside Código.js via clasp as separate .js file
- **Frontend (Phase 3)**: Will call `google.script.run.getSDRReport(dateIn, dateOut)` from App.html

## Deviations from Plan

None - plan executed exactly as written.

## Testing

**Automated verification:**
- ✅ All 9 helper functions exist
- ✅ All 8 section calculator stubs exist
- ✅ tipo_membresia reference confirmed in getSegment_()
- ✅ Test functions (testSDRReport_, testPerformance_) exist with all validation checks

**Manual testing available:**
- Open GAS Script Editor
- Run → testSDRReport_() to validate infrastructure
- Run → testPerformance_() to benchmark execution time
- Both log results to Logger

## Known Limitations

1. All section calculators return empty objects `{}` - implementation deferred to Plans 02-04
2. No actual data validation yet - stubs don't process leads/interactions
3. Performance benchmark uses broad date range (2024-2025) - actual performance depends on data volume

## Next Steps (Plan 02)

Implement the two heaviest sections:
1. **Embudo General**: 13 funnel steps from Total Leads → Deals Closed with segmentation + delta
2. **Incontactables**: Breakdown of leads without contact info (missing phone/email)

## Self-Check: PASSED

**Files created:**
```
FOUND: gas-crm-project/Analytics.js
```

**Commits exist:**
```
FOUND: b26446a (Task 1 - Infrastructure)
FOUND: 5ee46d5 (Task 2 - Test functions)
```

**Function inventory:**
- ✅ getSDRReport (main orchestrator)
- ✅ filterByDateRange_ (date filtering)
- ✅ buildLeadInteractionsIdx_ (one-to-many index)
- ✅ getSegment_ (tipo_membresia segmentation)
- ✅ calcPercentage_ (safe percentage)
- ✅ calcDelta_ (delta with zero handling)
- ✅ buildSegmentedMetric_ (segmented counts)
- ✅ buildSegmentedMetricWithDelta_ (segmented with delta)
- ✅ buildSegmentedAmountWithDelta_ (amounts with delta)
- ✅ calculateEmbudoGeneral_ (stub)
- ✅ calculateIncontactables_ (stub)
- ✅ calculateCrossSelling_ (stub)
- ✅ calculateSemaforoContesto_ (stub)
- ✅ calculateSemaforoNoContesto_ (stub)
- ✅ calculateSinRespuesta6toToque_ (stub)
- ✅ calculateRazonesNoPasoVentas_ (stub)
- ✅ calculateRazonesPerdioVenta_ (stub)
- ✅ testSDRReport_ (smoke test)
- ✅ testPerformance_ (benchmark)

All claims verified. Infrastructure complete and ready for section implementation.
