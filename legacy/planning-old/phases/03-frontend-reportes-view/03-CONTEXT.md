# Phase 3: Frontend Reportes View - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the "Reportes" view in the CRM UI — a new sidebar nav item visible only to ADMIN role. Displays 8 report tables with date range filtering, consuming JSON from the existing `getSDRReport(dateIn, dateOut)` backend in Analytics.js. No charts, no export, no per-vendor reports (those are v2).

</domain>

<decisions>
## Implementation Decisions

### Table Layout & Density
- Spreadsheet-dense styling — compact rows, small font, maximize data visible (financial dashboard feel)
- Grouped columns per segment: | Metric | Total (Count|%|Delta) | Manufacturers (Count|%|Delta) | Individuals (Count|%|Delta) |
- Flat list for Embudo General (all 13 metrics, no sub-headers or visual grouping)
- Semaforo tables rendered as grid matrices (rows = channels, columns = toque numbers), not flat rows
- Section titles as card headings above each table (matches existing chart-title pattern)
- Percentage columns show text + mini inline bar (colored bar behind the % value for visual scanning)
- Zero values displayed normally as '0' and '0%' — no dimming

### Date Picker & Controls
- Calendar range picker (visual popup where user clicks start/end dates) — not plain date inputs
- Comparison period displayed explicitly (label like "Comparando vs: 1 Ene - 31 Ene") so user knows what Delta% references
- Date controls in a sticky top bar, always visible when scrolling through tables
- Auto-load current month report when user navigates to the Reportes view

### Page Structure
- Accordion sections — click to expand/collapse each of the 8 report sections
- Multiple sections can be open simultaneously (not exclusive)
- Embudo General opens by default, rest collapsed
- Quick-nav anchor links at top (row of clickable section names that jump to and open the target section)

### Delta% Visual Treatment
- Green arrow up (↑ +15%) for positive, Red arrow down (↓ -8%) for negative, Gray (— 0%) for no change
- Always green=up, red=down — no context-aware color inversion for "bad" metrics
- Show extreme values as-is (no cap at ±999%)
- Delta% column header has tooltip explaining comparison period

### Loading State
- Full-page spinner with "Generando reporte..." message (reuses existing loader-ring + loader-text pattern)
- Cancel button available while loading — stops request and restores previous state
- Generate Report button disabled during loading

### Empty & Error States
- No data: friendly message "No hay datos para el rango seleccionado. Intenta con otras fechas." replacing tables
- Backend error: inline error card (not toast) with error message and "Reintentar" button

### Claude's Discretion
- Calendar range picker library choice (Flatpickr CDN vs custom — Claude picks best for GAS environment)
- Horizontal scroll vs fixed-width table approach (based on actual data density and screen width)
- Exact spacing, typography, and responsive breakpoints
- Accordion animation style
- Quick-nav visual design

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `navItems` computed array in App.html — add new entry for 'reportes' with role filtering already in template (line 44-45: `userRole === 'ADMIN'`)
- `currentView` / `currentPageTitle` pattern — add 'reportes' case to titles map (App.html line 88-94)
- `.stat-card`, `.chart-card`, `.chart-title` CSS classes — card heading pattern for report sections
- `.leads-table` class — base table styling (can extend for dense report tables)
- `toast` reactive object + `showToast()` method — existing notification system
- `loading` ref + `.loader-ring` + `.loader-text` — existing loading spinner pattern
- Material Symbols Outlined icon font — already loaded via CDN

### Established Patterns
- Vue 3 Composition API with `setup()` return — all state as refs/reactives, methods as functions
- Single-file architecture: Index.html (template), App.html (logic), Styles.html (CSS)
- `google.script.run.withSuccessHandler().withFailureHandler()` for backend calls
- Role-based nav visibility via `v-if` conditions in template
- Dark/light theme via `isDark` ref and CSS variables

### Integration Points
- Sidebar nav: Add `{ id: 'reportes', icon: 'assessment', label: 'Reportes' }` to navItems, restrict to ADMIN in template v-if
- View routing: Add `v-if="currentView === 'reportes'"` section in main content area
- Backend call: `google.script.run.getSDRReport(dateIn, dateOut)` — returns JSON with all 8 sections
- Styles: New CSS in Styles.html for report-specific classes

</code_context>

<specifics>
## Specific Ideas

- Tables should feel like a financial/analytics dashboard — dense, data-forward, not decorative
- Semaforo tables as grid matrices make the channel x toque pattern visually obvious
- The accordion with quick-nav gives the feel of a structured report you can drill into
- Mini bars behind percentages help spot outliers at a glance without charts (since charts are v2)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-frontend-reportes-view*
*Context gathered: 2026-03-04*
