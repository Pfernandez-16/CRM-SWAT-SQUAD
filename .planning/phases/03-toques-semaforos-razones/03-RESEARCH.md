# Phase 3: Toques + Semáforos + Razones — Research

**Researched:** 2026-03-11
**Domain:** Vue 3 Composition API — vertical contactability matrix, semaphore grids, razones tables with mix%
**Confidence:** HIGH — all findings verified directly from source files in the repo

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOQUES-01 | Toques as ROWS, products/countries as COLUMNS in contactability table | `matrizContactabilidad` computed in Index.html (line 832) already renders this layout; `matrizPivotMode` ref toggles product vs country |
| TOQUES-02 | Each cell shows how many leads reached that toque in that product/country | `matrizContactabilidad.byProduct['toque'+t][col]` already rendered in Index.html line 862; `tocTotal` is the row total |
| TOQUES-03 | Semaforo Contesto: canal x toque grid for "Contesto" result | `semaforoContestoGrid` computed and full table markup already exist; Telefono/WhatsApp 3 toques, Correo 4 toques |
| TOQUES-04 | Semaforo No Contesto: canal x toque grid for "No Contesto" result | `semaforoNoContestoGrid` computed and table markup already exist; Telefono/WhatsApp only, 3 toques each |
| TOQUES-05 | Sin Respuesta al 6to Toque indicator (leads with 6+ toques, no Contesto) | `sinRespuestaRows` computed and table markup already exist; single-row segmented table |
| RAZNES-01 | 6 categories: No Perfil Adecuado, Sin Presupuesto, Sin Interés Genuino, Necesita Tercero, No Entendió Marketing, Otros | `razonesNoPasoRows` computed maps all 6 reasons + Total Descartados summary row |
| RAZNES-02 | % representatividad (base 100) over total descartados | `mixPct` field already computed in `razonesNoPasoRows`: `(metric.total.count / _totalDescartados.total.count * 100).toFixed(1)` |
| RAZNES-03 | Delta % vs comparison period | `delta` field from backend `buildSegmentedMetricWithDelta_`; rendered in Index.html razones table |
| RAZPERD-01 | 13+ loss-reason categories | `razonesPerdioRows` computed maps all 13 reasons + `sinEspecificar` + Total Perdidas = 15 rows total |
| RAZPERD-02 | % representatividad (base 100) over total perdidas | `mixPct` computed same pattern as RAZNES-02, using `_totalPerdidas.total.count` as base |
| RAZPERD-03 | Delta % vs comparison period | `delta` field in every metric segment; same delta display pattern as all other tables |
</phase_requirements>

---

## Summary

**Phase 3 is almost entirely already implemented.** Every computed array, every HTML table template, every CSS class, and every backend data structure needed for this phase already exists in the codebase. The research question "what computeds already exist?" is answered: ALL of them exist. The research question "what markup already exists?" is answered: ALL of it exists.

The six Phase 3 sections in the report are:
1. `matrizContactabilidad` — vertical pivot table, DONE in Index.html lines 831-872
2. `semaforoContesto` — canal × toque grid, DONE in Index.html lines 874-924
3. `semaforoNoContesto` — canal × toque grid, DONE in Index.html lines 926-973
4. `sinRespuesta` — single-row segmented table, DONE in Index.html lines 975-1082
5. `noPasoVentas` — razones table with mixPct, DONE in Index.html lines 1084-1202
6. `perdioVenta` — razones table with mixPct, DONE in Index.html lines 1204-1322

All six sections are registered in `reportSections` (App.html line 165-175). All computed symbols are exported in the return block (App.html lines 2043-2046). No new Vue state, computed, or template code needs to be built from scratch.

**Primary recommendation:** Phase 3 is a verification + audit phase, not a build phase. The planner should treat this as: read all six sections against the 11 requirements, identify any discrepancies between what the template renders and what the backend actually returns, fix mismatches, and confirm all sections render correctly in the browser. Do not rebuild what exists.

---

## Standard Stack

### Core (unchanged from Phase 1 and Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | CDN (full build) | Reactive computed, v-for, v-if, template | Already in use — all report state is Vue refs/computeds |
| Tailwind CSS | CDN | Utility classes | Already loaded; report-specific custom classes are in Styles.html |
| Material Symbols Outlined | Google Fonts CDN | `arrow_upward`, `arrow_downward`, `remove` icons for delta | Already loaded; delta spans already use these icons |

### No New Dependencies

No new libraries are needed for Phase 3. All tooling was established in Phase 1.

**Installation:** Nothing to install.

---

## Architecture Patterns

### How Phase 3 Data Flows

```
Analytics.js (backend)
  ├── calculateMatrizContactabilidad_()
  │     returns: { byProduct, byCountry, tocTotal, productKeys, countryKeys }
  ├── calculateSemaforoContesto_()
  │     returns: { telefono: {toque1,toque2,toque3}, whatsapp: {toque1,toque2,toque3}, correo: {toque1,toque2,toque3,toque4} }
  ├── calculateSemaforoNoContesto_()
  │     returns: { telefono: {toque1,toque2,toque3}, whatsapp: {toque1,toque2,toque3} }
  │     NOTE: Correo is EXCLUDED from NoContesto — only Telefono and WhatsApp
  ├── calculateSinRespuesta6toToque_()
  │     returns: { sinRespuesta: segmented_metric }
  ├── calculateRazonesNoPasoVentas_()
  │     returns: { noPerfilAdecuado, sinPresupuesto, sinInteresGenuino, necesitaTercero, noEntendioMarketing, otros, _totalDescartados }
  │     NOTE: 5 named reasons + 'otros' (catch-all for leads matching none) + total = 7 keys
  └── calculateRazonesPerdioVenta_()
        returns: { sinPresupuesto, eligioCompetidor, noResponde, timingInadecuado, noTienePoderDecision,
                   productoNoSeAjusta, cambioPrioridades, malaExperienciaPrevia, precioMuyAlto,
                   procesoInternoLargo, seFueConOtraSolucion, noEraElPerfil, empresaCerro,
                   sinEspecificar, _totalPerdidas }
        NOTE: 13 labeled reasons + sinEspecificar (empty razon_perdida) + total = 15 keys

App.html setup() — computed arrays
  ├── matrizPivotMode = ref('product')  — toggles product/country column mode
  ├── semaforoContestoGrid  — maps semaforoContesto → [{channel, toques:[...]}]
  ├── semaforoNoContestoGrid — maps semaforoNoContesto → [{channel, toques:[...]}]
  ├── maxToquesContesto = 4  — drives column count in semaforo grid header
  ├── maxToquesNoContesto = 3 — drives column count in no-contesto grid header
  ├── sinRespuestaRows — maps sinRespuesta6toToque → [{label, metric, type}]
  ├── razonesNoPasoRows — maps razonesNoPasoVentas → 7 rows with mixPct field
  ├── razonesPerdioRows — maps razonesPerdioVenta → 15 rows with mixPct field
  └── semaforoSegment = ref('total') — shared segment selector for both semaforo grids

Index.html — template sections, keyed by section.id
  ├── section.id === 'matrizContactabilidad'  → lines 831-872
  ├── section.id === 'semaforoContesto'       → lines 874-924
  ├── section.id === 'semaforoNoContesto'     → lines 926-973
  ├── section.id === 'sinRespuesta'           → lines 975-1082
  ├── section.id === 'noPasoVentas'           → lines 1084-1202
  └── section.id === 'perdioVenta'            → lines 1204-1322
```

### Pattern 1: Matriz de Contactabilidad — Pivot Table

**What:** Toques 1-10 are rows. Columns are dynamic: either product names (from `matrizContactabilidad.productKeys`) or country names (from `matrizContactabilidad.countryKeys`). A `Total` column shows `tocTotal['toque'+t]`. Each cell is `byProduct['toque'+t][col] || 0`.

**Key detail:** The backend derives column keys at runtime from the actual data — `productKeys` and `countryKeys` are sorted arrays of unique values found in the current period's leads. Column count is NOT fixed. In a real deployment, there may be 2-8 product columns depending on how many distinct `servicio_interes` values appear.

**Key detail:** The matrizContactabilidad does NOT return segmented metrics (no `total/manufacturers/individuals`). Each cell is a raw count (`Number`). This table has no delta, no pct — just counts. This is the only Phase 3 table without the standard `{count, pct, delta}` shape.

**Key detail:** The `matrizPivotMode` ref (`'product'` | `'country'`) is toggled by a `<select>` control rendered inside the section block. It is NOT a global filter — it only affects this table.

```javascript
// App.html line 177
const matrizPivotMode = ref('product');

// Backend shape (Analytics.js lines 987-993)
return {
    byProduct: { toque1: { ProductoA: 5, ProductoB: 3 }, toque2: { ... }, ... },
    byCountry:  { toque1: { Mexico: 6, Colombia: 2 }, ... },
    tocTotal:   { toque1: 8, toque2: 5, ... },
    productKeys: ['ProductoA', 'ProductoB'],   // sorted unique product names
    countryKeys:  ['Colombia', 'Mexico']         // sorted unique country names
};
```

### Pattern 2: Semaphore Grid (Contesto and No Contesto)

**What:** Two-dimensional grid: channels are rows, toques are columns. Each cell contains a count + delta from the `semaforoSegment` (Total/Manufacturers/Individuals). Each cell is a full segmented metric `{total: {count, pct, delta}, ...}`.

**Critical asymmetry:**
- `semaforoContesto` has **3 channels**: Telefono (3 toques), WhatsApp (3 toques), Correo (4 toques) → 4 columns in header
- `semaforoNoContesto` has **2 channels**: Telefono (3 toques), WhatsApp (3 toques) — Correo is excluded → 3 columns in header
- Correo does NOT track "No Contesto" — email is one-directional, there is no "no answer" concept for email
- `maxToquesContesto = 4` drives the `<th v-for="n in maxToquesContesto">` loop
- `maxToquesNoContesto = 3` drives the equivalent loop for NoContesto
- The template fills empty cells for channels with fewer toques than the max using `v-for="n in (maxToquesContesto - row.toques.length)"` — Telefono and WhatsApp show `--` in the Toque 4 column

**Key detail:** Both semaforo tables share the SAME `semaforoSegment` ref. Changing the segment selector in one table changes both. This is intentional — a single segment filter controls both grids.

```javascript
// App.html lines 236-257
const semaforoContestoGrid = computed(() => {
    const sc = reportData.value.semaforoContesto;
    return [
        { channel: 'Telefono', toques: [sc.telefono.toque1, sc.telefono.toque2, sc.telefono.toque3] },
        { channel: 'WhatsApp', toques: [sc.whatsapp.toque1, sc.whatsapp.toque2, sc.whatsapp.toque3] },
        { channel: 'Correo',   toques: [sc.correo.toque1,   sc.correo.toque2,   sc.correo.toque3,   sc.correo.toque4] }
    ];
});

const semaforoNoContestoGrid = computed(() => {
    const snc = reportData.value.semaforoNoContesto;
    return [
        { channel: 'Telefono', toques: [snc.telefono.toque1, snc.telefono.toque2, snc.telefono.toque3] },
        { channel: 'WhatsApp', toques: [snc.whatsapp.toque1, snc.whatsapp.toque2, snc.whatsapp.toque3] }
    ];
    // NOTE: No Correo row — semaforoNoContesto backend does not compute correo
});
```

### Pattern 3: Razones Tables (NoPaso + PerdioVenta)

**What:** Standard segmented table (Total/Manufacturers/Individuals) with an ADDITIONAL `mixPct` column. The `mixPct` is a "base 100" representativeness percentage: each reason's count divided by the total (descartados or perdidas) times 100.

**Key detail:** The `mixPct` is computed frontend-side in the computed array — it is NOT provided by the backend. The pattern is:

```javascript
// App.html lines 267-281 (razonesNoPasoRows)
const totalBase = rnp._totalDescartados?.total?.count || 0;
const calcMix = (metric) => totalBase > 0
    ? ((metric?.total?.count || 0) / totalBase * 100).toFixed(1)
    : '0.0';
```

**Key detail:** The same `calcMix` function is applied to ALL rows including the `_totalDescartados` row itself, which gets `mixPct: '100.0'` hardcoded. This summary row has `isSummary: true` which the template uses for bold styling.

**Key detail for razonesPerdioVenta:** The backend includes `sinEspecificar` (lost deals with empty `razon_perdida` field) as an extra 14th reason on top of the 13 labeled reasons. The `razonesPerdioRows` computed includes all 14 reasons + the `_totalPerdidas` summary = 15 rows total.

**Key detail:** The razones tables use the same 9-column structure as the incontactables/sinRespuesta tables (Razón | Mix% | Total×3 | Manufacturers×3 | Individuals×3), giving 11 columns per row including the Mix% column.

### Pattern 4: Mix% Column Rendering

```html
<!-- Index.html lines 1111-1118 (noPasoVentas table) -->
<td class="col-percentage" style="text-align:center; min-width:70px;">
    <div class="percentage-cell">
        <div class="percentage-bar"
            :style="{ width: row.mixPct + '%', background: 'var(--accent-danger, #ef4444)' }">
        </div>
        <span class="percentage-value" :style="row.isSummary ? 'font-weight:700;' : ''">
            {{ row.mixPct }}%
        </span>
    </div>
</td>
```

This uses the same `.percentage-cell` / `.percentage-bar` pattern as other percentage columns — the inline bar acts as a visual progress indicator proportional to the mix percentage.

### Pattern 5: Section Registration in reportSections

All Phase 3 sections are already registered in the static `reportSections` array (App.html lines 165-175). The accordion framework in Index.html iterates `v-for="section in reportSections"` and renders the correct table based on `v-else-if="section.id === '...'"`.

```javascript
// App.html lines 165-175
const reportSections = [
    { id: 'embudoGeneral',           label: 'Embudo General' },
    { id: 'incontactables',          label: 'Incontactables' },
    { id: 'crossSelling',            label: 'Cross Selling' },
    { id: 'matrizContactabilidad',   label: 'Matriz de Contactabilidad' },
    { id: 'semaforoContesto',        label: 'Semáforo Contestó' },
    { id: 'semaforoNoContesto',      label: 'Semáforo No Contestó' },
    { id: 'sinRespuesta',            label: 'Sin Respuesta 6to Toque' },
    { id: 'noPasoVentas',            label: 'Por qué no pasó a Ventas' },
    { id: 'perdioVenta',             label: 'Por qué perdió la venta' }
];
```

### Anti-Patterns to Avoid

- **Do not add a separate segment selector per semaforo grid.** Both grids share `semaforoSegment` intentionally. Splitting into two refs would break UX consistency.
- **Do not recompute mixPct in the backend.** The `_totalDescartados` / `_totalPerdidas` denominator is already provided. The frontend computes the ratio — this is the correct pattern (backend sends counts, frontend derives percentages).
- **Do not hardcode product/country column headers.** The `productKeys` and `countryKeys` arrays come from the backend and vary by period. Template must use `v-for="col in reportData.matrizContactabilidad.productKeys"` — never a fixed list.
- **Do not assume Correo exists in semaforoNoContesto.** The backend explicitly excludes Correo from `calculateSemaforoNoContesto_`. Accessing `reportData.semaforoNoContesto.correo` returns `undefined`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mix% computation | Custom division in template | `calcMix(metric)` closure in the computed array | Already implemented in `razonesNoPasoRows` and `razonesPerdioRows` |
| Dynamic column headers for pivot table | Fixed `<th>` tags | `v-for="col in reportData.matrizContactabilidad.productKeys"` | Already in Index.html line 848; column set varies per period |
| Empty cell fill in semaforo grid | Manual `v-if` per channel | `v-for="n in (maxToquesContesto - row.toques.length)"` | Already in Index.html line 918; handles channel toque count asymmetry |
| Delta display for semaforo cells | Custom inline style | `delta-positive/delta-negative/delta-neutral` classes + `getSegmentValue` | Same pattern as all other tables; already implemented in semaforo grid cells |
| Segment filter for semaforo | Per-section `ref` | `semaforoSegment` shared ref | Already defined at App.html line 307; both grids reference it |

---

## Common Pitfalls

### Pitfall 1: Accessing `semaforoNoContesto.correo` (Does Not Exist)

**What goes wrong:** Accessing `reportData.semaforoNoContesto.correo` returns `undefined`. Any template expression like `snc.correo.toque1` will throw.
**Why it happens:** `calculateSemaforoNoContesto_` only builds `telefono` and `whatsapp` — Correo is intentionally excluded.
**How to avoid:** The existing `semaforoNoContestoGrid` computed only maps `snc.telefono` and `snc.whatsapp` — this is correct. Do not add Correo to the No Contesto grid.
**Warning signs:** JavaScript TypeError in the browser console when the report loads, referencing `.correo`.

### Pitfall 2: Dynamic Column Count in Matriz — Wide Table Overflow

**What goes wrong:** If there are 6+ product columns, the table becomes very wide and overflows its container.
**Why it happens:** `productKeys` length is unknown at design time. The template renders one `<th>` per product, with no max.
**How to avoid:** The outer `<div>` uses `class="report-table-wrapper"` which already applies `overflow-x: auto` in Styles.html. This is correct. Verify the wrapper class is present in Index.html line 832 — it is (`class="report-table-wrapper"`).
**Warning signs:** Table renders but last columns are clipped with no scrollbar.

### Pitfall 3: `razonesNoPasoVentas` Has Only 5 Named Reasons (not 6)

**What goes wrong:** RAZNES-01 says "6 categories." The backend has 5 named reasons + 1 catch-all (`otros`). The `otros` key covers leads that are `Perdido` but matched none of the 5 named conditions.
**Why it happens:** The 6th "reason" in the client spec is "Otros" — the backend implements this as leads that DON'T match any of the 5 conditions, not a separate tracked reason. This is correct behavior.
**How to avoid:** The `razonesNoPasoRows` computed correctly includes `{ label: 'Otros', metric: rnp.otros, ... }` as the 6th row. The total count in "Otros" represents leads with status `Perdido` and no matching BANT disqualifier.
**Warning signs:** Only 5 rows render in the No Pasó a Ventas table (the `otros` key may be null if no such leads exist, but should still render as 0).

### Pitfall 4: `razonesPerdioVenta` Counts Leads, Not Deals

**What goes wrong:** Confusion about what is being counted. A lead can have multiple lost deals. The metric counts leads (not deals) that have at least one deal with `status_venta = 'Perdido'` and a matching `razon_perdida`.
**Why it happens:** `buildSegmentedMetricWithDelta_` iterates over `currentLeads` — each unit is a lead. The `hasLostDealWithReason_` helper checks the lead's deal index.
**How to avoid:** This is intentional and correct — the report counts unique leads with the loss reason. Do not change this to count deals per lead.
**Warning signs:** Counts seem lower than expected if the client assumes a lead with 2 lost deals would count twice.

### Pitfall 5: `mixPct` Bar Width — Values Above 100% Possible

**What goes wrong:** `.percentage-bar` uses `width: row.mixPct + '%'`. If any individual reason's count exceeds `_totalDescartados` count (which should be impossible but can happen if the backend's reason-counting is overlapping), the bar would overflow the cell.
**Why it happens:** The reasons in `razonesNoPasoVentas` can overlap — a lead can match multiple reasons simultaneously. Therefore, the sum of all reason counts can exceed `_totalDescartados`. The individual `mixPct` values can sum to more than 100%.
**How to avoid:** Cap the bar width: `:style="{ width: Math.min(Number(row.mixPct), 100) + '%', ... }"`. The display value `{{ row.mixPct }}%` can still show the real computed number. Verify whether the existing template has this cap — it does NOT currently cap at 100%. This is a candidate fix.
**Warning signs:** Mix% bar visually overflows its cell container when overlap is high.

### Pitfall 6: `_totalDescartados` Row in razonesNoPasoRows Has `mixPct: '100.0'` — Not Recomputed

**What goes wrong:** The `Total Descartados` summary row uses hardcoded `mixPct: '100.0'`. If `_totalDescartados.total.count === 0`, the `calcMix` function returns `'0.0'`, but the summary row still shows `100.0%`. This is a cosmetic inconsistency when there are zero descartados.
**Why it happens:** The summary row is hardcoded: `{ label: 'Total Descartados', metric: rnp._totalDescartados, type: 'count', isSummary: true, mixPct: '100.0' }` — `mixPct` is not run through `calcMix`.
**How to avoid:** This is acceptable behavior — if there are no descartados, `100.0%` on a zero row is semantically correct (100% of zero). Not a blocking bug.

---

## Code Examples

### matrizContactabilidad Backend Return Shape (verified from Analytics.js lines 987-993)

```javascript
{
    byProduct: {
        toque1: { 'Membresía Premium': 5, 'Membresía Básica': 3 },
        toque2: { 'Membresía Premium': 4, 'Membresía Básica': 2 },
        // ... toque3 through toque10
    },
    byCountry: {
        toque1: { 'México': 6, 'Colombia': 2 },
        // ...
    },
    tocTotal: { toque1: 8, toque2: 6, toque3: 4, ... },
    productKeys: ['Membresía Básica', 'Membresía Premium'],  // sorted
    countryKeys:  ['Colombia', 'México']                       // sorted
}
// NOTE: Each cell value is a plain Number — no {count, pct, delta} object
```

### semaforoContesto Backend Return Shape (verified from Analytics.js lines 570-609)

```javascript
{
    telefono: {
        toque1: { total: {count, pct, delta}, manufacturers: {...}, individuals: {...} },
        toque2: { ... },
        toque3: { ... }
    },
    whatsapp: {
        toque1: { ... },
        toque2: { ... },
        toque3: { ... }
    },
    correo: {
        toque1: { ... },
        toque2: { ... },
        toque3: { ... },
        toque4: { ... }   // Correo has 4 toques; Telefono/WhatsApp have 3
    }
}
```

### semaforoNoContesto Backend Return Shape (verified from Analytics.js lines 650-678)

```javascript
{
    telefono: { toque1: segmented_metric, toque2: segmented_metric, toque3: segmented_metric },
    whatsapp:  { toque1: segmented_metric, toque2: segmented_metric, toque3: segmented_metric }
    // No 'correo' key — excluded by design
}
```

### razonesNoPasoVentas Backend Keys (verified from Analytics.js lines 729-813)

```javascript
{
    noPerfilAdecuado:   segmented_metric,  // leads Perdido where perfil_adecuado = 'No'
    sinPresupuesto:     segmented_metric,  // leads Perdido where tiene_presupuesto = 'No'
    sinInteresGenuino:  segmented_metric,  // leads Perdido where mostro_interes_genuino = 'No'
    necesitaTercero:    segmented_metric,  // leads Perdido where necesita_decision_tercero = 'Si'|'Sí'
    noEntendioMarketing: segmented_metric, // leads Perdido where entendio_info_marketing = 'No'
    otros:              segmented_metric,  // leads Perdido matching NONE of the above
    _totalDescartados:  segmented_metric   // ALL leads with status = 'Perdido'
}
// Note: reasons can OVERLAP — a lead can match multiple BANT conditions simultaneously
// Note: 'otros' + all named reasons ≠ _totalDescartados when overlaps exist
```

### razonesPerdioVenta Backend Keys (verified from Analytics.js lines 838-907)

```javascript
{
    sinPresupuesto:          segmented_metric,
    eligioCompetidor:        segmented_metric,  // alt: 'Eligio competidor'
    noResponde:              segmented_metric,
    timingInadecuado:        segmented_metric,
    noTienePoderDecision:    segmented_metric,  // alt: 'No tiene poder de decision'
    productoNoSeAjusta:      segmented_metric,
    cambioPrioridades:       segmented_metric,
    malaExperienciaPrevia:   segmented_metric,
    precioMuyAlto:           segmented_metric,
    procesoInternoLargo:     segmented_metric,
    seFueConOtraSolucion:    segmented_metric,  // alt: 'Se fue con otra solucion'
    noEraElPerfil:           segmented_metric,
    empresaCerro:            segmented_metric,  // alt: 'Empresa cerro'
    sinEspecificar:          segmented_metric,  // lost deals with empty razon_perdida
    _totalPerdidas:          segmented_metric   // ALL leads with any deal status_venta = 'Perdido'
}
// 13 labeled reasons + sinEspecificar + _totalPerdidas = 15 keys
```

### mixPct Computation Pattern (verified from App.html lines 270-271)

```javascript
// Frontend-computed representativeness percentage (base 100)
const totalBase = rnp._totalDescartados?.total?.count || 0;
const calcMix = (metric) =>
    totalBase > 0
        ? ((metric?.total?.count || 0) / totalBase * 100).toFixed(1)
        : '0.0';
// Returns a String like '34.5'
// Used as: mixPct: calcMix(rnp.noPerfilAdecuado)
// Summary row uses hardcoded: mixPct: '100.0'
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Build all tables from scratch | All six Phase 3 table templates already exist in Index.html | Phase 3 is verification + audit, not build |
| Fixed product/country column headers | Dynamic `v-for` driven by `productKeys`/`countryKeys` from backend | Column set is period-dependent — could be 1 or 8 columns |
| Per-section segment selector | Shared `semaforoSegment` ref drives both semaforo grids | Intentional UX consistency — one filter, two grids |
| Flat reason list | mixPct computed per row against `_totalDescartados` / `_totalPerdidas` | Base-100 representativeness is a frontend concern, not a backend one |

---

## Open Questions

1. **Does the mixPct percentage bar need a `Math.min(value, 100)` cap?**
   - What we know: `razonesNoPasoVentas` reasons CAN overlap — a lead can match multiple BANT disqualifiers simultaneously. Individual mixPct values can exceed 100% for the sum, though individually each should be <= 100%.
   - What's unclear: Whether individual reason mixPct values can exceed 100% in practice (they would if the same lead contributes to both reason A and reason B and there are very few total descartados).
   - Recommendation: Cap the bar width to `Math.min(Number(row.mixPct), 100)` for defensive rendering. The text label can still show the real value.

2. **Should the Matriz de Contactabilidad show delta % vs the previous period?**
   - What we know: The backend `calculateMatrizContactabilidad_` is only called for the current period (not the previous period). It does not return delta values. The template shows raw counts only.
   - What's unclear: Whether Christian expects delta comparison in the contactability matrix.
   - Recommendation: Current implementation (counts only, no delta) matches the client spec description which says "how many leads reached that toque in that product/country" — no delta requirement listed. Treat as current behavior is correct.

3. **Are the product/country values in fact_leads trimmed consistently?**
   - What we know: The backend uses `String(lead.servicio_interes || '').trim() || 'Sin Producto'` and falls back to `'Sin Producto'`. If data has inconsistent casing or spacing, multiple columns might appear for the same product.
   - What's unclear: Data quality in the actual Google Sheets `fact_leads` table.
   - Recommendation: Not a code issue — the backend trims values. If the client sees spurious columns, the fix is data cleanup in the Sheets file. Not a Phase 3 concern.

---

## Validation Architecture

Manual browser testing is the only viable approach for this GAS + CDN stack. No automated test framework exists or is installable without a build step.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual browser testing + GAS Logger (no Jest/Vitest/pytest — not viable in this stack) |
| Config file | None |
| Quick run command | Open GAS web app URL; navigate to Reportes; click "Generar Reporte" |
| Full suite command | Walk all 5 Phase 3 success criteria in a browser session with real data |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Verification Step | Automated? |
|--------|----------|-----------|-------------------|-----------|
| TOQUES-01 | Toques as rows, dynamic product/country columns | Manual smoke | Open Matriz de Contactabilidad section; confirm rows are "Toque 1" through "Toque 10"; confirm columns are product names by default | Manual only |
| TOQUES-02 | Each cell shows lead count for that toque × product/country | Manual smoke | Verify cell values are non-negative integers; toggle to "País" mode and verify country names appear as columns | Manual only |
| TOQUES-03 | Semaforo Contesto grid: 3 channels × 3-4 toque columns | Manual smoke | Open Semáforo Contestó section; verify 3 rows (Telefono, WhatsApp, Correo); verify 4 columns (Toque 1-4); verify Correo shows count in Toque 4, Telefono and WhatsApp show `--` in Toque 4 | Manual only |
| TOQUES-04 | Semaforo No Contesto grid: 2 channels × 3 toque columns | Manual smoke | Open Semáforo No Contestó section; verify only Telefono and WhatsApp rows (no Correo); verify 3 columns | Manual only |
| TOQUES-05 | Sin Respuesta 6to Toque indicator renders with segments | Manual smoke | Open Sin Respuesta 6to Toque section; verify single row with Total/Manufacturers/Individuals columns and delta arrows | Manual only |
| RAZNES-01 | 6 razones categories render in noPasoVentas table | Manual smoke | Open "Por qué no pasó a Ventas" section; count rows — should be 6 reason rows + 1 summary row (Total Descartados) | Manual only |
| RAZNES-02 | Mix% column shows representativeness per reason | Manual smoke | Verify Mix% column exists; verify Total Descartados row shows 100.0%; verify sum of individual Mix% values may exceed 100% due to reason overlap | Manual only |
| RAZNES-03 | Delta % arrows render for all razones | Manual smoke | Every reason row shows delta arrow (up/down/neutral) with percentage value | Manual only |
| RAZPERD-01 | 13+ razones categories render in perdioVenta table | Manual smoke | Open "Por qué perdió la venta" section; count rows — should be 13 + sinEspecificar + Total Perdidas = 15 rows | Manual only |
| RAZPERD-02 | Mix% column shows representativeness per loss reason | Manual smoke | Verify Mix% column; Total Perdidas row shows 100.0%; individual reason Mix% values are proportional | Manual only |
| RAZPERD-03 | Delta % arrows render for all loss reasons | Manual smoke | Every reason row shows delta arrow with percentage value | Manual only |

### GAS-Side Smoke Test (existing)

```
GAS Script Editor → Run → testSDRReport_()
Validates all 9 report sections exist in the JSON response.
For Phase 3 verification, manually inspect result.semaforoContesto, result.matrizContactabilidad
and result.razonesNoPasoVentas in the GAS Logger output.
```

### Manual Acceptance Checklist (Phase 3 Success Criteria)

- [ ] SC1: Contactability matrix renders with Toque 1-10 as rows and product/country names as dynamic columns; row totals match column subtotals
- [ ] SC2: Both semaphore grids render correctly — Contesto shows 3 channels (incl. Correo), NoContesto shows 2 channels (excl. Correo); segment selector changes counts in both grids
- [ ] SC3: Sin Respuesta indicator renders with count + delta for all three segments
- [ ] SC4: Razones No Pasó a Ventas shows 6 reason rows + 1 summary, with Mix% column and delta arrows; Total Descartados row is bold
- [ ] SC5: Razones Perdió la Venta shows 14 reason rows + 1 summary, with Mix% column and delta arrows; Total Perdidas row is bold

### Wave 0 Gaps

None — existing infrastructure covers all Phase 3 requirements. All tables, computed arrays, CSS, section registrations, and return-block exports already exist. This phase is verification + audit only.

---

## Sources

### Primary (HIGH confidence)

- `App.html` lines 155-307 — `reportSections` array, `matrizPivotMode`, `semaforoContestoGrid`, `semaforoNoContestoGrid`, `maxToquesContesto`, `maxToquesNoContesto`, `sinRespuestaRows`, `razonesNoPasoRows`, `razonesPerdioRows`, `semaforoSegment` — all verified present
- `App.html` lines 2043-2046 — Return block confirms all Phase 3 symbols exported to template
- `Index.html` lines 831-1322 — Full markup for all 6 Phase 3 table sections verified present
- `Analytics.js` lines 532-993 — `calculateSemaforoContesto_`, `calculateSemaforoNoContesto_`, `calculateSinRespuesta6toToque_`, `calculateRazonesNoPasoVentas_`, `calculateRazonesPerdioVenta_`, `calculateMatrizContactabilidad_` — all return shapes verified
- `Analytics.js` lines 1005-1097 — `getSDRReport` orchestrator confirms all 9 sections are calculated and returned in the result envelope

### Secondary (MEDIUM confidence)

- `Analytics.js` lines 1105-1200 — `testSDRReport_()` smoke test; does NOT verify Phase 3 section keys individually (only checks that the section keys exist, not their internal structure)

### Tertiary (LOW confidence)

- None — all findings are directly from source code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from source files; no new dependencies
- Architecture: HIGH — all tables, computeds, and CSS already exist and are wired; backend data shapes verified directly from Analytics.js function signatures and return statements
- Pitfalls: HIGH — each pitfall identified from actual code asymmetries (semaforo channel counts, reason overlap, dynamic columns)
- Open questions: MEDIUM — mixPct cap and delta in matriz are UX questions, not technical gaps

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable GAS + Vue 3 CDN stack; backend data contract locked)
