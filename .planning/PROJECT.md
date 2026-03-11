# CRM SWAT Squad — Módulo de Reportería

## What This Is

CRM personalizado sobre Google Apps Script + Vue 3 + Google Sheets (Star Schema v6) para equipos de ventas con roles SDR/AE/ADMIN. El núcleo del CRM (gestión de leads, kanban, handoff SDR→AE, auditoría, BANT) está **funcionalmente completo en v7**. El trabajo activo es construir la **interfaz de reportes** según las especificaciones del cliente (Christian, reunión 02.26), y agregar el backend del reporte de Deals/Negociaciones que no existe aún.

## Core Value

El reporte debe ser confiable al 100% — los números cuadran con la base de datos o el cliente no renueva.

> "La confiabilidad es lo que puede marcar la diferencia de que alguien siga colaborando con nosotros o no." — Christian (transcripción 02.26)

## Requirements

### Validated

- ✓ Star Schema v6: fact_leads, fact_deals, fact_interacciones, dim_contactos, dim_vendedores — existente
- ✓ Frontend SPA Vue 3 + Tailwind Glassmorphism — existente
- ✓ Vista Tabla + Kanban para prospectos y negociaciones — existente
- ✓ Handoff SDR→AE con validación BANT — existente
- ✓ LockService para concurrencia — existente
- ✓ Panel Admin con HMN Variables — existente
- ✓ Clock-In/Clock-Out de SDRs — existente (extra no pedido)
- ✓ Backend Analytics.js completo: 9 secciones (embudo, incontactables, cross-selling, semáforos, sinRespuesta, razones, matrizContactabilidad) — existente

### Active

- [ ] Frontend de reportes: Embudo General con ratios de conversión
- [ ] Frontend de reportes: Incontactables (manufacturados vs individuales)
- [ ] Frontend de reportes: Cross-Selling
- [ ] Frontend de reportes: Toques/Contactabilidad VERTICAL (toques=filas, productos/países=columnas)
- [ ] Frontend de reportes: Semáforos Contesto/No Contesto
- [ ] Frontend de reportes: Razones No Pasó a Ventas (con % representatividad)
- [ ] Frontend de reportes: Razones Perdió la Venta (con % representatividad)
- [ ] Frontend de reportes: Selector de período + tipo de comparación (período anterior / año anterior)
- [ ] Backend nuevo: Reporte de Deals/Negociaciones (cotizó/negociación/demo/contrato/fondeó)
- [ ] Frontend de reportes: Reporte de Deals/Negociaciones

### Out of Scope

- Autenticación email/password — diferido, no bloqueante para reportes
- Importación masiva CSV/Excel — Fase 2
- Test 70/30 de distribución de leads — Fase 2
- Integración directa con landing page (form automático) — Fase 2
- Calendario interactivo completo — Fase 2
- Looker Studio o herramientas BI externas — decisión arquitectural: self-contained en GAS
- WebSockets / real-time — limitación de GAS, no viable

## Context

**Stack:** Google Apps Script (ES5-compatible) + Vue 3 CDN + Tailwind CSS CDN + SortableJS. Todo en un solo Google Workspace deployment. Sin npm, sin build step.

**Archivos clave:**
- `Analytics.js` — Motor de cálculo backend. 9 secciones ya implementadas + test functions.
- `App.html` — SPA principal Vue 3. Contiene toda la UI: prospectos, negociaciones, admin, y la vista de reportes (a construir).
- `Código.js` — Orquestador backend: CRUD de leads/deals, autenticación, doGet(), expone `getSDRReport()`.
- `Index.html` — Wrapper HTML que carga el app.
- `Styles.html` — CSS global, glassmorphism, dark mode.

**Base de datos (Google Sheets, Star Schema v6):**
- `fact_leads` — Prospectos (SDR workspace)
- `fact_deals` — Negociaciones (AE workspace)
- `fact_interacciones` — Toques/intentos de contacto
- `fact_calificacion` — BANT scores
- `log_transacciones` — Auditoría de cambios
- `dim_contactos` — Catálogo de contactos
- `dim_vendedores` — Roles y permisos

**Lo que ya sabe el backend sobre reportes:**
- `getSDRReport(dateIn, dateOut, compareType)` retorna JSON con 9 secciones
- `compareType`: 'period' (período anterior) | 'year' (año anterior)
- `matrizContactabilidad` tiene estructura VERTICAL (byProduct, byCountry, toques como filas)
- Todos los datos vienen segmentados: total / manufacturers / individuals + delta %

**Gap crítico identificado:**
- `fact_deals` tiene `monto_cotizacion` y `monto_cierre` pero NO tiene campos booleanos para el funnel de ventas: `cotizo`, `en_negociacion`, `asistio_demo`, `firmo_contrato`, `fondeo` — necesarios para el reporte de Deals/Negociaciones.

## Constraints

- **Tech Stack:** Google Apps Script ES5 — no arrow functions, no async/await, no modules. Todo es `var`.
- **Sin build step:** Vue 3 y Tailwind cargados vía CDN en script tags dentro de App.html.
- **GAS Timeout:** 6 minutos máximo. `getSDRReport` es una sola llamada; si crece, puede fallar.
- **Un solo archivo HTML:** App.html contiene todo el frontend. Vue maneja vistas con v-if.
- **Modelo de datos inmutable:** No migrar a SQL. Sheets es la DB. Agregar columnas cuando sea necesario.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Backend Analytics.js completo antes del frontend | Evitar re-trabajo si los datos cambian | ✓ Good — backend sólido |
| Toques = FILAS (no columnas) en la UI | Requerimiento explícito de Christian: consistencia vertical para comparar productos | — Pending |
| matrizContactabilidad en backend usa byProduct y byCountry | Permite comparar a lo largo y a lo ancho | — Pending |
| Agregar campos booleanos a fact_deals para reporte de Negociaciones | No están en el schema actual — necesario para el reporte de deals | — Pending |

---
*Last updated: 2026-03-11 after project re-initialization — pull from Pedro's repo + GSD setup*
