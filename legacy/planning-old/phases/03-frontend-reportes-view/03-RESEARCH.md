# Phase 3: Frontend Reportes View - Research

**Researched:** 2026-03-04
**Domain:** Vue 3 frontend UI with date pickers, dense tables, and accordion components
**Confidence:** HIGH

## Summary

This phase builds a role-restricted admin dashboard view for analytics reports. The technical stack is already established (Vue 3 Composition API + Google Apps Script HTML Service + Material Symbols icons), so research focuses on three main domains: (1) date range picker implementation via CDN-loaded Flatpickr, (2) dense table styling patterns for financial dashboards with inline progress bars, and (3) accordion component patterns using Vue 3 provide/inject for collapsible report sections.

The existing codebase follows a single-file architecture (Index.html template, App.html logic, Styles.html CSS) with Vue 3 CDN and google.script.run backend calls. All patterns needed for this phase — role-based navigation, loading states, error handling, reactive state — are already established in the current leads/negociaciones views.

**Primary recommendation:** Use Flatpickr 4.x via CDN for the date range picker (range mode, onChange handler), create accordion state with Vue 3 ref/reactive and provide/inject pattern, style tables with compact CSS (8-10px padding, sticky headers, inline progress bars for percentages), and follow existing google.script.run patterns with withSuccessHandler/withFailureHandler for the getSDRReport backend call.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Table Layout & Density:**
- Spreadsheet-dense styling — compact rows, small font, maximize data visible (financial dashboard feel)
- Grouped columns per segment: | Metric | Total (Count|%|Delta) | Manufacturers (Count|%|Delta) | Individuals (Count|%|Delta) |
- Flat list for Embudo General (all 13 metrics, no sub-headers or visual grouping)
- Semaforo tables rendered as grid matrices (rows = channels, columns = toque numbers), not flat rows
- Section titles as card headings above each table (matches existing chart-title pattern)
- Percentage columns show text + mini inline bar (colored bar behind the % value for visual scanning)
- Zero values displayed normally as '0' and '0%' — no dimming

**Date Picker & Controls:**
- Calendar range picker (visual popup where user clicks start/end dates) — not plain date inputs
- Comparison period displayed explicitly (label like "Comparando vs: 1 Ene - 31 Ene") so user knows what Delta% references
- Date controls in a sticky top bar, always visible when scrolling through tables
- Auto-load current month report when user navigates to the Reportes view

**Page Structure:**
- Accordion sections — click to expand/collapse each of the 8 report sections
- Multiple sections can be open simultaneously (not exclusive)
- Embudo General opens by default, rest collapsed
- Quick-nav anchor links at top (row of clickable section names that jump to and open the target section)

**Delta% Visual Treatment:**
- Green arrow up (↑ +15%) for positive, Red arrow down (↓ -8%) for negative, Gray (— 0%) for no change
- Always green=up, red=down — no context-aware color inversion for "bad" metrics
- Show extreme values as-is (no cap at ±999%)
- Delta% column header has tooltip explaining comparison period

**Loading State:**
- Full-page spinner with "Generando reporte..." message (reuses existing loader-ring + loader-text pattern)
- Cancel button available while loading — stops request and restores previous state
- Generate Report button disabled during loading

**Empty & Error States:**
- No data: friendly message "No hay datos para el rango seleccionado. Intenta con otras fechas." replacing tables
- Backend error: inline error card (not toast) with error message and "Reintentar" button

### Claude's Discretion

- Calendar range picker library choice (Flatpickr CDN vs custom — Claude picks best for GAS environment)
- Horizontal scroll vs fixed-width table approach (based on actual data density and screen width)
- Exact spacing, typography, and responsive breakpoints
- Accordion animation style
- Quick-nav visual design

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Nueva vista "Reportes" en sidebar con icono, visible solo para ADMIN | Role-based navigation pattern already established in navItems computed array (App.html line 44-45) |
| UI-02 | Selector de rango de fechas (Day In / Day Out) con date pickers | Flatpickr CDN library with range mode, onChange handler to calculate comparison period |
| UI-03 | Tabla Embudo General con columnas Total\|%\|Delta por segmento | Dense table CSS with sticky headers, inline progress bars for %, arrow icons for Delta |
| UI-04 | Tabla Incontactables | Same table pattern as UI-03, consumes section from getSDRReport JSON |
| UI-05 | Tabla Cross Selling | Same table pattern |
| UI-06 | Tabla Semaforo Contesto | Grid matrix rendering (2D table: channels × toque numbers) |
| UI-07 | Tabla Semaforo No Contesto | Grid matrix rendering |
| UI-08 | Tabla Sin Respuesta 6to Toque | Standard table pattern |
| UI-09 | Tabla Por que no paso a Ventas | Standard table pattern with 12 reason rows |
| UI-10 | Tabla Por que se perdio la venta | Standard table pattern with 12 reason rows |
| UI-11 | Indicador de carga mientras se calculan metricas | Existing loader-ring + loader-text pattern, AbortController for cancel button |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | 3.x (CDN prod) | Reactive UI framework | Already in use, Composition API with ref/reactive for state management |
| Flatpickr | 4.x (CDN) | Date range picker | Lightweight (no dependencies), range mode built-in, CDN-friendly for GAS HTML Service |
| Material Symbols Outlined | Latest (CDN) | Icon font | Already loaded in Index.html, provides assessment icon for Reports nav item |
| Google Apps Script HTML Service | N/A (GAS runtime) | Backend integration | Platform constraint, google.script.run for async server calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AbortController | Browser native | Cancel fetch requests | For cancel button during report loading (UI-11) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flatpickr | Native `<input type="date">` | Native inputs don't support range mode or visual calendar popup (requirement) |
| Flatpickr | Custom date picker | Reinventing the wheel, 100+ edge cases (leap years, locales, timezones) |
| Vue 3 CDN | Vue 3 npm + build step | GAS HTML Service deployment via clasp expects static files, no build pipeline |

**Installation:**
```html
<!-- In Index.html <head> -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
```

## Architecture Patterns

### Recommended Project Structure
```
gas-crm-project/
├── Index.html           # Template (add Flatpickr CDN links)
├── App.html             # Logic (add reportes view state, date picker init, accordion logic)
├── Styles.html          # CSS (add report-table, accordion, date-controls classes)
├── Código.js            # Backend (no changes — getSDRReport already exists)
└── Analytics.js         # Backend (no changes — analytics logic complete)
```

### Pattern 1: Role-Based Navigation (Already Established)
**What:** Conditional rendering of nav items based on userRole computed property
**When to use:** Adding new ADMIN-only "Reportes" nav item (UI-01)
**Example:**
```javascript
// App.html — navItems computed array
const navItems = computed(() => [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { id: 'leads', icon: 'list_alt', label: 'Prospectos' },
  { id: 'negociaciones', icon: 'handshake', label: 'Negociaciones' },
  { id: 'reportes', icon: 'assessment', label: 'Reportes' }, // NEW
  { id: 'calendar', icon: 'calendar_month', label: 'Calendario' },
  { id: 'config', icon: 'settings', label: 'Configuración' },
]);

// Index.html — nav item rendering with v-if
<a v-if="
  userRole === 'ADMIN' ||
  (userRole === 'SDR' && ['dashboard','leads','calendar','account'].includes(item.id)) ||
  (userRole === 'AE' && ['dashboard','negociaciones','calendar','account'].includes(item.id))
" class="nav-item" :class="{ active: currentView === item.id }" @click="currentView = item.id">
```
**Source:** Existing App.html line 44-45, navItems line 79-86

### Pattern 2: Vue 3 Accordion with Provide/Inject
**What:** Parent component provides accordion state, child sections inject and toggle
**When to use:** 8 collapsible report sections (UI-03 through UI-10)
**Example:**
```javascript
// App.html setup() — accordion state
const openSections = ref(['embudoGeneral']); // Embudo opens by default

function toggleSection(sectionId) {
  const idx = openSections.value.indexOf(sectionId);
  if (idx > -1) {
    openSections.value.splice(idx, 1); // Close
  } else {
    openSections.value.push(sectionId); // Open (non-exclusive)
  }
}

// Index.html — accordion section
<div class="report-section">
  <div class="section-header" @click="toggleSection('embudoGeneral')">
    <span class="material-symbols-outlined">
      {{ openSections.includes('embudoGeneral') ? 'expand_more' : 'chevron_right' }}
    </span>
    <h3 class="chart-title">Embudo General</h3>
  </div>
  <div v-if="openSections.includes('embudoGeneral')" class="section-body">
    <!-- Table content -->
  </div>
</div>
```
**Sources:**
- [Vue 3 Composition API accordion component pattern](https://medium.com/@ademyalcin27/vue-3-design-system-series-11-ad3cc4cb171c)
- [Build an accordion component in Vue 3](https://medium.com/@teddymczieuwa/build-an-accordion-component-in-vue-3-d05ca67c2abf)

### Pattern 3: Flatpickr Range Mode with Auto-Comparison Period
**What:** Initialize Flatpickr with range mode, calculate previous period on onChange
**When to use:** Date range picker (UI-02)
**Example:**
```javascript
// App.html setup() — date picker state
const dateRange = ref({ start: null, end: null });
const comparisonRange = ref({ start: null, end: null });
let flatpickrInstance = null;

onMounted(() => {
  if (currentView.value === 'reportes') {
    // Auto-load current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    flatpickrInstance = flatpickr('.date-range-picker', {
      mode: 'range',
      dateFormat: 'Y-m-d',
      defaultDate: [firstDay, lastDay],
      onChange: function(selectedDates) {
        if (selectedDates.length === 2) {
          dateRange.value.start = selectedDates[0];
          dateRange.value.end = selectedDates[1];

          // Calculate comparison period (same length, immediately before)
          const diffMs = selectedDates[1] - selectedDates[0];
          comparisonRange.value.end = new Date(selectedDates[0].getTime() - 86400000); // Day before start
          comparisonRange.value.start = new Date(comparisonRange.value.end.getTime() - diffMs);
        }
      }
    });
  }
});
```
**Sources:**
- [Flatpickr Examples - Range Mode](https://flatpickr.js.org/examples/)
- [Date Range Calendar in Flatpickr Example](https://techsolutionstuff.com/post/date-range-calendar-in-flatpickr-example)

### Pattern 4: google.script.run with AbortController
**What:** Async backend call with cancel support and loading state
**When to use:** Fetching report data with cancel button (UI-11)
**Example:**
```javascript
// App.html setup() — report fetching
const reportData = ref(null);
const reportLoading = ref(false);
const reportError = ref(null);
let abortController = null;

function generateReport() {
  reportLoading.value = true;
  reportError.value = null;
  abortController = new AbortController();

  const dateIn = formatDate(dateRange.value.start);
  const dateOut = formatDate(dateRange.value.end);

  google.script.run
    .withSuccessHandler(function(jsonString) {
      if (abortController.signal.aborted) return; // Ignore if cancelled
      reportData.value = JSON.parse(jsonString);
      reportLoading.value = false;
    })
    .withFailureHandler(function(error) {
      if (abortController.signal.aborted) return;
      reportError.value = error.message;
      reportLoading.value = false;
    })
    .getSDRReport(dateIn, dateOut);
}

function cancelReport() {
  if (abortController) {
    abortController.abort();
    reportLoading.value = false;
  }
}
```
**Note:** Google Apps Script doesn't natively support AbortController for server-side cancellation, but we can use it client-side to ignore responses after user clicks cancel.

**Sources:**
- [HTML Service: Best Practices](https://developers.google.com/apps-script/guides/html/best-practices)
- [Canceling Fetch Requests in JavaScript with AbortController](https://medium.com/@AlexanderObregon/canceling-fetch-requests-in-javascript-with-abortcontroller-98c11d2ab54e)

### Pattern 5: Dense Table with Sticky Header
**What:** Compact table styling with fixed header during scroll
**When to use:** All 8 report tables (UI-03 through UI-10)
**Example:**
```css
/* Styles.html — dense table styles */
.report-table-wrapper {
  max-height: 600px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.report-table {
  width: 100%;
  border-collapse: separate; /* Required for sticky */
  border-spacing: 0;
  font-size: 0.8rem; /* Compact */
}

.report-table thead th {
  position: sticky;
  top: 0;
  background-color: var(--bg-surface);
  z-index: 10;
  padding: 8px 10px; /* Dense padding */
  border-bottom: 2px solid var(--border);
  font-weight: 600;
  text-align: left;
}

.report-table tbody td {
  padding: 6px 10px; /* Compact rows */
  border-bottom: 1px solid var(--border);
}
```
**Sources:**
- [Position Sticky and Table Headers](https://css-tricks.com/position-sticky-and-table-headers/)
- [Styling Tables the Modern CSS Way](https://er-raj-aryan.medium.com/styling-tables-the-modern-css-way-f36c0ab1a381)

### Pattern 6: Inline Progress Bar Behind Percentage
**What:** Colored bar background for percentage cells (visual scanning)
**When to use:** Percentage columns in all report tables
**Example:**
```html
<!-- Index.html — percentage cell with inline bar -->
<td class="col-percentage">
  <div class="percentage-cell">
    <div class="percentage-bar" :style="{ width: row.percentage + '%', background: 'var(--accent-primary-soft)' }"></div>
    <span class="percentage-value">{{ row.percentage }}%</span>
  </div>
</td>
```
```css
/* Styles.html */
.col-percentage {
  position: relative;
  padding: 0 !important; /* Remove default padding */
}

.percentage-cell {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 6px 10px;
}

.percentage-bar {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  opacity: 0.15;
  transition: width 0.3s ease;
}

.percentage-value {
  position: relative;
  z-index: 1;
  font-weight: 500;
}
```
**Sources:**
- [CSS Progress Bars](https://css-tricks.com/css3-progress-bars/)
- [HTML & CSS table with progress bars and percentage](https://onlyrss.org/posts/table-with-progress-indicator.html)

### Pattern 7: Delta% with Arrow Icons
**What:** Color-coded delta with Material Symbols arrows
**When to use:** Delta% columns in all report tables
**Example:**
```html
<!-- Index.html — delta cell -->
<td class="col-delta">
  <span v-if="row.delta > 0" class="delta-positive">
    <span class="material-symbols-outlined">arrow_upward</span>
    +{{ row.delta }}%
  </span>
  <span v-else-if="row.delta < 0" class="delta-negative">
    <span class="material-symbols-outlined">arrow_downward</span>
    {{ row.delta }}%
  </span>
  <span v-else class="delta-neutral">
    <span class="material-symbols-outlined">remove</span>
    0%
  </span>
</td>
```
```css
/* Styles.html */
.col-delta {
  white-space: nowrap;
}

.delta-positive {
  color: var(--accent-success);
  display: flex;
  align-items: center;
  gap: 2px;
}

.delta-negative {
  color: var(--accent-danger);
  display: flex;
  align-items: center;
  gap: 2px;
}

.delta-neutral {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 2px;
}

.col-delta .material-symbols-outlined {
  font-size: 0.9rem;
}
```

### Anti-Patterns to Avoid
- **Loading data in scriptlet tags:** Use google.script.run for async data loading, not server-side scriptlets (slow page render)
- **Multiple google.script.run calls in parallel:** API allows 10 concurrent calls, but for a single report, one getSDRReport call returns all 8 sections
- **Inline styles for table rows:** Use CSS classes for styling (maintainability, theme support)
- **V-model on computed properties:** Use separate ref for date range, not computed getter/setter (reactivity issues)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range picker | Custom calendar popup component | Flatpickr CDN library | 100+ edge cases: leap years, locales, timezones, keyboard navigation, mobile touch, accessibility, min/max dates, disabled dates |
| Table sorting/filtering | Custom sort functions | Client-side sort on reportData.value | Data is pre-aggregated by backend, sorting would reorder metrics incorrectly |
| CSV export | Manual CSV generation | (v2 feature) | Out of scope for v1, defer to VIZ-02 requirement |
| Accordion animations | Custom CSS transitions | Simple Vue transition component or CSS max-height transition | Complexity vs value (nice-to-have, not core UX) |

**Key insight:** Date pickers are deceptively complex — internationalization, timezone handling, edge cases for month boundaries, leap years, disabled dates, min/max ranges, keyboard navigation, mobile touch handling, and accessibility (ARIA labels, screen reader support). Flatpickr is 20KB minified and handles all of this. A custom solution would be 500+ lines and miss edge cases.

## Common Pitfalls

### Pitfall 1: Forgetting to Format Dates for getSDRReport
**What goes wrong:** Passing Date objects to google.script.run instead of YYYY-MM-DD strings causes backend errors
**Why it happens:** Flatpickr onChange returns Date objects, but Analytics.js expects string parameters
**How to avoid:** Create formatDate helper function that converts Date → 'YYYY-MM-DD'
**Warning signs:** Backend error "Invalid date format" or NaN in date calculations

```javascript
function formatDateYMD(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

### Pitfall 2: Sticky Header Z-Index Layering
**What goes wrong:** Table body rows appear above sticky header during scroll
**Why it happens:** Default z-index or missing background-color on `<th>` elements
**How to avoid:** Set `z-index: 10` and `background-color: var(--bg-surface)` on thead th
**Warning signs:** Text "ghosting" through header, header becomes transparent on scroll

**Source:** [Position Sticky and Table Headers](https://css-tricks.com/position-sticky-and-table-headers/)

### Pitfall 3: Border-Collapse Breaks Sticky
**What goes wrong:** `position: sticky` doesn't work on table headers
**Why it happens:** `border-collapse: collapse` prevents sticky positioning
**How to avoid:** Use `border-collapse: separate` with `border-spacing: 0` for same visual result
**Warning signs:** Header scrolls with content instead of staying fixed

**Source:** [Creating a Scrollable Table with a Sticky Header](https://dev.to/lalitkhu/creating-a-scrollable-table-with-a-sticky-header-and-frozen-column-using-html-and-css-1d2a)

### Pitfall 4: Accordion Animation Janky Performance
**What goes wrong:** max-height transition from 0 to auto causes janky animation
**Why it happens:** Browser can't animate 'auto' value, needs explicit pixel height
**How to avoid:** Use v-show with simple opacity/transform transition, or calculate exact height with getBoundingClientRect
**Warning signs:** Accordion snaps open instead of smooth transition

```css
/* Simple approach — no height animation, just opacity */
.section-body {
  transition: opacity 0.2s ease;
}

.section-body[style*="display: none"] {
  opacity: 0;
}
```

### Pitfall 5: Flatpickr Instance Leaks on View Change
**What goes wrong:** Memory leak when navigating away from Reportes view
**Why it happens:** Flatpickr instance not destroyed when unmounting
**How to avoid:** Store flatpickr instance in ref, call .destroy() in onBeforeUnmount or watch currentView
**Warning signs:** Multiple date pickers appear after returning to Reportes view

```javascript
watch(currentView, (newView, oldView) => {
  if (oldView === 'reportes' && flatpickrInstance) {
    flatpickrInstance.destroy();
    flatpickrInstance = null;
  }
});
```

### Pitfall 6: Semaforo Grid Matrix Confusion
**What goes wrong:** Rendering Semaforo as flat rows instead of 2D grid (channels × toques)
**Why it happens:** Treating it like other tables (1 metric per row)
**How to avoid:** Use nested v-for: outer loop for channels (Telefono, WhatsApp, Correo), inner loop for toque numbers (1, 2, 3, etc.)
**Warning signs:** User can't see the channel/toque pattern at a glance

```html
<!-- Semaforo Contesto grid matrix -->
<table class="report-table semaforo-grid">
  <thead>
    <tr>
      <th>Canal</th>
      <th v-for="n in 4" :key="n">Toque {{ n }}</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="channel in ['Telefono', 'WhatsApp', 'Correo']" :key="channel">
      <td>{{ channel }}</td>
      <td v-for="n in 4" :key="n" class="col-percentage">
        <!-- Render count|%|delta for this channel × toque -->
      </td>
    </tr>
  </tbody>
</table>
```

## Code Examples

Verified patterns from official sources and existing codebase:

### Vue 3 Ref vs Reactive (State Management)
```javascript
// Source: https://vuejs.org/guide/essentials/reactivity-fundamentals.html
// App.html setup() — report state

// Use ref() for primitives and single objects
const reportLoading = ref(false);
const reportError = ref(null);
const dateRange = ref({ start: null, end: null });

// Use reactive() for grouped state
const reportState = reactive({
  data: null,
  loading: false,
  error: null,
  selectedSections: ['embudoGeneral']
});

// Access: reportLoading.value, reportState.loading (no .value for reactive)
```

### Google Apps Script HTML Service Best Practices
```javascript
// Source: https://developers.google.com/apps-script/guides/html/best-practices
// App.html — asynchronous data loading

// ✅ GOOD: Load data asynchronously on mount
onMounted(() => {
  google.script.run
    .withSuccessHandler(data => { catalogs.value = data; })
    .withFailureHandler(err => { console.error(err); })
    .getCatalogs();
});

// ❌ BAD: Loading data in scriptlet (blocks page render)
// <?!= JSON.stringify(getCatalogs()) ?>
```

### Flatpickr Range Mode Initialization
```javascript
// Source: https://flatpickr.js.org/examples/
// App.html onMounted()

flatpickrInstance = flatpickr('.date-range-picker', {
  mode: 'range',
  dateFormat: 'Y-m-d',
  defaultDate: [firstDayOfMonth, lastDayOfMonth],
  locale: {
    firstDayOfWeek: 1, // Monday
    rangeSeparator: ' a ' // "1 Ene a 31 Ene"
  },
  onChange: function(selectedDates, dateStr, instance) {
    if (selectedDates.length === 2) {
      // Trigger report regeneration
      generateReport();
    }
  }
});
```

### Existing Loading State Pattern (Reuse)
```html
<!-- Source: Index.html line 21-26 (existing pattern) -->
<!-- Index.html — Reportes view with loading state -->
<div v-if="currentView === 'reportes'" class="view reportes-view">
  <!-- Loading spinner -->
  <div v-if="reportLoading" class="app-loading">
    <div class="loader-container">
      <div class="loader-ring"></div>
      <p class="loader-text">Generando reporte...</p>
      <button class="btn btn-secondary" @click="cancelReport" style="margin-top: 1rem;">
        Cancelar
      </button>
    </div>
  </div>

  <!-- Error state -->
  <div v-else-if="reportError" class="error-card">
    <span class="material-symbols-outlined error-icon">error</span>
    <p>{{ reportError }}</p>
    <button class="btn btn-primary" @click="generateReport">Reintentar</button>
  </div>

  <!-- Report content -->
  <div v-else-if="reportData">
    <!-- Date controls, quick-nav, accordion sections -->
  </div>
</div>
```

### Quick-Nav Anchor Links
```html
<!-- Index.html — Quick navigation to sections -->
<div class="quick-nav">
  <button
    v-for="section in reportSections"
    :key="section.id"
    class="quick-nav-btn"
    :class="{ active: openSections.includes(section.id) }"
    @click="scrollToSection(section.id)">
    {{ section.label }}
  </button>
</div>
```
```javascript
// App.html
const reportSections = [
  { id: 'embudoGeneral', label: 'Embudo General' },
  { id: 'incontactables', label: 'Incontactables' },
  { id: 'crossSelling', label: 'Cross Selling' },
  { id: 'semaforoContesto', label: 'Semáforo Contestó' },
  { id: 'semaforoNoContesto', label: 'Semáforo No Contestó' },
  { id: 'sinRespuesta', label: 'Sin Respuesta 6to Toque' },
  { id: 'noPasoVentas', label: '¿Por qué no pasó a Ventas?' },
  { id: 'perdioVenta', label: '¿Por qué perdió la venta?' }
];

function scrollToSection(sectionId) {
  // Open section if collapsed
  if (!openSections.value.includes(sectionId)) {
    toggleSection(sectionId);
  }
  // Scroll to section
  nextTick(() => {
    const el = document.getElementById('section-' + sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Options API (Vue 2) | Composition API (Vue 3) | 2020 | Better code organization, reusable composables, TypeScript support |
| Moment.js for dates | Native Date + Intl API | 2020+ | Smaller bundle, modern browsers support Intl.DateTimeFormat |
| jQuery date pickers | Vanilla JS libraries (Flatpickr, Pikaday) | 2018+ | No jQuery dependency, lighter weight, framework-agnostic |
| inline onclick handlers | Vue event handlers (@click) | Always (Vue best practice) | Reactivity, automatic cleanup, testability |
| Server-side rendering in scriptlets | Client-side rendering with google.script.run | GAS best practice | Responsive UI, async loading, better UX |

**Deprecated/outdated:**
- **jQuery UI Datepicker:** Deprecated, use Flatpickr or native `<input type="date">` (but native doesn't support range mode)
- **Vue 2 global filters:** Removed in Vue 3, use methods or computed properties instead
- **v-model.lazy on date inputs:** Flatpickr has onChange event, no need for Vue modifiers

## Open Questions

1. **Horizontal scroll vs responsive column hiding for wide tables?**
   - What we know: Embudo General has 3 segments × 3 columns (Total/Manufacturers/Individuals) × 3 metrics (Count|%|Delta) = 9 data columns + 1 metric name = 10 columns total
   - What's unclear: On smaller screens (1366px laptops), does this overflow?
   - Recommendation: Implement horizontal scroll with sticky first column (metric name). Don't hide columns — user needs to see all segments for comparison.

2. **Tooltip library for Delta% column header explanation?**
   - What we know: User wants tooltip on Delta% header explaining "vs periodo anterior"
   - What's unclear: Does Material Symbols + pure CSS tooltip suffice, or use a library (Tippy.js)?
   - Recommendation: Start with CSS-only tooltip (`:hover::after` pseudo-element). If insufficient, add Tippy.js CDN in Wave 1 iteration.

3. **Auto-refresh on date range change vs manual "Generate Report" button?**
   - What we know: User wants "Generate Report button disabled during loading"
   - What's unclear: Should report auto-regenerate on date change, or require explicit button click?
   - Recommendation: Auto-generate on date change (better UX), disable date picker during loading to prevent overlapping requests.

## Validation Architecture

> Nyquist validation is enabled per .planning/config.json

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual UI testing — No automated test framework |
| Config file | None — see Wave 0 |
| Quick run command | N/A (manual checklist) |
| Full suite command | N/A (manual checklist) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | "Reportes" nav item visible only to ADMIN | manual | Manual: Login as SDR → no "Reportes". Login as ADMIN → "Reportes" visible | ❌ Wave 0 |
| UI-02 | Date range picker filters report data | manual | Manual: Select range → verify comparison period label updates → verify getSDRReport called with correct dates | ❌ Wave 0 |
| UI-03 | Embudo General table renders 13 metrics × 3 segments | manual | Manual: Open Embudo General → count rows (13) and column groups (3) | ❌ Wave 0 |
| UI-04 | Incontactables table renders | manual | Manual: Open Incontactables → verify 3 rows (Duplicado, Equivocado, SPAM) | ❌ Wave 0 |
| UI-05 | Cross Selling table renders | manual | Manual: Open Cross Selling → verify data | ❌ Wave 0 |
| UI-06 | Semaforo Contesto grid (channels × toques) | manual | Manual: Open Semaforo Contesto → verify grid layout (3 channels × 4 toques for Correo, 3 toques for others) | ❌ Wave 0 |
| UI-07 | Semaforo No Contesto grid | manual | Manual: Open Semaforo No Contesto → verify grid layout (2 channels × 3 toques) | ❌ Wave 0 |
| UI-08 | Sin Respuesta 6to Toque table | manual | Manual: Open Sin Respuesta → verify data | ❌ Wave 0 |
| UI-09 | Por que no paso a Ventas table (12 reasons) | manual | Manual: Open section → count rows (12 reasons) | ❌ Wave 0 |
| UI-10 | Por que perdio la venta table (12 reasons) | manual | Manual: Open section → count rows (12 reasons) | ❌ Wave 0 |
| UI-11 | Loading indicator shows, cancel button works | manual | Manual: Click Generate Report → verify spinner + "Generando reporte..." → click Cancel → verify loading stops | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual smoke test (open Reportes view, verify no console errors)
- **Per wave merge:** Manual checklist of all 11 UI requirements
- **Phase gate:** Full manual test pass before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Manual test checklist document — covers UI-01 through UI-11
- [ ] Browser DevTools console error monitoring — ensure no Vue warnings or runtime errors
- [ ] Cross-browser check (Chrome, Firefox, Edge) — flatpickr and sticky headers compatibility

**Note:** Google Apps Script HTML Service apps are difficult to unit test due to google.script.run dependency. Manual testing is standard practice for GAS web apps. Automated E2E testing (Puppeteer, Playwright) is possible but requires deploying as web app with public URL, which is out of scope for v1.

## Sources

### Primary (HIGH confidence)
- [Vue.js Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html) - ref() vs reactive() patterns
- [Google Apps Script HTML Service Best Practices](https://developers.google.com/apps-script/guides/html/best-practices) - async data loading, google.script.run usage
- [Flatpickr Examples](https://flatpickr.js.org/examples/) - range mode configuration
- [Position Sticky and Table Headers - CSS-Tricks](https://css-tricks.com/position-sticky-and-table-headers/) - sticky header implementation

### Secondary (MEDIUM confidence)
- [Vue 3 Composition API accordion patterns](https://medium.com/@ademyalcin27/vue-3-design-system-series-11-ad3cc4cb171c) - provide/inject accordion state
- [Reactivity with Vue 3 Composition API - LogRocket](https://blog.logrocket.com/reactivity-vue-3-composition-api-ref-reactive/) - ref vs reactive tradeoffs
- [Canceling Fetch Requests with AbortController](https://medium.com/@AlexanderObregon/canceling-fetch-requests-in-javascript-with-abortcontroller-98c11d2ab54e) - cancel button pattern
- [Date Range Calendar in Flatpickr](https://techsolutionstuff.com/post/date-range-calendar-in-flatpickr-example) - range picker setup
- [Creating a Scrollable Table with Sticky Header](https://dev.to/lalitkhu/creating-a-scrollable-table-with-a-sticky-header-and-frozen-column-using-html-and-css-1d2a) - sticky table best practices
- [Styling Tables the Modern CSS Way](https://er-raj-aryan.medium.com/styling-tables-the-modern-css-way-f36c0ab1a381) - dense table patterns

### Tertiary (LOW confidence)
- [Role-based navigation in Vue](https://techformist.com/role-based-navigation-elements-vue/) - v-if patterns for nav items
- [CSS Progress Bars](https://css-tricks.com/css3-progress-bars/) - inline progress bar implementation
- [HTML & CSS table with progress bars](https://onlyrss.org/posts/table-with-progress-indicator.html) - percentage visualization

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vue 3 and Flatpickr are well-documented, stable libraries with extensive official docs
- Architecture: HIGH - Patterns verified from existing codebase (App.html, Index.html) + Vue 3 official docs
- Pitfalls: MEDIUM - Based on search results + general web development experience, specific to GAS environment

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days — stable libraries, no fast-moving changes expected)
