# CRM SWAT Squad — Resumen Completo de Desarrollo

**Fecha:** 2026-03-25
**Autores:** Pedro Fernandez + Claude (AI)
**Para:** Juan Matute (contexto completo del estado del proyecto)

---

## 1. Features Implementadas (Checkpoint 4 — Reunión 02.26 con Christian)

### Wave 1-2: 8 Features Base (commit `c7c5bdf`)

| # | Feature | Descripción | Archivos Modificados |
|---|---------|-------------|---------------------|
| 1 | **SDR ve Deals solo lectura** | SDR puede navegar a "Negociaciones" y abrir deals, pero sin poder editar. Modal muestra "Solo lectura", sin botón guardar, kanban DnD deshabilitado para SDR. | App.html, Index.html |
| 2 | **Reportes formato vertical** | Embudo General convertido de formato horizontal (3 columnas por segmento) a vertical con toggle Total/Manufacturers/Individuals y CVR inter-etapa. | Index.html |
| 3 | **Campos obligatorios configurables** | Admin puede marcar campos como obligatorios desde Config > Personalizar Campos (checkbox rojo *). Validación al guardar y al mover cards en kanban. Si hay campos vacíos, se bloquea con toast de error. | App.html, Index.html |
| 4 | **Alertas de duplicados** | Banner amarillo en vista de Prospectos mostrando leads con status "Duplicado" de los últimos 7 días. Backend: `getRecentDuplicates()`. Dismissable con botón X. | Código.js, App.html, Index.html, Styles.html |
| 5 | **Pricing multi-producto** | Admin configura hasta 10 productos con ticket promedio mensual por tipo de cliente (SaaS/Fichas/Proyectos). SDR selecciona producto + licencias en el lead. Monto Aproximado se calcula automáticamente. Fórmulas: SaaS=ticket×licencias×12, Fichas=ticket×12, Proyectos=ticket×1. | Código.js, App.html, Index.html |
| 6 | **"Otros" razón de pérdida (deals)** | Cuando AE selecciona "Otros" como razón de pérdida de venta, aparece campo de texto libre para especificar. Se guarda en `razon_perdida_otra`. | Index.html (ya existía el renderer) |
| 7 | **Upload comprobante de pago** | Botón para subir PNG/JPG/PDF (max 10MB) en sección Cobranza del deal. Se sube a Google Drive (carpeta `CRM_Comprobantes_Pago`), link se guarda en el deal. | Código.js, App.html, Index.html |
| 8 | **Recompra badge visual** | Badge púrpura "Recompra" en tabla y kanban de deals cuando `¿Es recompra?` = "Si". | Index.html, Styles.html |

### Wave 3-4: Reportes Verticales + Recompra Highlight (commit `20cac8f`)

| # | Feature | Descripción |
|---|---------|-------------|
| 9 | **5 reportes más a formato vertical** | Convertidos: Incontactables, Cross-Selling, Sin Respuesta 6to Toque, Razones No Pasó a Ventas, Razones Perdió la Venta. Todos con toggle de segmento (Total/Manufacturers/Individuals). Las secciones con Mix% (noPasoVentas, perdioVenta) conservan esa columna. Se eliminaron ~540 líneas de código horizontal repetitivo. |
| 10 | **Recompra card highlight** | Kanban cards de deals con recompra tienen borde izquierdo púrpura + fondo gradient. Filas en tabla de deals también tienen highlight visual. CSS: `.recompra-card`. |

### Wave A-D: 6 Features Mayores (commit `3086abb`)

| # | Feature | Descripción |
|---|---------|-------------|
| 11 | **Cross-view: SDR ve Deal en tab "Negociación"** | Cuando SDR abre un lead que ya fue pasado a ventas (`_hasDeal`), aparece un tab "Negociación" con los datos del deal en solo lectura (status, AE asignado, montos, fechas, notas del AE). Data fresca via `getDealForLead()`. |
| 12 | **Cross-view: AE ve Lead en tab "Prospecto"** | Cuando AE abre un deal, aparece tab "Prospecto" con datos del lead original (status, calidad, servicio, toques, SDR, recompra, notas, BANT). Todo read-only. |
| 13 | **Recompra para SDR** | Campo `¿Es recompra?` (Si/No) agregado al layout de leads, sección "Información de Seguimiento". SDR puede marcar durante prospección. Se guarda en `fact_leads.es_recompra`. |
| 14 | **"Otros" razón de pérdida para leads** | Lead "Razón de Pérdida" cambiado de tipo `select` a tipo `loss_reason`. Ahora cuando SDR selecciona "Otros", aparece campo de texto libre. Se guarda en `fact_leads.razon_perdida_otra`. |
| 15 | **Reportes para SDR y AE** | "Reportes" habilitado en el menú de navegación para roles SDR y AE (antes solo ADMIN/GERENTE). Cada rol ve las secciones relevantes a su pipeline. |
| 16 | **Historial de asistencia** | `clockIn()`/`clockOut()` ahora registran cada entrada/salida en tabla `log_asistencia` con: email, nombre, tipo (entrada/salida), fecha_hora, duración de sesión. Vista en Config para Admin/Gerente con tabla de últimos 30 días. La tabla `log_asistencia` se crea automáticamente en el primer clock-in. |
| 17 | **Pricing label actualizado** | Label de productos en Config ahora dice "Productos — Ticket Promedio Mensual (hasta 10)" como pidió Christian. |

### Bug Fixes Incluidos

| Fix | Descripción |
|-----|-------------|
| Phantom log fix | `logChange_` en `uploadPaymentProof` movido dentro del guard `if (col)` para evitar logs fantasma cuando la columna no existe. |
| Loss reason renderer en deals | Agregado renderer `loss_reason` a la cadena v-else-if de deal sections (antes solo estaba en lead sections). |

---

## 2. Columnas Manuales Agregadas al Google Sheet

Estas columnas fueron agregadas manualmente por Pedro (requeridas por el código):

| Hoja | Columna | Propósito |
|------|---------|-----------|
| `fact_leads` | `es_recompra` | Marca si el lead es una recompra (Si/No) |
| `fact_leads` | `razon_perdida_otra` | Texto libre cuando razón de pérdida = "Otros" |
| `fact_leads` | `licencias` | Número de licencias/empleados confirmado por SDR |
| `fact_deals` | `comprobante_pago_url` | URL del comprobante de pago en Google Drive |

La tabla `log_asistencia` se crea automáticamente con columnas: `id_registro, email, nombre, tipo, fecha_hora, duracion_sesion`.

---

## 3. Paso a Paso para Probar Cada Feature

### Test 1: SDR ve Deals solo lectura
1. Iniciar sesión como usuario con rol **SDR**
2. En sidebar, verificar que aparece **"Negociaciones"**
3. Abrir cualquier deal → modal muestra "Solo lectura" en footer
4. No debe haber botón "Guardar" ni "Pase a Ventas"
5. En kanban, intentar drag & drop → debe estar deshabilitado

### Test 2: Reportes formato vertical
1. Ir a **Reportes** (como ADMIN/GERENTE, o ahora también SDR/AE)
2. Abrir cada sección y verificar formato vertical:
   - Embudo General → Etapa | Cantidad | Conversión | CVR | Delta%
   - Incontactables, Cross-Selling, Sin Respuesta → Métrica | Cantidad | Distribución | Delta%
   - Razones No Pasó / Perdió Venta → Razón | Cantidad | Mix% | Distribución | Delta%
3. Probar toggle **Total / Manufacturers / Individuals** en cada sección

### Test 3: Campos obligatorios configurables
1. Ir a **Config > Personalizar Campos** (leads o deals)
2. Marcar checkbox rojo (*) en cualquier campo → Guardar
3. Abrir un lead/deal, vaciar ese campo, intentar Guardar → toast de error
4. En kanban, mover card con campo obligatorio vacío → bloqueo con toast

### Test 4: Alertas de duplicados
1. En vista **Prospectos**, si hay leads con status "Duplicado" de los últimos 7 días:
   - Banner amarillo arriba de la tabla/kanban
   - Muestra nombres de los duplicados
   - Botón X cierra el banner

### Test 5: Pricing multi-producto
1. Ir a **Config > Pricing del Cliente**
2. Seleccionar Tipo de Cliente → Agregar 2-3 productos con nombres y tickets
3. Guardar → abrir un lead → sección "Pricing Global":
   - Dropdown "Producto" con los productos configurados
   - Campo "Licencias" (para SaaS)
   - Monto Aproximado se calcula automáticamente

### Test 6: "Otros" razón de pérdida (leads Y deals)
1. Abrir un **lead** → Razón de Pérdida → seleccionar "Otros" → campo de texto libre aparece
2. Abrir un **deal** → ¿Por qué perdimos la venta? → seleccionar "Otros" → campo de texto libre aparece
3. Guardar ambos y verificar persistencia

### Test 7: Upload comprobante de pago
1. Abrir un deal → sección Cobranza & Facturación
2. Campo "Comprobante de Pago" → botón "Subir archivo"
3. Subir PNG/JPG/PDF (max 10MB)
4. Verificar toast verde + link "Ver comprobante"
5. Verificar archivo en Google Drive carpeta `CRM_Comprobantes_Pago`

### Test 8: Recompra badge + highlight
1. Abrir deal → Cross Selling & Historial → ¿Es recompra? = "Si" → Guardar
2. En tabla de deals: fila con borde izquierdo púrpura + badge "Recompra"
3. En kanban de deals: card con borde púrpura + fondo gradient + badge

### Test 9: Cross-view — SDR ve Negociación
1. Como SDR, abrir un lead que ya fue pasado a ventas (tiene deal)
2. Debe aparecer tab **"Negociación"** en el modal
3. Click → datos del deal read-only (AE, status, montos, fechas, notas)
4. Si el lead NO tiene deal, tab no aparece

### Test 10: Cross-view — AE ve Prospecto
1. Como AE, abrir un deal
2. Debe aparecer tab **"Prospecto"** en el modal
3. Click → datos del lead original read-only (status, calidad, toques, recompra, notas SDR, BANT)

### Test 11: Recompra para SDR
1. Como SDR, abrir un lead → sección "Información de Seguimiento"
2. Campo **"¿Es recompra?"** visible con opciones Si/No
3. Marcar "Si" → Guardar → verificar persistencia

### Test 12: Reportes para SDR/AE
1. Como SDR o AE, verificar que "Reportes" aparece en el sidebar
2. Generar reporte → verificar que las secciones se muestran

### Test 13: Historial de asistencia
1. Marcar asistencia (🟢 Marcar Asistencia) → trabajar un rato → salir (🔴 Salir)
2. Como ADMIN, ir a **Config** → scroll abajo → sección "Historial de Asistencia"
3. Click "Cargar Últimos 30 Días" → tabla con entradas/salidas, duración por sesión

---

## 4. Lo Que Falta por Hacer (Pendientes de la Transcripción)

### Alta Prioridad — Solicitado por Christian

| # | Feature | Descripción | Complejidad | Estado |
|---|---------|-------------|-------------|--------|
| P1 | **Reporte de Campañas (FB/Google)** | Reporte con: Inversión, Impresiones, CPM, Clics, CPC, CTR, Visitas landing, Conv. rate, Leads, Costo x lead, Leads a ventas, Conv. lead-to-deal. Por medio (FB/Google) + atribución indirecta + total. Requiere integración API o input manual. | Alta | **En stand-by** (Pedro decidió posponer, escala inicial próximamente) |
| P2 | **Comparativa vs. Estimado (primeros 3 meses)** | Para clientes nuevos sin periodo anterior, comparar vs. estimado que el Admin ingresa manualmente. Christian dijo: "los primeros tres meses es versus el estimado". | Media | Pendiente |
| P3 | **Período parametrizable** | Christian quiere poder comparar "versus cualquier período", no solo mes anterior o año anterior. | Media | El period selector ya existe con mes anterior/año anterior. Falta agregar rango personalizado. |
| P4 | **Score de completitud de ficha** | Christian pidió un indicador tipo "6/10, 7/10" para medir cuántos campos se llenan en cada ficha. | Baja | Pendiente |
| P5 | **Filtrado de reportes por rol** | SDR ve "menos métricas" que el ejecutivo. Cada rol ve solo secciones relevantes. El nav ya se habilitó, pero falta filtrar las secciones específicas por rol (el toggle SDR/AE ya existe para Admin). | Media | Parcialmente hecho (nav habilitado, falta filtrado por secciones) |
| P6 | **Cross-selling visible en funnel por producto** | Christian quiere que si un lead llega por Producto A pero cierra Producto B, se muestre como "Cross Selling" en el funnel per-product view. `classifyDealType_()` ya existe pero falta la vista per-product. | Media | Backend implementado, falta vista per-product en reportes |

### Media Prioridad

| # | Feature | Descripción | Estado |
|---|---------|-------------|--------|
| M1 | **Auth email + contraseña** | Sistema de login propio (no depender solo de Google Account). | Diferido a v2 |
| M2 | **Import masivo CSV/Excel** | Carga masiva de leads desde archivos. | Diferido a v2 |
| M3 | **BANT Score Decay** | Score decrece basado en la distancia del campo Timing. | Pendiente |
| M4 | **Reporte ejecutivo simplificado** | Versión resumida del reporte para Christian. Tarea de Juan. | Pendiente (Juan) |

### Diferidos (Christian confirmó que son para después)

| # | Feature | Notas |
|---|---------|-------|
| D1 | **Reporte de Campañas completo** | Se hará con integración API + landing page team |
| D2 | **Dashboards de insights de optimización** | Christian mencionó: "para sacar insights de optimización hacia todo el funnel" — fase posterior |
| D3 | **Parametrización para Yoda** | Primer cliente de prueba. Se hace después de estabilizar el CRM base. |

---

## 5. Arquitectura Técnica Actual

### Stack
- **Backend:** Google Apps Script (ES5, V8 runtime)
- **Frontend:** Vue 3 CDN + Tailwind CSS
- **Base de datos:** Google Sheets (Star Schema v6, 12+ tablas)
- **Almacenamiento:** Google Drive (comprobantes de pago)

### Archivos del Proyecto (6 archivos en GAS)
| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `Código.js` | ~2,800 | Backend: APIs, CRUD, handoff, calendar, email, routing, attendance |
| `Analytics.js` | ~1,616 | Motor de reportes: 11 secciones, comparativas, segmentación |
| `App.html` | ~2,400 | Vue 3 setup(): refs, computeds, métodos, lógica de negocio |
| `Index.html` | ~3,200 | HTML: sidebar, 7 vistas, modals, 12+ secciones de reporte |
| `Styles.html` | ~1,940 | CSS: dark/light themes, glassmorphism, kanban, reportes |
| `appsscript.json` | 15 | Config: scopes OAuth, webapp settings |

### Tablas del Google Sheet
| Tabla | Propósito |
|-------|-----------|
| `fact_leads` | Leads/prospectos |
| `fact_deals` | Negociaciones/deals |
| `fact_calificacion` | BANT scoring por lead |
| `fact_toques` | Registro de cada toque de contacto (SDR + AE) |
| `fact_interacciones` | Interacciones genéricas |
| `fact_deal_productos` | Productos por deal (multi-producto) |
| `dim_contactos` | Datos de contacto |
| `dim_campanas` | UTMs y datos de campaña |
| `dim_vendedores` | Vendedores (SDR, AE, Gerente) |
| `cat_opciones` | Catálogos configurables (dropdowns) |
| `config_users` | Usuarios del sistema + clock-in |
| `config_plantillas_notas` | Templates de notas por usuario |
| `log_transacciones` | Audit log de todos los cambios |
| `log_asistencia` | Historial de entradas/salidas (NUEVO) |

### Deployment
- **Script ID:** `1AT7UA0NAuNTvRP08_tpBKCkqXM9PtAio3AsrA7dO1f1v7Uxe90XxL5uU`
- **Sheet ID:** `18GJ_Zz97k9F3r2VbyeNQNgRKuEc6LAV1Vyp7XprKrg0`
- **Deployment actual:** V10.0 @42
- **Push:** `clasp push --force` → `clasp deploy -i <deployment_id>`

---

## 6. Notas Importantes

1. **`clasp push` NO actualiza producción automáticamente.** Solo sube al HEAD. Hay que hacer `clasp deploy -i <id>` o actualizar desde el editor de GAS > Deploy > Manage Deployments.

2. **Nuevos OAuth scopes requieren re-autorización.** Si se agregan scopes a `appsscript.json`, el deployer debe re-autorizar al abrir la app.

3. **Columnas nuevas en el Sheet son manuales.** El código las maneja gracefully (si no existe la columna, no crashea), pero los datos no se guardan hasta que la columna exista.

4. **`log_asistencia` se auto-crea** la primera vez que alguien marca asistencia. No requiere setup manual.

5. **El reporte de campañas (P1) está en stand-by.** Christian lo pidió pero Pedro decidió posponerlo. Requeriría integración con Facebook/Google Ads APIs o input manual de datos.
