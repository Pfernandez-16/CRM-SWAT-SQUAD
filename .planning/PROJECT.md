# CRM SWAT Squad — Modulo de Reporteria y Estabilizacion

## What This Is

Modulo de reporteria/analiticas para el CRM SWAT Squad v7, un sistema de gestion de leads y ventas construido en Google Apps Script + Vue 3 + Tailwind CSS sobre Google Sheets (Star Schema v6). El objetivo es replicar dentro del CRM las tablas de metricas que el equipo actualmente calcula manualmente en su hoja "Reporte SDR General", y corregir bugs existentes para estabilizar la plataforma.

## Core Value

El equipo de direccion puede ver metricas del embudo de ventas en tiempo real dentro del CRM, sin depender de hojas externas ni calculos manuales.

## Requirements

### Validated

<!-- Funcionalidad existente construida por Pedro (v7) -->

- ✓ Modulo SDR "Prospectos" con tabla y Kanban — existing
- ✓ Modulo AE "Negociaciones" con tabla y Kanban — existing
- ✓ Traspaso SDR→AE con Ficha de Negociacion (BANT) via drag-drop — existing
- ✓ Base de datos normalizada Star Schema v6 (fact_leads, fact_deals, fact_interacciones, fact_calificacion, dims) — existing
- ✓ CRUD de leads y deals — existing
- ✓ Sistema de roles (SDR, AE, ADMIN, GUEST) — existing
- ✓ Historial y auditoria en log_transacciones — existing
- ✓ Clock-in/clock-out con auto-desconexion por inactividad — existing
- ✓ Catalogo de opciones editable (cat_opciones) — existing
- ✓ Dashboard basico con stats cards y barras por status/vendedor — existing
- ✓ Calendario de interacciones — existing
- ✓ Integracion Google Forms (onFormSubmit) — existing
- ✓ Motor de pricing (dim_productos) — existing

### Active

<!-- Scope de este milestone -->

- [ ] Corregir bugs conocidos y estabilizar la plataforma
- [ ] Crear archivo Analytics.js separado en el proyecto GAS con funciones de calculo
- [ ] Vista "Reportes" en sidebar solo para rol ADMIN
- [ ] Filtro por rango de fechas (Day In / Day Out) basado en fecha_ingreso
- [ ] Segmentacion por campo servicio_interes (Total / Manufacturers / Individuals)
- [ ] Seccion 1 — Embudo General: Total leads, pruebas, contactables, contactados, con respuesta, dialogo completo/intermitente, interes, descartados, asignados a ventas, carry-over, montos de inversion, deals cerrados, monto de cierres
- [ ] Seccion 2 — Incontactables: desglose por Duplicado, Equivocado, SPAM
- [ ] Seccion 3 — Cross Selling: conteo de leads cross-selling
- [ ] Seccion 4 — Semaforo Contesto: desglose por Telefono 1/2/3, WhatsApp 1/2/3, Correo 1/2/3/4
- [ ] Seccion 5 — Semaforo No Contesto: desglose por Telefono 1/2/3, WhatsApp 1/2/3
- [ ] Seccion 6 — Sin Respuesta 6to Toque: leads que agotaron los 6 intentos
- [ ] Seccion 7 — Por que no paso a Ventas: razones de descarte (Toque 6, Nunca Respondio, Dejo de responder, No tuvo interes, Desconoce registro, Ya resolvio, No hay servicio, Busca ser proveedor, Busca empleo, Pidio no llamar, Motivos personales, No me llames yo te llamo)
- [ ] Seccion 8 — Por que se perdio la venta: razones de perdida (No intereso cotizacion, Costoso, Sin presupuesto, Sin respuesta, No envio info, No logramos contactar, Investigando, No cubre perfil salarios, No cubre requerimientos, No compagina politicas, No se logro dar servicio, Otras razones)
- [ ] Columnas por seccion: Total | % | Delta% vs Periodo Anterior
- [ ] Comparativo contra periodo anterior (calculado automaticamente)

### Out of Scope

- Graficos y visualizaciones avanzadas — se haran en un milestone futuro despues de validar las tablas
- Reportes exportables a PDF/Excel — futuro
- Reportes por vendedor individual — futuro
- Automatizacion de secuencia de toques — fuera de este milestone
- Panel HMN de variables globales — Pedro lo dejo en progreso, se completara despues
- CRUD de usuarios en UI — Pedro lo dejo en progreso, se completara despues

## Context

### Codebase Existente

El proyecto vive en `gas-crm-project/` y se deploya con `clasp` a Google Apps Script:

- **Code.js** (1,146 lineas) — Backend API completo: readTable_, indexBy_, getColumnMap_, getLeads(), getCatalogs(), updateLeadField(), updateLeadMultiple(), processLeadTriggers_(), copyLeadToDeals_(), getLeadStats(), etc.
- **Index.html** (1,083 lineas) — Template HTML con Vue 3 components, modales, Kanban, formularios
- **App.html** (952 lineas) — Vue 3 setup() con estado reactivo, computed properties, metodos
- **Styles.html** (1,441 lineas) — CSS con tema oscuro/claro, glassmorphism, componentes

### Base de Datos (Google Sheets — Star Schema v6)

- **Hechos:** fact_leads (200 rows, 14 cols), fact_deals (33 rows, 21 cols), fact_interacciones (600 rows, 10 cols), fact_calificacion (56 rows, 13 cols)
- **Dimensiones:** dim_contactos (200 rows, 13 cols), dim_campanas (30 rows, 8 cols), dim_vendedores (7 rows, 5 cols), dim_productos (60 rows, 8 cols)
- **Config:** cat_opciones (106 rows, 5 cols), config_users (7 rows, 6 cols), log_transacciones (250 rows, 8 cols)
- **Spreadsheet ID:** 18GJ_Zz97k9F3r2VbyeNQNgRKuEc6LAV1Vyp7XprKrg0

### Reporte de Referencia

El equipo usa una hoja "Reporte SDR General" en su Google Sheet de metricas (Reporte SS.xlsx) con 8 secciones de tablas que calculan metricas del embudo. Este reporte es el modelo exacto que debemos replicar dentro del CRM.

### Bugs Conocidos

1. **Bug Vue (RESUELTO):** El string 'Notas Vendedor' partido en dos lineas en Index.html ya fue corregido en la version actual.
2. **LEAD_FIELD_MAP incompleto:** Campos de calificacion (En que toque va, Toques de Contactacion, campos BANT de calificacion) no estan mapeados explicitamente — dependen del fallback "direct column match" que puede fallar si los nombres de columna no coinciden exactamente.
3. **isDeal hardcoded por rol:** saveLeadChanges() asume isDeal=true si userRole=AE, lo cual falla si un AE ve un lead cruzado (cross_lead).

### Mapeo de Datos para Reporteria

Las metricas del reporte se calculan a partir de:

- **Embudo general:** Contar leads en fact_leads por status (Status column), filtrado por fecha_ingreso y servicio_interes
- **Incontactables:** Leads con status "Duplicado", "Equivocado", "SPAM" en fact_leads
- **Semaforo de contactabilidad:** Interacciones en fact_interacciones (tipo_interaccion + resultado + numero_toque)
- **Descartados / razones:** Campo "Razon de perdida" en fact_leads + "razon_perdida" en fact_deals
- **Asignados a ventas:** Leads con status "Paso a Ventas" en fact_leads
- **Carry-over:** Leads asignados a ventas cuya fecha_ingreso es de un periodo anterior al filtro actual
- **Deals cerrados / montos:** fact_deals con status_venta "Vendido" y monto_cierre
- **Comparativo:** Mismo calculo pero con el rango de fechas del periodo anterior

## Constraints

- **Tech Stack:** Google Apps Script (V8 runtime) + Vue 3 CDN + Tailwind CSS CDN — no Node.js server, no bundler
- **Platform:** Todo corre dentro de Google Sheets como Web App
- **Deploy:** Via clasp (.clasp.json ya configurado)
- **Performance:** GAS tiene limite de 6 min por ejecucion — las funciones de analiticas deben ser eficientes con los datos en memoria
- **Data Size:** ~200 leads, ~33 deals, ~600 interacciones — escala actual manejable pero disenar para ~2000 leads
- **Timezone:** America/Mexico_City

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Analytics.js como archivo separado | Separacion de concerns, mantenibilidad — el Code.js ya tiene 1146 lineas | — Pending |
| Replicar tablas primero, graficos despues | Validar que los numeros cuadren antes de invertir en visualizacion | — Pending |
| Solo ADMIN ve reportes | Los reportes son para direccion, no operacion diaria | — Pending |
| Filtro por fecha_ingreso | Es el campo canonico de entrada del lead al sistema | — Pending |
| Segmentacion por servicio_interes | Mapea a Manufacturers/Individuals segun el campo existente | — Pending |

---
*Last updated: 2026-03-03 after initialization*
