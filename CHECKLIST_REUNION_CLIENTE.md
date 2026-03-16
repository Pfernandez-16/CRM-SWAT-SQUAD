# Checklist de Reunión con Christian — CRM SWAT Squad

> Documento de control para la reunión de entrega. Ir punto por punto.
> Fuente: Transcripción 02.26 — `TRANSCRIPCIÓN _ (CRM _ Pedro _ Chris) _ SWAT SQUAD _ 02.26.md`

---

## INSTRUCCIONES DE USO

1. Abrir este archivo antes de la reunión
2. Ir punto por punto sin saltar
3. Marcar ✅ lo que ya está entregado
4. Marcar 🔄 lo que está en progreso
5. Marcar ❌ lo que está pendiente
6. Documentar en "Notas de Entrega" todo lo que se hizo de más (extras) y por qué

---

## SECCIÓN 1 — ESTRUCTURA DE BASE DE DATOS

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 1.1 | Integración automática de formulario de landing page → CRM | ✅ | Google Forms → createNewLeadOrDeal |
| 1.2 | Dimensiones: contactos, campañas, leads, deals, roles | ✅ | Star Schema v6 implementado |
| 1.3 | Campos del formulario parametrizables por tipo de cliente | ✅ | HMN Variables en panel Admin |
| 1.4 | Agregar/eliminar campos sin intervención manual | ✅ | cat_opciones editable desde Config |

---

## SECCIÓN 2 — SECCIÓN DE PROSPECTOS (SDR)

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 2.1 | Vista Tabla Y Vista Kanban (alternables) | ✅ | SortableJS implementado |
| 2.2 | Registro de Toques (intentos de contacto + timestamps) | ✅ | fact_interacciones |
| 2.3 | Módulo de Historial de cambios (quién cambió qué, cuándo) | ✅ | log_transacciones |
| 2.4 | Marcado de asistencia (Clock-In / Clock-Out) | ✅ | **EXTRA** — ver sección de extras |
| 2.5 | Creación manual de prospectos ("Crear Lead") | ✅ | |
| 2.6 | Múltiples SDRs sin pisarse entre sí | ✅ | LockService |

---

## SECCIÓN 3 — MÓDULO DE PASO A VENTAS (SDR → AE)

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 3.1 | Formulario BANT obligatorio antes del traspaso | ✅ | |
| 3.2 | Confirmación "¿Estás seguro?" antes del traspaso | ✅ | |
| 3.3 | Especificar qué SDR pasa a qué AE | ✅ | 3 modos: SDR Choice, Round Robin Auto, Manager Review |
| 3.4 | Ficha técnica enviada al AE junto con el lead | ✅ | Modal "Ficha de Negociación" con historial + BANT + pricing |
| 3.5 | Posibilidad de regresar lead a etapa anterior | ✅ | |
| 3.6 | Mostrar monto total por columna (no solo conteo de tarjetas) | ✅ | |
| 3.7 | Campos obligatorios por etapa (no avanza si no completa) | ✅ | |

---

## SECCIÓN 4 — SECCIÓN DE NEGOCIACIONES (AE)

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 4.1 | Vista separada para AEs (fact_deals) | ✅ | Tab Negociaciones con tabla + kanban |
| 4.2 | Segmentación por rol: SDR ve prospectos, AE ve negociaciones | ✅ | |
| 4.3 | Columna "AE Asignado" en tabla de deals | ✅ | **EXTRA** Phase 8 |
| 4.4 | Badge "Pendiente revisión" para deals MANAGER_REVIEW | ✅ | **EXTRA** Phase 8 |

---

## SECCIÓN 5 — SISTEMA DE VALUACIÓN / PRICING (3 Tipos)

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 5.1 | Tipo 1: Monto estimado al paso a ventas (ticket promedio × factor) | ✅ | handoffMontoEstimado con desglose de fórmula |
| 5.2 | Tipo 2: Monto cotizado (lo que realmente se cotizó) | ✅ | fact_deals.monto_cotizacion editable por AE |
| 5.3 | Tipo 3: Monto de cierre (lo que se cerró) | ✅ | fact_deals.monto_cierre |
| 5.4 | Modelo: Proyectos (ticket promedio × 1) | ✅ | calculoMontoAproximado |
| 5.5 | Modelo: Suscripciones/Fichas (ticket mensual × 12) | ✅ | calculoMontoAproximado |
| 5.6 | Modelo: SaaS (por licencias × ticket × 12) | ✅ | calculoMontoAproximado |
| 5.7 | Monto Estimado SDR visible como referencia en ficha deal | ✅ | Banner read-only en sección Cotización |

---

## SECCIÓN 6 — CALIFICACIÓN BANT

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 6.1 | Calificación automática (no manual, para evitar inconsistencias) | ✅ | |
| 6.2 | Score base BANT: Budget, Authority, Need, Timing | ✅ | fact_calificacion |
| 6.3 | Score disminuye según distancia del Timing | 🔄 | Nice-to-have, diferido a v3 por acuerdo |
| 6.4 | Fórmula simple, sin ponderaciones complejas en MVP | ✅ | Alto/Medio/Bajo |

---

## SECCIÓN 7 — DISTRIBUCIÓN DE LEADS ENTRANTES

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 7.1 | Directo a AE (sin SDR) — modo SDR_CHOICE | ✅ | SDR selecciona AE en handoff |
| 7.2 | SDR asigna a AE/Gerente | ✅ | Modo SDR_CHOICE + MANAGER_REVIEW |
| 7.3 | Gerente distribuye a vendedores | ✅ | Modo MANAGER_REVIEW |
| 7.4 | Round-robin automático | ✅ | Modo AUTO con assignNextUserRR |
| 7.5 | Configuración de modo desde panel Admin | ✅ | Selector SDR_CHOICE / AUTO / MANAGER_REVIEW |

---

## SECCIÓN 8 — TAREAS Y CALENDARIO

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 8.1 | Sección de Tareas (asignar desde tarjeta de lead/deal) | ✅ | **EXTRA** — ver sección de extras |
| 8.2 | Calendario digital (llamadas, seguimientos, tareas por rol) | ✅ | FullCalendar + Google Calendar CRUD |
| 8.3 | Edición directa del calendario | ✅ | Quick Calendar + Event Details modal |

---

## SECCIÓN 9 — REPORTERÍA / ANALYTICS

### 9.1 — Configuración General del Reporte

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.1.1 | Selector de período (fecha inicio / fecha fin) | ✅ | Flatpickr range selector |
| 9.1.2 | Comparación vs período anterior | ✅ | |
| 9.1.3 | Comparación vs año anterior | ✅ | |
| 9.1.4 | Comparación personalizada (fechas libres) | ✅ | **EXTRA** Phase 5 |
| 9.1.5 | Segmentación por producto | ✅ | matrizContactabilidad |
| 9.1.6 | Segmentación por país | ✅ | matrizContactabilidad |

### 9.2 — Embudo General (Funnel)

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.2.1 | Total leads (manufacturados + individuales) | ✅ | |
| 9.2.2 | Contactables / Contactados / Con Respuesta | ✅ | |
| 9.2.3 | Diálogo Completo / Diálogo Intermitente | ✅ | |
| 9.2.4 | Con Interés / Descartados | ✅ | |
| 9.2.5 | Asignados a Ventas / Carry Over | ✅ | |
| 9.2.6 | Montos de Inversión / Deals Cerrados / Monto Cierres | ✅ | |
| 9.2.7 | Fórmulas de conversión entre etapas (funnel ratios) | ✅ | |
| 9.2.8 | Desglose: Manufacturados vs Individuales | ✅ | |
| 9.2.9 | Delta % vs período de comparación | ✅ | |
| 9.2.10 | Gráfica de embudo visual (Chart.js) | ✅ | **EXTRA** Phase 6 |
| 9.2.11 | Delta alerts (±20% destacado visual) | ✅ | **EXTRA** Phase 6 |

### 9.3 — Incontactables

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.3.1 | Duplicado (Manufacturados vs Individuales) | ✅ | |
| 9.3.2 | Equivocado (Manufacturados vs Individuales) | ✅ | |
| 9.3.3 | Spam (Manufacturados vs Individuales) | ✅ | |
| 9.3.4 | Delta % vs período comparación | ✅ | |

### 9.4 — Cross Selling

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.4.1 | Deals con tipo_transaccion = 'Cross-sell' | ✅ | |
| 9.4.2 | Desglose Manufacturados vs Individuales | ✅ | |

### 9.5 — Toques / Contactabilidad

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.5.1 | Presentación VERTICAL (toques = filas, productos/países = columnas) | ✅ | |
| 9.5.2 | Toques 1 al 10 configurables | ✅ | MAX_TOQUES=10 |
| 9.5.3 | Semáforo: Contactó vía WhatsApp (Sí/No) | ✅ | |
| 9.5.4 | Semáforo: Contactó vía Email (Sí/No) | ✅ | |
| 9.5.5 | Semáforo: Contactó vía Teléfono (Sí/No) | ✅ | |
| 9.5.6 | Cuántos toques hasta contacto (número) | ✅ | |
| 9.5.7 | Sin Respuesta hasta toque 6 | ✅ | |
| 9.5.8 | Sin Respuesta / No Contestó grids | ✅ | |

### 9.6 — Razones No Pasó a Ventas

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.6.1–9.6.6 | 6 categorías de razón | ✅ | |
| 9.6.7 | Representatividad % (base 100) | ✅ | |
| 9.6.8 | Delta vs período comparación | ✅ | |

### 9.7 — Razones Perdió la Venta

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.7.1 | 13 razones de pérdida de venta | ✅ | |
| 9.7.2 | Representatividad % por razón | ✅ | |
| 9.7.3 | Delta vs período comparación | ✅ | |

### 9.8 — Reporte de Deals/Negociaciones

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.8.1 | ¿Cotizó? (Sí/No) + Monto cotización | ✅ | Phase 4 |
| 9.8.2 | ¿En negociación? (Sí/No) | ✅ | Phase 4 |
| 9.8.3 | ¿Asistió a demo? (Sí/No) | ✅ | Phase 4 |
| 9.8.4 | ¿Firmó contrato? (Sí/No) | ✅ | Phase 4 |
| 9.8.5 | ¿Ya fondeó? (Sí/No) + Monto | ✅ | Phase 4 |
| 9.8.6 | ¿Se perdió? + Razón de pérdida | ✅ | |
| 9.8.7 | Flujo: Contactado→Cotizado→Negociación→Demo→Contrato→Fondeo | ✅ | Phase 4 |
| 9.8.8 | Velocidad de cierre promedio en días + delta | ✅ | **EXTRA** Phase 6 |

### 9.9 — Ranking SDRs

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 9.9.1 | Tabla de ranking con nombre SDR, total leads, CVR | ✅ | **EXTRA** Phase 5 |
| 9.9.2 | CVR anterior + delta | ✅ | **EXTRA** Phase 5 |
| 9.9.3 | Ordenado por CVR descendente | ✅ | **EXTRA** Phase 5 |

---

## SECCIÓN 10 — ADMINISTRACIÓN Y AUTENTICACIÓN

| # | Requerimiento | Estado | Notas |
|---|--------------|--------|-------|
| 10.1 | Gestión de roles y permisos de personal | ✅ | |
| 10.2 | Login email + contraseña | 🔄 | Diferido a v3 — usa auth de Google Apps Script |
| 10.3 | Activación/desactivación de perfiles | ✅ | |
| 10.4 | Panel de variables HMN configurables | ✅ | |
| 10.5 | Configuración de routing de AEs | ✅ | **EXTRA** Phase 8 |
| 10.6 | Reordenamiento Round Robin drag & drop | ✅ | **EXTRA** Phase 8 |

---

## SECCIÓN 11 — FASE 2 (DIFERIDO — NO COMPROMETIDO EN ESTA ENTREGA)

> Solo mencionar en reunión si Christian pregunta. Recordar que esto es Fase 2.

| # | Ítem | Notas |
|---|------|-------|
| 11.1 | Test 70/30 (split inbound leads SDR vs AE directo) | Fase 2 |
| 11.2 | Importación masiva de bases de datos (CSV/Excel) | Fase 2 |
| 11.3 | Distribución manual por criterios avanzados | Fase 2 |

---

## SECCIÓN 12 — EXTRAS ENTREGADOS (NO PEDIDOS — EXPLICAR RAZÓN)

| # | Extra | Razón / Justificación |
|---|-------|----------------------|
| E.1 | Sistema de Clock-In/Clock-Out (marcado de asistencia) | Permite auditar horas activas de SDRs; indicador operacional sin costo adicional |
| E.2 | Módulo de Historial de cambios (log_transacciones) | Trazabilidad perfecta ante disputas de datos; recomendado como buena práctica en CRMs |
| E.3 | Sección de Tareas | Reduce fricción operativa; SDRs pueden organizar su día sin salir del CRM |
| E.4 | Arquitectura de Star Schema completa | Garantiza escalabilidad y limpieza de datos a futuro; costo zero en Google Sheets |
| E.5 | Comparativa personalizada (cualquier rango vs cualquier rango) | Gerente puede hacer análisis ad-hoc sin restricciones |
| E.6 | Gráfica de embudo visual (Chart.js) | Presentación ejecutiva lista para reuniones con CEO |
| E.7 | Delta alerts visuales (±20%) | Gerente identifica anomalías al instante |
| E.8 | Velocidad de cierre promedio | KPI operacional clave para AEs |
| E.9 | Ranking SDRs con CVR + delta | Gerente puede medir performance individual |
| E.10 | Multi-producto por deal con auto-clasificación | Cross-selling/Up-selling/Venta directa automática |
| E.11 | Timestamps automáticos (cotización + cierre) | Reduce errores humanos en fechas |
| E.12 | Pricing calculator en handoff modal | SDR ve monto estimado antes de confirmar traspaso |

---

## SECCIÓN 13 — PENDIENTES DE CHRISTIAN (Compromisos del cliente)

| # | Compromiso | Estado |
|---|------------|--------|
| C.1 | Enviar plantilla Excel con estructura exacta del reporte y métricas | ⚠️ Pendiente de verificar si fue enviado |
| C.2 | Definir exactamente qué campos van en reporte de Deals/Negociaciones | ✅ Cubierto en Phase 4 |
| C.3 | Confirmar número de Toques por cliente (6 vs 10) | ✅ Implementado 10 toques (configurable) |

---

## NOTAS DE REUNIÓN

> Usar este espacio durante la reunión

```
Fecha reunión: _______________
Presentes: _______________

Acuerdos:
-
-
-

Cambios de scope:
-
-

Próximos pasos:
-
-
```

---

*Generado por: Claude — Basado en transcripción 02.26 + análisis de código*
*Última actualización: 2026-03-14 — Actualizado tras completar Phases 7-10 (v2.0)*
