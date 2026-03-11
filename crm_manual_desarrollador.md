# 📘 Manual de Desarrollador — CRM SWAT Squad
> **Para:** Nuevo desarrollador del equipo  
> **Stack:** Google Apps Script (backend) + Vue 3 SPA (frontend) + Google Sheets (base de datos)  
> **Repositorio local:** `c:\Users\juanc\Documents\anaconda_projects\Pedro - Dev\gas-crm-project\`  
> **Sheet ID (v6):** `18GJ_Zz97k9F3r2VbyeNQNgRKuEc6LAV1Vyp7XprKrg0`  
> **Web App URL:** `https://script.google.com/macros/s/AKfycbznz67sRbxW48D4S12CekK0XXe2s8PE_tNi3eVBJysh67PqHOjpRCnUEunVnYH5zTJpBg/exec`

---

## 1. VISIÓN GENERAL DEL NEGOCIO

CRM para gestión de ventas en dos etapas:

```
LEAD (captado) ──► [SDR prospecta] ──► "Paso a Ventas" ──► DEAL (en Deals_AE) ──► [AE cierra] ──► Vendido / Perdido
```

### Roles de usuario

| Rol | Descripción | Acceso |
|---|---|---|
| **SDR** | Sales Development Rep — prospecta y califica leads | Ve y edita `fact_leads`. Ve Pipeline propio. |
| **AE** | Account Executive — cierra ventas | Ve y edita `fact_deals`. Ve Pipeline AE. |
| **ADMIN** | Administrador | Ve todo, edita catálogos, configura usuarios. |
| **GUEST** | Sin permisos asignados | Solo lectura básica. |

### Ciclo de vida de un Lead

```
Nuevo → Contactado → En Seguimiento → Calificado → Paso a Ventas
                                   ↓
                              Perdido / Duplicado / Inválido
```

Al llegar a **"Paso a Ventas"** se crea automáticamente un registro en `fact_deals` con FK al lead. El SDR no puede crear Deals directamente.

### Ciclo de vida de un Deal

```
Recien llegado → Contactado → En negociación → Propuesta enviada → Apartado → Vendido
                                                                            ↓
                                                                    Perdido / Stand-by
```

---

## 2. ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────┐
│  FRONTEND (Google Apps Script Host) │
│  ┌─────────────────────────────┐    │
│  │  Index.html  (shell/loader) │    │
│  │  Styles.html (CSS)          │    │
│  │  App.html    (Vue 3 SPA)    │    │
│  └────────────┬────────────────┘    │
│               │ google.script.run   │
│  ┌────────────▼────────────────┐    │
│  │  Code.js  (Backend API)     │    │
│  │  GAS Server-side functions  │    │
│  └────────────┬────────────────┘    │
└───────────────┼─────────────────────┘
                │ SpreadsheetApp.openById()
         ┌──────▼──────────────────────┐
         │  Google Sheet v6 (11 tablas)│
         │  Schema Estrella Normalizado│
         └─────────────────────────────┘
```

### Comunicación Frontend ↔ Backend

No hay REST API. El frontend llama funciones GAS directamente:
```js
google.script.run
  .withSuccessHandler(function(result) { /* handle */ })
  .withFailureHandler(function(err) { /* handle error */ })
  .getLeads();  // ← nombre de función pública en Code.js
```

> ⚠️ **Limitación GAS:** Cada petición tarda 1-5 segundos (cold start). No hay websockets. El timeout máximo de ejecución es **6 minutos**.

---

## 3. ESTRUCTURA DE ARCHIVOS

```
gas-crm-project/
├── Code.js          ← Backend API (~780 líneas). TODO el código servidor.
├── Index.html       ← Shell HTML. Carga Vue 3, SortableJS y los includes.
├── App.html         ← Vue 3 SPA (~960 líneas). Toda la lógica de UI.
├── Styles.html      ← CSS completo del sistema.
└── appsscript.json  ← Manifiesto GAS (scopes, runtime).
```

`.clasp.json` — conecta el directorio local con el proyecto GAS (ID del script).

---

## 4. BASE DE DATOS — SCHEMA v6 (Normalizado)

**Sheet ID:** `18GJ_Zz97k9F3r2VbyeNQNgRKuEc6LAV1Vyp7XprKrg0`

El schema sigue el patrón **estrella (star schema)** con tablas de hechos y dimensiones.

### 4.1 Diagrama de Relaciones

```
dim_campanas ──────────────────────────┐
(id_campana)                           │
                                       ▼
dim_contactos ◄──── fact_leads ────► dim_vendedores
(id_contacto)       (id_lead)          (id_vendedor)
     │                  │
     │                  ▼
     │            fact_deals ──────► dim_productos
     └──────────► (id_deal)           (id_producto)
                      │
                      ▼
               fact_interacciones   fact_calificacion
               (id_lead, id_deal)   (id_lead)

cat_opciones  ← todos los dropdowns/catálogos
log_transacciones ← audit log unificado
config_users  ← sesiones y roles
```

---

### 4.2 Tablas en Detalle

#### `fact_leads` — Hechos del Lead
| Columna | Tipo | Descripción |
|---|---|---|
| `id_lead` | INT | PK autoincremental |
| `id_contacto` | INT | FK → `dim_contactos` |
| `id_campana` | INT | FK → `dim_campanas` (puede ser null) |
| `id_vendedor_sdr` | INT | FK → `dim_vendedores` |
| `status` | TEXT | Estado actual en pipeline SDR |
| `calidad_contacto` | TEXT | Calificación de contacto |
| `servicio_interes` | TEXT | Servicio de interés |
| `fecha_ingreso` | DATETIME | Cuando entró al sistema |
| `fecha_asignacion` | DATETIME | Cuando se asignó al SDR |
| `fecha_ultimo_contacto` | DATETIME | Último contacto |
| `numero_toques` | INT | Contador de intentos de contacto |
| `tipo_seguimiento` | TEXT | Canal de seguimiento activo |
| `status_seguimiento` | TEXT | Estado del seguimiento |
| `notas` | TEXT | Notas del SDR |

#### `fact_deals` — Hechos del Deal (AE)
| Columna | Tipo | Descripción |
|---|---|---|
| `id_deal` | INT | PK autoincremental |
| `id_lead` | INT | FK → `fact_leads` |
| `id_contacto` | INT | FK → `dim_contactos` |
| `id_vendedor_ae` | INT | FK → `dim_vendedores` |
| `id_producto` | INT | FK → `dim_productos` |
| `status_venta` | TEXT | Estado en pipeline AE |
| `proyeccion` | TEXT | Alta/Media/Baja |
| `monto_proyeccion` | NUMBER | Monto estimado |
| `monto_apartado` | NUMBER | Apartado recibido |
| `monto_cierre` | NUMBER | Monto final cerrado |
| `fecha_pase_ventas` | DATETIME | Cuando llegó de SDR |
| `fecha_primer_contacto_ae` | DATETIME | Primer contacto del AE |
| `fecha_cierre` | DATETIME | Fecha de cierre |
| `razon_perdida` | TEXT | Por qué se perdió |
| `descuento_pct` | NUMBER | % descuento aplicado |
| `es_recompra` | BOOL | |
| `es_cliente_activo` | BOOL | |
| `producto_cierre` | TEXT | Producto final vendido |
| `fuente_origen` | TEXT | Inbound/Outbound/Referido... |
| `tipo_transaccion` | TEXT | Nueva/Renovación/Upgrade... |
| `notas_vendedor` | TEXT | Notas del AE |

#### `dim_contactos` — Datos de persona/empresa
| Columna | Tipo | Descripción |
|---|---|---|
| `id_contacto` | INT | PK |
| `nombre` | TEXT | |
| `apellido` | TEXT | |
| `email` | TEXT | |
| `telefono_1` | TEXT | |
| `telefono_2` | TEXT | |
| `empresa` | TEXT | |
| `area` | TEXT | Área/departamento |
| `pais` | TEXT | |
| `ciudad` | TEXT | |
| `empleados` | TEXT | Rango de empleados |
| `nivel` | TEXT | Cargo (CEO, VP, Analista...) |
| `fecha_creacion` | DATETIME | |

#### `dim_vendedores` — Equipo de ventas
| Columna | Tipo | Descripción |
|---|---|---|
| `id_vendedor` | INT | PK |
| `email` | TEXT | Email corporativo |
| `nombre` | TEXT | Nombre completo |
| `rol` | TEXT | SDR / AE / ADMIN |
| `activo` | BOOL | Si está habilitado |

#### `dim_campanas` — Fuentes UTM
| Columna | Tipo | Descripción |
|---|---|---|
| `id_campana` | INT | PK |
| `source` | TEXT | organic, facebook, google... |
| `medium` | TEXT | display, referral, cpc... |
| `campaign` | TEXT | Nombre de campaña |
| `term` | TEXT | Keyword |
| `content` | TEXT | Variante del anuncio |
| `fecha_inicio` | DATE | |
| `activa` | BOOL | |

#### `dim_productos` — Catálogo de productos/membresías
| Columna | Tipo | Descripción |
|---|---|---|
| `id_producto` | INT | PK |
| `region` | TEXT | Norteamérica, LATAM, Europa... |
| `membership_type` | TEXT | Manufacturers, Individuals, Attraction |
| `pricing_tier` | TEXT | Tier 1 - Basic... Tier 5 - Custom |
| `precio_1_year` | NUMBER | Precio anualidad 1 año |
| `precio_2_year` | NUMBER | Precio anualidad 2 años |
| `moneda` | TEXT | USD |
| `activo` | BOOL | |

#### `fact_interacciones` — Historial de contacto (ilimitado)
| Columna | Tipo | Descripción |
|---|---|---|
| `id_interaccion` | INT | PK |
| `id_lead` | INT | FK (puede ser null si es interacción AE) |
| `id_deal` | INT | FK (puede ser null si es interacción SDR) |
| `id_vendedor` | INT | FK → `dim_vendedores` |
| `tipo_interaccion` | TEXT | Teléfono / WhatsApp / Correo |
| `resultado` | TEXT | Contestó / No Contestó |
| `numero_toque` | INT | Número secuencial del intento |
| `timestamp` | DATETIME | Cuándo ocurrió |
| `duracion_seg` | INT | Duración en segundos (opcional) |
| `notas` | TEXT | Notas de la interacción |

> Esta tabla reemplaza las 36+ columnas "Contestó Teléfono 1..3", "No Contestó Whatsapp 1..6" del schema anterior. **Ahora los toques son ilimitados**.

#### `fact_calificacion` — Preguntas BANT
| Columna | Tipo | Descripción |
|---|---|---|
| `id_calificacion` | INT | PK |
| `id_lead` | INT | FK → `fact_leads` |
| `entendio_info_marketing` | TEXT | Sí/No/Parcialmente |
| `mostro_interes_genuino` | TEXT | |
| `necesidad_puntual` | TEXT | |
| `perfil_adecuado` | TEXT | |
| `necesita_decision_tercero` | TEXT | |
| `tiene_presupuesto` | TEXT | |
| `monto_presupuesto` | TEXT | |
| `asociacion_industria` | TEXT | |
| `region` | TEXT | |
| `tipo_membresia` | TEXT | |
| `fecha_calificacion` | DATETIME | |

#### `cat_opciones` — Catálogos (todos los dropdowns)
| Columna | Tipo | Descripción |
|---|---|---|
| `id_opcion` | INT | PK |
| `categoria` | TEXT | Nombre del catálogo |
| `valor` | TEXT | Opción del dropdown |
| `orden` | INT | Orden de aparición |
| `activo` | BOOL | Si está disponible |

**Categorías disponibles:**

| categoria | Usado por frontend como |
|---|---|
| `Status Lead` | `Status` |
| `Status de Venta` | `Status de Venta` |
| `Calidad de Contacto` | `Calidad de Contacto` |
| `Tipo de Seguimiento` | `Tipo de Seguimiento` |
| `Status Seguimiento` | `Status del Seguimiento` |
| `Razón de Pérdida` | `Razón de pérdida` |
| `Tipo de Interacción` | interno (`fact_interacciones`) |
| `Resultado Interacción` | interno (`fact_interacciones`) |
| `Región` | `¿Cual es su región?` |
| `Membership Type` | `¿Que tipo de membresía es?` |
| `Pricing Tier` | `Pricing Tier` |
| `Servicio` | `Servicio` |
| `Proyección` | `Proyeccion` |
| `Descuento` | `Descuento` |
| `Producto Cierre` | `Producto de Cierre` |
| `Fuente de Origen` | `Fuente de origen` |
| `Tipo de Transacción` | `Tipo de Transacción` |
| `Attraction` | sub-filtro de pricing |

#### `log_transacciones` — Auditoría unificada
| Columna | Tipo | Descripción |
|---|---|---|
| `id_log` | INT | PK |
| `timestamp` | DATETIME | Cuándo ocurrió el cambio |
| `entidad` | TEXT | `"Lead"` o `"Deal"` |
| `id_entidad` | INT | ID del lead o deal modificado |
| `usuario` | TEXT | Email del usuario |
| `campo_modificado` | TEXT | Nombre del campo |
| `valor_anterior` | TEXT | |
| `valor_nuevo` | TEXT | |

#### `config_users` — Usuarios y sesiones
| Columna | Tipo | Descripción |
|---|---|---|
| `email` | TEXT | Email del usuario (PK funcional) |
| `nombre` | TEXT | Nombre completo |
| `rol` | TEXT | SDR / AE / ADMIN |
| `activo` | BOOL | Si está habilitado |
| `conectado` | BOOL | Si hizo Clock-In |
| `ultimo_clockin` | DATETIME | Timestamp del último ingreso |

---

## 5. MÓDULOS DEL BACKEND (Code.js)

### 5.1 Funciones Públicas (llamadas desde frontend)

| Función | Descripción | Retorna |
|---|---|---|
| `getLeads()` | JOIN fact_leads + dims. Retorna leads y deals. | `JSON string`: `{leads: [...], deals: [...]}` |
| `getCatalogs()` | Lee cat_opciones agrupado por categoría. Cacheado 6h. | `Object`: `{Status: [...], ...}` |
| `getPricingData()` | Lee dim_productos. | `Array` de `{region, membershipType, attraction, oneYear, twoYear}` |
| `getUserConfig()` | Lee config_users para el usuario autenticado. | `Object`: `{email, nombre, rol, isConnected, clockInTime}` |
| `getActiveAEs()` | Lista AEs activos de dim_vendedores. | `{status, data: [{email, nombre}]}` |
| `getCurrentUser()` | Retorna email de Session. | `{email, effectiveEmail}` |
| `clockIn()` | Marca usuario como conectado en config_users. | `{status, clockInTime}` |
| `clockOut()` | Marca usuario como desconectado. | `{status}` |
| `updateLeadField(row, field, value, isDeal)` | Actualiza un campo. Enruta a la tabla correcta. | `{updated, triggers}` |
| `updateLeadMultiple(row, updates, isDeal)` | Actualiza múltiples campos a la vez. | `{updated, triggers}` |
| `createNewLeadOrDeal(payload, type)` | Crea Lead (+ contacto) o Deal. | `{status, data: {id}}` |
| `createDealFromLead(rowNumber)` | Crea Deal desde fila de fact_leads. | `{success, dealRow, leadId}` |
| `getLeadHistory(idLead)` | Historial de log_transacciones + fact_interacciones. | `JSON string`: `{status, data: {pipeline, leads, deals}}` |
| `getLeadStats()` | Estadísticas del Dashboard. | `{total, thisWeek, thisMonth, byStatus, byCalidad, byVendedor}` |
| `updateCatalog(name, values)` | Actualiza opciones en cat_opciones. | `{updated, column, count}` |

### 5.2 Funciones Privadas (solo backend, naming con `_`)

| Función | Descripción |
|---|---|
| `readTable_(sheetName)` | Lee hoja completa → `[{col: val, ...}]` |
| `indexBy_(rows, key)` | Crea índice `{id: row}` para JOINs |
| `getColumnMap_(sheet)` | Retorna `{headerName: colIndex_1based}` |
| `getNextId_(sheet, colName)` | Genera siguiente ID autoincremental |
| `getFirstEmptyRow_(sh, idColName)` | Primera fila vacía (bottom-up) |
| `parseToqueValue_(value)` | `"Contestó Teléfono 3"` → `{tipo, resultado}` |
| `logChange_(entidad, id, user, campo, viejo, nuevo)` | Escribe en log_transacciones |
| `processLeadTriggers_(ss, sheet, row, field, val, colMap, leadId)` | Triggers post-update |
| `copyLeadToDeals_(ss, sheet, row, colMap, leadId)` | Crea Deal en fact_deals |

### 5.3 Constantes Clave

```js
var SHEET_ID = '18GJ_Zz97k9F3r2VbyeNQNgRKuEc6LAV1Vyp7XprKrg0';

// Tablas
var T_CONTACTOS    = 'dim_contactos';
var T_LEADS        = 'fact_leads';
var T_DEALS        = 'fact_deals';
var T_INTERACCIONES = 'fact_interacciones';
var T_CATALOGS     = 'cat_opciones';
var T_LOG          = 'log_transacciones';
var T_USERS        = 'config_users';

// Mapeo categoría DB → clave frontend
var CATEGORY_MAP = {
  'Status Lead': 'Status',
  'Status Seguimiento': 'Status del Seguimiento',
  ...
};

// Routing de campos a tablas
var LEAD_FIELD_MAP = {
  'Status': 'status',                         // → fact_leads.status
  'Nombre': '_DIM_CONTACTO_nombre',           // → dim_contactos.nombre
  ...
};
var DEAL_FIELD_MAP = { ... };
```

---

## 6. MÓDULOS DEL FRONTEND (App.html — Vue 3)

### 6.1 Estado Global (reactive state)

```js
// Datos principales
const leads = ref([]);          // Array de objetos Lead (desde fact_leads + JOINs)
const deals = ref([]);          // Array de objetos Deal
const catalogs = ref({});       // { Status: [...], Calidad de Contacto: [...] }
const pricing = ref([]);        // dim_productos
const currentUser = ref({});    // config_users del usuario logueado

// UI state
const currentView = ref('pipeline');  // 'dashboard'|'leads'|'pipeline'|'calendar'|'config'|'account'
const selectedLead = ref({});   // Lead abierto en modal
const editLead = reactive({});  // Copia editable del selectedLead

// Clock-In
let clockInterval = null;       // setInterval del timer
let inactivityTimeout = null;   // setTimeout de desconexión por inactividad
```

### 6.2 Vistas (Views)

| Vista | ID | Descripción |
|---|---|---|
| **Dashboard** | `dashboard` | Estadísticas generales: total, semana, mes, por status/vendedor |
| **Leads / Deals** | `leads` | Tabla paginada (50 por página) con búsqueda y filtro de status |
| **Pipeline Kanban** | `pipeline` | Tablero arrastrable. SDR ve `Status` de Leads; AE ve `Status de Venta` de Deals |
| **Calendario** | `calendar` | Vista mensual con eventos de historial de interacciones |
| **Configuración** | `config` | Editor de catálogos (cat_opciones) por categoría |
| **Cuenta** | `account` | Clock-in/out, info del usuario, lista de AEs conectados |

### 6.3 Pipeline Kanban — Lógica de Drag & Drop

- Usa **SortableJS** para drag & drop entre columnas
- Las columnas se generan desde `catalogs['Status']` (SDR) o `catalogs['Status de Venta']` (AE)
- Al soltar una tarjeta en nueva columna:
  1. Actualiza el estado local inmediatamente (optimistic update)
  2. Llama `updateLeadField(row, 'Status', newStatus, isDeal)` al backend
  3. Si hay error, revierte el estado local
  4. Si el status es **"Paso a Ventas"** y es un Lead (no Deal):
     - Muestra `confirm()` al usuario
     - Llama `updateLeadField` → el backend crea el Deal via trigger

> ⚠️ **Importante:** El frontend NO llama `createDealFromLead` directamente. El trigger en `processLeadTriggers_` crea el Deal automáticamente cuando `status = 'Paso a Ventas'`.

### 6.4 Modal de Lead/Deal

Al abrir un registro:
1. `openLeadDetail(lead)` copia el objeto completo a `editLead`
2. Llama `getLeadHistory(lead._id)` asíncronamente
3. Al guardar, `saveLeadChanges()` detecta qué campos cambiaron y llama `updateLeadMultiple`

El modal tiene tabs:
- **Info**: Datos del contacto (nombre, email, tel, empresa)
- **Lead**: Status, calidad, notas, seguimiento
- **Deal**: Status de venta, montos, pricing (solo AE)
- **Historial**: Entradas de `log_transacciones` + `fact_interacciones`

### 6.5 Objeto Lead/Deal (formato que retorna getLeads)

```js
// El backend hace JOINs y devuelve:
{
  _row: 5,              // Fila física en fact_leads/fact_deals (para updates)
  _id: 42,              // id_lead o id_deal
  _name: "Valentina Rodríguez",
  _empresa: "Textiles Modernos",
  _email: "val@corp.mx",
  _tel: "+52 819 600 1338",
  _colW_Status: "En Seguimiento",   // alias de 'Status'
  _colX_Calidad: "Excelente",       // alias de 'Calidad de Contacto'
  _colAQ_Vendedor: "Carlos López",  // nombre del vendedor (JOIN)
  _colAS_Notas: "Agenda reunión...",
  _history: [{ type: "Contestó Teléfono", date: "2025-01-03T..." }],
  _id_contacto: 82,    // FK para updates a dim_contactos
  _source: 'lead',     // 'lead'|'deal'|'cross_lead'|'cross_deal' (para Kanban)
  // Campos directos para el modal:
  'Nombre': 'Valentina', 'Apellido': 'Rodríguez',
  'Status': 'En Seguimiento', ...
}
```

---

## 7. FLUJOS CRÍTICOS

### 7.1 Flujo: Lead entra al sistema

```
Google Form submit
  → onFormSubmit(e)
    → createNewLeadOrDeal(payload, 'lead')
      → INSERT dim_contactos (nuevo contacto)
      → INSERT fact_leads (nuevo lead, id_contacto FK)
      → logChange_('Lead', id, 'System', 'CREACIÓN', ...)
```

### 7.2 Flujo: SDR registra un toque

```
SDR selecciona "Contestó Teléfono 2" en el modal
  → saveLeadChanges() detecta cambio en 'Toques de Contactación'
  → updateLeadMultiple(row, {'Toques de Contactación': 'Contestó Teléfono 2'}, false)
    → routing: campo no está en LEAD_FIELD_MAP → busca directamente en fact_leads
    → processLeadTriggers_ detecta campo 'Toques de Contactación'
      → parseToqueValue_('Contestó Teléfono 2') → {tipo: 'Teléfono', resultado: 'Contestó'}
      → INSERT fact_interacciones (nuevo registro de interacción)
      → UPDATE fact_leads.numero_toques++
```

### 7.3 Flujo: Lead pasa a Ventas

```
SDR arrastra card a columna "Paso a Ventas"
  → confirm() en UI
  → updateLeadField(row, 'Status', 'Paso a Ventas', false)
    → Backend: UPDATE fact_leads.status = 'Paso a Ventas'
    → processLeadTriggers_ detecta Status = 'Paso a Ventas'
      → copyLeadToDeals_()
        → Check anti-duplicado por id_lead en fact_deals
        → INSERT fact_deals (id_lead FK, id_contacto FK, status_venta = primer valor de cat_opciones)
        → logChange_('Lead', ...) + logChange_('Deal', ...)
```

### 7.4 Flujo: AE marca como Vendido

```
AE arrastra card a "Vendido"
  → updateLeadField(row, 'Status de Venta', 'Vendido', true)
    → routing DEAL_FIELD_MAP: 'Status de Venta' → 'status_venta'
    → UPDATE fact_deals.status_venta = 'Vendido'
    → logChange_('Deal', id, user, 'Status de Venta', 'Apartado', 'Vendido')
```

---

## 8. DEPLOYING — Cómo publicar cambios

### Requisitos previos
```bash
npm install -g @google/clasp
clasp login
```

### Push al GAS
```bash
cd "c:\Users\juanc\Documents\anaconda_projects\Pedro - Dev\gas-crm-project"
clasp push    # y → confirmar overwrite del manifest
```

### Crear nueva versión (para producción)
```bash
clasp version "v2.1 - descripción del cambio"
clasp deploy --versionNumber X --description "Producción"
```

### Links útiles
- **Editor GAS:** `https://script.google.com/home/projects/<SCRIPT_ID>/edit`
- **Logs GAS:** En el editor → Ver → Ejecuciones (o Stackdriver)
- **Sheet v6:** `https://docs.google.com/spreadsheets/d/18GJ_Zz97k9F3r2VbyeNQNgRKuEc6LAV1Vyp7XprKrg0`

---

## 9. CONVENCIONES Y REGLAS

### Naming Backend
- Funciones públicas (API): `camelCase` sin sufijo (`getLeads`, `updateLeadField`)
- Funciones privadas/internas: `camelCase_` con underscore al final (`readTable_`, `logChange_`)
- Constantes de tabla: `T_NOMBRE` en mayúsculas (`T_LEADS`, `T_CATALOGS`)
- Constantes de config: `var NOMBRE = valor`

### Agregar un nuevo campo editable

1. Agregar la columna en la hoja Google Sheets correspondiente
2. Si es campo de `fact_leads` o `fact_deals`: agregar la key al `LEAD_FIELD_MAP` o `DEAL_FIELD_MAP` en Code.js
3. Si es campo de contacto: mapear como `'_DIM_CONTACTO_nombrecolumna'`
4. En App.html: agregar la key al array `EDITABLE_KEYS` en `saveLeadChanges()`
5. Agregar el control de UI en el template del modal

### Agregar una categoría de catálogo nueva

1. Agregar filas en `cat_opciones` con la nueva categoría
2. Si el nombre en la DB no coincide con la clave del frontend, agregar entrada en `CATEGORY_MAP` en Code.js
3. Agregar la categoría al `configCategoryMap` en App.html si debe aparecer en la vista de Configuración

### Agregar un nuevo rol de usuario

1. Agregar el email en `config_users` con el rol correspondiente
2. Revisar las condicionales de rol en App.html (`userRole.value === 'AE'`, etc.)
3. Agregar validación de rol en Code.js en las funciones sensibles

---

## 10. TROUBLESHOOTING COMÚN

| Síntoma | Causa probable | Fix |
|---|---|---|
| "No data" al cargar | Sheet ID incorrecto o hoja renombrada | Verificar `SHEET_ID` y nombres de tablas en Code.js |
| Catálogos vacíos / dropdowns vacíos | `cat_opciones` sin filas `activo=TRUE`, o cache desactualizado | Borrar caché: en Code.js comentar `cache.get()` temporalmente |
| Deal se crea 2 veces | Frontend llama `createDealFromLead` además del trigger | Verificar App.html: no debe llamarse `createDealFromLead` explícitamente |
| Campos no se guardan | Key no está en `LEAD_FIELD_MAP`/`DEAL_FIELD_MAP` ni como columna directa | Agregar al mapeo y al `EDITABLE_KEYS` del frontend |
| Timeout en producción | `readTable_` de hoja muy grande | Revisar dimensiones de las hojas; agregar paginación |
| Error "No se puede acceder" | `getActiveSpreadsheet()` usado en web app context | Siempre usar `openById(SHEET_ID)` en GAS web apps |
| Historia vacía | `log_transacciones` no existe en el Sheet | GAS la crea automáticamente en el primer `logChange_` |
