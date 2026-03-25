# CRM SWAT Squad — Checklist Maestro

**Última actualización:** 2026-03-25
**Deployment actual:** V10.0 @42

---

## Features Completadas

### Checkpoint 4 — Reunión con Christian (02.26)

- [x] SDR ve Deals en solo lectura (nav + modal disabled + kanban DnD off)
- [x] Reportes en formato vertical — Embudo General
- [x] Reportes en formato vertical — Incontactables
- [x] Reportes en formato vertical — Cross-Selling
- [x] Reportes en formato vertical — Sin Respuesta 6to Toque
- [x] Reportes en formato vertical — Razones No Pasó a Ventas (con Mix%)
- [x] Reportes en formato vertical — Razones Perdió la Venta (con Mix%)
- [x] Toggle de segmento (Total / Manufacturers / Individuals) en todas las secciones
- [x] CVR inter-etapa en Embudo General
- [x] Campos obligatorios configurables (Admin marca desde Config, validación en save + kanban drag)
- [x] Alertas de duplicados (banner amarillo en Prospectos, últimos 7 días)
- [x] Pricing multi-producto (hasta 10 productos, ticket promedio mensual por tipo de cliente)
- [x] Fórmulas de pricing: SaaS = ticket × licencias × 12, Fichas = ticket × 12, Proyectos = ticket × 1
- [x] "Otros" razón de pérdida con texto libre — Deals (AE)
- [x] "Otros" razón de pérdida con texto libre — Leads (SDR)
- [x] Upload comprobante de pago a Google Drive (PNG/JPG/PDF, max 10MB)
- [x] Recompra badge visual (púrpura) en tabla y kanban de deals
- [x] Recompra card highlight (borde + fondo) en kanban de deals
- [x] Recompra highlight en filas de tabla de deals

### Features Adicionales (Post-Checkpoint 4)

- [x] Cross-view: SDR ve tab "Negociación" con datos del deal (read-only, data fresca)
- [x] Cross-view: AE ve tab "Prospecto" con datos del lead original (read-only)
- [x] Recompra para SDR — campo ¿Es recompra? en layout de leads
- [x] Reportes habilitados para SDR y AE (nav visible para ambos roles)
- [x] Historial de asistencia — clock-in/out registra en log_asistencia
- [x] Vista de asistencia en Config para Admin/Gerente (últimos 30 días)
- [x] Pricing label actualizado a "Ticket Promedio Mensual"
- [x] Loss reason renderer en cadena de deal sections (faltaba)
- [x] Fix: phantom log en uploadPaymentProof (logChange_ dentro de guard)

### Features Pre-Existentes (v1.0 — v3.0)

- [x] Lead CRUD completo
- [x] Deal CRUD completo
- [x] Kanban + Drag & Drop (leads y deals)
- [x] Calendar (FullCalendar + Google Calendar CRUD)
- [x] Email (Quill editor + attachments)
- [x] Clock-in/out + detección de inactividad (30 min)
- [x] Catálogos editables (Admin)
- [x] HMN config (variables configurables)
- [x] User management (crear, activar/desactivar, cambiar rol)
- [x] Dark/light theme
- [x] BANT auto-score + calidad de contacto auto-calculada
- [x] History timeline (pipeline, leads, deals)
- [x] Form submit integration (leads desde formularios externos)
- [x] 12 secciones de reportes (Embudo, Incontactables, Cross-Selling, Semáforos, Razones, Deals, Rankings, AE Report)
- [x] Comparativa personalizada (mes anterior, año anterior)
- [x] SDR Ranking con CVR
- [x] AE Ranking con métricas de deals
- [x] Chart.js funnel chart + deals velocity
- [x] Handoff routing (SDR Choice, Round Robin, Manager Review)
- [x] Plantillas de notas por usuario
- [x] Duplicate detection + merge banner
- [x] Schema discovery (auto-detecta columnas nuevas del Sheet)

---

## Pendientes — Alta Prioridad

- [ ] **P1: Reporte de Campañas (FB/Google Ads)** — Inversión, Impresiones, CPM, Clics, CPC, CTR, Visitas landing, Conv rate, Leads, Costo x lead, Leads a ventas, Conv lead-to-deal. Por medio + atribución indirecta + total. **STATUS: En stand-by, escala inicial próximamente.**
- [ ] **P2: Comparativa vs. Estimado (primeros 3 meses)** — Para clientes nuevos sin periodo anterior, Admin ingresa estimado y se compara contra eso.
- [ ] **P3: Período parametrizable en reportes** — Comparar vs. cualquier período personalizado (no solo mes anterior/año anterior).
- [ ] **P4: Score de completitud de ficha** — Indicador tipo "6/10" que muestre cuántos campos de la ficha están llenos.
- [ ] **P5: Filtrado de secciones de reportes por rol** — SDR ve menos métricas que ejecutivo. Nav ya habilitado, falta filtrar secciones específicas por rol.
- [ ] **P6: Cross-selling visible en funnel por producto** — Si lead llega por Producto A pero cierra B, mostrar como "Cross Selling" en vista per-product del funnel.

## Pendientes — Media Prioridad

- [ ] **M1: BANT Score Decay** — Score decrece basado en distancia del campo Timing.
- [ ] **M2: Reporte ejecutivo simplificado** — Versión resumida para Christian. (Tarea de Juan)
- [ ] **M3: Verificación profunda de historial de contacto** — Asegurar que no se pierde información en el log de cambios y toques en todos los flujos.

## Diferidos (v2 / Fase Posterior)

- [ ] **D1: Auth email + contraseña** — Login propio sin depender de Google Account.
- [ ] **D2: Import masivo CSV/Excel** — Carga masiva de leads.
- [ ] **D3: Dashboards de insights de optimización** — Christian: "para sacar insights hacia todo el funnel".
- [ ] **D4: Parametrización para Yoda** — Primer cliente de prueba, después de estabilizar CRM base.
- [ ] **D5: Reporte de Campañas completo con API** — Integración con FB/Google Ads APIs + landing page team.

---

## Columnas del Sheet (Setup Manual)

### Ya agregadas
- [x] `fact_leads.es_recompra`
- [x] `fact_leads.razon_perdida_otra`
- [x] `fact_leads.licencias`
- [x] `fact_deals.comprobante_pago_url`

### Auto-creadas
- [x] `log_asistencia` (se crea automáticamente en primer clock-in)

---

## Notas de Deployment

- `clasp push --force` → sube código a HEAD (desarrollo)
- Pedro maneja el `clasp deploy` manualmente para producción
- Nuevos OAuth scopes requieren re-autorización del deployer
- Script ID: `1AT7UA0NAuNTvRP08_tpBKCkqXM9PtAio3AsrA7dO1f1v7Uxe90XxL5uU`
- Sheet ID: `18GJ_Zz97k9F3r2VbyeNQNgRKuEc6LAV1Vyp7XprKrg0`
