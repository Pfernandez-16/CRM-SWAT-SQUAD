# Phase 2: Backend Analytics Engine - Research

**Researched:** 2026-03-04
**Domain:** Google Apps Script analytics functions, report generation, data aggregation
**Confidence:** HIGH

## Summary

Phase 2 creates Analytics.js as a standalone Google Apps Script file that reads from the normalized Star Schema v6 database and returns complete SDR report data as JSON via `getSDRReport(dateIn, dateOut)`. The critical challenges are (1) performance optimization to stay within GAS's 6-minute execution limit for up to 2000 leads, (2) implementing complex funnel metrics with segmentation and period-over-period comparison, and (3) structuring JSON output to match the existing "Reporte SDR General" spreadsheet format.

Google Apps Script performance is dominated by minimizing server round-trips. The established pattern is: read all tables once with `readTable_()`, build in-memory indexes with `indexBy_()`, process everything in JavaScript arrays, and return JSON. For 2000 leads with 6000 interactions, this reduces execution time from minutes to seconds by replacing 8000+ individual calls with ~10 batch reads.

The analytics function architecture follows a calculate-then-structure pattern: (1) load all fact and dimension tables into memory, (2) build lookup indexes, (3) filter leads by date range, (4) calculate metrics via array operations (filter/reduce/map), (5) segment by `servicio_interes`, (6) calculate previous period delta, (7) assemble JSON response with 8 sections.

**Primary recommendation:** Use batch operations exclusively, leverage existing `readTable_()` and `indexBy_()` utilities, implement all calculations in-memory as pure JavaScript functions, and structure Analytics.js as a collection of focused metric functions composed by the main `getSDRReport()` orchestrator.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Funnel Step Definitions (Embudo General - Section 1)**
- **Total leads**: All leads in fact_leads within the date range (fecha_ingreso between dateIn and dateOut)
- **Pruebas**: OMIT this row — no field exists to identify test leads, and the existing data is sufficient for validation
- **Contactables**: Lead whose contact in dim_contactos has a non-empty telefono_1 OR email
- **Contactados**: Lead with at least 1 interaction in fact_interacciones
- **Con respuesta**: Lead with at least 1 interaction where resultado = 'Contestó'
- **Diálogo completo**: Lead that answered ('Contestó') on consecutive toques without gaps (e.g., toque 1 Contestó, toque 2 Contestó)
- **Diálogo intermitente**: Lead that answered but with gaps between answered toques (e.g., toque 1 Contestó, toque 2 No Contestó, toque 3 Contestó)
- **Interés**: Lead with mostro_interes_genuino = 'Sí' in fact_calificacion
- **Descartados**: Lead with status = 'Perdido' in fact_leads
- **Asignados a ventas**: Lead with status = 'Paso a Ventas' in fact_leads
- **Carry-over**: Leads from previous period (fecha_ingreso before dateIn) that got status 'Paso a Ventas' during current period
- **Montos inversión**: Sum of monto_proyeccion from fact_deals linked to leads in the period
- **Deals cerrados**: Count of deals with status_venta = 'Vendido' linked to leads in the period
- **Monto cierres**: Sum of monto_cierre from deals with status_venta = 'Vendido'

### Claude's Discretion

- **Segmentation mapping**: Determine how to map leads to Manufacturers/Individuals segments. Options: use fact_calificacion.tipo_membresia, or servicio_interes in fact_leads, or dim_productos.membership_type via fact_deals. Research the reference report (Reporte SS.xlsx) to determine the correct source.
- **Period comparison**: How to calculate the previous period for delta%. Likely: same duration shifted back (e.g., if current = Mar 1-15, previous = Feb 14-28).
- **Section 7 "Por qué no pasó a Ventas" reasons**: The 12 specific reasons listed in requirements don't match cat_opciones 'Razón de Pérdida'. Research whether these come from a different field, are derived from interaction patterns, or need to be added as a new category.
- **Section 8 "Por qué se perdió la venta" reasons**: The 12 reasons match closer to cat_opciones 'Razón de Pérdida' but may need verification against fact_deals.razon_perdida values.
- **Cross Selling section**: Determine what identifies a cross-selling lead (possibly tipo_transaccion = 'Cross-sell' in fact_deals or a flag in fact_leads).
- **Semáforo sections**: The exact interaction pattern counting per channel (Teléfono/WhatsApp/Correo) x toque number x resultado.
- **Performance optimization**: Read all tables once, process in memory. Must execute within GAS 6-minute limit for up to 2000 leads.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLYT-01 | Create separate Analytics.js file with metric calculation functions | GAS modular architecture via clasp deployment; all .js files share namespace |
| ANLYT-02 | Function getSDRReport(dateIn, dateOut) returns all report sections as JSON | JSON generation pattern: batch read → calculate → structure → return JSON string |
| ANLYT-03 | Date range filtering by fecha_ingreso (Day In/Out) | Array.filter() on fecha_ingreso ISO strings; parse with new Date() |
| ANLYT-04 | Segmentation by servicio_interes (Total/Manufacturers/Individuals) | Group-by pattern: leads.filter(l => l.servicio_interes === segment) |
| ANLYT-05 | Delta% vs previous period automatic calculation | Period shift: durationMs = dateOut - dateIn; prevPeriod = [dateIn - durationMs, dateOut - durationMs] |
| ANLYT-06 | Section Embudo General (13 metrics with segmentation) | Locked funnel definitions from CONTEXT.md; calculate via in-memory JOINs |
| ANLYT-07 | Section Incontactables (Duplicado/Equivocado/SPAM) | Filter leads by status field matching 3 incontactable values |
| ANLYT-08 | Section Cross Selling | Identify via fact_deals.tipo_transaccion = 'Cross-sell' |
| ANLYT-09 | Section Semáforo Contestó (9 channel-toque metrics) | Group interactions by tipo_interaccion + numero_toque where resultado = 'Contestó' |
| ANLYT-10 | Section Semáforo No Contestó (6 channel-toque metrics) | Group interactions by tipo_interaccion + numero_toque where resultado = 'No Contestó' |
| ANLYT-11 | Section Sin Respuesta 6to Toque | Filter leads where numero_toques >= 6 AND no 'Contestó' interaction exists |
| ANLYT-12 | Section Por qué no pasó a Ventas (12 reasons) | Source TBD: likely fact_leads.razon_perdida or new cat_opciones category |
| ANLYT-13 | Section Por qué se perdió la venta (12 reasons) | Source: fact_deals.razon_perdida values; verify against cat_opciones |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google Apps Script | V8 Runtime | Server-side execution environment | Only option for Google Sheets backend automation |
| clasp | 2.4.2+ | Deploy .js files to GAS project | Industry standard CLI for GAS development with local files |
| SpreadsheetApp | Built-in GAS | Read/write Google Sheets data | Native GAS service, no alternatives |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CacheService | Built-in GAS | Cache computed results for 6 hours | Optional: only if calculation takes >3 seconds initially |
| Logger | Built-in GAS | Log execution for debugging | Development only; remove before production |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Analytics.js | Add functions to Code.js | Separation of concerns — Analytics.js keeps analytics logic isolated from CRUD operations |
| JSON.stringify() | Manual string building | Never manually build JSON; stringify() handles escaping and formatting correctly |
| CacheService | PropertiesService | CacheService auto-expires after 6 hours (safer); PropertiesService persists indefinitely (manual cleanup required) |

**Installation:**
```bash
# Already configured — no additional dependencies
cd gas-crm-project/
clasp push   # Deploys Analytics.js alongside existing files
```

## Architecture Patterns

### Recommended Project Structure
```
gas-crm-project/
├── Código.js          # Existing CRUD API
├── Analytics.js       # NEW — Analytics functions
├── Index.html         # Existing UI template
├── App.html           # Existing Vue logic
├── Styles.html        # Existing CSS
├── .clasp.json        # Existing clasp config
└── appsscript.json    # Existing GAS manifest
```

### Pattern 1: Batch Read + In-Memory Processing

**What:** Load entire tables once with `readTable_()`, perform all filtering/aggregation in JavaScript, return final result.

**When to use:** Always for analytics functions — GAS performance is dominated by service call count, not data size.

**Example:**
```javascript
// Source: Código.js lines 39-60 (existing pattern)
function calculateMetrics(dateIn, dateOut) {
  // GOOD: One read per table
  var leads = readTable_(T_LEADS);              // ~200 rows — 1 server call
  var interacciones = readTable_(T_INTERACCIONES); // ~600 rows — 1 server call
  var calificaciones = readTable_(T_CALIFICACION); // ~56 rows — 1 server call

  // GOOD: Build indexes for JOINs
  var calificacionIdx = indexBy_(calificaciones, 'id_lead');
  var interaccionesIdx = {};
  for (var i = 0; i < interacciones.length; i++) {
    var lidKey = String(interacciones[i].id_lead);
    if (!interaccionesIdx[lidKey]) interaccionesIdx[lidKey] = [];
    interaccionesIdx[lidKey].push(interacciones[i]);
  }

  // GOOD: Filter in JavaScript
  var dateInMs = new Date(dateIn).getTime();
  var dateOutMs = new Date(dateOut).getTime();
  var filtered = leads.filter(function(lead) {
    var ts = new Date(lead.fecha_ingreso).getTime();
    return ts >= dateInMs && ts <= dateOutMs;
  });

  // GOOD: Calculate metrics in-memory
  var contactados = filtered.filter(function(lead) {
    var inters = interaccionesIdx[String(lead.id_lead)] || [];
    return inters.length > 0;
  }).length;

  // Return result — no writes
  return { total: filtered.length, contactados: contactados };
}
```

**BAD Example (avoid):**
```javascript
// BAD: Loop that reads individual cells
var sheet = ss.getSheetByName(T_LEADS);
var lastRow = sheet.getLastRow();
for (var i = 2; i <= lastRow; i++) {
  var fecha = sheet.getRange(i, 8).getValue();  // 200 server calls
  if (fecha >= dateIn && fecha <= dateOut) {
    count++;
  }
}
// Performance: 70 seconds for 200 rows vs 1 second with batch read
```

### Pattern 2: Segmented Metrics Calculation

**What:** Calculate the same metric for Total, Manufacturers, and Individuals by filtering on `servicio_interes`.

**When to use:** All 8 report sections require segmentation breakdown.

**Example:**
```javascript
function calculateSegmented(leads, metricFn) {
  var total = metricFn(leads);
  var manufacturers = metricFn(leads.filter(function(l) {
    return String(l.servicio_interes || '').toLowerCase().indexOf('manufacturer') >= 0;
  }));
  var individuals = metricFn(leads.filter(function(l) {
    return String(l.servicio_interes || '').toLowerCase().indexOf('individual') >= 0;
  }));

  return {
    total: { count: total, percentage: 100 },
    manufacturers: {
      count: manufacturers,
      percentage: leads.length > 0 ? (manufacturers / leads.length * 100).toFixed(1) : 0
    },
    individuals: {
      count: individuals,
      percentage: leads.length > 0 ? (individuals / leads.length * 100).toFixed(1) : 0
    }
  };
}

// Usage
var contactablesMetric = function(leadsSubset) {
  return leadsSubset.filter(function(lead) {
    var contacto = contactosIdx[String(lead.id_contacto)] || {};
    return (contacto.telefono_1 || contacto.email);
  }).length;
};
var result = calculateSegmented(filteredLeads, contactablesMetric);
// result = { total: {count: 150, percentage: 100}, manufacturers: {count: 90, percentage: 60}, ... }
```

### Pattern 3: Period-over-Period Delta Calculation

**What:** Calculate metrics for current period and previous period, compute delta percentage.

**When to use:** ANLYT-05 requires delta% for all metrics.

**Example:**
```javascript
function calculateWithDelta(dateIn, dateOut, metricFn) {
  var dateInMs = new Date(dateIn).getTime();
  var dateOutMs = new Date(dateOut).getTime();
  var durationMs = dateOutMs - dateInMs;

  var prevDateIn = new Date(dateInMs - durationMs);
  var prevDateOut = new Date(dateOutMs - durationMs);

  var currentValue = metricFn(dateIn, dateOut);
  var previousValue = metricFn(prevDateIn.toISOString(), prevDateOut.toISOString());

  var delta = 0;
  if (previousValue !== 0) {
    delta = ((currentValue - previousValue) / previousValue * 100).toFixed(1);
  }

  return { current: currentValue, previous: previousValue, delta: delta };
}
```

### Pattern 4: Funnel Metric Composition

**What:** Build complex funnel metrics by composing simpler boolean filters.

**When to use:** Embudo General section requires multi-condition metrics.

**Example:**
```javascript
// Diálogo completo: consecutive 'Contestó' without gaps
function hasDialogoCompleto(lead, interaccionesIdx) {
  var inters = (interaccionesIdx[String(lead.id_lead)] || [])
    .filter(function(i) { return i.resultado === 'Contestó'; })
    .sort(function(a, b) { return a.numero_toque - b.numero_toque; });

  if (inters.length < 2) return false;

  // Check for consecutive toques
  for (var i = 1; i < inters.length; i++) {
    if (inters[i].numero_toque === inters[i-1].numero_toque + 1) {
      return true;  // Found consecutive pair
    }
  }
  return false;
}

// Diálogo intermitente: 'Contestó' exists but with gaps
function hasDialogoIntermitente(lead, interaccionesIdx) {
  var allInters = interaccionesIdx[String(lead.id_lead)] || [];
  var contestoInters = allInters.filter(function(i) { return i.resultado === 'Contestó'; });

  if (contestoInters.length === 0) return false;
  if (hasDialogoCompleto(lead, interaccionesIdx)) return false; // Already counted

  // Has 'Contestó' but not consecutive
  return true;
}
```

### Pattern 5: JSON Response Structure

**What:** Return multi-section report as nested JSON matching frontend expectations.

**When to use:** Main `getSDRReport()` function assembles all sections.

**Example:**
```javascript
function getSDRReport(dateIn, dateOut) {
  try {
    // Load all data
    var leads = readTable_(T_LEADS);
    var contactos = readTable_(T_CONTACTOS);
    // ... load all tables

    // Build indexes
    var contactosIdx = indexBy_(contactos, 'id_contacto');
    // ... build all indexes

    // Filter by date
    var filtered = filterByDateRange(leads, dateIn, dateOut);

    // Calculate sections
    var section1 = calculateEmbudoGeneral(filtered, contactosIdx, interaccionesIdx, calificacionIdx);
    var section2 = calculateIncontactables(filtered);
    // ... calculate all 8 sections

    return JSON.stringify({
      metadata: {
        dateIn: dateIn,
        dateOut: dateOut,
        generatedAt: new Date().toISOString(),
        totalLeads: filtered.length
      },
      sections: {
        embudoGeneral: section1,
        incontactables: section2,
        crossSelling: section3,
        semaforoContesto: section4,
        semaforoNoContesto: section5,
        sinRespuesta6toToque: section6,
        razonesNoPasoVentas: section7,
        razonesPerdioVenta: section8
      }
    });
  } catch (err) {
    Logger.log('getSDRReport ERROR: ' + err.message);
    return JSON.stringify({ error: err.message, stack: err.stack });
  }
}
```

### Anti-Patterns to Avoid

- **Individual cell reads in loops:** Causes 100x slowdown; use `getDataRange().getValues()` instead
- **Writing intermediate results to sheet:** Analytics functions are read-only; never write back
- **Recalculating same data:** Build indexes once, reuse for all metrics
- **Nested SpreadsheetApp calls:** Load all data upfront, process in JS only
- **String date comparisons:** Always parse to `Date` objects first; ISO strings work but are fragile

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date parsing/formatting | Custom regex parser | `new Date(isoString)` and `.toISOString()` | GAS V8 runtime has full Date API; handles timezones correctly |
| JSON serialization | Manual string concatenation | `JSON.stringify(obj)` | Handles escaping, circular refs, undefined values; 100% reliable |
| Array grouping | Manual loop with temp objects | `reduce()` with accumulator object | Standard functional pattern; less code, fewer bugs |
| Table reading | `getRange(row, col).getValue()` in loop | `readTable_()` utility (existing) | Already implemented in Código.js; batch reads are 70x faster |
| Index building | Nested loops for JOIN | `indexBy_()` utility (existing) | Already implemented in Código.js; O(n) vs O(n²) |
| Percentage calculation | Inline division everywhere | Reusable `calcPercentage(part, total)` helper | Handles division by zero, formats to 1 decimal |
| Segment filtering | Copy-paste filter logic 3 times | `calculateSegmented(leads, metricFn)` wrapper | DRY principle; single source of truth for segmentation |

**Key insight:** Google Apps Script's biggest performance pitfall is server round-trips. The existing `readTable_()` and `indexBy_()` utilities already solve this. Don't reinvent — compose analytics from these primitives.

## Common Pitfalls

### Pitfall 1: Ignoring GAS Execution Time Limit

**What goes wrong:** Function times out at 6 minutes with "Exceeded maximum execution time" error.

**Why it happens:** Reading data row-by-row or making thousands of individual SpreadsheetApp calls.

**How to avoid:**
- Load all tables once with `readTable_()` (existing utility)
- Process everything in JavaScript arrays
- Measure execution time: wrap function in `var start = new Date(); ... Logger.log('Duration: ' + (new Date() - start) + 'ms');`
- For 2000 leads + 6000 interactions, batch approach executes in ~5-10 seconds vs 5+ minutes for row-by-row

**Warning signs:**
- Script takes >30 seconds to run
- Seeing SpreadsheetApp calls inside loops
- getRange() or setValue() called hundreds of times

### Pitfall 2: Date Filtering Off-by-One Errors

**What goes wrong:** Reports miss leads created exactly on dateIn or dateOut boundary.

**Why it happens:** Inconsistent use of `<` vs `<=` when comparing timestamps, or timezone mismatches.

**How to avoid:**
- Always use inclusive ranges: `ts >= dateInMs && ts <= dateOutMs`
- Parse all dates with `new Date(isoString).getTime()` for millisecond comparison
- Document whether dateOut is inclusive or exclusive in function JSDoc
- Test with boundary cases: lead created at exactly dateIn time

**Warning signs:**
- Report counts vary by 1-2 leads when changing date range
- Leads "disappear" when date range starts/ends on their creation date

### Pitfall 3: Segmentation Mapping Ambiguity

**What goes wrong:** Leads counted in wrong segment (Manufacturers vs Individuals) or missing from all segments.

**Why it happens:** The field used for segmentation (`servicio_interes` vs `tipo_membresia`) contains inconsistent values or nulls.

**How to avoid:**
- **RESEARCH FINDING:** Check CONTEXT.md discretion item — need to verify source field
- Implement fallback: if `servicio_interes` is empty, check `tipo_membresia` from calificacion
- Log unmapped leads during development: `if (!segment) Logger.log('No segment for lead: ' + lead.id_lead);`
- Add "Unclassified" segment in development to catch orphans

**Warning signs:**
- Total count > (Manufacturers + Individuals)
- Empty segment values in raw data
- Frontend reports "0 Manufacturers, 0 Individuals" but Total > 0

### Pitfall 4: Missing JOIN Data

**What goes wrong:** Metrics return 0 or undefined because related data (contact, calificacion, interactions) is missing.

**Why it happens:** Foreign key references invalid IDs, or tables not fully populated.

**How to avoid:**
- Always provide fallback: `contactosIdx[String(lead.id_contacto)] || {}`
- Check for required fields before calculation: `if (!contacto.telefono_1 && !contacto.email) return false;`
- Log missing JOINs in development: `if (!calificacionIdx[leadId]) Logger.log('No calificacion for lead: ' + leadId);`
- Defensive coding: treat missing data as "no" not as error

**Warning signs:**
- "Cannot read property 'telefono_1' of undefined" errors
- Metric counts are suspiciously low (e.g., 0 contactables when you expect 150)

### Pitfall 5: Delta Calculation Division by Zero

**What goes wrong:** `delta = (current - previous) / previous * 100` throws error or returns Infinity/NaN.

**Why it happens:** Previous period has 0 leads (new business, date range before system launch).

**How to avoid:**
```javascript
var delta = 0;
if (previousValue > 0) {
  delta = ((currentValue - previousValue) / previousValue * 100).toFixed(1);
} else if (currentValue > 0) {
  delta = '+100';  // Or 'N/A' or '∞' depending on UX preference
}
```

**Warning signs:**
- Frontend shows "NaN%" or "Infinity%" in delta column
- Console errors about division by zero

### Pitfall 6: Interaction Pattern Logic Bugs

**What goes wrong:** "Diálogo completo" vs "Diálogo intermitente" counts overlap or miss leads.

**Why it happens:** Complex multi-step logic has edge cases (e.g., what if all interactions are same toque number?).

**How to avoid:**
- Write unit tests for edge cases: 0 interactions, 1 interaction, all same toque, gaps
- Use clear variable names: `contestoInters`, `sortedByToque`, `hasConsecutive`
- Document assumptions in comments: `// Completo = at least 2 consecutive 'Contestó' toques`
- Validate with real data: manually check 5-10 sample leads against calculations

**Warning signs:**
- Sum of "completo" + "intermitente" > "con respuesta"
- Leads appear in both categories

### Pitfall 7: Carry-Over Calculation Misunderstanding

**What goes wrong:** Carry-over count is double-counted or misses leads.

**Why it happens:** Confusion about what "carry-over" means — leads that entered BEFORE period but converted DURING period.

**How to avoid:**
```javascript
// Carry-over = fecha_ingreso < dateIn AND status changed to 'Paso a Ventas' during [dateIn, dateOut]
// This requires checking log_transacciones for status change timestamp, OR
// Simplified: fecha_ingreso < dateIn AND fecha_asignacion between [dateIn, dateOut]
var carryOver = leads.filter(function(lead) {
  var ingresoMs = new Date(lead.fecha_ingreso).getTime();
  var asignacionMs = new Date(lead.fecha_asignacion).getTime();
  return ingresoMs < dateInMs &&
         asignacionMs >= dateInMs &&
         asignacionMs <= dateOutMs &&
         lead.status === 'Paso a Ventas';
}).length;
```

**Warning signs:**
- Carry-over count = 0 always (probably wrong logic)
- Carry-over + new assignments ≠ total assignments in period

## Code Examples

Verified patterns from existing codebase:

### Read Entire Table as Array of Objects
```javascript
// Source: Código.js lines 39-60 (existing utility)
// This is the foundation — use for ALL data loading
function readTable_(sheetName) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var obj = { _row: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j] || '').trim();
      if (key) {
        var val = data[i][j];
        if (val instanceof Date) val = val.toISOString();
        obj[key] = val;
      }
    }
    results.push(obj);
  }
  return results;
}
```

### Build Index for Fast Lookups
```javascript
// Source: Código.js lines 65-74 (existing utility)
// Use for dimension tables (contactos, vendedores, productos, calificacion)
function indexBy_(rows, key) {
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var k = rows[i][key];
    if (k !== undefined && k !== null && k !== '') {
      map[String(k)] = rows[i];
    }
  }
  return map;
}

// Usage example:
var contactos = readTable_(T_CONTACTOS);
var contactosIdx = indexBy_(contactos, 'id_contacto');
// Now: contactosIdx['123'] returns the full contact object
```

### Build One-to-Many Index (Interactions per Lead)
```javascript
// Source: Código.js lines 184-192 (adapted pattern)
var interacciones = readTable_(T_INTERACCIONES);
var leadInteractions = {};
for (var i = 0; i < interacciones.length; i++) {
  var inter = interacciones[i];
  var lid = String(inter.id_lead || '');
  if (lid) {
    if (!leadInteractions[lid]) leadInteractions[lid] = [];
    leadInteractions[lid].push(inter);
  }
}
// Now: leadInteractions['45'] returns array of all interactions for lead 45
```

### Filter Leads by Date Range
```javascript
function filterByDateRange(leads, dateIn, dateOut) {
  var dateInMs = new Date(dateIn).getTime();
  var dateOutMs = new Date(dateOut).getTime();

  return leads.filter(function(lead) {
    var ts = new Date(lead.fecha_ingreso).getTime();
    return !isNaN(ts) && ts >= dateInMs && ts <= dateOutMs;
  });
}
```

### Calculate Contactables Metric
```javascript
// Contactables = has telefono_1 OR email in dim_contactos
function countContactables(leads, contactosIdx) {
  return leads.filter(function(lead) {
    var contacto = contactosIdx[String(lead.id_contacto)] || {};
    var hasTel = String(contacto.telefono_1 || '').trim() !== '';
    var hasEmail = String(contacto.email || '').trim() !== '';
    return hasTel || hasEmail;
  }).length;
}
```

### Calculate Contactados Metric
```javascript
// Contactados = has at least 1 interaction in fact_interacciones
function countContactados(leads, interaccionesIdx) {
  return leads.filter(function(lead) {
    var inters = interaccionesIdx[String(lead.id_lead)] || [];
    return inters.length > 0;
  }).length;
}
```

### Calculate Con Respuesta Metric
```javascript
// Con respuesta = has at least 1 interaction where resultado = 'Contestó'
function countConRespuesta(leads, interaccionesIdx) {
  return leads.filter(function(lead) {
    var inters = interaccionesIdx[String(lead.id_lead)] || [];
    return inters.some(function(i) {
      return String(i.resultado).trim() === 'Contestó';
    });
  }).length;
}
```

### Calculate Percentage with Formatting
```javascript
function calcPercentage(part, total) {
  if (total === 0) return '0.0';
  return ((part / total) * 100).toFixed(1);
}
```

### Main Report Function Structure
```javascript
// Source: Pattern from Código.js getLeads() (lines 162-363)
function getSDRReport(dateIn, dateOut) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);

    // 1. Load all tables (batch reads)
    var leads = readTable_(T_LEADS);
    var contactos = readTable_(T_CONTACTOS);
    var interacciones = readTable_(T_INTERACCIONES);
    var calificaciones = readTable_(T_CALIFICACION);
    var deals = readTable_(T_DEALS);

    // 2. Build indexes
    var contactosIdx = indexBy_(contactos, 'id_contacto');
    var calificacionIdx = indexBy_(calificaciones, 'id_lead');
    var interaccionesIdx = {};
    for (var i = 0; i < interacciones.length; i++) {
      var lid = String(interacciones[i].id_lead);
      if (lid) {
        if (!interaccionesIdx[lid]) interaccionesIdx[lid] = [];
        interaccionesIdx[lid].push(interacciones[i]);
      }
    }

    // 3. Filter by date range
    var currentLeads = filterByDateRange(leads, dateIn, dateOut);

    // 4. Calculate previous period
    var dateInMs = new Date(dateIn).getTime();
    var dateOutMs = new Date(dateOut).getTime();
    var durationMs = dateOutMs - dateInMs;
    var prevDateIn = new Date(dateInMs - durationMs).toISOString();
    var prevDateOut = new Date(dateOutMs - durationMs).toISOString();
    var previousLeads = filterByDateRange(leads, prevDateIn, prevDateOut);

    // 5. Calculate sections
    var embudoGeneral = calculateEmbudoGeneral_(currentLeads, previousLeads, contactosIdx, interaccionesIdx, calificacionIdx, deals);
    var incontactables = calculateIncontactables_(currentLeads, previousLeads);
    // ... more sections

    // 6. Return JSON
    return JSON.stringify({
      metadata: {
        dateIn: dateIn,
        dateOut: dateOut,
        generatedAt: new Date().toISOString(),
        totalLeads: currentLeads.length
      },
      embudoGeneral: embudoGeneral,
      incontactables: incontactables
      // ... more sections
    });
  } catch (err) {
    Logger.log('getSDRReport ERROR: ' + err.message);
    return JSON.stringify({ error: err.message });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual calculation in separate spreadsheet | Automated calculation via Analytics.js | This phase (2026-03) | Real-time metrics instead of manual copy-paste |
| Row-by-row cell reads | Batch `getDataRange().getValues()` | GAS best practices since ~2018 | 70x performance improvement |
| Denormalized single table | Star Schema v6 with fact/dim tables | Implemented by Pedro in v7 (2025) | Enables complex JOINs for analytics |
| Hardcoded report structure in UI | Backend returns JSON, UI renders | Modern API pattern (2020+) | Separation of concerns, easier testing |

**Deprecated/outdated:**
- **GAS HTML Service SandboxMode.IFRAME**: Deprecated; use NATIVE mode (already configured in project)
- **UrlFetchApp without fetchAll()**: Use `fetchAll([requests])` for concurrent requests when calling external APIs
- **Direct cell manipulation for reports**: Use batch reads + JSON return pattern instead

## Open Questions

1. **Segmentation Field Source (MEDIUM priority)**
   - What we know: CONTEXT.md lists three options: `servicio_interes` in fact_leads, `tipo_membresia` in fact_calificacion, or `dim_productos.membership_type` via deals
   - What's unclear: Which field is the ground truth? Do values match "Manufacturers"/"Individuals" exactly or need mapping?
   - Recommendation: Check existing `servicio_interes` values in fact_leads (likely source since it's on the lead itself). If values don't match exactly, implement string matching (`.indexOf('manufacturer')` case-insensitive). Reference report "Reporte SS.xlsx" is ground truth but couldn't read binary file — ask user for clarification or inspect sheet manually.

2. **Section 7 Reasons Source (LOW priority)**
   - What we know: Requirements list 12 specific "Por qué no pasó a Ventas" reasons that don't match existing cat_opciones 'Razón de Pérdida'
   - What's unclear: Are these derived from interaction patterns, stored in a different field, or need to be added as new cat_opciones category?
   - Recommendation: Most likely need to add new cat_opciones category "Razón No Paso Ventas" with the 12 values. Alternatively, could map from existing fact_leads.razon_perdida if field exists. Verify with user during planning.

3. **Cross-Selling Identification (LOW priority)**
   - What we know: CONTEXT.md suggests `tipo_transaccion = 'Cross-sell'` in fact_deals
   - What's unclear: Does this field exist? Are there cross-sell leads vs deals?
   - Recommendation: Check fact_deals schema (database_schema/schema_dump.txt line ~50). If field exists, use it. If not, cross-selling might be identified by lead having multiple deals or deal linked to existing customer (`es_recompra = true`). Clarify during planning.

4. **Test Framework for Analytics.js (MEDIUM priority)**
   - What we know: GAS has no built-in test framework; community options include QUnitGS2, GasT, UnitTestingApp
   - What's unclear: Should we implement unit tests given 6-minute execution limit concern?
   - Recommendation: For this phase, use manual testing with sample data (create test function that runs calculations on known dataset and logs results). For v2, consider QUnitGS2 library for automated regression tests.

## Validation Architecture

> Nyquist validation is enabled per .planning/config.json (workflow.nyquist_validation: true)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual Testing + Logger validation (GAS has no native test runner) |
| Config file | None — GAS executes in cloud environment |
| Quick run command | `clasp run getSDRReport '2024-01-01' '2024-01-31'` (requires clasp 2.4.2+) |
| Full suite command | Manual: Open Script Editor → Run → getSDRReport → View Logs |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLYT-01 | Analytics.js exists as separate file | smoke | `clasp status` (verify Analytics.js in file list) | ❌ Wave 0 |
| ANLYT-02 | getSDRReport() returns valid JSON with 8 sections | unit | Manual: call function, verify JSON.parse() succeeds | ❌ Wave 0 |
| ANLYT-03 | Date filtering includes only leads with fecha_ingreso in [dateIn, dateOut] | unit | Manual: test boundary cases (lead on dateIn, before dateIn, after dateOut) | ❌ Wave 0 |
| ANLYT-04 | Segmentation by servicio_interes produces Total/Manufacturers/Individuals | unit | Manual: verify sum(segments) = total for each metric | ❌ Wave 0 |
| ANLYT-05 | Delta% calculated as (current - previous) / previous * 100 | unit | Manual: test with known values (prev=100, curr=150 → delta=50%) | ❌ Wave 0 |
| ANLYT-06 | Embudo General section has 13 metrics matching CONTEXT.md definitions | integration | Manual: compare output JSON to reference report for 5 sample leads | ❌ Wave 0 |
| ANLYT-07 | Incontactables counts match status='Duplicado'/'Equivocado'/'SPAM' | unit | Manual: filter fact_leads by status, verify count matches | ❌ Wave 0 |
| ANLYT-08 | Cross Selling identifies deals with tipo_transaccion='Cross-sell' | unit | Manual: create test deal with tipo_transaccion, verify count | ❌ Wave 0 |
| ANLYT-09 | Semáforo Contestó groups by tipo_interaccion + numero_toque (9 buckets) | unit | Manual: verify interaction counting logic with sample data | ❌ Wave 0 |
| ANLYT-10 | Semáforo No Contestó groups correctly (6 buckets) | unit | Manual: verify interaction counting logic with sample data | ❌ Wave 0 |
| ANLYT-11 | Sin Respuesta 6to Toque = numero_toques >= 6 AND no 'Contestó' | unit | Manual: create test lead with 6 'No Contestó', verify inclusion | ❌ Wave 0 |
| ANLYT-12 | Por qué no pasó a Ventas reasons match source field | integration | Manual: verify reason counts sum to total descartados | ❌ Wave 0 |
| ANLYT-13 | Por qué se perdió la venta uses fact_deals.razon_perdida | integration | Manual: verify reason counts match deal records | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** Manual smoke test — call `getSDRReport()` with sample dates, verify no errors, spot-check 2-3 metric values
- **Per wave merge:** Full manual validation — compare ALL metrics against reference "Reporte SS.xlsx" for same date range
- **Phase gate:** Full validation green + performance test (execution completes in <30 seconds for 2000 leads) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] **Test data fixture** — Create `test/sample-data.json` with 10 known leads + interactions for unit testing
- [ ] **Manual test checklist** — Create `.planning/phases/02-backend-analytics-engine/TEST-CHECKLIST.md` with step-by-step validation procedures
- [ ] **Performance benchmark script** — Create `testPerformance()` function in Analytics.js that measures execution time
- [ ] **Reference comparison** — Extract key metrics from "Reporte SS.xlsx" as expected values for validation

**Note:** GAS lacks native automated testing. Best practice is comprehensive logging + manual verification during development, then integration testing via frontend in Phase 3.

## Sources

### Primary (HIGH confidence)
- [Google Apps Script Best Practices](https://developers.google.com/apps-script/guides/support/best-practices) - Performance optimization, batch operations
- [Google Apps Script Quotas for Google Services](https://developers.google.com/apps-script/guides/services/quotas) - 6-minute execution limit, quota details
- Código.js (local file, lines 39-1457) - Existing utilities readTable_(), indexBy_(), getColumnMap_(), established patterns
- database_schema/schema_dump.txt (local file) - Star Schema v6 structure, table columns, data types
- .planning/phases/02-backend-analytics-engine/02-CONTEXT.md (local file) - Locked funnel definitions, user decisions

### Secondary (MEDIUM confidence)
- [Google Apps Script Performance Optimization](https://www.labnol.org/google-script-performance-memoization-211004) - Memoization patterns, caching strategies
- [Bypassing Maximum Script Runtime](https://medium.com/geekculture/bypassing-the-maximum-script-runtime-in-google-apps-script-e510aa9ae6da) - Chunking strategies, trigger chaining
- [Create JSON from Google Sheets](https://www.highviewapps.com/blog/how-to-create-a-shareable-json-feed-from-a-google-sheets-spreadsheet-using-google-apps-script/) - JSON generation patterns
- [Google Apps Script Testing](https://medium.com/geekculture/taking-away-the-pain-from-unit-testing-in-google-apps-script-98f2feee281d) - QUnitGS2 framework, testing strategies
- [Funnel Metrics Formulas](https://www.statsig.com/perspectives/funnel-metrics-formulas-examples) - Abandonment rate, retention rate calculations

### Tertiary (LOW confidence)
- [Google Analytics Data API in Apps Script](https://developers.google.com/apps-script/advanced/analyticsdata) - Advanced service patterns (not directly used but relevant architecture)
- [Funnel Charts in Google Sheets](https://www.benlcollins.com/spreadsheets/funnel-charts/) - Visualization patterns (Phase 3 scope)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - GAS is only option, V8 runtime verified in appsscript.json, clasp configured
- Architecture: HIGH - Existing Code.js patterns are proven, batch read pattern is GAS best practice
- Pitfalls: HIGH - Performance issues are well-documented, existing codebase demonstrates correct patterns
- Validation: MEDIUM - No automated testing framework available; manual validation is standard for GAS

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days — GAS platform is stable, practices unlikely to change)
