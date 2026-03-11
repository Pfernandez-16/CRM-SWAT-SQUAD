# 📋 GUÍA COMPLETA — PROYECTO CRM SWAT SQUAD

> **Fecha de análisis:** 2026-03-02
> **Contexto:** Corrección de bugs y mejoras estructurales del CRM desarrollado en Google Apps Script + Vue 3

---

## 📌 RESUMEN EJECUTIVO

### Estado Actual
- **Plataforma:** Google Apps Script (Backend) + Vue 3 SPA (Frontend)
- **Base de datos:** Google Sheets (Leads: 2,092 registros × 558 columnas)
- **Usuarios:** SDR (prospección), AE (cierre ventas), ADMIN
- **Tiempo en producción:** 3 años (con evolución continua)
- **Bugs críticos identificados:** 21 issues (9 críticos, 8 altos, 4 medios)

### Objetivo del Proyecto
Corregir bugs críticos, optimizar rendimiento, mejorar arquitectura y adaptar UX según flujo operativo real del equipo comercial descrito en la reunión con el cliente.

---

## 🗂️ ESTRUCTURA DEL PROYECTO

### Archivos del Proyecto (Google Apps Script)
```
📁 gas-crm-project/
├── Code.js           # Backend completo (1,496 líneas) — TODO EL CÓDIGO
├── App.html          # Vue 3 App con lógica frontend (958 líneas)
├── Index.html        # Template HTML + estructura (1,085 líneas)
├── Styles.html       # CSS completo dark/light theme (1,441 líneas)
└── appsscript.json   # Configuración del proyecto GAS (10 líneas)
```

### Base de Datos (Google Sheets)
| Hoja | Filas | Columnas | Propósito |
|------|-------|----------|-----------|
| **Leads** | 2,092 | **558** ⚠️ | Leads prospectados por SDR |
| **Deals_AE** | 992 | 101 | Deals cerrados por AE |
| **Catalogs** | 1,000 | 44 | Dropdowns y catálogos |
| **Config_Users** | 3 | 6 | Usuarios y roles del sistema |
| **Transacciones_Log** | 110 | 6 | Log de cambios SDR |
| **Transacciones_Log_AE** | 35 | 6 | Log de cambios AE |
| **PRicing Catalos** | 1,000 | 10 | Tabla de pricing por región/membresía |
| **Log_Leads** | 19 | 6 | Logs adicionales (no usados por código) |
| **Log_Deals** | 8 | 6 | Logs adicionales (no usados por código) |

⚠️ **PROBLEMA CRÍTICO:** La hoja Leads tiene 558 columnas (debería tener ~80). Esto causa timeouts al cargar datos porque `getDataRange()` lee 1,167,336 celdas en cada petición.

---

## 🐛 BUGS CONFIRMADOS (CONSOLIDADO)

### 🔴 CRÍTICOS (Rompen funcionalidad)

#### BUG #1 — `getActiveSpreadsheet()` en contexto Web App = null
**Severidad:** CRÍTICA
**Impacto:** Al ejecutar desde la Web App, `getActiveSpreadsheet()` retorna `null` y todo crashea.

**Funciones afectadas:**
- [Code.js:149](gas-crm-project/Code.js#L149) — `createNewLeadOrDeal`
- [Code.js:234](gas-crm-project/Code.js#L234) — `logChange_`
- [Code.js:262](gas-crm-project/Code.js#L262) — `syncMirrorStatus_`
- [Code.js:1198](gas-crm-project/Code.js#L1198) — `createDealFromLead`

**Fix:**
```javascript
// ❌ Incorrecto
var ss = SpreadsheetApp.getActiveSpreadsheet();

// ✅ Correcto
var ss = SpreadsheetApp.openById(SHEET_ID);
```

---

#### BUG #2 — Deal se crea DOS VECES al mover a "Paso a Ventas"
**Severidad:** CRÍTICA
**Impacto:** Genera registros duplicados en `Deals_AE`.

**Flujo del problema:**
1. Frontend llama `updateLeadField(row, 'Status', 'Paso a Ventas', false)` → App.html:839
2. Backend (`processLeadTriggers_`) detecta status y llama `copyLeadToDeals_()` → **PRIMERA creación**
3. Después, frontend TAMBIÉN llama `createDealFromLead(rowNum)` → App.html:872 → **SEGUNDA creación**

**Fix:** Eliminar la llamada explícita del frontend (líneas 869-886 en App.html). El trigger interno ya maneja la creación con protección anti-duplicado.

```javascript
// ❌ ELIMINAR ESTE BLOQUE del frontend
if (!itemIsDeal && newStatus.toLowerCase().trim() === 'paso a ventas') {
    google.script.run
        // ...
        .createDealFromLead(rowNum);
}
```

---

#### BUG #5 — Leads con 558 COLUMNAS causa timeout
**Severidad:** CRÍTICA
**Impacto:** `getLeads()` tarda 3-5 minutos y puede exceder el límite de 6 min de GAS.

**Fix inmediato:** Limpiar columnas vacías de la hoja Leads.

**Fix estructural:** Implementar paginación server-side:
```javascript
function getLeads(page, pageSize) {
  page = page || 1;
  pageSize = Math.min(pageSize || 100, 200);
  var lastCol = Math.min(sheet.getLastColumn(), 80); // Limitar a 80 cols
  var startRow = 2 + (page - 1) * pageSize;
  var data = sheet.getRange(startRow, 1, pageSize, lastCol).getValues();
  // ... parse y return
}
```

---

### 🟠 ALTOS (Afectan funcionalidad parcial)

#### BUG #3 — Función `getLeadHistory` definida DOS VECES
**Severidad:** ALTA
**Ubicación:** [Code.js:746](gas-crm-project/Code.js#L746) (primera) y [Code.js:801](gas-crm-project/Code.js#L801) (segunda)

**Fix:** Eliminar la primera definición (L746-795) completamente. La segunda es la que realmente se ejecuta.

---

#### BUG #4 — ClockIn escribe en columna EQUIVOCADA
**Severidad:** ALTA
**Causa:** El header real es `Ultimo_ClockIn` pero el código busca `clockintime`, `clock_in`, `entrada`.

**Fix:** Actualizar el mapeo de headers en `clockIn()` y `clockOut()`:
```javascript
// En getUserConfig, línea ~644
else if (hName === 'clockintime' || hName === 'clock_in' || hName === 'entrada' || hName === 'ultimo_clockin') {
  clockInCol = h;
}
```

---

#### BUG #8 — `getLeadStats` usa índices HARDCODED
**Severidad:** ALTA
**Ubicación:** [Code.js:1343-1352](gas-crm-project/Code.js#L1343)

**Fix:** Usar mapeo dinámico de columnas:
```javascript
var headers = data[0];
var colMap = {};
headers.forEach((h, i) => { if (h) colMap[String(h).trim()] = i; });

// Usar: data[i][colMap['Status']] en vez de data[i][22]
```

---

#### BUG #9 — Columnas DUPLICADAS en Deals_AE
**Severidad:** ALTA
**Problema:** `getColumnMap_` sobrescribe con la última ocurrencia de headers duplicados.

**Fix:** Tomar la PRIMERA ocurrencia:
```javascript
// En getColumnMap_, línea ~217
if (h && !map[h]) map[h] = i + 1; // Primera ocurrencia gana
```

---

### 🟡 MEDIOS (Mejoras necesarias)

#### BUG #7 — Hoja `Catalogs_2` no existe
**Severidad:** MEDIA
**Fix:** Crear la hoja `Catalogs_2` o cambiar la constante para usar `Catalogs`.

#### BUG #10 — Variable `triggers` re-declarada
**Severidad:** MEDIA
**Ubicación:** [Code.js:347 y 350](gas-crm-project/Code.js#L347)
**Fix:** Renombrar a `dealTriggers` y `leadTriggers`.

#### BUG #11 — `onEdit` sin LockService
**Severidad:** MEDIA
**Fix:** Envolver `onEdit()` en `LockService.getScriptLock()`.

#### BUG #12 — `createLead` usa `appendRow` en lugar de `getFirstEmptyRow_`
**Severidad:** MEDIA
**Fix:** Usar el método consistente del resto del código.

---

### 🔒 SEGURIDAD

#### SEC #1 — Validación de rol solo en FRONTEND
**Riesgo:** Un usuario puede llamar directamente las APIs del backend sin restricciones de rol.

**Fix:** Agregar validación en el backend:
```javascript
function updateLeadField(row, fieldName, value, isDeal) {
  var userConfig = getUserConfig();
  if (userConfig.rol === 'GUEST') throw new Error('No autorizado');
  if (fieldName === 'Status de Venta' && userConfig.rol === 'SDR') {
    throw new Error('SDR no puede modificar Status de Venta');
  }
  // ... resto del código
}
```

---

### 💾 MEMORY LEAKS (Frontend)

#### MEM #1 — Event listeners no limpiados
**Ubicación:** [App.html:920-922](gas-crm-project/App.html#L920)

**Fix:**
```javascript
// Guardar referencias
const inactivityHandler = resetInactivityTimer_;
const events = ['click', 'keydown', 'mousemove', 'scroll'];

// Al montar
events.forEach(ev => document.addEventListener(ev, inactivityHandler, { passive: true }));

// Al desmontar (onUnmounted)
events.forEach(ev => document.removeEventListener(ev, inactivityHandler));
```

---

## 📊 PROCESO DE NEGOCIO (Del Cliente)

### Contexto de la Reunión
**Participantes:** Erika (Líder de ventas SDR), Christian (Director), Juan (Dev)
**Fecha:** 2026-02-26
**Duración:** 1h 4min

### Flujo Operativo Real

#### 1. CAPTURA DE LEADS
- **Origen:** Google Forms embebido en landing (WordPress + Google Tag Manager)
- **Datos críticos:**
  - UTM completa (source, medium, campaign, term, content, fbclid)
  - Datos del contacto (nombre, apellido, empresa, email, teléfono 1 y 2)
  - País, empleados, área, nivel, servicio de interés
- **Objetivo:** Medir conversión por canal y campaña

#### 2. PROCESO DE CONTACTACIÓN (SDR)
**Sistema de "Toques":** El SDR intenta contactar al lead mediante:
- 3 intentos por llamada (Teléfono 1, 2, y repetición)
- 3 intentos por WhatsApp
- Correo electrónico

**Registro automático:**
- Cada toque registra fecha y hora exacta
- El sistema lleva un contador: "¿En qué toque va?" (1 al 6)
- **Toque 6 = Abandono** → Se marca como "No contestó en toque 6" y se da de baja

**Estados de contactación:**
| Estado | Significado |
|--------|-------------|
| **Nuevo** | Lead recién llegado |
| **Contactado sin Respuesta** | No ha contestado ningún toque |
| **Seguimiento** | Contestó pero pidió ser contactado después |
| **Diálogo Completo** | Conversación completa, lead calificado |
| **Diálogo Intermitente** | Conversación incompleta |

#### 3. CALIFICACIÓN DEL LEAD (SDR)
Una vez que el lead **contesta**, se evalúa:

**Preguntas de calificación:**
1. ¿Entendió la información de Marketing? (Si/No)
2. ¿Mostró Interés genuino? (Si/No)
3. ¿Cuál es tu necesidad puntual? (Dropdown catálogo)
4. ¿El perfil del prospecto es el adecuado? (Si/No)
5. ¿Necesitas tocar base con alguien para decidir? (Si/No) — Indica si es tomador de decisión
6. ¿Tienes presupuesto asignado para este proyecto, en este año? (Si/No)
7. ¿Cuánto? (Monto estimado)
8. ¿Han sido parte de alguna asociación de la industria? (Si/No)

**Razones de baja (si NO califica):**
- Sin cobertura (no hay servicio en su región)
- Sin servicio adecuado (el servicio que busca no lo ofrecen)
- Sin interés
- Información incorrecta (datos mal capturados)
- Duplicado
- Prueba/Spam

#### 4. ASIGNACIÓN A VENTAS (AE)
**Criterio:** Si el lead está calificado y muestra interés genuino → Status cambia a **"Paso a Ventas"**

**Campos que se completan:**
- Vendedor Asignado para Seguimiento (dropdown)
- Fecha y Hora de Asignación (automática)
- Región del cliente
- Tipo de membresía
- Pricing Tier
- Cálculo automático de precio (1 año / 2 años) basado en tabla de pricing

**¡IMPORTANTE!** Aquí ocurre el BUG #2: el sistema crea el Deal dos veces.

#### 5. CIERRE DE VENTA (AE)
**Estados de venta:**
- Llamamos de acuerdo a la programación
- Cliente pidió reagenda
- En proceso de cotización
- En proceso de negociación
- Vendido ✅
- Perdido ❌

**Si se VENDE:**
- Monto de cierre
- Fecha de cierre
- Producto de cierre
- Link de pago
- Soporte de pago
- ¿Es cross-selling? (venta adicional a cliente existente)
- ¿Es recompra? (cliente que compra de nuevo)

**Si se PIERDE:**
- ¿Por qué perdimos la venta? (Catálogo de razones)

---

### 6. REPORTES Y MÉTRICAS (Críticos para el cliente)

#### Reporte Mensual de SDR
**Elementos medidos:**
1. **Total de leads** del mes (por fecha de captura)
2. **Leads contactables** = Total - (Pruebas + Duplicados + Spam + Equivocados)
3. **Contactabilidad:**
   - Leads contactados con al menos 1 toque
   - Leads en proceso de contacto (sin respuesta aún)
   - Leads sin respuesta en toque 6 (abandonados)
4. **Calidad de leads contactados:**
   - Diálogo completo vs. Diálogo intermitente
   - % que entendió la información de Marketing
   - % que mostró interés genuino
5. **Status del lead:**
   - En seguimiento
   - Asignados a ventas (del período actual)
   - Carry-over (leads del mes anterior asignados este mes)
6. **Razones de baja:** Por no cobertura, sin servicio, sin interés, etc.
7. **Toques efectivos:** ¿En qué toque contestaron? (Llamada 1, 2, 3, WhatsApp 1, 2, 3, etc.)
8. **Comparativa vs. período anterior** (MoM) — ¡CRÍTICO!

#### Reporte de Performance de Pauta
**Elementos medidos:**
1. **Inversión por canal:** Google Ads, Meta, TikTok, etc.
2. **Leads generados por canal**
3. **CPL (Cost Per Lead)** = Inversión / Leads
4. **Leads asignados a ventas** por canal
5. **Granularidad:** General → Canal → Audiencia → Keyword
6. **Comparativa vs. período anterior y año anterior** — ¡CRÍTICO!

**PROBLEMA ACTUAL:** Los reportes están separados en diferentes hojas y a veces hay discrepancias mínimas que requieren ajustes manuales (`+1` o `-1`).

---

### 7. REQUERIMIENTOS UX DEL CLIENTE

#### Codificación Visual con Colores
**Prioridad:** ALTA
**Solicitud:** Erika y su equipo necesitan identificar visualmente el estado de cada lead mediante colores (como un "semáforo").

**Propuesta:**
- 🟢 Verde: Lead calificado, en seguimiento activo
- 🟡 Amarillo: Lead en proceso, requiere acción
- 🔴 Rojo: Lead perdido o sin respuesta en toque 6
- 🔵 Azul: Lead asignado a ventas
- 🟣 Morado: Deal cerrado (AE)

**Ubicación:** En la tabla de leads y en las tarjetas del Kanban.

---

#### Validación y Limpieza de Datos
**Problema identificado:** A veces hay inconsistencias entre:
- Contactos registrados vs. respuestas reales
- Fechas de asignación vs. carry-over
- Reportes que no cuadran al 100%

**Solución requerida:**
1. Validación de datos al llenar campos críticos
2. Filtros inteligentes para detectar inconsistencias
3. Logs completos de cambios (ya existe pero falta mejorar)
4. Sistema de alertas cuando hay discrepancias

---

#### Facilidad de Uso
**Solicitudes:**
1. No complicar la interfaz con demasiadas gráficas
2. **Foco en FONEL (Funnel) y CONVERSIONES** — "Te lo dicen todo"
3. Drill-down de general a particular (ej: de canal → audiencia → keyword)
4. Poder parametrizar por fechas fácilmente
5. Evitar dependencia del desarrollador para ajustes menores

---

## 🏗️ ARQUITECTURA PROPUESTA

### Problema Actual
Todo el backend está en un único `Code.js` de 1,496 líneas. Esto dificulta:
- Mantenimiento
- Debugging
- Testing
- Escalabilidad

### Módulos Propuestos
```
📁 gas-crm-project/
├── Config.js           # Constantes globales (SHEET_ID, nombres hojas)
├── SheetUtils.js       # getColumnMap_, getFirstEmptyRow_, parseSheetToObjects_
├── LeadsService.js     # getLeads, createNewLeadOrDeal, createLead, generateLeadId_
├── DealsService.js     # copyLeadToDeals_, createDealFromLead, normalizeHeader_
├── TriggerService.js   # processLeadTriggers_, processDealTriggers_, onEdit, onFormSubmit
├── UserService.js      # getUserConfig, clockIn, clockOut, getActiveAEs
├── CatalogService.js   # getCatalogs, updateCatalog, getPricingData
├── LogService.js       # logChange_, syncMirrorStatus_, getLeadHistory
├── StatsService.js     # getLeadStats
└── WebApp.js           # doGet, include, API dispatcher
```

### API Dispatcher Pattern
En lugar de múltiples `google.script.run` individuales:
```javascript
// WebApp.js
function api(action, payload) {
  var handlers = {
    'getLeads': () => LeadsService.getLeads(payload.page, payload.pageSize),
    'updateLeadField': () => updateLeadField(payload.row, payload.col, payload.val, payload.isDeal),
    // ...
  };
  if (!handlers[action]) return { error: 'Unknown action: ' + action };
  try { return handlers[action](); }
  catch(e) { return { error: e.message }; }
}
```

---

## ✅ PLAN DE ACCIÓN PRIORIZADO

### FASE 1 — CORRECCIÓN DE BUGS CRÍTICOS (1-2 días)
| # | Task | Tiempo |
|---|------|--------|
| 1 | Fix `getActiveSpreadsheet()` → `openById()` en 4 funciones | 15 min |
| 2 | Eliminar llamada duplicada a `createDealFromLead` en frontend | 10 min |
| 5 | Limpiar columnas vacías de Leads (558 → 80) | 30 min |
| 3 | Eliminar función `getLeadHistory` duplicada | 5 min |
| 9 | Fix `getColumnMap_` para tomar primera ocurrencia de headers duplicados | 5 min |

**Total Fase 1:** ~65 minutos

---

### FASE 2 — CORRECCIÓN DE BUGS ALTOS (1-2 días)
| # | Task | Tiempo |
|---|------|--------|
| 4 | Fix ClockIn/ClockOut header mismatch | 10 min |
| 8 | Reemplazar índices hardcoded en `getLeadStats` con column map | 20 min |
| 7 | Crear hoja `Catalogs_2` o ajustar código | 5 min |
| 10 | Renombrar variable `triggers` duplicada | 5 min |
| 11 | Agregar `LockService` a `onEdit` | 15 min |
| 12 | Fix `createLead` para usar `getFirstEmptyRow_` | 10 min |

**Total Fase 2:** ~65 minutos

---

### FASE 3 — OPTIMIZACIÓN Y SEGURIDAD (2-3 días)
| # | Task | Tiempo |
|---|------|--------|
| SEC1 | Implementar validación de rol en backend | 60 min |
| MEM1 | Limpiar event listeners en frontend | 10 min |
| PERF | Implementar paginación en `getLeads()` | 120 min |
| CACHE | Agregar cache a `getLeads` (como en `getCatalogs`) | 30 min |

**Total Fase 3:** ~220 minutos (3.5 horas)

---

### FASE 4 — MEJORAS DE UX (3-5 días)
| # | Task | Tiempo |
|---|------|--------|
| UX1 | Implementar codificación visual con colores (semáforo) | 2 horas |
| UX2 | Agregar validación de datos en formularios | 3 horas |
| UX3 | Mejorar reportes con comparativas vs. período anterior | 4 horas |
| UX4 | Agregar drill-down en reportes (canal → audiencia → keyword) | 5 horas |

**Total Fase 4:** ~14 horas

---

### FASE 5 — REFACTORIZACIÓN (1-2 semanas)
| # | Task | Tiempo |
|---|------|--------|
| ARCH1 | Separar `Code.js` en módulos según arquitectura propuesta | 2-3 días |
| ARCH2 | Implementar API dispatcher pattern | 1 día |
| ARCH3 | Agregar tests unitarios básicos | 2 días |
| ARCH4 | Documentación de código | 1 día |

**Total Fase 5:** ~6-7 días

---

## 📂 ARCHIVOS IMPORTANTES

### Código Fuente
- Proyecto clonado en: `c:\Users\juanc\Documents\anaconda_projects\Pedro - Dev\gas-crm-project\`
- Archivos: `Code.js`, `App.html`, `Index.html`, `Styles.html`, `appsscript.json`

### Base de Datos
- Excel de referencia: `c:\Users\juanc\Documents\anaconda_projects\Pedro - Dev\Copia de CRM V5 _ 2025.xlsx`
- Google Sheets ID: (debe estar en `SHEET_ID` dentro de `Code.js`)

### Documentación
- Auditoría de Gemini: `C:\Users\juanc\.gemini\antigravity\brain\900b421a-e3a1-42a8-9936-c3456edfe38a\crm_audit_report.md.resolved`
- Transcripción de reunión: `c:\Users\juanc\Documents\anaconda_projects\Pedro - Dev\TRANSCIRPCIÓN _ (CRM _ Pedro _ Chris) _ SWAT SQUAD _ 02.26.docx`

---

## 🎯 NEXT STEPS

### Para iniciar en el nuevo chat:
1. Abrir el proyecto: `cd c:\Users\juanc\Documents\anaconda_projects\Pedro - Dev\gas-crm-project\`
2. Revisar este documento completo
3. Decidir si empezar por FASE 1 (bugs críticos) o FASE 4 (UX según cliente)
4. Crear branch de trabajo: `git checkout -b fix/critical-bugs` o `git checkout -b feature/ux-improvements`

### Comandos útiles
```bash
# Ver código
cd "c:\Users\juanc\Documents\anaconda_projects\Pedro - Dev\gas-crm-project"

# Subir cambios a GAS (requiere clasp)
clasp push

# Abrir proyecto en browser
clasp open
```

---

## 📞 CONTACTOS DEL PROYECTO

- **Pedro Fernandez** — Product Owner / Cliente
- **Christian Muñiz** — Director / Stakeholder principal
- **Erika Reyes** — Líder de ventas SDR / Usuario principal del CRM
- **Juan Matute** — Developer contratado (tú)

---

## 🔗 RECURSOS ADICIONALES

- URL del proyecto GAS: https://script.google.com/u/0/home/projects/1w9xpnRqdShIXifMAGWtIX42NvQKZEDMLPvS5X4zSJ4CURDWaAK_lc7OX/edit
- Reunión grabada (tldv): https://tldv.io/app/meetings/698fa1198e9a9300131dc581/

---

**Última actualización:** 2026-03-02
**Versión del documento:** 1.0
**Estado del proyecto:** En análisis → Listo para corrección de bugs

---

> **NOTA IMPORTANTE:** Este documento debe ser leído COMPLETO antes de hacer cualquier cambio al código. Los bugs están interrelacionados y algunos fixes pueden afectar otros módulos.
