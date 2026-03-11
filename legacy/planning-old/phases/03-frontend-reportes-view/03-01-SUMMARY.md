---
phase: 03-frontend-reportes-view
plan: 01
subsystem: frontend
tags: [ui, reportes, flatpickr, accordion, date-picker]
requires: [Analytics.js:getSDRReport]
provides: [reportes-view-scaffold, date-range-picker, accordion-framework]
affects: [Index.html, App.html, Styles.html]
decisions:
  - "Use Flatpickr for date range selection with auto-initialization on view entry"
  - "Default to current month date range on initial load"
  - "Auto-load report immediately after Flatpickr initializes"
  - "Use border-collapse separate for sticky table headers compatibility"
  - "Open embudoGeneral section by default in accordion"
tech_stack_added:
  libraries:
    - name: Flatpickr
      version: latest (CDN)
      purpose: Date range picker with locale support
  patterns:
    - name: Accordion UI pattern
      description: Collapsible report sections with toggle/scroll functionality
    - name: Sticky controls bar
      description: Date picker remains visible during scroll
key_files_created: []
key_files_modified:
  - path: gas-crm-project/Index.html
    changes: "Added Flatpickr CDN links, created reportes view template with date controls, loading/error/empty states, accordion skeleton, quick-nav"
  - path: gas-crm-project/App.html
    changes: "Added reportes nav item, page title, report state management, Flatpickr initialization, generateReport/cancelReport/toggleSection/scrollToSection functions"
  - path: gas-crm-project/Styles.html
    changes: "Added 423 lines of report-specific CSS: sticky controls bar, accordion, quick-nav, dense table base, percentage bars, delta colors, Flatpickr dark theme"
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_modified: 3
  lines_added: 644
  commits: 2
completed_at: "2026-03-04"
---

# Phase 03 Plan 01: Reportes View Scaffolding Summary

ADMIN-only Reportes nav with Flatpickr date picker, accordion framework, loading/error/empty states, and complete report CSS infrastructure.

## One-Liner

Reportes view shell with Flatpickr date range picker defaulting to current month, 8-section accordion framework (embudoGeneral open by default), sticky date controls, loading overlay, error/empty states, dense table CSS, percentage bars, delta colors, and Flatpickr dark theme override.

## What Was Built

### Task 1: Reportes Navigation, Routing, and State Management
**Commits:** 873c53e

**Frontend Structure:**
- **Navigation:** Added `{ id: 'reportes', icon: 'assessment', label: 'Reportes' }` nav item (ADMIN-only via existing role filter)
- **Page Title:** Added `reportes: 'Reportes'` to currentPageTitle map
- **Flatpickr CDN:** Loaded CSS and JS from jsdelivr CDN in Index.html head

**View Template (Index.html):**
- **Loading Overlay:** Full-screen with spinner, "Generando reporte..." text, and Cancel button
- **Date Controls Bar:** Sticky top bar with date range picker and comparison period label
- **Error State:** Inline error card with error icon, message, and Reintentar button
- **Empty State:** Friendly message for zero-data scenarios
- **Initial State:** Prompt to select dates and click "Generar Reporte"
- **Report Content:** Quick-nav buttons + 8-section accordion (content stubs for Plans 02-03)

**State Management (App.html):**
```javascript
reportData, reportLoading, reportError, dateRange, comparisonRange,
openSections: ['embudoGeneral'], // Default open
reportSections: [
  { id: 'embudoGeneral', label: 'Embudo General' },
  { id: 'incontactables', label: 'Incontactables' },
  { id: 'crossSelling', label: 'Cross Selling' },
  { id: 'semaforoContesto', label: 'Semaforo Contesto' },
  { id: 'semaforoNoContesto', label: 'Semaforo No Contesto' },
  { id: 'sinRespuesta', label: 'Sin Respuesta 6to Toque' },
  { id: 'noPasoVentas', label: 'Por que no paso a Ventas' },
  { id: 'perdioVenta', label: 'Por que perdio la venta' }
]
```

**Flatpickr Integration:**
- **Init on view entry:** watch(currentView) triggers Flatpickr setup with current month default
- **Locale:** Spanish (firstDayOfWeek: 1, rangeSeparator: ' a ')
- **Auto-load:** generateReport() called immediately after date range set
- **Cleanup:** destroy() when leaving reportes view (oldView check)

**Comparison Period Logic:**
```javascript
// If user selects Jan 1-31 (31 days):
// Comparison: Dec 1-31 (same 31-day period ending day before selected start)
const diffMs = selectedEnd - selectedStart;
const compEnd = new Date(selectedStart - 86400000); // Day before start
const compStart = new Date(compEnd - diffMs); // Same duration backward
```

**Report Functions:**
- **generateReport():** Calls google.script.run.getSDRReport(dateIn, dateOut), handles JSON/error/empty responses
- **cancelReport():** Aborts via AbortController, stops loading spinner
- **toggleSection():** Opens/closes accordion sections by ID
- **scrollToSection():** Opens section if closed + smooth scrolls to #section-{id}

### Task 2: Report-Specific CSS Styles
**Commits:** 9b8c56a

**Sticky Controls Bar:**
```css
.report-controls-bar {
  position: sticky; top: 0; z-index: 20;
  display: flex; justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary); /* Opaque for scroll visibility */
}
```

**Dense Report Tables:**
- **Font size:** 0.8rem body text, 0.72rem uppercase headers
- **Padding:** 6-8px (vs 10-12px in standard tables)
- **Border-collapse:** `separate` with `border-spacing: 0` (sticky headers requirement per RESEARCH.md)
- **Sticky metric column:** `.col-metric { position: sticky; left: 0; z-index: 5; }`
- **Sticky headers:** `thead th { position: sticky; top: 0; z-index: 10; }`

**Percentage Cell with Inline Bar:**
```css
.col-percentage { padding: 0 !important; }
.percentage-bar { /* Background bar behind value */ }
.percentage-value { position: relative; z-index: 1; }
```

**Delta% Colors:**
- `.delta-positive { color: var(--accent-success); }` (green with ▲ arrow)
- `.delta-negative { color: var(--accent-danger); }` (red with ▼ arrow)
- `.delta-neutral { color: var(--text-muted); }` (gray with ─ dash)

**CSS Tooltip (data-tooltip):**
```css
[data-tooltip]::after { /* Hover tooltip for Delta% header */ }
```

**Accordion Sections:**
- Collapsible with chevron rotation
- Hover background change
- Section body hidden via `v-show` (Vue directive)

**Quick-Nav:**
- Horizontal scrollable button row
- Active state highlights open sections
- Smooth scroll to section on click

**Flatpickr Dark Theme:**
- Overrides for `.flatpickr-calendar`, `.flatpickr-day`, etc.
- Uses existing CSS variables (--bg-card, --accent-primary, --border)
- Matches CRM dark mode aesthetic

**Responsive:**
- Mobile: stacks controls bar vertically, disables sticky metric column

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

**Manual Checks Performed:**
1. ✅ Search Index.html for `currentView === 'reportes'` → View exists at line 383
2. ✅ Search App.html for `generateReport` → Function exists at line 372
3. ✅ Search App.html for `flatpickr` init code → Found in watch(currentView) at line ~1150
4. ✅ Verify navItems includes reportes → Confirmed at line 103
5. ✅ Confirm currentPageTitle map includes `reportes` → Confirmed at line 112
6. ✅ Search Styles.html for `.report-table` → 10 occurrences
7. ✅ Search Styles.html for `.flatpickr-calendar` → Dark theme override exists at line 1764

**All verification criteria met.**

## Known Limitations / Future Work

1. **Table content stubs:** Report sections show "Seccion en construccion..." placeholder text. Plans 02 and 03 will populate tables.
2. **No getSDRReport validation:** This plan assumes Analytics.js getSDRReport exists and returns correct JSON structure. Integration testing happens in Plans 02-03.
3. **No server startup:** This is frontend-only scaffolding. Manual testing requires deploying to Apps Script environment.

## Files Changed

**Modified (3 files):**
- `gas-crm-project/Index.html` — Flatpickr CDN links + reportes view template
- `gas-crm-project/App.html` — Reportes nav item, state, Flatpickr init, report functions
- `gas-crm-project/Styles.html` — 423 lines of report CSS

## Commits

| Commit  | Type | Message                                                                 |
|---------|------|-------------------------------------------------------------------------|
| 873c53e | feat | Add Reportes nav, view routing, Flatpickr CDN, report state           |
| 9b8c56a | feat | Add report-specific CSS styles                                          |

## Self-Check

**Files created:**
- `.planning/phases/03-frontend-reportes-view/03-01-SUMMARY.md` → ✅ Created

**Commits exist:**
- 873c53e → ✅ Found
- 9b8c56a → ✅ Found

**Modified files exist:**
- gas-crm-project/Index.html → ✅ Exists
- gas-crm-project/App.html → ✅ Exists
- gas-crm-project/Styles.html → ✅ Exists

## Self-Check: PASSED
