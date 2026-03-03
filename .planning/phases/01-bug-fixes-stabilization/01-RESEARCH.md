# Phase 1: Bug Fixes & Stabilization - Research

**Researched:** 2026-03-03
**Domain:** Google Apps Script backend data persistence and field mapping
**Confidence:** HIGH

## Summary

Phase 1 addresses two critical bugs in the CRM's data persistence layer that prevent qualification fields from saving correctly and cause cross-role lead/deal confusion. The bugs exist in a Google Apps Script (GAS) backend where field updates route through mapping objects (`LEAD_FIELD_MAP` and `DEAL_FIELD_MAP`) to database tables (`fact_leads`, `dim_contactos`, `fact_calificacion`).

**BUG-01** stems from incomplete field maps—qualification fields (BANT criteria, touch tracking) are missing from `LEAD_FIELD_MAP`, causing them to fall through to a "direct column match" fallback that fails when column names don't match frontend labels. **BUG-02** incorrectly determines save destination based on user role rather than the item's data source property, causing AEs viewing SDR leads to mistakenly save to `fact_deals`.

Both bugs follow established patterns already present in Code.js. The fix requires extending existing mapping conventions (using `_DIM_CONTACTO_` prefix pattern for related tables) and changing a single boolean parameter from role-based to source-based detection.

**Primary recommendation:** Extend LEAD_FIELD_MAP with missing qualification fields using `_FACT_CALIFICACION_` prefix for fact_calificacion routing, and change isDeal detection in App.html saveLeadChanges() from `userRole.value === 'AE'` to `selectedLead._source === 'deal' || selectedLead._source === 'cross_deal'`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**BUG-01: LEAD_FIELD_MAP incomplete**
- Add missing qualification fields to LEAD_FIELD_MAP in Code.js
- Fields to add: Toques de Contactacion, En que toque va, all BANT qualification fields (Entendio Marketing, Mostro Interes, Necesidad puntual, Perfil adecuado, Tocar base para decidir, Presupuesto asignado, Asociacion industria)
- Also add: Razon de perdida, Toques de Seguimiento, Status del Seguimiento, Tipo de Seguimiento
- These fields map to columns in fact_leads and fact_calificacion
- Pattern: follow existing LEAD_FIELD_MAP convention of 'Frontend Name': 'db_column_name'
- For fields in fact_calificacion, route via _FACT_CALIFICACION_ prefix (new convention, similar to _DIM_CONTACTO_)

**BUG-02: saveLeadChanges isDeal detection**
- In App.html saveLeadChanges(), change isDeal detection from `userRole.value === 'AE'` to checking the item's _source property
- Logic: isDeal should be true when selectedLead._source === 'deal' or selectedLead._source === 'cross_deal'
- This ensures an AE viewing a cross_lead correctly saves to fact_leads, not fact_deals
- Same fix needed in the updateLeadMultiple call at line ~510 of App.html

### Claude's Discretion
- Exact column names in fact_calificacion (verify from schema_dump.txt)
- Whether to add a CALIFICACION_FIELD_MAP or extend LEAD_FIELD_MAP with routing logic
- Error handling approach for unmapped fields

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUG-01 | LEAD_FIELD_MAP debe incluir campos de calificacion faltantes (Toques de Contactacion, En que toque va, campos BANT) | Field mapping pattern established in Code.js lines 583-595; fact_calificacion schema verified in schema_dump.txt line 44; routing pattern matches _DIM_CONTACTO_ prefix convention |
| BUG-02 | saveLeadChanges() debe detectar si el item es deal o lead por _source, no asumir por userRole | _source property populated in App.html lines 101-117; saveLeadChanges isDeal parameter at line 510 currently uses userRole; fix requires checking selectedLead._source instead |

</phase_requirements>

## Standard Stack

### Core Technology
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google Apps Script | Runtime V8 | Server-side JavaScript execution environment | Native Google Workspace integration, no deployment complexity |
| SpreadsheetApp API | N/A (built-in) | Database layer via Google Sheets | Existing data store, zero-cost persistence |

### Supporting Tools
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| clasp | 2.x | Local development and version control | Optional for this phase—direct Apps Script editor acceptable for two-file bug fix |
| Logger/console API | Built-in | Execution logging | Development debugging (use console.log for Cloud Logging in production) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct spreadsheet edits | ORM/database | Adds complexity; existing system uses Sheets as database—changing would be phase-breaking |
| clasp + local dev | Apps Script Editor | Clasp enables version control but adds setup overhead; acceptable to skip for focused bug fix |

**Installation:**
N/A—Google Apps Script runs in cloud environment. No package installation required.

## Architecture Patterns

### Recommended Project Structure
```
Code.js                    # Backend API functions
├── LEAD_FIELD_MAP         # Frontend field name → database column mapping
├── DEAL_FIELD_MAP         # Same pattern for deals
├── updateLeadMultiple()   # Batch field update with routing logic
└── logChange_()           # Audit trail for all changes

App.html                   # Frontend Vue 3 application
├── saveLeadChanges()      # Collects changed fields, calls updateLeadMultiple
└── openLeadDetail()       # Populates selectedLead with _source property
```

### Pattern 1: Field Map Routing with Prefix Convention
**What:** Field maps translate frontend display names to database columns. When a field lives in a related table (not the primary fact table), prefix the mapping value with table identifier.

**When to use:** Any field update that needs to route to a table other than the primary fact table (fact_leads or fact_deals).

**Example:**
```javascript
// Source: Code.js lines 583-595 (existing pattern)
var LEAD_FIELD_MAP = {
  // Direct mapping to fact_leads
  'Status': 'status',
  'Calidad de Contacto': 'calidad_contacto',

  // Routed mapping to dim_contactos via prefix
  'Nombre': '_DIM_CONTACTO_nombre',
  'Email': '_DIM_CONTACTO_email',

  // NEW: Routed mapping to fact_calificacion (BUG-01 fix)
  '¿Entendió la información de Marketing?': '_FACT_CALIFICACION_entendio_info_marketing',
  '¿Mostró Interés genuino?': '_FACT_CALIFICACION_mostro_interes_genuino'
};
```

**Implementation in updateLeadMultiple():**
```javascript
// Source: Code.js lines 723-746 (existing routing logic)
for (var fieldName in updates) {
  var dbCol = fieldMap[fieldName];

  if (dbCol && dbCol.indexOf('_DIM_CONTACTO_') === 0) {
    // Route to dim_contactos table
    contactUpdates[dbCol.replace('_DIM_CONTACTO_', '')] = ...;
  } else if (dbCol && dbCol.indexOf('_FACT_CALIFICACION_') === 0) {
    // NEW: Route to fact_calificacion table (BUG-01 fix)
    calificacionUpdates[dbCol.replace('_FACT_CALIFICACION_', '')] = ...;
  } else if (dbCol) {
    // Direct write to fact table
    var factCol = colMap[dbCol];
    sheet.getRange(rowNumber, factCol).setValue(newValue);
  }
}
```

### Pattern 2: Source-Based Entity Type Detection
**What:** Frontend tags each lead/deal with `_source` property indicating origin ('lead', 'deal', 'cross_lead', 'cross_deal'). Backend operations use this to determine save destination.

**When to use:** Any operation that must distinguish between leads and deals, especially in cross-role viewing scenarios.

**Example:**
```javascript
// Source: App.html lines 101-117 (existing _source tagging)
if (isAE) {
  ownItems.forEach(d => { d._source = 'deal'; });
  crossItems = leads.value.filter(...);
  crossItems.forEach(l => { l._source = 'cross_lead'; });
}

// Source: App.html line 510 (CURRENT BUGGY CODE)
.updateLeadMultiple(row, updates, userRole.value === 'AE');
//                                  ^^^^^^^^^^^^^^^^^^^^ WRONG

// BUG-02 FIX:
const isDeal = (selectedLead.value._source === 'deal' ||
                selectedLead.value._source === 'cross_deal');
.updateLeadMultiple(row, updates, isDeal);
```

### Anti-Patterns to Avoid
- **Role-based entity type detection:** Role determines UI access, but not data type—an AE can view leads (cross_leads) and must save them as leads
- **Direct column name matching as primary strategy:** Frontend labels rarely match database column names exactly; always use explicit field maps
- **Inline field routing logic:** Consolidate routing in updateLeadMultiple(); don't scatter table-write logic across multiple functions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-table atomic updates | Custom transaction manager | LockService + sequential writes within lock | GAS doesn't support true transactions; LockService provides script-level mutex (already implemented in Code.js line 696) |
| Field mapping validation | Pre-save field checker | Rely on fallback + logging | Existing code has direct column match fallback (line 739); adding validation duplicates logic and adds latency |
| Change auditing | Custom event system | logChange_() function | Already implemented (line 730, 743, 761); captures user, timestamp, old/new values |

**Key insight:** Google Apps Script lacks traditional database features (transactions, constraints, foreign keys). The existing codebase compensates with LockService for concurrency and explicit logging for audit trails. Don't try to build ACID guarantees—work within GAS's eventual consistency model.

## Common Pitfalls

### Pitfall 1: Forgetting to Route fact_calificacion Fields
**What goes wrong:** New BANT fields added to frontend but not to LEAD_FIELD_MAP fall through to direct column match. Since frontend uses Spanish question format ("¿Entendió...?") but database uses snake_case (entendio_info_marketing), the match fails silently—no error, but data doesn't persist.

**Why it happens:** updateLeadMultiple() has a "graceful degradation" fallback (line 739-744) that attempts direct column matching when field map lookup fails. This masks missing mappings during development.

**How to avoid:**
1. Always add frontend field names to field map BEFORE adding to UI
2. Cross-reference schema_dump.txt for exact column names
3. Test with Cloud Logging enabled: `console.log('Unmapped field:', fieldName)` in the fallback branch

**Warning signs:**
- Fields save in UI preview but don't persist after page reload
- No error messages but qualification data missing in Sheets
- Execution log shows field update triggered but no row change

### Pitfall 2: Confusing User Role with Data Source
**What goes wrong:** Checking `userRole === 'AE'` to determine if data is a deal breaks when AEs view leads. The cross_lead gets saved to fact_deals table, orphaning it from its original fact_leads record and breaking foreign key relationships.

**Why it happens:** The UI shows AEs both deals (their primary data) and leads (for visibility into SDR pipeline). The `_source` property tracks origin, but developers instinctively check role because it's readily available in session.

**How to avoid:**
1. Always check `item._source` instead of `userRole` when determining entity type
2. Naming convention: isDeal should derive from data properties, not user properties
3. Add defensive check: `if (!selectedLead.value._source) throw new Error('Missing _source property')`

**Warning signs:**
- AE reports "lead disappeared after editing"
- Duplicate entries appearing in both T_LEADS and T_DEALS sheets
- Foreign key id_lead column in fact_deals pointing to wrong table

### Pitfall 3: Assuming Synchronous Spreadsheet Updates
**What goes wrong:** Reading a value immediately after writing it may return stale data. SpreadsheetApp operations are eventually consistent—writes return before Sheets flushes to storage.

**Why it happens:** Google Sheets uses optimistic caching. `setValue()` updates the in-memory representation but doesn't guarantee disk persistence timing.

**How to avoid:**
1. Avoid read-after-write patterns; trust the write succeeded
2. Use SpreadsheetApp.flush() to force synchronization (expensive, use sparingly)
3. Structure logic to pass updated values through function returns, not re-read from sheet

**Warning signs:**
- Intermittent test failures that pass on retry
- Trigger functions see old values when invoked immediately after update
- Race conditions in high-frequency update scenarios

### Pitfall 4: Lock Timeout Without Fallback
**What goes wrong:** LockService.waitLock(10000) throws exception if lock unavailable after 10 seconds. Concurrent updates from multiple users cause "Could not obtain lock" errors with no retry logic.

**Why it happens:** Google Apps Script runtime is single-threaded per script instance, but multiple users create multiple instances. Lock contention is real.

**How to avoid:**
1. Keep lock duration minimal—read data, release lock, compute, reacquire for write
2. Implement exponential backoff retry (not present in current code)
3. Return user-friendly error: "Another user is updating this record, please try again"

**Warning signs:**
- Errors during high-traffic periods (e.g., Monday mornings)
- Users report "save failed" but retry succeeds
- Execution logs show lock timeouts in concurrent executions

## Code Examples

Verified patterns from codebase analysis:

### BUG-01 Fix: Extending LEAD_FIELD_MAP
```javascript
// Source: Code.js lines 583-595 (existing pattern to extend)
var LEAD_FIELD_MAP = {
  // Existing fact_leads fields
  'Status': 'status',
  'Calidad de Contacto': 'calidad_contacto',
  'Notas': 'notas',
  'Servicio': 'servicio_interes',

  // Existing dim_contactos routing
  'Nombre': '_DIM_CONTACTO_nombre',
  'Email': '_DIM_CONTACTO_email',

  // NEW: fact_leads fields (direct mapping)
  'Toques de Contactación': 'numero_toques',  // Verified: fact_leads column exists
  'Tipo de Seguimiento': 'tipo_seguimiento',   // Already mapped (line 586)
  'Status del Seguimiento': 'status_seguimiento', // Already mapped (line 587)
  'Razón de pérdida': 'razon_perdida',         // NEW: missing from current map

  // NEW: fact_calificacion routing (requires new prefix pattern)
  '¿Entendió la información de Marketing?': '_FACT_CALIFICACION_entendio_info_marketing',
  '¿Mostró Interés genuino?': '_FACT_CALIFICACION_mostro_interes_genuino',
  '¿Cuál es tu necesidad puntual?': '_FACT_CALIFICACION_necesidad_puntual',
  '¿El perfil del prospecto es el adecuado?': '_FACT_CALIFICACION_perfil_adecuado',
  '¿Necesitas tocar base con alguién para decidir la compra?': '_FACT_CALIFICACION_necesita_decision_tercero',
  '¿Tienes presupuesto asignado para este proyecto, en este año?': '_FACT_CALIFICACION_tiene_presupuesto',
  '¿Cuánto?': '_FACT_CALIFICACION_monto_presupuesto',
  '¿han sido parte de alguna asociación de la industria?': '_FACT_CALIFICACION_asociacion_industria'
};
```

**Column name verification:** Database schema (schema_dump.txt line 44) confirms fact_calificacion columns:
- entendio_info_marketing
- mostro_interes_genuino
- necesidad_puntual
- perfil_adecuado
- necesita_decision_tercero
- tiene_presupuesto
- monto_presupuesto
- asociacion_industria

### BUG-01 Fix: Adding fact_calificacion Routing to updateLeadMultiple()
```javascript
// Source: Code.js lines 713-746 (add new routing branch)
function updateLeadMultiple(rowNumber, updates, isDeal) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(isDeal ? T_DEALS : T_LEADS);
    var colMap = getColumnMap_(sheet);
    var fieldMap = isDeal ? DEAL_FIELD_MAP : LEAD_FIELD_MAP;

    // Collect related table updates
    var contactUpdates = {};
    var calificacionUpdates = {};  // NEW: collect fact_calificacion updates
    var idContacto = null;
    var idLead = null;             // NEW: needed for fact_calificacion FK

    // Get foreign keys
    var contactoIdCol = colMap['id_contacto'];
    var leadIdCol = colMap['id_lead'];
    if (contactoIdCol) idContacto = sheet.getRange(rowNumber, contactoIdCol).getValue();
    if (leadIdCol) idLead = sheet.getRange(rowNumber, leadIdCol).getValue();

    for (var fieldName in updates) {
      var newValue = updates[fieldName];
      var dbCol = fieldMap[fieldName];

      if (dbCol && dbCol.indexOf('_DIM_CONTACTO_') === 0) {
        // Existing pattern: route to dim_contactos
        contactUpdates[dbCol.replace('_DIM_CONTACTO_', '')] = { field: fieldName, value: newValue };
      } else if (dbCol && dbCol.indexOf('_FACT_CALIFICACION_') === 0) {
        // NEW: route to fact_calificacion
        calificacionUpdates[dbCol.replace('_FACT_CALIFICACION_', '')] = { field: fieldName, value: newValue };
      } else if (dbCol) {
        // Direct write to fact_leads/fact_deals
        var factCol = colMap[dbCol];
        if (factCol) {
          sheet.getRange(rowNumber, factCol).setValue(newValue);
          logChange_(isDeal ? 'Deal' : 'Lead', entityId, user, fieldName, oldValue, newValue);
        }
      }
    }

    // NEW: Write calificacion updates to fact_calificacion
    if (idLead && Object.keys(calificacionUpdates).length > 0) {
      var calSheet = ss.getSheetByName(T_CALIFICACION);
      var calColMap = getColumnMap_(calSheet);
      var calData = calSheet.getDataRange().getValues();
      var calIdLeadCol = calColMap['id_lead'] || 2;  // Column index for id_lead FK

      // Find or create calificacion record
      var calRowIdx = -1;
      for (var ci = 1; ci < calData.length; ci++) {
        if (String(calData[ci][calIdLeadCol - 1]) === String(idLead)) {
          calRowIdx = ci + 1;  // Convert to 1-based row number
          break;
        }
      }

      // If no calificacion record exists, create one
      if (calRowIdx === -1) {
        calSheet.appendRow([null, idLead]);  // id_calificacion (auto), id_lead (FK)
        calRowIdx = calSheet.getLastRow();
      }

      // Update calificacion fields
      for (var calCol in calificacionUpdates) {
        var tCol = calColMap[calCol];
        if (tCol) {
          var oldC = calSheet.getRange(calRowIdx, tCol).getValue();
          calSheet.getRange(calRowIdx, tCol).setValue(calificacionUpdates[calCol].value);
          logChange_('Lead', idLead, user, calificacionUpdates[calCol].field, oldC, calificacionUpdates[calCol].value);
        }
      }
    }

    // Existing contact update logic continues...
    result.updated = true;
  } finally {
    lock.releaseLock();
  }
  return result;
}
```

### BUG-02 Fix: Source-Based isDeal Detection
```javascript
// Source: App.html lines 423-510 (modify saveLeadChanges function)
function saveLeadChanges() {
  saving.value = true;
  const row = selectedLead.value._row;
  const updates = {};

  // ... collect updates (lines 428-466 unchanged) ...

  // BEFORE (BUGGY):
  // const isDeal = (userRole.value === 'AE');

  // AFTER (FIXED):
  const isDeal = (selectedLead.value._source === 'deal' ||
                  selectedLead.value._source === 'cross_deal');

  google.script.run
    .withSuccessHandler(function (result) {
      saving.value = false;
      showToast('✅ Registro actualizado correctamente', 'success');

      // Update correct dataset based on source, not role
      const dataset = isDeal ? deals : leads;
      const idx = dataset.value.findIndex(l => l._row === row);
      // ... update local data (lines 486-502 unchanged) ...
    })
    .withFailureHandler(function (err) {
      saving.value = false;
      showToast('❌ Error al guardar: ' + err.message, 'error');
    })
    .updateLeadMultiple(row, updates, isDeal);  // Use computed isDeal
}
```

### Testing Pattern: Manual Verification Checklist
```javascript
// Google Apps Script doesn't have built-in test framework for this use case.
// Recommended manual verification approach:

/**
 * TEST BUG-01: BANT Field Persistence
 *
 * Setup:
 * 1. Open CRM as SDR user
 * 2. Select a lead in "Contactado" status
 * 3. Open lead detail modal, navigate to Calificacion tab
 *
 * Test Steps:
 * 1. Fill in BANT fields:
 *    - "¿Entendió la información de Marketing?" → "Sí"
 *    - "¿Mostró Interés genuino?" → "Parcialmente"
 *    - "¿Cuál es tu necesidad puntual?" → "Busca membresía"
 *    - "¿El perfil del prospecto es el adecuado?" → "Sí"
 *    - "¿Necesitas tocar base con alguién para decidir?" → "No"
 *    - "¿Tienes presupuesto asignado?" → "Sí"
 *    - "¿Cuánto?" → "$20,000-$50,000"
 *    - "¿han sido parte de alguna asociación?" → "Parcialmente"
 * 2. Click "Guardar Cambios"
 * 3. Close modal
 * 4. Reopen same lead
 * 5. Navigate to Calificacion tab
 *
 * Expected Result:
 * - All BANT fields display saved values
 * - Toast shows "✅ Registro actualizado correctamente"
 * - fact_calificacion sheet shows new/updated row with id_lead FK
 * - log_transacciones shows 8 change entries
 *
 * Verification Query (in Apps Script):
 * function verifyCalificacion() {
 *   var ss = SpreadsheetApp.openById(SHEET_ID);
 *   var calSheet = ss.getSheetByName('fact_calificacion');
 *   var data = calSheet.getDataRange().getValues();
 *   Logger.log(data.filter(row => row[1] === TEST_LEAD_ID));
 * }
 */

/**
 * TEST BUG-02: Cross-Role Save Routing
 *
 * Setup:
 * 1. As SDR, move a lead to "Calificado" status
 * 2. Log in as AE user
 * 3. Verify lead appears in AE's "Calificado" column (cross_lead)
 *
 * Test Steps:
 * 1. Open the cross_lead in detail modal
 * 2. Verify modal title shows lead info (not deal info)
 * 3. Edit "Notas" field: add text "AE reviewed - looks good"
 * 4. Click "Guardar Cambios"
 * 5. Verify toast confirmation
 * 6. Open Google Sheet directly
 * 7. Check fact_leads sheet for the lead's row
 * 8. Check fact_deals sheet to confirm NO new row created
 *
 * Expected Result:
 * - Notas update appears in fact_leads sheet at correct row
 * - NO new row in fact_deals sheet
 * - log_transacciones shows entity="Lead" (not "Deal")
 * - Lead remains in SDR's dataset (doesn't disappear)
 *
 * Negative Test:
 * Repeat with selectedLead._source check REMOVED (revert to userRole check)
 * Result: New row incorrectly created in fact_deals, original lead orphaned
 */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V8 runtime opt-in | V8 runtime default | 2020 | Modern JavaScript (const/let, arrow functions, template literals) now standard |
| Logger.log() only | console.log() with Cloud Logging | 2021 | Persistent logs, structured logging, production monitoring support |
| Rhino engine (ES5) | V8 engine (ES6+) | 2020 | Enables modern syntax; older scripts may need updates |

**Deprecated/outdated:**
- **Rhino runtime:** Officially deprecated; all scripts should use V8 (check via Run > Enable new Apps Script runtime)
- **Logger.log() for production:** Use console.log/info/error for Cloud Logging integration; Logger disappears after execution completes
- **Manual locking via properties:** LockService (introduced 2013) is the correct approach; don't build custom lock mechanisms

## Open Questions

1. **Does fact_calificacion require a new record per lead, or update existing?**
   - What we know: Schema has id_calificacion (PK) and id_lead (FK), suggesting one-to-one or one-to-many relationship
   - What's unclear: Whether to upsert (find existing by id_lead and update) or always append
   - Recommendation: Implement upsert pattern (find by id_lead, update if exists, create if not)—matches how dim_contactos updates work

2. **Should "¿En qué toque va?" map to fact_leads.numero_toques or a separate field?**
   - What we know: Frontend has both "Toques de Contactación" and "¿En qué toque va?" fields
   - What's unclear: schema_dump.txt shows fact_leads.numero_toques but no "toque_actual" column
   - Recommendation: Map both to numero_toques unless user confirms they're distinct fields; front-end may use one for display, one for data entry

3. **Do BANT fields need validation rules?**
   - What we know: Fields are dropdowns in UI (see App.html line 214), likely pulling from cat_opciones
   - What's unclear: Whether backend should reject invalid values or trust frontend validation
   - Recommendation: Trust frontend; backend adds complexity with no clear benefit (UI already constrains input)

<validation_architecture>
## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated test framework detected) |
| Config file | None—Google Apps Script lacks native test infrastructure |
| Quick run command | N/A—manual testing via CRM UI required |
| Full suite command | N/A—manual testing via CRM UI required |

**Note:** Google Apps Script projects typically don't have automated test suites in the traditional sense. Testing requires deploying to GAS runtime and executing functions. For production GAS projects, clasp + Jest + gas-local enables unit testing, but current project doesn't use clasp (direct Apps Script editor workflow). Wave 0 recommendations focus on structured manual verification.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Verification Approach | Status |
|--------|----------|-----------|------------------------|--------|
| BUG-01 | BANT fields (Entendio Marketing, Mostro Interes, etc.) persist when saved from lead detail modal | Manual integration | 1. Fill BANT fields in Calificacion tab<br>2. Save & reload lead<br>3. Verify fields display saved values<br>4. Check fact_calificacion sheet for row with matching id_lead | ❌ Wave 0: Document test procedure |
| BUG-01 | Toques de Contactacion field persists correctly | Manual integration | 1. Edit "Toques de Contactación" field<br>2. Save lead<br>3. Verify fact_leads.numero_toques updated | ❌ Wave 0: Document test procedure |
| BUG-02 | AE viewing cross_lead (SDR lead) saves to fact_leads, NOT fact_deals | Manual integration | 1. As SDR, move lead to "Calificado"<br>2. As AE, open cross_lead and edit<br>3. Verify update in fact_leads sheet<br>4. Verify NO new row in fact_deals | ❌ Wave 0: Document test procedure |
| BUG-02 | AE viewing own deal saves to fact_deals correctly (regression check) | Manual integration | 1. As AE, open own deal<br>2. Edit and save<br>3. Verify update in fact_deals | ❌ Wave 0: Document test procedure |

### Sampling Rate
**This phase uses manual verification only. No automated test execution.**

- **Per task commit:** Developer manually tests affected behavior before committing
- **Per wave merge:** Full manual test suite (all 4 scenarios above) before marking wave complete
- **Phase gate:** Complete manual verification checklist before `/gsd:verify-work`

### Wave 0 Gaps

**Testing Infrastructure:**
- [ ] Document manual test procedures in `.planning/phases/01-bug-fixes-stabilization/TEST_PROCEDURES.md`
- [ ] Create verification spreadsheet queries (Apps Script functions) to check data integrity post-save
- [ ] Establish baseline: capture screenshots/data dumps of current buggy behavior for before/after comparison

**Optional Future Enhancement (post-Phase 1):**
- [ ] Set up clasp for local development: `npm install -g @google/clasp`
- [ ] Add Jest + gas-local for unit testing field mapping logic: `npm install --save-dev jest gas-local`
- [ ] Create mock SpreadsheetApp for testing updateLeadMultiple() in isolation

**Rationale for Manual Testing:** Google Apps Script's tight coupling with Google Sheets runtime makes mocking difficult. For a two-bug fix phase, manual verification provides faster time-to-fix than setting up full test infrastructure. Recommend test automation setup as separate phase if project continues to grow.

</validation_architecture>

## Sources

### Primary (HIGH confidence)
- Project codebase analysis:
  - `Code.js` lines 583-595 (LEAD_FIELD_MAP pattern)
  - `Code.js` lines 695-774 (updateLeadMultiple routing logic)
  - `App.html` lines 423-510 (saveLeadChanges function)
  - `App.html` lines 101-117 (_source property population)
  - `database_schema/schema_dump.txt` lines 25-47 (fact_leads, fact_calificacion schema)
- Context documents:
  - `.planning/phases/01-bug-fixes-stabilization/01-CONTEXT.md` (user decisions)
  - `.planning/REQUIREMENTS.md` (BUG-01, BUG-02 definitions)

### Secondary (MEDIUM confidence)
- [Best Practices | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/support/best-practices) - Performance optimization patterns (batch operations, LockService)
- [Logging | Apps Script | Google for Developers](https://developers.google.com/apps-script/guides/logging) - console.log vs Logger.log, Cloud Logging integration
- [Unit Testing in Google Apps Script | Medium](https://medium.com/geekculture/taking-away-the-pain-from-unit-testing-in-google-apps-script-98f2feee281d) - Jest + clasp testing strategies
- [Master Google Apps Script UIs — Part 5: Unit Testing with Jest](https://javascript.plainenglish.io/master-google-apps-script-uis-part-5-unit-testing-your-front-end-with-jest-9f619cdff0c2) - Frontend testing patterns

### Tertiary (LOW confidence)
- [GitHub: google-app-script-ts-jest](https://github.com/lastlink/google-app-script-ts-jest) - TypeScript + Jest template (not verified for current use case)
- [GitHub: ez-clasp](https://github.com/cristobalgvera/ez-clasp) - Clasp template with Jest (not verified for current use case)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from existing codebase; Google Apps Script environment confirmed
- Architecture: HIGH - Patterns extracted directly from Code.js and App.html; field map routing proven in production
- Pitfalls: MEDIUM - Based on Google Apps Script documentation and common GAS development issues; not verified in this specific codebase
- Validation: MEDIUM - Manual testing approach confirmed necessary; automated testing patterns from secondary sources not verified in production

**Research date:** 2026-03-03
**Valid until:** 2026-04-02 (30 days - stable technology, Google Apps Script API changes infrequently)
