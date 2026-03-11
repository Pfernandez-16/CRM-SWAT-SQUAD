# Phase 2: Funnel + Incontactables + Cross-Selling — Research

**Researched:** 2026-03-11
**Domain:** Vue 3 Composition API — report table rendering, data shape verification, CVR computation
**Confidence:** HIGH — all findings verified directly from source files in the repo

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FUNNEL-01 | Total leads with Mfg/Ind breakdown | `embudoRows` computed array already maps `eg.totalLeads`; template already renders it |
| FUNNEL-02 | Contactables, Contactados, Con Respuesta | `embudoRows` already maps `eg.contactables`, `eg.contactados`, `eg.conRespuesta` |
| FUNNEL-03 | Dialogo Completo, Dialogo Intermitente | `embudoRows` already maps `eg.dialogoCompleto`, `eg.dialogoIntermitente` |
| FUNNEL-04 | Con Interés, Descartados, Asignados a Ventas, Carry Over | `embudoRows` already maps all four |
| FUNNEL-05 | Montos de Inversión, Deals Cerrados, Monto de Cierres | `embudoRows` already maps all three; amount rows use `type: 'amount'` branch in template |
| FUNNEL-06 | CVR ratio to prior stage per metric | `cvrInterEtapa` field computed in `embudoRows`; ONE BUG exists (see Pitfall 1) |
| FUNNEL-07 | Delta % vs comparison period with arrow | `delta` field in every metric segment; template already renders `delta-positive/negative/neutral` |
| FUNNEL-08 | Visual Mfg/Ind breakdown per metric | Three segment columns (Total/Manufacturers/Individuals) already in template header and body |
| INCONT-01 | Duplicados with Mfg/Ind + delta | `incontactablesRows` maps `inc.duplicado`; template renders all 9 cells |
| INCONT-02 | Equivocados with Mfg/Ind + delta | `incontactablesRows` maps `inc.equivocado`; note: maps to status 'Invalido' in backend |
| INCONT-03 | SPAM with Mfg/Ind + delta | `incontactablesRows` maps `inc.spam`; backend returns zeroed structure — no SPAM data source |
| CROSS-01 | Cross-sell deals with Mfg/Ind + delta | `crossSellingRows` maps `cs.crossSellDeals`; template renders 9 cells |
</phase_requirements>

---

## Summary

**Phase 2 is almost entirely already implemented.** The computed arrays (`embudoRows`, `incontactablesRows`, `crossSellingRows`), the HTML table templates in Index.html, the CSS in Styles.html, and the helper functions (`getSegmentValue`, `formatAmount`) are all present and wired to `reportData`. The accordion section framework (open/close, scroll-to, quick-nav) works for all three sections.

The data contract from the backend is fully established and correct. `getSDRReport` returns `embudoGeneral` with 13 metrics, `incontactables` with 3 sub-metrics, and `crossSelling` with `crossSellDeals` — all using the same `{ total: {count, pct, delta}, manufacturers: {count, pct, delta}, individuals: {count, pct, delta} }` shape (amount metrics use `{amount, delta}` instead of `{count, pct, delta}`).

There is **one real bug** to fix (FUNNEL-06: CVR for `dealsCerrados` computes against `montosInversion` which has no `.count`) and **two visual/UX gaps** to verify: the delta display for amount rows (currently shows `--` for pct but delta IS available from backend and is not currently shown), and whether the "%" label on `col-delta` should use the `+` prefix for positive deltas on amount rows.

**Primary recommendation:** Phase 2 is a verification + bug-fix phase, not a build phase. Audit each computed row, fix the CVR bug, verify amount-row delta rendering, and confirm all 13 requirements render correctly. Do not rebuild what exists.

---

## Standard Stack

### Core (unchanged from Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | CDN (full build) | Reactive computed, v-for, v-if, template | Already in use — all report state is Vue refs/computeds |
| Tailwind CSS | CDN | Utility classes | Already loaded; report-specific custom classes are in Styles.html |
| Material Symbols Outlined | Google Fonts CDN | `arrow_upward`, `arrow_downward`, `remove` icons for delta | Already loaded; delta spans already use these icons |

### No New Dependencies

No new libraries are needed for Phase 2. All tooling was established in Phase 1.

**Installation:** Nothing to install.

---

## Architecture Patterns

### How Report Tables Are Structured

```
App.html setup()
  ├── embudoRows      computed — maps reportData.embudoGeneral → [{label, metric, type, cvrInterEtapa}]
  ├── incontactablesRows computed — maps reportData.incontactables → [{label, metric, type}]
  ├── crossSellingRows  computed — maps reportData.crossSelling   → [{label, metric, type}]
  └── getSegmentValue(metric, segment) — safe accessor, returns {count:0, pct:'0.0', delta:'0.0'} on null

Index.html
  └── v-if="currentView === 'reportes'"
        └── v-for="section in reportSections"
              ├── section.id === 'embudoGeneral'   → <table class="report-table">
              ├── section.id === 'incontactables'  → <table class="report-table">
              └── section.id === 'crossSelling'    → <table class="report-table">

Styles.html
  └── .report-table, .col-metric, .col-count, .col-percentage, .col-delta
      .delta-positive, .delta-negative, .delta-neutral
      .percentage-cell, .percentage-bar (inline progress bar behind %)
```

### Pattern 1: Metric Data Shape (COUNT metrics)

Every count metric from `buildSegmentedMetricWithDelta_` returns:

```javascript
// Source: Analytics.js lines 154-170
{
  total:         { count: Number, pct: '100.0', delta: String },  // pct is always '100.0' for total
  manufacturers: { count: Number, pct: String,  delta: String },
  individuals:   { count: Number, pct: String,  delta: String }
}
// pct = (segment_count / total_count * 100).toFixed(1)
// delta = ((current - previous) / previous * 100).toFixed(1)
// Special: if previous === 0 and current > 0: delta = '100.0'
// Special: if both 0: delta = '0.0'
```

### Pattern 2: Metric Data Shape (AMOUNT metrics)

Amount metrics (`montosInversion`, `montoCierres`) from `buildSegmentedAmountWithDelta_` return:

```javascript
// Source: Analytics.js lines 216-229
{
  total:         { amount: Number, delta: String },
  manufacturers: { amount: Number, delta: String },
  individuals:   { amount: Number, delta: String }
}
// NOTE: No 'count' or 'pct' fields — template must use row.type === 'amount' branch
```

### Pattern 3: Template Branch for Amount vs Count Rows

```html
<!-- Source: Index.html lines 470-484 (embudoGeneral table, Total segment) -->
<template v-if="row.type === 'amount'">
  <td class="col-count">{{ formatAmount(getSegmentValue(row.metric, 'total').amount) }}</td>
  <td class="col-percentage"><span class="percentage-value">--</span></td>
</template>
<template v-else>
  <td class="col-count">{{ getSegmentValue(row.metric, 'total').count }}</td>
  <td class="col-percentage">
    <div class="percentage-cell">
      <div class="percentage-bar" :style="{ width: getSegmentValue(row.metric, 'total').pct + '%', ... }"></div>
      <span class="percentage-value">{{ getSegmentValue(row.metric, 'total').pct }}%</span>
    </div>
  </td>
</template>
<td class="col-delta">
  <!-- arrow_upward / arrow_downward / remove with delta-positive/negative/neutral class -->
</td>
```

**Key detail:** The `col-delta` cell is rendered the same for both count and amount rows. The delta value comes from `getSegmentValue(row.metric, 'total').delta`. For amount rows, `getSegmentValue` returns the amount object `{amount, delta}`, so `delta` IS accessible — this is correct. But `getSegmentValue`'s fallback returns `{count: 0, pct: '0.0', delta: '0.0'}` which does not have `amount` — so `formatAmount(getSegmentValue(...).amount)` will receive `undefined`, which `formatAmount` handles as `'$0'`. Safe.

### Pattern 4: CVR Inter-Etapa Computation

```javascript
// Source: App.html lines 199-209
for (let i = 0; i < rawRows.length; i++) {
    if (i === 0 || rawRows[i].type === 'amount') {
        rawRows[i].cvrInterEtapa = null; // no CVR
    } else {
        const prevCount = rawRows[i - 1].metric?.total?.count || 0;
        const currCount = rawRows[i].metric?.total?.count || 0;
        rawRows[i].cvrInterEtapa = prevCount > 0
            ? (currCount / prevCount * 100).toFixed(1)
            : '0.0';
    }
}
```

**CVR color thresholds (already in template):**
- >= 70%: `var(--accent-success)` green
- >= 40%: `var(--accent-warning)` orange
- < 40%: `var(--accent-danger)` red

### Pattern 5: embudoRows Row Order and Types

| Index | Label | type | CVR Note |
|-------|-------|------|----------|
| 0 | Total Leads | count | null (top of funnel) |
| 1 | Contactables | count | vs row 0 |
| 2 | Contactados | count | vs row 1 |
| 3 | Con Respuesta | count | vs row 2 |
| 4 | Dialogo Completo | count | vs row 3 |
| 5 | Dialogo Intermitente | count | vs row 4 |
| 6 | Interes | count | vs row 5 |
| 7 | Descartados | count | vs row 6 |
| 8 | Asignados a Ventas | count | vs row 7 |
| 9 | Carry Over | count | vs row 8 |
| 10 | Monto Inversion | **amount** | null (amount row) |
| 11 | Deals Cerrados | count | **BUG: vs row 10 (amount) — prevCount = 0** |
| 12 | Monto Cierres | **amount** | null (amount row) |

### Anti-Patterns to Avoid

- **Do not change the `getSegmentValue` fallback shape.** It returns `{count: 0, pct: '0.0', delta: '0.0'}` which is what the count-branch template expects. If you add `amount: 0` to the fallback you must also ensure amount-branch `formatAmount` still works.
- **Do not add a `type: 'amount'` guard to the CVR loop.** The guard already exists. The bug is that `dealsCerrados` (a count row) immediately follows an amount row. Fix is to skip backwards to the nearest count row.
- **Do not re-order embudoRows.** The order matches the client's funnel specification and the template is keyed by `row.label`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delta display arrows | Custom CSS icon or SVG | `material-symbols-outlined` + `delta-positive/negative/neutral` CSS classes | Already defined in Styles.html lines 1691-1720; icons already loaded |
| Inline progress bars in % cells | Canvas/SVG bar charts | `.percentage-bar` div inside `.percentage-cell` | Already implemented in all three tables |
| Null-safe metric access | Try/catch or manual null checks | `getSegmentValue(metric, segment)` helper (App.html line 304) | Returns safe default `{count:0, pct:'0.0', delta:'0.0'}` on null |
| Currency formatting | `Intl.NumberFormat` or manual | `formatAmount(val)` (App.html line 309) | Already exists; outputs `$1,234,567` format |
| Section accordion | Custom show/hide JS | `openSections` ref + `toggleSection()` + `v-show` | Already implemented; all 3 sections are in `reportSections` and will accordion correctly |

---

## Common Pitfalls

### Pitfall 1: CVR for "Deals Cerrados" Shows 0.0% (Bug in Current Code)

**What goes wrong:** `Deals Cerrados` (index 11) has its CVR computed as `rawRows[10].metric?.total?.count || 0`. Row 10 is `Monto Inversion` which is an `amount` metric with no `.count` field. Result: `prevCount = 0`, so `cvrInterEtapa = '0.0'`.

**Why it happens:** The CVR loop uses `i-1` as the "prior stage" without checking if `rawRows[i-1].type === 'amount'`.

**How to fix:** Walk backwards from `i-1` to find the nearest count row:

```javascript
// Replacement for the else branch in the CVR loop (App.html lines 202-208)
} else {
    // Find the nearest prior COUNT row (skip amount rows)
    let prevCountRow = null;
    for (let j = i - 1; j >= 0; j--) {
        if (rawRows[j].type !== 'amount') { prevCountRow = rawRows[j]; break; }
    }
    const prevCount = prevCountRow ? (prevCountRow.metric?.total?.count || 0) : 0;
    const currCount = rawRows[i].metric?.total?.count || 0;
    rawRows[i].cvrInterEtapa = prevCount > 0
        ? (currCount / prevCount * 100).toFixed(1)
        : '0.0';
}
```

**Effect:** `Deals Cerrados` CVR will correctly show as `(dealsCerrados.total.count / carryOver.total.count * 100)` — the nearest prior count row (Carry Over, index 9).

**Warning signs:** Deals Cerrados row shows "0.0%" in green/red CVR cell when there are clearly leads in the funnel.

### Pitfall 2: Amount Row Delta Not Displaying in Cross-Section Delta Column

**What goes wrong:** For `row.type === 'amount'` rows, the percentage column shows `--` (correct — no percentage for dollar amounts), but the `col-delta` cell still accesses `getSegmentValue(row.metric, 'total').delta`. Since `row.metric.total = {amount: X, delta: 'Y'}` (not `{count, pct, delta}`), `getSegmentValue` returns the correct object only when `metric[segment]` is not nullish. The actual `delta` IS present. Verify this works by checking that `Number('Y')` comparison triggers the correct delta-positive/negative class.

**How to verify:** Check that `montosInversion` and `montoCierres` rows show the delta arrow correctly in a browser test with real data.

**Warning signs:** Amount rows show "0%" delta even when there is a previous period value, or the arrow color is wrong.

### Pitfall 3: SPAM Row Always Shows Zero (by Design, Not a Bug)

**What goes wrong:** `incontactables.spam` is always `{ total: {count: 0, pct: '0.0', delta: '0.0'}, ... }` — the backend comment at Analytics.js line 471 explicitly states "no data source exists."

**Why it happens:** The `fact_leads` table has no SPAM status value. The backend initializes SPAM as zeroed rather than omitting it.

**How to handle:** The zero rows display correctly. Add a note or tooltip to the SPAM row in the UI indicating "Sin datos registrados" or mark it visually as inactive if the client notices. This is a known data gap, not a code bug. **Document this for the client.**

**Warning signs:** Client asks why SPAM is always 0. The answer is that there is no SPAM status in the lead database — the category exists for future use.

### Pitfall 4: "Carry Over" Count May Be Unexpectedly High or Low

**What goes wrong:** `carryOver` counts leads that were open (not Descartado, not Paso a Ventas, not resolved) before `dateIn` and still active at the start of the current period. Its CVR relative to `Asignados a Ventas` may be confusing (e.g., carryOver could be larger than asignadosVentas).

**Why it happens:** The business metric is: leads that "carried over" from a previous period. It is not a downstream conversion of asignadosVentas — it is a lateral count.

**How to handle:** The CVR for Carry Over vs Asignados a Ventas will frequently show values >100%, which is fine. Do not attempt to cap or hide it. If the client asks, it means "we carried forward more leads than we assigned to sales this period."

### Pitfall 5: getSegmentValue Fallback Missing `amount` Field

**What goes wrong:** For amount rows, `getSegmentValue` returns `{amount: X, delta: 'Y'}`. If the metric segment is null/undefined, the fallback returns `{count: 0, pct: '0.0', delta: '0.0'}` which lacks `amount`. `formatAmount(undefined)` is handled safely by the `formatAmount` function (returns `'$0'`). No crash, but test this explicitly.

**How to verify:** Confirm `formatAmount` receives `undefined` gracefully when `reportData` is null or a segment is missing.

---

## Code Examples

### embudoRows Computed — Complete Shape (verified from App.html lines 180-211)

```javascript
// Each row in embudoRows:
{
  label: 'Contactados',          // display string
  metric: {                      // raw from reportData.embudoGeneral.contactados
    total:         { count: 42, pct: '100.0', delta: '+15.3' },
    manufacturers: { count: 28, pct: '66.7',  delta: '+10.2' },
    individuals:   { count: 14, pct: '33.3',  delta: '+25.0' }
  },
  type: 'count',                 // 'count' | 'amount'
  cvrInterEtapa: '87.5'          // String (toFixed(1)) or null
}
// Amount row shape:
{
  label: 'Monto Inversion',
  metric: {
    total:         { amount: 125000, delta: '+8.5' },
    manufacturers: { amount: 85000,  delta: '+12.0' },
    individuals:   { amount: 40000,  delta: '+2.1' }
  },
  type: 'amount',
  cvrInterEtapa: null
}
```

### incontactablesRows Computed — Complete Shape (verified from App.html lines 213-221)

```javascript
// Three rows, identical metric shape to count rows above:
[
  { label: 'Duplicado',   metric: reportData.incontactables.duplicado,  type: 'count' },
  { label: 'Equivocado',  metric: reportData.incontactables.equivocado, type: 'count' },
  { label: 'SPAM',        metric: reportData.incontactables.spam,       type: 'count' }
]
// Backend note: spam is always zeroed — no SPAM status in fact_leads
// Backend note: equivocado maps to status 'Invalido' | 'Inválido' in fact_leads
```

### crossSellingRows Computed — Complete Shape (verified from App.html lines 223-229)

```javascript
// Single row:
[
  { label: 'Cross Sell Deals', metric: reportData.crossSelling.crossSellDeals, type: 'count' }
]
// Backend: counts deals with tipo_transaccion === 'Cross-sell' whose id_lead falls in current period
```

### getSegmentValue Helper (verified from App.html lines 304-307)

```javascript
function getSegmentValue(metric, segment) {
    if (!metric || !metric[segment]) return { count: 0, pct: '0.0', delta: '0.0' };
    return metric[segment];
}
// Usage: getSegmentValue(row.metric, 'total').count
// Usage: getSegmentValue(row.metric, 'manufacturers').delta
// Safe for amount rows: getSegmentValue(row.metric, 'total').amount → Number
```

### Delta Display Pattern (verified from Index.html lines 485-499)

```html
<td class="col-delta">
  <span v-if="Number(getSegmentValue(row.metric, 'total').delta) > 0" class="delta-positive">
    <span class="material-symbols-outlined">arrow_upward</span>
    +{{ getSegmentValue(row.metric, 'total').delta }}%
  </span>
  <span v-else-if="Number(getSegmentValue(row.metric, 'total').delta) < 0" class="delta-negative">
    <span class="material-symbols-outlined">arrow_downward</span>
    {{ getSegmentValue(row.metric, 'total').delta }}%
  </span>
  <span v-else class="delta-neutral">
    <span class="material-symbols-outlined">remove</span>
    0%
  </span>
</td>
```

### CVR Bug Fix (replacement for App.html lines 202-208)

```javascript
// BEFORE (buggy — prevCount is 0 when prior row is 'amount'):
const prevCount = rawRows[i - 1].metric?.total?.count || 0;

// AFTER (correct — skip backwards past amount rows):
let prevCountRow = null;
for (let j = i - 1; j >= 0; j--) {
    if (rawRows[j].type !== 'amount') { prevCountRow = rawRows[j]; break; }
}
const prevCount = prevCountRow ? (prevCountRow.metric?.total?.count || 0) : 0;
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Build table from scratch | All three tables already exist in Index.html | Phase 2 is verification + fix, not build |
| Manually check each metric key | `embudoRows` computed abstracts all key access | Safe null-access pattern already in place |
| Custom delta display | CSS classes + Material Symbols already styled | `.delta-positive/negative/neutral` fully styled in Styles.html |

---

## Open Questions

1. **Should amount rows (Monto Inversion, Monto Cierres) also show delta arrows?**
   - What we know: The delta value IS present in the backend response. The template renders the `col-delta` cell for all rows including amount rows. The existing template will show the arrow (positive/negative) based on `getSegmentValue(row.metric, 'total').delta`.
   - What's unclear: Whether this is working correctly since `getSegmentValue`'s fallback lacks `amount`. But because `amount` metrics return `{amount: X, delta: 'Y'}`, the delta IS accessible as long as the metric exists.
   - Recommendation: Verify with a browser test. If working, no change needed. If delta shows "0%" for amount rows despite real data, add explicit amount-row handling to `getSegmentValue`.

2. **Should SPAM row display "N/A" or "Sin datos" instead of all zeros?**
   - What we know: SPAM is always zeroed. The current display shows 0/0.0%/0% for all three segments.
   - What's unclear: Whether the client expects SPAM to be populated or understands it's not tracked.
   - Recommendation: Add a subtle note row or a `data-tooltip="Sin datos en el sistema"` to the SPAM metric cell. Low priority for Phase 2; defer to Phase 4 if client asks.

3. **Is `Interes` (label: "Interes") the correct Spanish for the client?**
   - What we know: The label is defined in `embudoRows` in App.html as `'Interes'` (no accent).
   - What's unclear: Whether the client expects "Con Interés" (with accent, matching REQUIREMENTS.md language).
   - Recommendation: Fix the accent: `'Con Interés'` to match `FUNNEL-04` requirement language. Minor cosmetic fix with no data impact.

---

## Validation Architecture

> Manual browser testing is the only viable approach for this GAS + CDN stack. No automated test framework exists or is installable without a build step.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual browser testing + GAS Logger (no Jest/Vitest/pytest — not viable in this stack) |
| Config file | None |
| Quick run command | Open GAS web app URL; navigate to Reportes; click "Generar Reporte" |
| Full suite command | Walk all 5 Phase 2 success criteria in a browser session with real data |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Verification Step | Automated? |
|--------|----------|-----------|-------------------|-----------|
| FUNNEL-01 | Total Leads row renders with Mfg/Ind breakdown | Manual smoke | Confirm first row of Embudo table shows three segment columns with non-zero counts | Manual only |
| FUNNEL-02 | Contactables/Contactados/Con Respuesta rows render | Manual smoke | Confirm rows 2-4 in Embudo table render with correct labels and counts | Manual only |
| FUNNEL-03 | Dialogo Completo/Intermitente rows render | Manual smoke | Confirm rows 5-6 render | Manual only |
| FUNNEL-04 | Interes/Descartados/Asignados/Carry Over render | Manual smoke | Confirm rows 7-10 render with correct count values | Manual only |
| FUNNEL-05 | Amount rows (Monto Inversion, Deals Cerrados, Monto Cierres) render | Manual smoke | Confirm currency format appears (`$1,234`) in amount rows; count appears in Deals Cerrados | Manual only |
| FUNNEL-06 | CVR column shows ratio for each stage | Manual smoke | After CVR bug fix: Deals Cerrados CVR should show ratio vs Carry Over, not 0.0% | Manual only |
| FUNNEL-07 | Delta arrows render for all rows | Manual smoke | Each row shows up/down/neutral arrow with color-coded percentage | Manual only |
| FUNNEL-08 | Three segment columns visible per row | Manual smoke | Manufacturers and Individuals columns render alongside Total | Manual only |
| INCONT-01 | Duplicados row renders | Manual smoke | First row of Incontactables table shows count + arrow | Manual only |
| INCONT-02 | Equivocados row renders | Manual smoke | Second row (maps to 'Invalido' status in DB) shows count + arrow | Manual only |
| INCONT-03 | SPAM row renders (all zeros) | Manual smoke | Third row renders zero counts — expected behavior, not a bug | Manual only |
| CROSS-01 | Cross Sell Deals row renders | Manual smoke | Cross Selling section shows single row with deal count | Manual only |

### GAS-Side Smoke Test (existing — can validate backend data shape)

```
GAS Script Editor → Run → testSDRReport_()
Validates: embudoGeneral has 13 metrics, incontactables has 3 sub-metrics, crossSelling has crossSellDeals
All with total/manufacturers/individuals segmentation and delta fields
```

### Manual Acceptance Checklist (Phase 2 Success Criteria)

- [ ] SC1: All Embudo metrics (Total Leads through Monto Cierres) visible in single table with three segment columns
- [ ] SC2: Every Embudo count row (non-amount) shows a non-null CVR; Deals Cerrados CVR correctly reflects ratio vs Carry Over (not 0.0%)
- [ ] SC3: Incontactables table shows Duplicado, Equivocado, SPAM with Mfg/Ind breakdown and delta arrows
- [ ] SC4: Cross Selling table shows Cross Sell Deals count with Mfg/Ind breakdown and delta arrows
- [ ] SC5: All three tables update when user changes the date range and clicks "Generar Reporte"

### Wave 0 Gaps

None — existing infrastructure covers all Phase 2 requirements. The tables, computed arrays, CSS, and helpers all exist. Only the CVR bug fix (App.html) needs to be written before the acceptance tests can pass SC2.

---

## Sources

### Primary (HIGH confidence)

- `App.html` lines 155-311 — All report state refs, `embudoRows`/`incontactablesRows`/`crossSellingRows` computed arrays, `getSegmentValue`, `formatAmount`, `openSections`, `reportSections`
- `App.html` lines 2016-2076 — Return block confirming all report symbols are exposed to template
- `Index.html` lines 371-830 — Full reportes view markup: loading overlay, controls bar, error state, empty state, accordion sections, all three table templates
- `Analytics.js` lines 90-229 — `calcDelta_`, `calcPercentage_`, `buildSegmentedMetric_`, `buildSegmentedMetricWithDelta_`, `buildSegmentedAmountWithDelta_` — exact metric shape verified
- `Analytics.js` lines 251-530 — `calculateEmbudoGeneral_` (13 metrics), `calculateIncontactables_` (3 sub-metrics, SPAM is zeroed), `calculateCrossSelling_` (crossSellDeals via deal proxies)
- `Styles.html` lines 1586-1720 — `.report-table`, `.col-metric`, `.col-count`, `.col-percentage`, `.col-delta`, `.delta-positive/negative/neutral`, `.percentage-cell/.bar` — all CSS verified present

### Secondary (MEDIUM confidence)

- `Analytics.js` lines 1100-1200 — `testSDRReport_()` smoke test validates all 13 embudo metrics and 3 incontactables sub-metrics have `total/manufacturers/individuals` segmentation

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from source files; no new dependencies
- Architecture: HIGH — all tables, computeds, and CSS already exist and are wired
- Pitfalls: HIGH — CVR bug confirmed by reading App.html lines 199-208 against the row order; SPAM zero confirmed from Analytics.js line 471
- Open questions: MEDIUM — delta behavior on amount rows requires browser test to confirm

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable GAS + Vue 3 CDN stack; backend data contract locked)
