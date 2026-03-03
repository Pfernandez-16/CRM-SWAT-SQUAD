# Phase 1: Bug Fixes & Stabilization - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix two known bugs in the backend (Code.js) and frontend (App.html) so field mappings and save logic work correctly before adding the analytics module. No new features.

</domain>

<decisions>
## Implementation Decisions

### BUG-01: LEAD_FIELD_MAP incomplete
- Add missing qualification fields to LEAD_FIELD_MAP in Code.js
- Fields to add: Toques de Contactacion, En que toque va, all BANT qualification fields (Entendio Marketing, Mostro Interes, Necesidad puntual, Perfil adecuado, Tocar base para decidir, Presupuesto asignado, Asociacion industria)
- Also add: Razon de perdida, Toques de Seguimiento, Status del Seguimiento, Tipo de Seguimiento
- These fields map to columns in fact_leads and fact_calificacion
- Pattern: follow existing LEAD_FIELD_MAP convention of 'Frontend Name': 'db_column_name'
- For fields in fact_calificacion, route via _FACT_CALIFICACION_ prefix (new convention, similar to _DIM_CONTACTO_)

### BUG-02: saveLeadChanges isDeal detection
- In App.html saveLeadChanges(), change isDeal detection from `userRole.value === 'AE'` to checking the item's _source property
- Logic: isDeal should be true when selectedLead._source === 'deal' or selectedLead._source === 'cross_deal'
- This ensures an AE viewing a cross_lead correctly saves to fact_leads, not fact_deals
- Same fix needed in the updateLeadMultiple call at line ~510 of App.html

### Claude's Discretion
- Exact column names in fact_calificacion (verify from schema_dump.txt)
- Whether to add a CALIFICACION_FIELD_MAP or extend LEAD_FIELD_MAP with routing logic
- Error handling approach for unmapped fields

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- LEAD_FIELD_MAP (Code.js:583-595) — existing pattern for field routing, extend this
- DEAL_FIELD_MAP (Code.js:597-611) — same pattern for deals
- _DIM_CONTACTO_ prefix convention — reuse for fact_calificacion routing

### Established Patterns
- Field updates route through updateLeadMultiple() which reads the field map
- Unmapped fields fall to "direct column match" fallback (Code.js:738-744)
- All changes logged via logChange_()

### Integration Points
- Code.js LEAD_FIELD_MAP (~line 583) — add new entries
- Code.js updateLeadMultiple() (~line 695) — may need routing for fact_calificacion
- App.html saveLeadChanges() (~line 423) — fix isDeal parameter
- database_schema/schema_dump.txt — verify exact column names

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward bug fixes following existing patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-bug-fixes-stabilization*
*Context gathered: 2026-03-03*
