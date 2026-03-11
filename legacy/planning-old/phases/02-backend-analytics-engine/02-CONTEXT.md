# Phase 2: Backend Analytics Engine - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Create Analytics.js as a standalone GAS file that reads from the normalized database (Star Schema v6) and returns complete SDR report data as JSON via getSDRReport(dateIn, dateOut). Must match the 8 sections of the existing "Reporte SDR General" spreadsheet with Total/Manufacturers/Individuals segmentation, percentages, and delta vs previous period. No UI — that's Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Funnel Step Definitions (Embudo General - Section 1)
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

### Segmentation (Locked per Research)
- **Segmentation field**: Use `tipo_membresia` from fact_calificacion (values: 'Manufacturers', 'Individuals', 'Attraction') — NOT servicio_interes from fact_leads (which has service names like 'Consultoría', not segment names). Leads without a fact_calificacion record or with NULL tipo_membresia count only in Total, not in any segment.
- **Period comparison**: Same duration shifted back (e.g., if current = Mar 1-15, previous = Feb 14-28).

### Claude's Discretion
- **Section 7 "Por qué no pasó a Ventas" reasons**: The 12 specific reasons listed in requirements don't match cat_opciones 'Razón de Pérdida'. Research whether these come from a different field, are derived from interaction patterns, or need to be added as a new category.
- **Section 8 "Por qué se perdió la venta" reasons**: The 12 reasons match closer to cat_opciones 'Razón de Pérdida' but may need verification against fact_deals.razon_perdida values.
- **Cross Selling section**: Determine what identifies a cross-selling lead (possibly tipo_transaccion = 'Cross-sell' in fact_deals or a flag in fact_leads).
- **Semáforo sections**: The exact interaction pattern counting per channel (Teléfono/WhatsApp/Correo) x toque number x resultado.
- **Performance optimization**: Read all tables once, process in memory. Must execute within GAS 6-minute limit for up to 2000 leads.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `readTable_(sheetName)`: Reads entire sheet as array of objects — use for all table reads
- `indexBy_(rows, key)`: Creates {id: row} maps for JOINs — use for lead→contact, lead→calificacion, lead→deal lookups
- `getColumnMap_(sheet)`: Returns {header: colIndex} — useful if writing back
- `getLeadStats()` (Código.js:1109): Existing basic analytics function — pattern reference for counting by status, but does not filter by date or segment

### Established Patterns
- Table constants defined at top: T_LEADS, T_DEALS, T_INTERACCIONES, T_CALIFICACION, T_CONTACTOS, etc.
- SHEET_ID constant for SpreadsheetApp.openById()
- All data as objects with snake_case keys matching sheet column headers
- Dates stored as ISO strings, need `new Date(ts)` parsing
- Error handling: try/catch with Logger.log

### Integration Points
- Analytics.js will be a NEW file in gas-crm-project/ deployed alongside Código.js via clasp
- Frontend (Phase 3) will call `google.script.run.getSDRReport(dateIn, dateOut)` from App.html
- Can import/use same table constants and utility functions since all GAS files share the same namespace
- Reference report: Reporte SS.xlsx in project root — use as ground truth for section structure

### Database Schema Summary
- **fact_leads** (200r x 14c): id_lead, id_contacto, id_campana, id_vendedor_sdr, status, calidad_contacto, servicio_interes, fecha_ingreso, fecha_asignacion, fecha_ultimo_contacto, numero_toques, tipo_seguimiento, status_seguimiento, notas
- **fact_deals** (33r x 21c): id_deal, id_lead, id_contacto, id_vendedor_ae, id_producto, status_venta, proyeccion, monto_proyeccion, monto_apartado, monto_cierre, fecha_pase_ventas, fecha_primer_contacto_ae, fecha_cierre, razon_perdida, ...
- **fact_interacciones** (600r x 10c): id_interaccion, id_lead, id_deal, id_vendedor, tipo_interaccion, resultado, numero_toque, timestamp, duracion_seg, notas
- **fact_calificacion** (56r x 13c): id_calificacion, id_lead, entendio_info_marketing, mostro_interes_genuino, necesidad_puntual, perfil_adecuado, necesita_decision_tercero, tiene_presupuesto, monto_presupuesto, asociacion_industria, region, tipo_membresia, fecha_calificacion
- **dim_contactos** (200r x 13c): id_contacto, nombre, apellido, email, telefono_1, telefono_2, empresa, ...
- **cat_opciones**: Status Lead values: ['Nuevo', 'Contactado', 'En Seguimiento', 'Calificado', 'No Calificado', 'Contactado sin Respuesta', 'Paso a Ventas', 'Perdido', 'Duplicado', 'Inválido']
- **Resultado Interacción**: ['Contestó', 'No Contestó']
- **Tipo de Interacción**: ['Teléfono', 'WhatsApp', 'Correo']

</code_context>

<specifics>
## Specific Ideas

- "Diálogo completo" means consecutive answered toques without gaps. "Intermitente" means answered but with gaps (e.g., answered toque 1, missed toque 2, answered toque 3). The distinction is about continuity of the conversation, not count.
- The reference report "Reporte SS.xlsx" in the project root is the exact model to replicate. Use it as ground truth for section structure and column layout.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-backend-analytics-engine*
*Context gathered: 2026-03-04*
