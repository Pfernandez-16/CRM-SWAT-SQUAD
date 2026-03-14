# Requirements: CRM SWAT Squad — Pre-Entrega al Cliente

**Defined:** 2026-03-14
**Core Value:** El reporte cuadra con la base de datos al 100% y el flujo SDR→AE funciona sin fricciones

## v1 Requirements (Complete — Milestone v1.0)

All 39 v1/v1.1 requirements shipped in milestone v1.0 (Reportería). See MILESTONES.md for details.

## v2.0 Requirements

Requirements for pre-delivery milestone. Each maps to roadmap phases.

### Bug Fixes

- [ ] **BUG-01**: submitHandoff llama a processHandoff (routing-aware) en vez de updateLeadMultiple — activando la lógica de asignación inteligente de AE
- [ ] **BUG-02**: SDR Ranking CVR calcula correctamente usando lead.status === 'Paso a Ventas' o existencia de deal en vez de cal.status_lead inexistente
- [ ] **BUG-03**: Funciones duplicadas eliminadas en App.html — solo queda una definición de openHandoffModal, cancelHandoff, submitHandoff (la que usa processHandoff)
- [ ] **BUG-04**: processHandoff escribe status canónico 'Paso a Ventas' en vez de 'Pase a Ventas'

### Handoff & Routing

- [ ] **ROUTE-01**: Modo SDR_CHOICE funcional: SDR selecciona AE manualmente desde dropdown en handoff modal, processHandoff usa ese email para crear el deal
- [ ] **ROUTE-02**: Modo AUTO funcional: Round Robin asigna AE automáticamente al confirmar handoff, dropdown de AE se oculta
- [ ] **ROUTE-03**: Modo MANAGER_REVIEW funcional: Handoff crea deal sin AE asignado, queda pendiente hasta que gerente apruebe y asigne
- [ ] **ROUTE-04**: Configuración de routing editable desde panel Admin — gerente/admin puede seleccionar modo activo (SDR_CHOICE/AUTO/MANAGER_REVIEW)

### Pricing & Valuación

- [ ] **PRICE-01**: Monto estimado auto-calculado y visible al paso a ventas (Tipo 1: ticket promedio × factor según tipo de cliente — Fichas×12, Proyectos×1, SaaS×licencias×12)
- [ ] **PRICE-02**: Monto cotizado editable por AE en ficha de deal (Tipo 2) — campo independiente del monto estimado
- [ ] **PRICE-03**: Pricing calculator integrado en handoff modal (muestra monto estimado antes de confirmar) y en deal detail modal (permite ver/editar pricing)

### Deal Fichas

- [ ] **DEAL-01**: Ficha de deal separada en sección Cotización (monto cotizado + fecha de cotización) y sección Cierre (monto cierre + monto apartado + fecha de cierre) — visualmente distintas en el modal
- [ ] **DEAL-02**: Timestamps automáticos: fecha_cotizacion se graba al llenar monto cotizado, fecha_cierre se graba al cambiar status a Vendido
- [ ] **DEAL-03**: Soporte multi-producto por deal — tabla de productos con nombre, cantidad, precio unitario, descuento % por línea
- [ ] **DEAL-04**: Clasificación automática cross-selling/up-selling/venta directa — compara producto de interés del SDR con producto(s) de cierre del AE

### QA & Limpieza

- [ ] **QA-01**: CHECKLIST_REUNION_CLIENTE.md actualizado reflejando que toda la sección 9 (Reportería) está completa
- [ ] **QA-02**: Código muerto eliminado de App.html — funciones duplicadas, variables no referenciadas, imports sin usar
- [ ] **QA-03**: Verificación end-to-end del flujo completo: crear lead → toques → calificar BANT → handoff → deal creado con AE → cotizar → negociar → cerrar

## v3 Requirements (Deferred)

### Autenticación

- **AUTH-01**: Login con email + contraseña
- **AUTH-02**: Sesión persistente entre recargas

### Importación Masiva

- **IMPORT-01**: Importar base de datos desde CSV/Excel con mapeo de campos
- **IMPORT-02**: Distribución 70/30 configurable de leads entrantes (SDR vs AE directo)

### Calendario Completo

- **CAL-01**: Calendario interactivo con calls, seguimientos y tareas por rol
- **CAL-02**: Edición directa desde el calendario con drag & drop

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
| BUG-01 | TBD | Pending |
| BUG-02 | TBD | Pending |
| BUG-03 | TBD | Pending |
| BUG-04 | TBD | Pending |
| ROUTE-01 | TBD | Pending |
| ROUTE-02 | TBD | Pending |
| ROUTE-03 | TBD | Pending |
| ROUTE-04 | TBD | Pending |
| PRICE-01 | TBD | Pending |
| PRICE-02 | TBD | Pending |
| PRICE-03 | TBD | Pending |
| DEAL-01 | TBD | Pending |
| DEAL-02 | TBD | Pending |
| DEAL-03 | TBD | Pending |
| DEAL-04 | TBD | Pending |
| QA-01 | TBD | Pending |
| QA-02 | TBD | Pending |
| QA-03 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 18 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 18 ⚠️

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after milestone v2.0 definition*
