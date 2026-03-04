# Requirements: CRM SWAT Squad — Reporteria

**Defined:** 2026-03-03
**Core Value:** El equipo de direccion puede ver metricas del embudo de ventas en tiempo real dentro del CRM

## v1 Requirements

### Bug Fixes & Stabilization

- [x] **BUG-01**: LEAD_FIELD_MAP debe incluir campos de calificacion faltantes (Toques de Contactacion, En que toque va, campos BANT)
- [x] **BUG-02**: saveLeadChanges() debe detectar si el item es deal o lead por _source, no asumir por userRole

### Backend Analytics

- [x] **ANLYT-01**: Crear archivo Analytics.js separado con funciones de calculo de metricas
- [x] **ANLYT-02**: Funcion getSDRReport(dateIn, dateOut) que retorna todas las secciones del reporte como JSON
- [x] **ANLYT-03**: Filtrado por rango de fechas (fecha_ingreso) con parametros Day In / Day Out
- [x] **ANLYT-04**: Segmentacion por servicio_interes (Total / Manufacturers / Individuals)
- [x] **ANLYT-05**: Calculo de Delta% vs periodo anterior automatico
- [x] **ANLYT-06**: Seccion Embudo General (total leads, pruebas, contactables, contactados, con respuesta, dialogo completo/intermitente, interes, descartados, asignados a ventas, carry-over, montos inversion, deals cerrados, monto cierres)
- [x] **ANLYT-07**: Seccion Incontactables (Duplicado, Equivocado, SPAM)
- [x] **ANLYT-08**: Seccion Cross Selling
- [x] **ANLYT-09**: Seccion Semaforo Contesto (Telefono 1/2/3, WhatsApp 1/2/3, Correo 1/2/3/4)
- [x] **ANLYT-10**: Seccion Semaforo No Contesto (Telefono 1/2/3, WhatsApp 1/2/3)
- [x] **ANLYT-11**: Seccion Sin Respuesta 6to Toque
- [x] **ANLYT-12**: Seccion Por que no paso a Ventas (12 razones)
- [x] **ANLYT-13**: Seccion Por que se perdio la venta (12 razones)

### Frontend Reportes

- [x] **UI-01**: Nueva vista "Reportes" en sidebar con icono, visible solo para ADMIN
- [x] **UI-02**: Selector de rango de fechas (Day In / Day Out) con date pickers
- [x] **UI-03**: Tabla Embudo General con columnas Total|%|Delta por segmento
- [x] **UI-04**: Tabla Incontactables
- [x] **UI-05**: Tabla Cross Selling
- [ ] **UI-06**: Tabla Semaforo Contesto
- [ ] **UI-07**: Tabla Semaforo No Contesto
- [ ] **UI-08**: Tabla Sin Respuesta 6to Toque
- [ ] **UI-09**: Tabla Por que no paso a Ventas
- [ ] **UI-10**: Tabla Por que se perdio la venta
- [x] **UI-11**: Indicador de carga mientras se calculan metricas

## v2 Requirements

### Visualizacion Avanzada

- **VIZ-01**: Graficos de barras/pie para las secciones del reporte
- **VIZ-02**: Exportar reporte a PDF/Excel
- **VIZ-03**: Reporte por vendedor individual
- **VIZ-04**: Tendencias historicas (linea de tiempo)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Graficos y charts | v2 — primero validar que los numeros cuadren |
| Automatizacion de toques | Milestone separado |
| Panel HMN variables | Pedro lo dejo en progreso, completar despues |
| CRUD usuarios en UI | Pedro lo dejo en progreso, completar despues |
| Reportes AE/Ventas | Futuro — enfoque actual es reporte SDR |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 1 | Complete |
| BUG-02 | Phase 1 | Complete |
| ANLYT-01 | Phase 2 | Complete |
| ANLYT-02 | Phase 2 | Complete |
| ANLYT-03 | Phase 2 | Complete |
| ANLYT-04 | Phase 2 | Complete |
| ANLYT-05 | Phase 2 | Complete |
| ANLYT-06 | Phase 2 | Complete |
| ANLYT-07 | Phase 2 | Complete |
| ANLYT-08 | Phase 2 | Complete |
| ANLYT-09 | Phase 2 | Complete |
| ANLYT-10 | Phase 2 | Complete |
| ANLYT-11 | Phase 2 | Complete |
| ANLYT-12 | Phase 2 | Complete |
| ANLYT-13 | Phase 2 | Complete |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 3 | Complete |
| UI-04 | Phase 3 | Complete |
| UI-05 | Phase 3 | Complete |
| UI-06 | Phase 3 | Pending |
| UI-07 | Phase 3 | Pending |
| UI-08 | Phase 3 | Pending |
| UI-09 | Phase 3 | Pending |
| UI-10 | Phase 3 | Pending |
| UI-11 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
