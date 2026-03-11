# Phase 1: Scaffolding — Research

**Researched:** 2026-03-11
**Domain:** Vue 3 Composition API + Google Apps Script bridge + Flatpickr date range
**Confidence:** HIGH — all findings verified directly from source files in the repo

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERIOD-01 | User can select a start date and end date for the period to analyze | Flatpickr already loaded in Index.html (CDN), `.date-range-picker` input exists, `dateRange` reactive ref exists |
| PERIOD-02 | User can choose comparison type: "vs período anterior" or "vs año anterior" | `compareType` ref exists with values `'prev_period'`/`'yoy'`, `<select>` with both options already in Index.html line 385-389 |
| PERIOD-03 | When the period changes, all reports update with new data | `generateReport()` function exists and calls `getSDRReport`, wired to "Generar Reporte" button; auto-triggered on view entry |
</phase_requirements>

---

## Summary

Phase 1 Scaffolding is largely **already implemented** in the codebase. The Reportes view, period selector UI, `getSDRReport` API call, loading states, error handling, and result storage in Vue reactive state all exist and are wired together. The planner's job is to verify correctness of each piece, fix any gaps, and confirm the full data flow works end-to-end.

The main risk is that `getSDRReport` lives in `Analytics.js` and is **not** re-exposed in `Código.js`. In Google Apps Script, all `.gs`/`.js` files in the same project share the same global scope — so `google.script.run.getSDRReport()` works as long as `Analytics.js` is deployed in the same GAS project. This is the architecture already in use; no plumbing change is needed.

The one genuine gap: the Reportes nav link is only visible to `ADMIN` and `GERENTE` roles (SDR and AE lists do not include `'reportes'`). Whether this is intentional must be verified by the planner before finalizing.

**Primary recommendation:** Audit each piece (nav visibility, flatpickr init, compareType watcher, generateReport call) against the Phase 1 success criteria and close any remaining gaps. Do not re-build what exists.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | CDN (petite-vue not used — full Vue 3) | Reactive state, computed, watch, v-if rendering | Already in use across entire app |
| Flatpickr | CDN (jsdelivr) | Date range picker | Already loaded in Index.html line 15-16; `.date-range-picker` class already targeted |
| Google Apps Script `google.script.run` | N/A (GAS runtime) | Async bridge to backend | Only async mechanism available in GAS web apps |
| Tailwind CSS | CDN | Utility styling | Already in use in Styles.html |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Material Symbols Outlined | Google Fonts CDN | Icons | Already used throughout; `assessment` icon for Reportes nav |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flatpickr range mode | Native `<input type="date">` pair | Flatpickr already loaded; native inputs would require manual range validation; Flatpickr is the correct choice |
| `AbortController` (used for cancelReport) | None / flag-only | AbortController is correct for cancelling in-flight pseudo-requests; already implemented |

**Installation:** Nothing to install. All CDN dependencies are already present in Index.html.

---

## Architecture Patterns

### How the App Is Structured

```
Index.html          — HTML template (3004 lines), mounts #app, contains all v-if view blocks
App.html            — Pure <script> block (2070 lines), Vue 3 createApp + setup()
Styles.html         — CSS, included via <?!= include('Styles') ?>
Código.js           — Backend CRUD, doGet(), utility functions
Analytics.js        — Report calculations, exposes getSDRReport() globally
```

GAS deploys all `.js` files into one shared global scope. `google.script.run` can call any top-level function from any `.js` file in the project without explicit export.

### Pattern 1: View Navigation

**What:** `currentView` is a `ref('dashboard')` in App.html setup(). Clicking a sidebar nav item sets `currentView = item.id`. Views in Index.html use `v-if="currentView === 'reportes'"`.

**Key detail:** Navigation is immediate — no async, no router. The `watch(currentView, ...)` handler in App.html (line 1916) fires side effects: for `'reportes'` it initializes flatpickr and auto-calls `generateReport()`.

```javascript
// App.html line 17
const currentView = ref('dashboard');

// Index.html line 57 — nav item click
@click="currentView = item.id"

// Index.html line 371 — view rendering
<div v-if="currentView === 'reportes'" class="view reportes-view">
```

**Role visibility gap:** The nav item for `'reportes'` only appears for `ADMIN` and `GERENTE` (SDR and AE allowlists at lines 54-55 do not include `'reportes'`). This is likely intentional (reports are a management view) but must be confirmed.

### Pattern 2: google.script.run Call

**What:** All backend calls follow the same pattern — `.withSuccessHandler(fn).withFailureHandler(fn).methodName(args)`. The call is fire-and-forget; no promise. State flags (`loading`, `error`) must be managed manually.

```javascript
// Canonical pattern (App.html lines 731-756)
google.script.run
    .withSuccessHandler(function (jsonString) {
        var data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        if (data.error) {
            reportError.value = data.error;
        } else {
            reportData.value = data;
        }
        reportLoading.value = false;
    })
    .withFailureHandler(function (error) {
        reportError.value = error.message || 'Error desconocido';
        reportLoading.value = false;
    })
    .getSDRReport(dateIn, dateOut, compareType.value);
```

**Critical:** `google.script.run` does not support cancellation. `cancelReport()` uses `AbortController.abort()` to set a flag, but the backend call still runs to completion — only the success/failure handlers are skipped. This is the correct GAS pattern.

### Pattern 3: Flatpickr Init on View Entry

**What:** Flatpickr is initialized inside `watch(currentView, ...)` after `nextTick()`. It is destroyed when leaving the Reportes view.

```javascript
// App.html lines 1926-1964
if (newView === 'reportes') {
    nextTick(() => {
        if (flatpickrInstance) { flatpickrInstance.destroy(); flatpickrInstance = null; }
        flatpickrInstance = flatpickr('.date-range-picker', {
            mode: 'range',
            dateFormat: 'Y-m-d',
            defaultDate: [firstDay, lastDay],
            onChange: function (selectedDates) {
                if (selectedDates.length === 2) {
                    dateRange.value = { start: selectedDates[0], end: selectedDates[1] };
                    // Also computes comparisonRange for prev_period
                }
            }
        });
        // Sets dateRange and comparisonRange, then calls generateReport()
        generateReport();
    });
}
```

**Gap:** The `onChange` handler only computes `comparisonRange` for `prev_period` mode (it subtracts the period duration). For `yoy` mode, `comparisonRange` is set by `generateReport()` via the backend metadata — it is NOT recomputed in the onChange handler. This means `comparisonLabel` may show prev_period dates even when compareType is `yoy`. The planner should audit this.

### Pattern 4: compareType Watch

**What:** `compareType` is a `ref('prev_period')`. When the user changes the `<select>`, the planner must verify whether `generateReport()` is triggered automatically or must be triggered by a watch or an explicit button press.

**Current state:** Looking at the code, there is NO `watch(compareType, ...)` in App.html. The only triggers for `generateReport()` are:
1. Auto-call when entering the Reportes view (line 1958)
2. The "Generar Reporte" button click (Index.html line 393)

This means PERIOD-03 ("when the period changes, reports update") is only satisfied if the user clicks the button after changing compareType. If auto-trigger on compareType change is required, a `watch(compareType, generateReport)` needs to be added.

### Pattern 5: Report Data Shape

**What:** `getSDRReport` returns a JSON string. The frontend parses it and stores in `reportData`. The response shape is:

```javascript
{
  metadata: { dateIn, dateOut, compareType, previousDateIn, previousDateOut, totalLeads, ... },
  embudoGeneral: { ... },
  incontactables: { ... },
  crossSelling: { ... },
  semaforoContesto: { ... },
  semaforoNoContesto: { ... },
  sinRespuesta6toToque: { ... },
  razonesNoPasoVentas: { ... },
  razonesPerdioVenta: { ... },
  matrizContactabilidad: { ... }
}
```

Special cases already handled:
- `data.error` string → sets `reportError`, clears `reportData`
- `data.metadata.totalLeads === 0` → sets `reportData = { _empty: true }` for empty state

### Anti-Patterns to Avoid

- **Do not use async/await in App.html.** The app uses `var` + function declarations throughout. Arrow functions appear in some places (the app was written partly in ES6+ for the frontend), but the pattern must not be broken.
- **Do not add npm or build steps.** All dependencies are CDN.
- **Do not re-initialize flatpickr on an element that already has an instance.** The existing code already destroys before re-creating — preserve this pattern.
- **Do not emit backend calls without setting `reportLoading = true` first.** Silent loading states cause blank UI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range picker | Custom two-input date range with validation | Flatpickr `mode: 'range'` | Already loaded; handles edge cases (reverse selection, locale, formatting) |
| Backend call cancellation | Custom flag-based abort | `AbortController` (already used) | Consistent pattern already in place |
| Date formatting for API | Manual string concat | `formatDateYMD(date)` helper (App.html line 712) | Already exists and handles month/day padding |

---

## Common Pitfalls

### Pitfall 1: getSDRReport Not Found by google.script.run

**What goes wrong:** `google.script.run.getSDRReport()` throws "Method not found" or silently calls failureHandler.
**Why it happens:** If `Analytics.js` is not deployed as part of the GAS project, or the function name was renamed.
**How to avoid:** Confirm `Analytics.js` is in the same GAS deployment as `Código.js`. In clasp projects, all `.js` files in the root are included. Verified: `getSDRReport` is a top-level function in `Analytics.js` line 1005 — no wrapper needed.
**Warning signs:** failureHandler fires with "Script function not found: getSDRReport".

### Pitfall 2: Flatpickr Attaches to Wrong Element

**What goes wrong:** Flatpickr targets `.date-range-picker` class. If the DOM element is not rendered yet when `flatpickr(...)` is called, it silently attaches to nothing.
**Why it happens:** `v-if="currentView === 'reportes'"` means the element does not exist in the DOM when the app first loads.
**How to avoid:** The existing code wraps flatpickr init in `nextTick()` — this is correct. Do not change this timing.
**Warning signs:** Clicking the date input does nothing; `flatpickrInstance` is null after init.

### Pitfall 3: compareType Change Does Not Trigger Re-fetch

**What goes wrong:** User switches from "vs Período Anterior" to "vs Año Pasado" but the report does not update.
**Why it happens:** There is no `watch(compareType, ...)` in the current code. Only the button triggers `generateReport()`.
**How to avoid:** Add `watch(compareType, generateReport)` if PERIOD-03 requires auto-trigger on compareType change. If the UX intent is button-triggered only, document this explicitly.
**Warning signs:** Delta % values still show prev_period comparison after toggling to yoy.

### Pitfall 4: comparisonRange Shows Wrong Dates for YOY

**What goes wrong:** `comparisonLabel` shows wrong comparison period dates when `compareType === 'yoy'`.
**Why it happens:** `comparisonRange` is computed in the flatpickr `onChange` handler using prev_period math only. For YOY, `comparisonRange` should be set from `reportData.metadata.previousDateIn/Out` after the backend call returns.
**How to avoid:** After `reportData.value = data`, also update `comparisonRange` from `data.metadata.previousDateIn` and `data.metadata.previousDateOut`.
**Warning signs:** The comparison label shows dates exactly one period-length back even in YOY mode.

### Pitfall 5: Role-Based Visibility Hides Reportes from SDR/AE

**What goes wrong:** SDR and AE users cannot see the Reportes nav item.
**Why it happens:** The nav allowlist at Index.html lines 54-55 does not include `'reportes'`.
**How to avoid:** If reports should be visible to all roles, add `'reportes'` to the SDR and AE allowlists. If reports are management-only, leave as-is and document the decision.
**Warning signs:** SDR/AE logs in and sees no Reportes link.

---

## Code Examples

### Existing generateReport() (verified from App.html lines 722-757)

```javascript
function generateReport() {
    if (!dateRange.value.start || !dateRange.value.end) return;
    reportLoading.value = true;
    reportError.value = null;
    reportAbortController = new AbortController();

    var dateIn = formatDateYMD(dateRange.value.start);
    var dateOut = formatDateYMD(dateRange.value.end);

    google.script.run
        .withSuccessHandler(function (jsonString) {
            if (reportAbortController && reportAbortController.signal.aborted) return;
            try {
                var data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
                if (data.error) {
                    reportError.value = data.error;
                    reportData.value = null;
                } else if (data.metadata && data.metadata.totalLeads === 0) {
                    reportData.value = { _empty: true };
                } else {
                    reportData.value = data;
                }
            } catch (e) {
                reportError.value = 'Error al procesar la respuesta: ' + e.message;
            }
            reportLoading.value = false;
        })
        .withFailureHandler(function (error) {
            if (reportAbortController && reportAbortController.signal.aborted) return;
            reportError.value = error.message || 'Error desconocido al generar el reporte';
            reportData.value = null;
            reportLoading.value = false;
        })
        .getSDRReport(dateIn, dateOut, compareType.value);
}
```

### getSDRReport Signature (Analytics.js line 1005)

```javascript
// Parameters:
//   dateIn      — 'YYYY-MM-DD'
//   dateOut     — 'YYYY-MM-DD'
//   compareType — 'prev_period' (default) | 'yoy'
// Returns: JSON string
function getSDRReport(dateIn, dateOut, compareType) { ... }
```

### comparisonRange Patch for YOY (gap to fill)

```javascript
// After: reportData.value = data;
// Add:
if (data.metadata && data.metadata.previousDateIn && data.metadata.previousDateOut) {
    comparisonRange.value = {
        start: new Date(data.metadata.previousDateIn),
        end: new Date(data.metadata.previousDateOut)
    };
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Options API (`data()`, `methods:`) | Composition API (`setup()`, `ref`, `computed`) | App already uses Composition API — do not mix in Options API patterns |
| Separate Vue components | Single monolithic setup() | Intentional for GAS — no build step, no SFC files |
| v-show for all views | v-if per view | v-if is correct here — avoids rendering all views on load |

---

## Open Questions

1. **Should compareType change auto-trigger generateReport()?**
   - What we know: Currently no watch on compareType; only the button triggers the call
   - What's unclear: Whether PERIOD-03 intent is "button re-run" or "any selector change re-runs automatically"
   - Recommendation: Add `watch(compareType, generateReport)` for PERIOD-03 compliance; this matches the intent of "all reports update when period changes"

2. **Should Reportes be visible to SDR/AE roles?**
   - What we know: Nav allowlists at Index.html lines 54-55 exclude `'reportes'` for SDR/AE
   - What's unclear: Whether this is intentional product decision or an oversight
   - Recommendation: Planner should default to ADMIN/GERENTE-only (current state) and document; if SDR/AE need access, it is a one-line change per role

3. **Does getSDRReport require any GAS webapp re-deploy after Analytics.js changes?**
   - What we know: GAS web apps require re-deploy to pick up new code when serving via URL
   - What's unclear: Whether the project uses clasp push + manual deploy or a CI script
   - Recommendation: Not a Phase 1 blocker — Analytics.js is already complete and already deployed

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual browser testing + GAS Logger (no automated unit test framework exists or is viable in this stack) |
| Config file | None — GAS + CDN architecture does not support Jest/Vitest/pytest |
| Quick run command | Open GAS web app URL in browser, navigate to Reportes |
| Full suite command | Walk all 5 success criteria in a browser session |

**Note:** Automated unit testing is not viable for this stack. GAS has no npm ecosystem, and the frontend is a CDN-loaded SPA without a build step. The Validation Architecture below describes manual smoke tests and GAS Logger verification steps.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Verification Step | Automated? |
|--------|----------|-----------|-------------------|-----------|
| PERIOD-01 | Date range picker renders and accepts a start+end date | Manual smoke | Navigate to Reportes; flatpickr input appears; select a range; `dateRange` reactive state updates | Manual only — no DOM test runner |
| PERIOD-02 | Comparison type selector shows both options and is reactive | Manual smoke | Confirm `<select>` shows "vs Período Anterior" and "vs Año Pasado (YOY)"; change selection; `compareType.value` updates | Manual only |
| PERIOD-03 | Changing period triggers getSDRReport and populates reportData | Manual + GAS Logger | Click "Generar Reporte"; verify loading spinner appears; verify spinner disappears; verify report sections render | Manual only |

### GAS-Side Smoke Test (existing)

Analytics.js already contains `testSDRReport_()` (line 1105) — a runnable test in the GAS Script Editor. Run via: GAS Editor > Run > `testSDRReport_`. Validates that `getSDRReport('2024-01-01', '2025-12-31')` returns a valid structure without errors.

### Manual Acceptance Checklist (Phase 1 Success Criteria)

- [ ] SC1: Navigate to Reportes from sidebar without page reload (click nav item → view switches immediately)
- [ ] SC2: Date range input is functional; comparison type selector shows both options
- [ ] SC3: After clicking "Generar Reporte", `reportData` in Vue devtools contains the 9-section JSON from backend
- [ ] SC4: Loading spinner is visible while call is in flight; disappears on completion
- [ ] SC5: If backend call fails (e.g., test with invalid dates), error message renders instead of blank state

### Wave 0 Gaps

None — existing infrastructure covers all Phase 1 requirements. No new test files needed. GAS Logger + browser manual testing is the appropriate validation layer for this stack.

---

## Sources

### Primary (HIGH confidence)
- `App.html` lines 1-2070 — Vue setup(), all reportes state variables, generateReport(), watch handlers, flatpickr init
- `Index.html` lines 1-500 — HTML template, v-if view blocks, Reportes view HTML, nav role visibility logic
- `Analytics.js` lines 1000-1097 — getSDRReport signature, parameters, return shape, compareType values
- `Código.js` — confirmed getSDRReport is NOT redeclared here; it lives only in Analytics.js

### Secondary (MEDIUM confidence)
- Google Apps Script documentation (from training): all top-level functions in any .js file in a GAS project are callable via `google.script.run` — no export/expose needed
- Flatpickr range mode behavior: `.date-range-picker` class targeting, `onChange` with `selectedDates.length === 2` guard

### Tertiary (LOW confidence — no concerns for Phase 1)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from CDN includes in Index.html and existing code
- Architecture: HIGH — read directly from source files
- Pitfalls: HIGH — each pitfall identified from actual code gaps, not speculation
- Gaps/open questions: MEDIUM — behavior intent requires product decision, not technical discovery

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable stack — GAS + Vue 3 CDN does not change rapidly)
