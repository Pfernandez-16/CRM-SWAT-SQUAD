# Informe de Avance — CRM SWAT Squad: Modulo de Reporteria

**Fecha:** 4 de Marzo, 2026
**Proyecto:** CRM SWAT Squad v7 — Modulo de Reporteria y Estabilizacion
**Estado:** 2 de 3 fases completadas (67% del milestone)

---

## Resumen Ejecutivo

Se han completado las dos primeras fases del proyecto: la estabilizacion de bugs criticos y la construccion completa del motor de analiticas (backend). La tercera y ultima fase — la interfaz visual de reportes — esta en etapa de planificacion y es lo siguiente a implementar.

**Lo que ya esta listo y funcionando:**
- Todos los bugs criticos corregidos
- Motor de analiticas completo con las 8 secciones del reporte SDR
- Falta: la vista de "Reportes" en el CRM (la interfaz que el usuario ve)

---

## Fase 1: Correccion de Bugs (COMPLETADA)

### Que se corrigio

**Bug 1 — Campos BANT no se guardaban correctamente:**
- Los campos de calificacion (presupuesto, perfil adecuado, interes genuino, decision de terceros, etc.) no se estaban persistiendo al guardar un lead
- **Solucion:** Se agrego un sistema de enrutamiento que detecta los campos BANT y los guarda correctamente en la tabla `fact_calificacion` del Star Schema
- Ahora un SDR puede llenar los campos BANT, guardar, y al reabrir el lead toda la informacion aparece correctamente

**Bug 2 — Guardado cruzado entre roles:**
- Cuando un AE abria un lead cruzado (cross_lead) desde la vista de Negociaciones y lo editaba, el sistema guardaba los cambios en la tabla equivocada (fact_deals en vez de fact_leads)
- **Solucion:** El sistema ahora detecta si el registro es un lead o un deal basandose en su origen (_source), no en el rol del usuario
- Esto garantiza que los conteos de leads y deals sean correctos — critico para que los reportes sean precisos

### Archivos modificados
- `Codigo.js` — Backend (mapeo de campos, enrutamiento de guardado)
- `App.html` — Frontend (deteccion de tipo de entidad)

---

## Fase 2: Motor de Analiticas (COMPLETADA)

### Que se construyo

Se creo el archivo `Analytics.js` como un modulo independiente que contiene toda la logica de calculo de metricas. Este archivo se despliega junto con el CRM via clasp.

**Funcion principal:** `getSDRReport(fechaInicio, fechaFin)`
- Recibe un rango de fechas
- Lee todas las tablas de la base de datos (leads, deals, interacciones, calificaciones, contactos)
- Calcula automaticamente el periodo de comparacion (mismo duracion, inmediatamente anterior)
- Retorna un JSON completo con las 8 secciones del reporte

### Las 8 secciones implementadas

#### Seccion 1 — Embudo General (13 metricas)
| Metrica | Descripcion |
|---------|-------------|
| Total Leads | Todos los leads en el periodo |
| Pruebas | Leads en estado "Prueba" |
| Contactables | Leads con informacion de contacto valida |
| Contactados | Leads que fueron contactados al menos una vez |
| Con Respuesta | Leads que respondieron |
| Dialogo Completo | Leads con proceso de dialogo terminado |
| Dialogo Intermitente | Leads con contacto irregular |
| Interes | Leads que mostraron interes |
| Descartados | Leads descartados del embudo |
| Asignados a Ventas | Leads que pasaron al equipo de ventas |
| Carry-Over | Leads de periodos anteriores asignados a ventas en este periodo |
| Montos de Inversion | Presupuesto declarado de los leads asignados |
| Deals Cerrados + Monto | Ventas cerradas y su monto total |

#### Seccion 2 — Incontactables
- **Duplicado:** Leads marcados como duplicados
- **Equivocado (Invalido):** Datos incorrectos
- **SPAM:** Leads no legitimos

#### Seccion 3 — Cross Selling
- Conteo de oportunidades de venta cruzada detectadas

#### Seccion 4 — Semaforo Contesto (Matriz 10 celdas)
Grilla de contactabilidad: cuantos leads contestaron por canal y numero de toque

| Canal | Toque 1 | Toque 2 | Toque 3 | Toque 4 |
|-------|---------|---------|---------|---------|
| Telefono | X | X | X | — |
| WhatsApp | X | X | X | — |
| Correo | X | X | X | X |

#### Seccion 5 — Semaforo No Contesto (Matriz 6 celdas)
Misma logica pero para leads que NO contestaron (sin Correo, porque email no tiene concepto de "no contesto")

| Canal | Toque 1 | Toque 2 | Toque 3 |
|-------|---------|---------|---------|
| Telefono | X | X | X |
| WhatsApp | X | X | X |

#### Seccion 6 — Sin Respuesta 6to Toque
- Leads que agotaron los 6 intentos de contacto sin obtener respuesta
- Deteccion robusta: verifica tanto el campo `numero_toques` como el conteo real de interacciones

#### Seccion 7 — Por que no paso a Ventas (6 categorias)
Razones por las cuales un lead fue descartado, derivadas de los campos BANT de calificacion:
1. No perfil adecuado
2. Sin presupuesto
3. Sin interes genuino
4. Necesita decision de tercero
5. No entendio info de marketing
6. Otros

*Nota: Un lead puede tener multiples razones (no son mutuamente excluyentes)*

#### Seccion 8 — Por que se perdio la venta (13 razones)
Razones de perdida directamente del campo `razon_perdida` en deals:
Sin presupuesto, Eligio competidor, No responde, Timing inadecuado, No tiene poder de decision, Producto no se ajusta, Cambio prioridades, Mala experiencia previa, Precio muy alto, Proceso interno largo, Se fue con otra solucion, No era el perfil, Empresa cerro

### Caracteristicas transversales de TODAS las secciones

- **Segmentacion triple:** Cada metrica se desglosa en Total / Manufacturers / Individuals
- **Porcentaje:** Cada conteo incluye su porcentaje respecto al total
- **Delta vs Periodo Anterior:** Cada metrica incluye el porcentaje de cambio respecto al periodo anterior (ej: "+15%" o "-8%")
- **Performance:** Optimizado para ejecutar en menos de 30 segundos (limite GAS: 6 minutos)

### Testing
- `testSDRReport_()` — Valida la estructura JSON completa
- `testPerformance_()` — Benchmark de 3 ejecuciones, reporta PASS si < 30s

---

## Fase 3: Vista de Reportes en el CRM (EN PLANIFICACION)

### Que se va a construir

La interfaz visual que el equipo de direccion usara para ver los reportes directamente dentro del CRM, sin necesidad de hojas externas.

### Decisiones de diseno ya tomadas

| Aspecto | Decision |
|---------|----------|
| **Acceso** | Solo visible para rol ADMIN en el sidebar |
| **Selector de fechas** | Calendario visual (range picker) en barra fija superior |
| **Carga inicial** | Auto-carga el mes actual al entrar a la vista |
| **Estructura** | Secciones en acordeon (expand/collapse), varias abiertas a la vez |
| **Seccion por defecto** | Embudo General abre automaticamente |
| **Navegacion rapida** | Links de anclaje en la parte superior para saltar a cada seccion |
| **Tablas** | Estilo spreadsheet denso (tipo dashboard financiero) |
| **Columnas** | Agrupadas por segmento: Total (Cont\|%\|Delta) \| Mfg (Cont\|%\|Delta) \| Ind (Cont\|%\|Delta) |
| **Semaforos** | Formato de grilla matricial (canal x toque) |
| **Porcentajes** | Texto + mini barra visual detras del numero |
| **Delta positivo** | Verde con flecha arriba (↑ +15%) |
| **Delta negativo** | Rojo con flecha abajo (↓ -8%) |
| **Sin cambio** | Gris (— 0%) |
| **Periodo de comparacion** | Se muestra explicitamente (ej: "Comparando vs: 1 Ene - 31 Ene") |
| **Cargando** | Spinner central con "Generando reporte..." y boton de cancelar |
| **Sin datos** | Mensaje amigable reemplaza las tablas |
| **Error** | Tarjeta de error inline con boton "Reintentar" |

### Estimacion
- Esta es la ultima fase del milestone
- Al completarla, el modulo de reporteria estara 100% funcional

---

## Arquitectura Tecnica

```
Google Sheets (Base de datos Star Schema v6)
    |
    v
Google Apps Script (Backend)
    ├── Codigo.js  — CRUD, autenticacion, catalogs, triggers (existente)
    ├── Analytics.js — Motor de metricas (NUEVO - Fase 2) ✓
    └── Index.html + App.html + Styles.html — Frontend Vue 3 + Tailwind
                                               └── Vista "Reportes" (Fase 3 - pendiente)
```

**Stack:** Google Apps Script (V8) + Vue 3 CDN + Tailwind CSS CDN
**Deploy:** Via clasp a Google Sheets Web App

---

## Resumen de Progreso

| Fase | Nombre | Estado | Que entrega |
|------|--------|--------|-------------|
| 1 | Bug Fixes & Estabilizacion | ✓ Completada | Campos BANT guardan correctamente, routing cross-role corregido |
| 2 | Motor de Analiticas (Backend) | ✓ Completada | Analytics.js con 8 secciones, segmentacion triple, delta%, tests |
| 3 | Vista de Reportes (Frontend) | ○ En planificacion | Interfaz visual ADMIN-only con tablas, filtros de fecha, acordeon |

**Progreso general del milestone:** 67% (2/3 fases completas)

---

## Para el Deploy

**Lo que se necesita hacer para que el cliente vea los cambios de Fase 1 y 2:**

1. Ejecutar `clasp push` desde la carpeta `gas-crm-project/`
2. Verificar en el Script Editor que `Analytics.js` aparece junto a `Codigo.js`
3. Probar `testSDRReport_()` desde el Script Editor para validar
4. Los bugs (Fase 1) ya estaran corregidos al hacer push

**Lo que el cliente NO vera aun:**
- La vista "Reportes" en el sidebar (eso es Fase 3)
- Los cambios de Fase 1 y 2 son backend — mejoran la integridad de datos y preparan el motor de calculo

---

*Documento generado: 2026-03-04*
*Proyecto: CRM SWAT Squad — Modulo de Reporteria v1.0*
