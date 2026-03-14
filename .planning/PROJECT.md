# CRM SWAT Squad

## What This Is

CRM personalizado sobre Google Apps Script + Vue 3 + Google Sheets (Star Schema v6) para equipos de ventas con roles SDR/AE/ADMIN/GERENTE. El CRM core (gestión de leads, kanban, handoff SDR→AE, auditoría, BANT, calendario, email) y el módulo completo de reportería están funcionalmente entregados. El trabajo activo es **corregir bugs críticos, activar el handoff routing inteligente, y completar features pendientes para la entrega al cliente**.

## Core Value

El reporte cuadra con la base de datos al 100% y el flujo SDR→AE funciona sin fricciones — confiabilidad y usabilidad son lo que retiene al cliente.

> "La confiabilidad es lo que puede marcar la diferencia de que alguien siga colaborando con nosotros o no." — Christian (transcripción 02.26)

## Current Milestone: v2.0 Pre-Entrega al Cliente

**Goal:** Corregir bugs críticos del handoff, activar routing inteligente de AEs, implementar pricing UI en fichas, reestructurar deal fichas, y QA general para la entrega a Christian.

**Target features:**
- Bug fixes críticos (handoff routing bypass, SDR ranking CVR, funciones duplicadas, typo status)
- Handoff SDR→AE funcional end-to-end con Round Robin / SDR Choice / Manager Review
- Pricing UI visible y calculable en fichas de leads y deals
- Deal fichas reestructuradas con secciones Cotización y Cierre separadas
- QA y limpieza de código muerto pre-entrega

## Requirements

### Validated

- ✓ Star Schema v6: fact_leads, fact_deals, fact_interacciones, dim_contactos, dim_vendedores
- ✓ Frontend SPA Vue 3 + Tailwind Glassmorphism + Dark/Light mode
- ✓ Vista Tabla + Kanban con drag & drop (SortableJS)
- ✓ Handoff SDR→AE con validación BANT (modal con 3 campos obligatorios)
- ✓ LockService para concurrencia
- ✓ Panel Admin con HMN Variables + User CRUD
- ✓ Clock-In/Clock-Out de SDRs con timer
- ✓ Calendario integrado (FullCalendar + Google Calendar CRUD)
- ✓ Email compose (Quill + attachments)
- ✓ Backend Analytics.js: 11 secciones de reporte
- ✓ Frontend Reportes: 12 secciones accordion con tablas, Chart.js funnel, delta alerts
- ✓ Comparativa personalizada + Ranking SDRs
- ✓ Visual Intelligence (Chart.js, delta-alert CSS, deal velocity)
- ✓ BANT auto-score (calidad_contacto Alto/Medio/Bajo)
- ✓ Form submit integration (Google Forms → createNewLeadOrDeal)
- ✓ Audit logging (log_transacciones)

### Active

- [ ] Fix: submitHandoff debe llamar a processHandoff (routing-aware) en vez de updateLeadMultiple
- [ ] Fix: SDR Ranking CVR usa campo inexistente — corregir a lead.status o deal existence
- [ ] Fix: Eliminar funciones duplicadas en App.html (openHandoffModal, cancelHandoff, submitHandoff)
- [ ] Fix: processHandoff escribe 'Pase a Ventas' — corregir a 'Paso a Ventas'
- [ ] Handoff end-to-end: Round Robin, SDR Choice, y Manager Review funcionando en producción
- [ ] Pricing UI: monto estimado visible y calculable al paso a ventas (Tipo 1)
- [ ] Pricing UI: monto cotizado editable por AE en ficha de deal (Tipo 2)
- [ ] Deal fichas: separar secciones Cotización (monto + fecha) y Cierre (monto + apartado + fecha)
- [ ] Deal fichas: soporte multi-producto por deal
- [ ] QA: actualizar CHECKLIST_REUNION_CLIENTE.md con reportería completada
- [ ] QA: limpieza de código muerto y verificación end-to-end

### Out of Scope

- Autenticación email/password — diferido a v3, no bloqueante
- Importación masiva CSV/Excel — diferido a v3
- Test 70/30 distribución de leads — diferido a v3
- Integración directa con landing page — diferido a v3
- BANT score decay por Timing — nice-to-have, no comprometido
- Looker Studio / BI externo — decisión arquitectural: self-contained en GAS
- WebSockets / real-time — limitación de GAS

## Context

**Stack:** Google Apps Script (ES5) + Vue 3 CDN + Tailwind CSS CDN + SortableJS + FullCalendar + Chart.js + Quill.js. Sin npm, sin build step.

**Archivos clave (5 archivos, ~11,500 líneas):**
- `Código.js` (2,594 lines) — Backend: 30+ public API functions
- `Analytics.js` (1,616 lines) — Motor de reportes: 11 secciones
- `App.html` (2,230 lines) — Vue 3 SPA: 50+ refs, 25+ computeds
- `Index.html` (3,171 lines) — HTML: sidebar, 6 vistas, 5 modales, 12 secciones accordion
- `Styles.html` (1,894 lines) — CSS: dark/light, glassmorphism, report tables

**Base de datos (Google Sheets, Star Schema v6):**
- `fact_leads`, `fact_deals`, `fact_interacciones`, `fact_calificacion`
- `dim_contactos`, `dim_vendedores`, `dim_productos`, `dim_campanas`
- `cat_opciones`, `config_users`, `log_transacciones`

**Bugs críticos identificados en v2.0 analysis:**
1. `submitHandoff()` activo llama `updateLeadMultiple` (trigger path), NO `processHandoff` (routing path) — Round Robin es código muerto
2. `calculateSDRRankingReport_()` busca `cal.status_lead` en fact_calificacion — campo no existe, CVR = 0 siempre
3. `openHandoffModal`, `cancelHandoff`, `submitHandoff` definidas 2 veces cada una en App.html — primera definición (con routing) es dead code
4. `processHandoff` escribe `'Pase a Ventas'` (typo) vs canonical `'Paso a Ventas'`

## Constraints

- **Tech Stack:** Google Apps Script ES5 — no arrow functions, no async/await, no modules. Todo es `var`.
- **Sin build step:** Vue 3 y Tailwind cargados vía CDN.
- **GAS Timeout:** 6 minutos máximo por ejecución.
- **Un solo archivo HTML:** App.html contiene todo el frontend. Vue maneja vistas con v-if.
- **Modelo de datos:** Google Sheets. Agregar columnas cuando sea necesario, no migrar.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Backend Analytics.js completo antes del frontend | Evitar re-trabajo si los datos cambian | ✓ Good |
| Toques = FILAS en la UI | Requerimiento explícito de Christian | ✓ Good |
| Agregar campos booleanos a fact_deals | Necesario para reporte de deals | ✓ Good |
| processHandoff con routing inteligente | Round Robin + SDR Choice + Manager Review para flexibilidad | ⚠️ Revisit — actualmente bypassed |
| submitHandoff debe usar processHandoff | Bug fix: activar la lógica de routing que ya existe | — Pending |

---
*Last updated: 2026-03-14 after milestone v2.0 initialization*
