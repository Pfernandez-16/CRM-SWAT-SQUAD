# Requirements: CRM SWAT Squad — Módulo de Reportería

**Defined:** 2026-03-11
**Core Value:** El reporte cuadra con la base de datos al 100% — confiabilidad es lo que retiene al cliente

## v1 Requirements

### Selector de Período

- [x] **PERIOD-01**: Usuario puede seleccionar fecha de inicio y fecha de fin del período a analizar
- [x] **PERIOD-02**: Usuario puede elegir tipo de comparación: "vs período anterior" o "vs año anterior"
- [x] **PERIOD-03**: Al cambiar el período, todos los reportes se actualizan con los nuevos datos

### Embudo General

- [x] **FUNNEL-01**: Reporte muestra total de leads del período con desglose Manufacturados vs Individuales
- [x] **FUNNEL-02**: Reporte muestra métricas de contactabilidad: Contactables, Contactados, Con Respuesta
- [x] **FUNNEL-03**: Reporte muestra métricas de calidad de diálogo: Diálogo Completo, Diálogo Intermitente
- [x] **FUNNEL-04**: Reporte muestra métricas de avance: Con Interés, Descartados, Asignados a Ventas, Carry Over
- [x] **FUNNEL-05**: Reporte muestra métricas monetarias: Montos de Inversión, Deals Cerrados, Monto de Cierres
- [x] **FUNNEL-06**: Cada métrica muestra ratio de conversión respecto a la etapa anterior (fórmulas de funnel)
- [x] **FUNNEL-07**: Cada métrica muestra delta % comparado con el período seleccionado (sube/baja)
- [x] **FUNNEL-08**: Desglose visual Manufacturados vs Individuales en cada métrica

### Incontactables

- [x] **INCONT-01**: Reporte muestra leads Duplicados con desglose Manufacturados vs Individuales + delta
- [x] **INCONT-02**: Reporte muestra leads Equivocados con desglose Manufacturados vs Individuales + delta
- [x] **INCONT-03**: Reporte muestra leads Spam con desglose Manufacturados vs Individuales + delta

### Cross Selling

- [x] **CROSS-01**: Reporte muestra deals de tipo Cross-sell con desglose Manufacturados vs Individuales + delta

### Toques / Contactabilidad (Matriz Vertical)

- [x] **TOQUES-01**: Tabla de contactabilidad muestra toques como FILAS (Toque 1 al 10) y productos/países como COLUMNAS
- [x] **TOQUES-02**: Cada celda muestra cuántos leads llegaron a ese toque en ese producto/país
- [x] **TOQUES-03**: Semáforo Contesto: grid canal (Teléfono/WhatsApp/Correo) × toque con resultado "Contesto"
- [x] **TOQUES-04**: Semáforo No Contesto: grid canal × toque con resultado "No Contesto"
- [x] **TOQUES-05**: Indicador de Sin Respuesta al 6to toque (leads con 6+ toques sin contacto)

### Razones No Pasó a Ventas

- [x] **RAZNES-01**: Reporte muestra 6 categorías de razones: No Perfil Adecuado, Sin Presupuesto, Sin Interés Genuino, Necesita Tercero, No Entendió el Marketing, Otros
- [x] **RAZNES-02**: Cada razón muestra % de representatividad sobre el total de descartados (base 100)
- [x] **RAZNES-03**: Cada razón muestra delta % vs período de comparación

### Razones Perdió la Venta

- [x] **RAZPERD-01**: Reporte muestra 13+ categorías de razones de pérdida de venta
- [x] **RAZPERD-02**: Cada razón muestra % de representatividad sobre el total de pérdidas (base 100)
- [x] **RAZPERD-03**: Cada razón muestra delta % vs período de comparación

### Reporte de Deals / Negociaciones (Nuevo — Backend + Frontend)

- [x] **DEALS-01**: Backend: agregar campos booleanos a fact_deals: cotizo, en_negociacion, asistio_demo, firmo_contrato, fondeo
- [x] **DEALS-02**: Backend: nueva función calculateDealsReport_() en Analytics.js que calcula métricas Sí/No por etapa
- [ ] **DEALS-03**: Frontend: reporte muestra flujo Contactado→Cotizado→Negociación→Demo→Contrato→Fondeo con conteos Sí/No
- [ ] **DEALS-04**: Frontend: cada etapa muestra monto cotizado y monto de cierre donde aplica
- [ ] **DEALS-05**: Frontend: razones de pérdida por deal con conteos

## v1.1 Requirements

### Comparativa Personalizada

- [ ] **CUSTOM-01**: Usuario puede seleccionar un tercer modo de comparación "Personalizado" en el selector de período
- [ ] **CUSTOM-02**: Al activar modo personalizado, aparecen dos date pickers adicionales para elegir inicio y fin del período de comparación libremente
- [ ] **CUSTOM-03**: El backend recibe las fechas personalizadas y calcula todas las métricas contra ese período libre (sin modificar la lógica existente de prev_period/yoy)

### Ranking SDRs

- [ ] **SDR-01**: Backend: nueva función calculateSDRRankingReport_() que calcula total leads, leads con_interes y CVR por id_vendedor_sdr para período actual y anterior, con delta
- [ ] **SDR-02**: Frontend: sección "Ranking SDRs" muestra tabla con nombre del SDR, total leads, CVR actual, CVR anterior y delta — ordenada de mayor a menor CVR
- [ ] **SDR-03**: Ranking SDR incluido en respuesta de getSDRReport() — se actualiza al cambiar el período selector

### Visual Intelligence

- [ ] **CHART-01**: Sección Embudo General incluye gráfica de embudo (Chart.js CDN) además de la tabla, mostrando volumen por etapa visualmente
- [ ] **ALERT-01**: Deltas con variación ≥ ±20% se destacan visualmente (color/icono distinto) en todas las tablas de reportes
- [ ] **VELOCITY-01**: Sección Deals muestra velocidad de cierre promedio (días desde fecha_pase_ventas hasta fondeo=TRUE) con delta vs período anterior

## v2 Requirements

### Autenticación

- **AUTH-01**: Login con email + contraseña
- **AUTH-02**: Sesión persistente entre recargas

### Importación Masiva

- **IMPORT-01**: Importar base de datos desde CSV/Excel con mapeo de campos
- **IMPORT-02**: Distribución 70/30 configurable de leads entrantes (SDR vs AE directo)

### Calendario Completo

- **CAL-01**: Calendario interactivo con calls, seguimientos y tareas por rol
- **CAL-02**: Edición directa desde el calendario

## Out of Scope

| Feature | Reason |
|---------|--------|
| Looker Studio / herramientas BI externas | Decisión arquitectural: self-contained en GAS sin dependencias externas |
| WebSockets / real-time push | Limitación de Google Apps Script — no viable |
| Migración a SQL | Cliente requiere Google Sheets como DB |
| OAuth / SSO | No pedido — email/password es suficiente para v1 |
| App móvil nativa | Web-first — GAS sirve como PWA suficiente |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERIOD-01 | Phase 1 | Complete |
| PERIOD-02 | Phase 1 | Complete |
| PERIOD-03 | Phase 1 | Complete |
| FUNNEL-01 | Phase 2 | Complete |
| FUNNEL-02 | Phase 2 | Complete |
| FUNNEL-03 | Phase 2 | Complete |
| FUNNEL-04 | Phase 2 | Complete |
| FUNNEL-05 | Phase 2 | Complete |
| FUNNEL-06 | Phase 2 | Complete |
| FUNNEL-07 | Phase 2 | Complete |
| FUNNEL-08 | Phase 2 | Complete |
| INCONT-01 | Phase 2 | Complete |
| INCONT-02 | Phase 2 | Complete |
| INCONT-03 | Phase 2 | Complete |
| CROSS-01 | Phase 2 | Complete |
| TOQUES-01 | Phase 3 | Complete |
| TOQUES-02 | Phase 3 | Complete |
| TOQUES-03 | Phase 3 | Complete |
| TOQUES-04 | Phase 3 | Complete |
| TOQUES-05 | Phase 3 | Complete |
| RAZNES-01 | Phase 3 | Complete |
| RAZNES-02 | Phase 3 | Complete |
| RAZNES-03 | Phase 3 | Complete |
| RAZPERD-01 | Phase 3 | Complete |
| RAZPERD-02 | Phase 3 | Complete |
| RAZPERD-03 | Phase 3 | Complete |
| DEALS-01 | Phase 4 | Complete |
| DEALS-02 | Phase 4 | Complete |
| DEALS-03 | Phase 4 | Complete |
| DEALS-04 | Phase 4 | Complete |
| DEALS-05 | Phase 4 | Complete |
| CUSTOM-01 | Phase 5 | Pending |
| CUSTOM-02 | Phase 5 | Pending |
| CUSTOM-03 | Phase 5 | Pending |
| SDR-01 | Phase 5 | Pending |
| SDR-02 | Phase 5 | Pending |
| SDR-03 | Phase 5 | Pending |
| CHART-01 | Phase 6 | Pending |
| ALERT-01 | Phase 6 | Pending |
| VELOCITY-01 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 30 total (complete)
- v1.1 requirements: 9 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 — v1.1 requirements added: custom comparison, SDR ranking, visual intelligence*
