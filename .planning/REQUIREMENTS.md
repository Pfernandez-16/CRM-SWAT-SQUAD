# Requirements: CRM SWAT Squad — Módulo de Reportería

**Defined:** 2026-03-11
**Core Value:** El reporte cuadra con la base de datos al 100% — confiabilidad es lo que retiene al cliente

## v1 Requirements

### Selector de Período

- [ ] **PERIOD-01**: Usuario puede seleccionar fecha de inicio y fecha de fin del período a analizar
- [ ] **PERIOD-02**: Usuario puede elegir tipo de comparación: "vs período anterior" o "vs año anterior"
- [ ] **PERIOD-03**: Al cambiar el período, todos los reportes se actualizan con los nuevos datos

### Embudo General

- [ ] **FUNNEL-01**: Reporte muestra total de leads del período con desglose Manufacturados vs Individuales
- [ ] **FUNNEL-02**: Reporte muestra métricas de contactabilidad: Contactables, Contactados, Con Respuesta
- [ ] **FUNNEL-03**: Reporte muestra métricas de calidad de diálogo: Diálogo Completo, Diálogo Intermitente
- [ ] **FUNNEL-04**: Reporte muestra métricas de avance: Con Interés, Descartados, Asignados a Ventas, Carry Over
- [ ] **FUNNEL-05**: Reporte muestra métricas monetarias: Montos de Inversión, Deals Cerrados, Monto de Cierres
- [ ] **FUNNEL-06**: Cada métrica muestra ratio de conversión respecto a la etapa anterior (fórmulas de funnel)
- [ ] **FUNNEL-07**: Cada métrica muestra delta % comparado con el período seleccionado (sube/baja)
- [ ] **FUNNEL-08**: Desglose visual Manufacturados vs Individuales en cada métrica

### Incontactables

- [ ] **INCONT-01**: Reporte muestra leads Duplicados con desglose Manufacturados vs Individuales + delta
- [ ] **INCONT-02**: Reporte muestra leads Equivocados con desglose Manufacturados vs Individuales + delta
- [ ] **INCONT-03**: Reporte muestra leads Spam con desglose Manufacturados vs Individuales + delta

### Cross Selling

- [ ] **CROSS-01**: Reporte muestra deals de tipo Cross-sell con desglose Manufacturados vs Individuales + delta

### Toques / Contactabilidad (Matriz Vertical)

- [ ] **TOQUES-01**: Tabla de contactabilidad muestra toques como FILAS (Toque 1 al 10) y productos/países como COLUMNAS
- [ ] **TOQUES-02**: Cada celda muestra cuántos leads llegaron a ese toque en ese producto/país
- [ ] **TOQUES-03**: Semáforo Contesto: grid canal (Teléfono/WhatsApp/Correo) × toque con resultado "Contesto"
- [ ] **TOQUES-04**: Semáforo No Contesto: grid canal × toque con resultado "No Contesto"
- [ ] **TOQUES-05**: Indicador de Sin Respuesta al 6to toque (leads con 6+ toques sin contacto)

### Razones No Pasó a Ventas

- [ ] **RAZNES-01**: Reporte muestra 6 categorías de razones: No Perfil Adecuado, Sin Presupuesto, Sin Interés Genuino, Necesita Tercero, No Entendió el Marketing, Otros
- [ ] **RAZNES-02**: Cada razón muestra % de representatividad sobre el total de descartados (base 100)
- [ ] **RAZNES-03**: Cada razón muestra delta % vs período de comparación

### Razones Perdió la Venta

- [ ] **RAZPERD-01**: Reporte muestra 13+ categorías de razones de pérdida de venta
- [ ] **RAZPERD-02**: Cada razón muestra % de representatividad sobre el total de pérdidas (base 100)
- [ ] **RAZPERD-03**: Cada razón muestra delta % vs período de comparación

### Reporte de Deals / Negociaciones (Nuevo — Backend + Frontend)

- [ ] **DEALS-01**: Backend: agregar campos booleanos a fact_deals: cotizo, en_negociacion, asistio_demo, firmo_contrato, fondeo
- [ ] **DEALS-02**: Backend: nueva función calculateDealsReport_() en Analytics.js que calcula métricas Sí/No por etapa
- [ ] **DEALS-03**: Frontend: reporte muestra flujo Contactado→Cotizado→Negociación→Demo→Contrato→Fondeo con conteos Sí/No
- [ ] **DEALS-04**: Frontend: cada etapa muestra monto cotizado y monto de cierre donde aplica
- [ ] **DEALS-05**: Frontend: razones de pérdida por deal con conteos

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
| PERIOD-01 | Phase 1 | Pending |
| PERIOD-02 | Phase 1 | Pending |
| PERIOD-03 | Phase 1 | Pending |
| FUNNEL-01 | Phase 2 | Pending |
| FUNNEL-02 | Phase 2 | Pending |
| FUNNEL-03 | Phase 2 | Pending |
| FUNNEL-04 | Phase 2 | Pending |
| FUNNEL-05 | Phase 2 | Pending |
| FUNNEL-06 | Phase 2 | Pending |
| FUNNEL-07 | Phase 2 | Pending |
| FUNNEL-08 | Phase 2 | Pending |
| INCONT-01 | Phase 2 | Pending |
| INCONT-02 | Phase 2 | Pending |
| INCONT-03 | Phase 2 | Pending |
| CROSS-01 | Phase 2 | Pending |
| TOQUES-01 | Phase 3 | Pending |
| TOQUES-02 | Phase 3 | Pending |
| TOQUES-03 | Phase 3 | Pending |
| TOQUES-04 | Phase 3 | Pending |
| TOQUES-05 | Phase 3 | Pending |
| RAZNES-01 | Phase 3 | Pending |
| RAZNES-02 | Phase 3 | Pending |
| RAZNES-03 | Phase 3 | Pending |
| RAZPERD-01 | Phase 3 | Pending |
| RAZPERD-02 | Phase 3 | Pending |
| RAZPERD-03 | Phase 3 | Pending |
| DEALS-01 | Phase 4 | Pending |
| DEALS-02 | Phase 4 | Pending |
| DEALS-03 | Phase 4 | Pending |
| DEALS-04 | Phase 4 | Pending |
| DEALS-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 — traceability updated to match ROADMAP.md phase structure*
