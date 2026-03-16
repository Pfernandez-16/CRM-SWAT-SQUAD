# Requirements: CRM SWAT Squad — Pre-Entrega al Cliente

**Defined:** 2026-03-14
**Core Value:** El reporte cuadra con la base de datos al 100% y el flujo SDR→AE funciona sin fricciones

## v1 Requirements (Complete — Milestone v1.0)

All 39 v1/v1.1 requirements shipped in milestone v1.0 (Reportería). See MILESTONES.md for details.

## v2.0 Requirements

Requirements for pre-delivery milestone. Each maps to roadmap phases.

### Bug Fixes

- [x] **BUG-01**: submitHandoff llama a processHandoff (routing-aware) en vez de updateLeadMultiple — activando la lógica de asignación inteligente de AE
- [x] **BUG-02**: SDR Ranking CVR calcula correctamente usando lead.status === 'Paso a Ventas' o existencia de deal en vez de cal.status_lead inexistente
- [x] **BUG-03**: Funciones duplicadas eliminadas en App.html — solo queda una definición de openHandoffModal, cancelHandoff, submitHandoff (la que usa processHandoff)
- [x] **BUG-04**: processHandoff escribe status canónico 'Paso a Ventas' en vez de 'Pase a Ventas'

### Handoff & Routing

- [x] **ROUTE-01**: Modo SDR_CHOICE funcional: SDR selecciona AE manualmente desde dropdown en handoff modal, processHandoff usa ese email para crear el deal
- [x] **ROUTE-02**: Modo AUTO funcional: Round Robin asigna AE automáticamente al confirmar handoff, dropdown de AE se oculta
- [x] **ROUTE-03**: Modo MANAGER_REVIEW funcional: Handoff crea deal sin AE asignado, queda pendiente hasta que gerente apruebe y asigne
- [x] **ROUTE-04**: Configuración de routing editable desde panel Admin — gerente/admin puede seleccionar modo activo (SDR_CHOICE/AUTO/MANAGER_REVIEW)

### Pricing & Valuación

- [x] **PRICE-01**: Monto estimado auto-calculado y visible al paso a ventas (Tipo 1: ticket promedio × factor según tipo de cliente — Fichas×12, Proyectos×1, SaaS×licencias×12)
- [x] **PRICE-02**: Monto cotizado editable por AE en ficha de deal (Tipo 2) — campo independiente del monto estimado
- [x] **PRICE-03**: Pricing calculator integrado en handoff modal (muestra monto estimado antes de confirmar) y en deal detail modal (permite ver/editar pricing)

### Deal Fichas

- [x] **DEAL-01**: Ficha de deal separada en sección Cotización (monto cotizado + fecha de cotización) y sección Cierre (monto cierre + monto apartado + fecha de cierre) — visualmente distintas en el modal
- [x] **DEAL-02**: Timestamps automáticos: fecha_cotizacion se graba al llenar monto cotizado, fecha_cierre se graba al cambiar status a Vendido
- [x] **DEAL-03**: Soporte multi-producto por deal — tabla de productos con nombre, cantidad, precio unitario, descuento % por línea
- [x] **DEAL-04**: Clasificación automática cross-selling/up-selling/venta directa — compara producto de interés del SDR con producto(s) de cierre del AE

### QA & Limpieza

- [x] **QA-01**: CHECKLIST_REUNION_CLIENTE.md actualizado reflejando que toda la sección 9 (Reportería) está completa
- [x] **QA-02**: Código muerto eliminado de App.html — funciones duplicadas, variables no referenciadas, imports sin usar
- [x] **QA-03**: Verificación end-to-end del flujo completo: crear lead → toques → calificar BANT → handoff → deal creado con AE → cotizar → negociar → cerrar

## v3.0 Requirements (Checkpoint 2 + 3)

### Quick Wins UI/UX

- [x] **QW-01**: Ocultar campo "Index" del formulario de negociación
- [x] **QW-02**: Dropdown razones de pérdida con opción "Otros" + campo texto libre condicional
- [x] **QW-03**: Renombrar "Propuesta enviada" → "Cotización" en catálogo Status de Venta (manual)
- [x] **QW-04**: Campo "Notas de Cotización" en sección Cotización del deal

### Toques & Seguimiento

- [x] **TOQUE-01**: Registrar canal/medio (Llamada, WhatsApp, Email) por cada toque en fact_toques
- [x] **TOQUE-02**: Impedir registrar toque hacia atrás — solo incrementar (monotonic)

### Detección de Duplicados

- [x] **DUP-01**: Alerta al crear lead si email o teléfono ya existe en fact_leads (sin fusión automática)

### Reporte AE

- [x] **AERPT-01**: Vista de reporte dedicada para Account Executives con métricas de deal pipeline

### Presupuesto Dual

- [x] **BUDGET-01**: Campo presupuesto con modo exacto ($) o modo rango (De $X a $Y)

### Plantillas de Notas

- [x] **TMPL-01**: Templates pre-escritas para SDR seleccionables desde dropdown, con variables auto-reemplazadas

### Historial de Cambios

- [x] **AUDIT-01**: Cada modificación a lead/deal registra quién, qué campo, valor anterior, valor nuevo, cuándo (ya existía — 27 call sites de logChange_ + tab Historial en modal)

### Preguntas Parametrizables

- [x] **PARAM-01**: Admin configura preguntas adicionales al BANT por cliente desde panel de configuración

### QA v3.0

- [x] **QA3-01**: Verificación E2E de todos los flujos v3.0 + deploy final

## v4 Requirements (Deferred)

### Autenticación

- **AUTH-01**: Login con email + contraseña
- **AUTH-02**: Sesión persistente entre recargas

### Importación Masiva

- **IMPORT-01**: Importar base de datos desde CSV/Excel con mapeo de campos
- **IMPORT-02**: Distribución 70/30 configurable de leads entrantes (SDR vs AE directo)

### Landing Page

- **LAND-01**: Formulario landing page parametrizable conectado a Google Sheets
- **LAND-02**: Correo con dominio del cliente (limitación GAS)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Looker Studio / herramientas BI externas | Decisión arquitectural: self-contained en GAS |
| WebSockets / real-time push | Limitación de Google Apps Script |
| Migración a SQL | Cliente requiere Google Sheets como DB |
| OAuth / SSO | No pedido por el cliente |
| App móvil nativa | Web-first — GAS sirve como PWA |
| BANT score decay por Timing | Nice-to-have, no comprometido para entrega |
| SPAM metric en incontactables | No hay columna fuente en schema — requiere cambio de proceso del cliente |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 7 | Complete |
| BUG-02 | Phase 7 | Complete |
| BUG-03 | Phase 7 | Complete |
| BUG-04 | Phase 7 | Complete |
| ROUTE-01 | Phase 8 | Complete |
| ROUTE-02 | Phase 8 | Complete |
| ROUTE-03 | Phase 8 | Complete |
| ROUTE-04 | Phase 8 | Complete |
| PRICE-01 | Phase 9 | Complete |
| PRICE-02 | Phase 9 | Complete |
| PRICE-03 | Phase 9 | Complete |
| DEAL-01 | Phase 10 | Complete |
| DEAL-02 | Phase 10 | Complete |
| DEAL-03 | Phase 10 | Complete |
| DEAL-04 | Phase 10 | Complete |
| QA-01 | Phase 11 | Complete |
| QA-02 | Phase 11 | Complete |
| QA-03 | Phase 11 | Complete |

| QW-01 | Phase 12 | Complete |
| QW-02 | Phase 12 | Complete |
| QW-03 | Phase 12 | Complete |
| QW-04 | Phase 12 | Complete |
| TOQUE-01 | Phase 13 | Complete |
| TOQUE-02 | Phase 13 | Complete |
| DUP-01 | Phase 14 | Complete |
| AERPT-01 | Phase 15 | Complete |
| BUDGET-01 | Phase 16 | Complete |
| TMPL-01 | Phase 17 | Complete |
| AUDIT-01 | Phase 18 | Complete |
| PARAM-01 | Phase 19 | Complete |
| QA3-01 | Phase 20 | Complete |

**Coverage:**
- v2.0 requirements: 18 total — 18 complete (100%)
- v3.0 requirements: 13 total — 13 complete (100%)
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 — v3.0 requirements added from Checkpoint 2+3*
