/*************************************************************
 *  Code.gs — Backend API para CRM SWAT Squad Web App
 *  Refactored for Normalized v6 Database (Star Schema)
 *************************************************************/

// ============ CONFIG ============
var SHEET_ID = '18GJ_Zz97k9F3r2VbyeNQNgRKuEc6LAV1Vyp7XprKrg0';

// Tablas normalizadas
var T_CONTACTOS = 'dim_contactos';
var T_CAMPANAS = 'dim_campanas';
var T_VENDEDORES = 'dim_vendedores';
var T_PRODUCTOS = 'dim_productos';
var T_LEADS = 'fact_leads';
var T_DEALS = 'fact_deals';
var T_INTERACCIONES = 'fact_interacciones';
var T_CALIFICACION = 'fact_calificacion';
var T_CATALOGS = 'cat_opciones';
var T_LOG = 'log_transacciones';
var T_USERS = 'config_users';

// Mapeo de categorías cat_opciones → claves del frontend
var CATEGORY_MAP = {
  'Status Lead': 'Status',
  'Status Seguimiento': 'Status del Seguimiento',
  'Razón de Pérdida': 'Razón de pérdida',
  'Región': '¿Cual es su región?',
  'Membership Type': '¿Que tipo de membresía es?',
  'Producto Cierre': 'Producto de Cierre',
  'Fuente de Origen': 'Fuente de origen',
  'Proyección': 'Proyeccion'
};

// ============ UTILITY FUNCTIONS ============

/**
 * Lee una hoja completa como array de objetos {header: value}.
 */
function readTable_(sheetName) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var obj = { _row: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j] || '').trim();
      if (key) {
        var val = data[i][j];
        if (val instanceof Date) val = val.toISOString();
        obj[key] = val;
      }
    }
    results.push(obj);
  }
  return results;
}

/**
 * Crea un índice {id: row_object} para JOINs rápidos.
 */
function indexBy_(rows, key) {
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var k = rows[i][key];
    if (k !== undefined && k !== null && k !== '') {
      map[String(k)] = rows[i];
    }
  }
  return map;
}

/**
 * Retorna {header: colIndex_1based} para una hoja.
 */
function getColumnMap_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (h && !map[h]) map[h] = i + 1;
  }
  return map;
}

/**
 * Genera el siguiente ID auto-incremental para una hoja.
 */
function getNextId_(sheet, idColName) {
  var colMap = getColumnMap_(sheet);
  var idCol = colMap[idColName];
  if (!idCol) return new Date().getTime();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat().filter(String);
  if (ids.length === 0) return 1;
  var maxId = Math.max.apply(null, ids.map(Number).filter(function (n) { return !isNaN(n); }));
  return maxId + 1;
}

/**
 * Busca la primera fila vacía en una hoja.
 */
function getFirstEmptyRow_(sh, idColName) {
  var lastRow = sh.getLastRow();
  if (lastRow === 0) return 1;
  var colMap = getColumnMap_(sh);
  var idCol = colMap[idColName || 'id_lead'] || 1;
  var values = sh.getRange(1, idCol, lastRow, 1).getValues();
  for (var i = lastRow - 1; i >= 0; i--) {
    var cell = values[i][0];
    if (cell !== null && cell !== undefined && String(cell).trim() !== '') {
      return i + 2;
    }
  }
  return 2;
}

/**
 * Parsea "Contestó Teléfono 3" → {tipo: "Teléfono", resultado: "Contestó"}
 */
function parseToqueValue_(value) {
  var val = String(value || '').trim();
  if (!val) return null;
  var resultado = 'Contestó';
  if (val.indexOf('No Contest') === 0 || val.indexOf('No Contes') === 0) {
    resultado = 'No Contestó';
    val = val.replace(/^No Contesto\s*/i, '').replace(/^No Contestó\s*/i, '');
  } else {
    val = val.replace(/^Contestó\s*/i, '');
  }
  var tipo = 'Teléfono';
  if (val.toLowerCase().indexOf('whatsapp') >= 0) tipo = 'WhatsApp';
  else if (val.toLowerCase().indexOf('correo') >= 0) tipo = 'Correo';
  else if (val.toLowerCase().indexOf('teléfono') >= 0 || val.toLowerCase().indexOf('telefono') >= 0) tipo = 'Teléfono';
  return { tipo: tipo, resultado: resultado };
}

// ============ WEB APP ENTRY ============

function doGet(e) {
  var html = HtmlService.createTemplateFromFile('Index').evaluate();
  html.setTitle('CRM SWAT Squad')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return html;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============ API: LEADS (JOIN fact_leads + dims) ============

/**
 * Retorna leads y deals como JSON. Hace JOINs server-side
 * y devuelve objetos con las mismas claves que el frontend espera.
 */
function getLeads() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);

    // Read dimension tables
    var contactos = readTable_(T_CONTACTOS);
    var contactosIdx = indexBy_(contactos, 'id_contacto');
    var campanas = readTable_(T_CAMPANAS);
    var campanasIdx = indexBy_(campanas, 'id_campana');
    var vendedores = readTable_(T_VENDEDORES);
    var vendedoresIdx = indexBy_(vendedores, 'id_vendedor');
    var productos = readTable_(T_PRODUCTOS);
    var productosIdx = indexBy_(productos, 'id_producto');

    // Read calificacion data
    var calificaciones = readTable_(T_CALIFICACION);
    var calificacionIdx = indexBy_(calificaciones, 'id_lead');

    // Read interactions for history
    var interacciones = readTable_(T_INTERACCIONES);

    // Build lead interaction index: {id_lead: [interactions]}
    var leadInteractions = {};
    for (var ii = 0; ii < interacciones.length; ii++) {
      var inter = interacciones[ii];
      var lid = String(inter.id_lead || '');
      if (lid) {
        if (!leadInteractions[lid]) leadInteractions[lid] = [];
        leadInteractions[lid].push(inter);
      }
    }

    // --- Build Leads ---
    var rawLeads = readTable_(T_LEADS);
    var leads = [];
    for (var i = 0; i < rawLeads.length; i++) {
      var fl = rawLeads[i];
      var contacto = contactosIdx[String(fl.id_contacto)] || {};
      var campana = campanasIdx[String(fl.id_campana)] || {};
      var vendedor = vendedoresIdx[String(fl.id_vendedor_sdr)] || {};

      var obj = {
        _row: fl._row,
        _id: fl.id_lead,
        _name: ((contacto.nombre || '') + ' ' + (contacto.apellido || '')).trim(),
        _empresa: contacto.empresa || '',
        _email: contacto.email || '',
        _tel: contacto.telefono_1 || '',
        // Compatibility aliases
        _colW_Status: fl.status || '',
        _colX_Calidad: fl.calidad_contacto || '',
        _colY_Toques: '',
        _colAQ_Vendedor: vendedor.nombre || '',
        _colAS_Notas: fl.notas || '',
        // Direct fields the frontend reads
        'ID': fl.id_lead,
        'Nombre': contacto.nombre || '',
        'Apellido': contacto.apellido || '',
        'Email': contacto.email || '',
        'Teléfono': contacto.telefono_1 || '',
        'Teléfono 2': contacto.telefono_2 || '',
        'empresa': contacto.empresa || '',
        'Area': contacto.area || '',
        'Pais': contacto.pais || '',
        'City': contacto.ciudad || '',
        'Empleados': contacto.empleados || '',
        'Nivel': contacto.nivel || '',
        'Status': fl.status || '',
        'Calidad de Contacto': fl.calidad_contacto || '',
        'Servicio': fl.servicio_interes || '',
        'Vendedor Asignado para Seguimiento': vendedor.nombre || '',
        'Notas': fl.notas || '',
        'Tipo de Seguimiento': fl.tipo_seguimiento || '',
        'Status del Seguimiento': fl.status_seguimiento || '',
        'source': campana.source || '',
        'medium': campana.medium || '',
        'campaign': campana.campaign || '',
        'term': campana.term || '',
        'content': campana.content || '',
        'time stamp': fl.fecha_ingreso || '',
        'Timestamp': fl.fecha_ingreso || '',
        // Internal FKs for updates
        _id_contacto: fl.id_contacto,
        _id_campana: fl.id_campana,
        _id_vendedor_sdr: fl.id_vendedor_sdr
      };

      // Add tracking fields
      obj['Toques de Contactación'] = String(fl.numero_toques || 0);
      obj['¿En qué toque va?'] = String(fl.numero_toques || 0);

      // Add calificacion fields (from fact_calificacion JOIN)
      var calif = calificacionIdx[String(fl.id_lead)] || {};
      obj['¿Entendió la información de Marketing?'] = calif.entendio_info_marketing || '';
      obj['¿Mostró Interés genuino?'] = calif.mostro_interes_genuino || '';
      obj['¿Cuál es tu necesidad puntual?'] = calif.necesidad_puntual || '';
      obj['¿El perfil del prospecto es el adecuado?'] = calif.perfil_adecuado || '';
      obj['¿Necesitas tocar base con alguién para decidir la compra?'] = calif.necesita_decision_tercero || '';
      obj['¿Tienes presupuesto asignado para este proyecto, en este año?'] = calif.tiene_presupuesto || '';
      obj['¿Cuánto?'] = calif.monto_presupuesto || '';
      obj['¿han sido parte de alguna asociación de la industria?'] = calif.asociacion_industria || '';

      // Build history from fact_interacciones
      var history = [];
      var inters = leadInteractions[String(fl.id_lead)] || [];
      for (var h = 0; h < inters.length; h++) {
        var it = inters[h];
        history.push({
          type: (it.resultado || '') + ' ' + (it.tipo_interaccion || ''),
          date: it.timestamp || ''
        });
      }
      history.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      obj._history = history;
      obj._colY_Toques = String(fl.numero_toques || 0);

      leads.push(obj);
    }

    // --- Build Deals ---
    var rawDeals = readTable_(T_DEALS);
    var deals = [];
    for (var d = 0; d < rawDeals.length; d++) {
      var fd = rawDeals[d];
      var dc = contactosIdx[String(fd.id_contacto)] || {};
      var dv = vendedoresIdx[String(fd.id_vendedor_ae)] || {};
      var dp = productosIdx[String(fd.id_producto)] || {};

      var dealObj = {
        _row: fd._row,
        _id: fd.id_deal,
        _name: ((dc.nombre || '') + ' ' + (dc.apellido || '')).trim(),
        _empresa: dc.empresa || '',
        _email: dc.email || '',
        _tel: dc.telefono_1 || '',
        _colW_Status: fd.status_venta || '',
        _colX_Calidad: '',
        _colY_Toques: '',
        _colAQ_Vendedor: dv.nombre || '',
        _colAS_Notas: fd.notas_vendedor || '',
        // Direct fields
        'ID': fd.id_deal,
        'Nombre': dc.nombre || '',
        'Apellido': dc.apellido || '',
        'Email': dc.email || '',
        'Teléfono': dc.telefono_1 || '',
        'empresa': dc.empresa || '',
        'Status de Venta': fd.status_venta || '',
        'Proyeccion': fd.proyeccion || '',
        'Monto de proyección': fd.monto_proyeccion || '',
        'Monto de Apartado': fd.monto_apartado || '',
        'Monto de cierre': fd.monto_cierre || '',
        'Fecha de Cierre': fd.fecha_cierre || '',
        'Descuento': fd.descuento_pct || '',
        'Notas Vendedor': fd.notas_vendedor || '',
        'Notas': fd.notas_vendedor || '',
        '¿Por qué perdimos la venta?': fd.razon_perdida || '',
        '¿Es recompra?': fd.es_recompra || '',
        '¿Es cliente activo?': fd.es_cliente_activo || '',
        'Producto de Cierre': fd.producto_cierre || '',
        'Fuente de origen': fd.fuente_origen || '',
        'Tipo de Transacción': fd.tipo_transaccion || '',
        'Vendedor Asignado para Seguimiento': dv.nombre || '',
        // Pricing from dim_productos
        '¿Cual es su región?': dp.region || '',
        '¿Que tipo de membresía es?': dp.membership_type || '',
        'Pricing Tier': dp.pricing_tier || '',
        '1 Year Mem': dp.precio_1_year || '',
        '2 Year Mem': dp.precio_2_year || '',
        // Internal FKs
        _id_lead: fd.id_lead,
        _id_contacto: fd.id_contacto,
        _id_vendedor_ae: fd.id_vendedor_ae,
        _id_producto: fd.id_producto
      };

      // Build deal history from fact_interacciones
      var dealHistory = [];
      var dealInters = [];
      for (var di = 0; di < interacciones.length; di++) {
        if (String(interacciones[di].id_deal) === String(fd.id_deal)) {
          dealInters.push(interacciones[di]);
        }
      }
      for (var dh = 0; dh < dealInters.length; dh++) {
        dealHistory.push({
          type: (dealInters[dh].resultado || '') + ' ' + (dealInters[dh].tipo_interaccion || ''),
          date: dealInters[dh].timestamp || ''
        });
      }
      dealHistory.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      dealObj._history = dealHistory;

      deals.push(dealObj);
    }

    return JSON.stringify({ leads: leads, deals: deals });
  } catch (err) {
    Logger.log('getLeads ERROR: ' + err.message);
    return JSON.stringify({ leads: [], deals: [], error: err.message });
  }
}

// ============ API: CATALOGS (vertical → grouped) ============

function getCatalogs() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('catalogs_data');
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through */ }
  }

  var rows = readTable_(T_CATALOGS);
  var catalogs = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.activo === false || row.activo === 'FALSE') continue;
    var cat = String(row.categoria || '').trim();
    if (!cat) continue;
    var frontendKey = CATEGORY_MAP[cat] || cat;
    if (!catalogs[frontendKey]) catalogs[frontendKey] = [];
    catalogs[frontendKey].push(String(row.valor || ''));
  }

  try {
    cache.put('catalogs_data', JSON.stringify(catalogs), 21600);
  } catch (e) { /* ignore */ }

  return catalogs;
}

function updateCatalog(headerName, values) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(T_CATALOGS);
  if (!sheet) throw new Error('Hoja cat_opciones no encontrada');

  // Find the reverse category name
  var dbCategory = headerName;
  for (var k in CATEGORY_MAP) {
    if (CATEGORY_MAP[k] === headerName) { dbCategory = k; break; }
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var catCol = -1, valCol = -1, ordenCol = -1, activoCol = -1, idCol = -1;
  for (var h = 0; h < headers.length; h++) {
    var hn = String(headers[h]).trim();
    if (hn === 'categoria') catCol = h;
    if (hn === 'valor') valCol = h;
    if (hn === 'orden') ordenCol = h;
    if (hn === 'activo') activoCol = h;
    if (hn === 'id_opcion') idCol = h;
  }

  // Delete existing rows for this category (bottom-up)
  var rowsToDelete = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][catCol]).trim() === dbCategory) {
      rowsToDelete.push(i + 1);
    }
  }
  for (var r = 0; r < rowsToDelete.length; r++) {
    sheet.deleteRow(rowsToDelete[r]);
  }

  // Get next ID
  var maxId = 0;
  var refreshData = sheet.getDataRange().getValues();
  for (var x = 1; x < refreshData.length; x++) {
    var num = parseInt(refreshData[x][idCol], 10);
    if (!isNaN(num) && num > maxId) maxId = num;
  }

  // Insert new values
  var insertRow = sheet.getLastRow() + 1;
  for (var v = 0; v < values.length; v++) {
    maxId++;
    var newRow = ['', '', '', '', ''];
    newRow[idCol] = maxId;
    newRow[catCol] = dbCategory;
    newRow[valCol] = values[v];
    newRow[ordenCol] = v + 1;
    newRow[activoCol] = true;
    sheet.getRange(insertRow + v, 1, 1, newRow.length).setValues([newRow]);
  }

  CacheService.getScriptCache().remove('catalogs_data');
  return { updated: true, column: headerName, count: values.length };
}

// ============ API: PRICING (from dim_productos) ============

function getPricingData() {
  var rows = readTable_(T_PRODUCTOS);
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.activo === false || r.activo === 'FALSE') continue;
    result.push({
      region: String(r.region || ''),
      membershipType: String(r.membership_type || ''),
      attraction: String(r.pricing_tier || ''),
      index: String(r.id_producto || ''),
      oneYear: Number(r.precio_1_year) || 0,
      twoYear: Number(r.precio_2_year) || 0
    });
  }
  return result;
}

// ============ API: USER ============

function getUserConfig() {
  try {
    var email = Session.getActiveUser().getEmail();
    var rows = readTable_(T_USERS);

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (String(row.email || '').trim().toLowerCase() === email.toLowerCase()) {
        return {
          email: email,
          nombre: String(row.nombre || email),
          rol: String(row.rol || 'GUEST').toUpperCase(),
          sheetId: SHEET_ID,
          isConnected: row.conectado === true || row.conectado === 'TRUE' || row.conectado === 1,
          clockInTime: row.ultimo_clockin ? String(row.ultimo_clockin) : null,
          _row: row._row
        };
      }
    }
    return { email: email, nombre: email, rol: 'GUEST', sheetId: SHEET_ID, isConnected: false, clockInTime: null };
  } catch (err) {
    Logger.log('getUserConfig error: ' + err.message);
    return { email: '', nombre: 'Error', rol: 'GUEST', sheetId: SHEET_ID, isConnected: false, clockInTime: null, error: err.message };
  }
}

function clockIn() {
  try {
    var email = Session.getActiveUser().getEmail();
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_USERS);
    if (!sheet) return { status: 'error', message: 'config_users not found' };

    var colMap = getColumnMap_(sheet);
    var data = sheet.getDataRange().getValues();
    var emailCol = colMap['email'] || 1;
    var connCol = colMap['conectado'];
    var clockCol = colMap['ultimo_clockin'];

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailCol - 1] || '').trim().toLowerCase() === email.toLowerCase()) {
        var now = new Date();
        if (connCol) sheet.getRange(i + 1, connCol).setValue(true);
        if (clockCol) sheet.getRange(i + 1, clockCol).setValue(now);
        return { status: 'success', clockInTime: now.toISOString() };
      }
    }
    return { status: 'error', message: 'Usuario no encontrado' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

function clockOut() {
  try {
    var email = Session.getActiveUser().getEmail();
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_USERS);
    if (!sheet) return { status: 'error', message: 'config_users not found' };

    var colMap = getColumnMap_(sheet);
    var data = sheet.getDataRange().getValues();
    var emailCol = colMap['email'] || 1;
    var connCol = colMap['conectado'];
    var clockCol = colMap['ultimo_clockin'];

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailCol - 1] || '').trim().toLowerCase() === email.toLowerCase()) {
        if (connCol) sheet.getRange(i + 1, connCol).setValue(false);
        if (clockCol) sheet.getRange(i + 1, clockCol).setValue('');
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'Usuario no encontrado' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

function getActiveAEs() {
  try {
    var rows = readTable_(T_VENDEDORES);
    var activeAEs = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rol = String(row.rol || '').toUpperCase();
      if (rol === 'AE' || rol === 'ADMIN') {
        if (row.activo === true || row.activo === 'TRUE' || row.activo === 1) {
          activeAEs.push({ email: row.email || '', nombre: row.nombre || '' });
        }
      }
    }
    return { status: 'success', data: activeAEs };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

function getCurrentUser() {
  return {
    email: Session.getActiveUser().getEmail(),
    effectiveEmail: Session.getEffectiveUser().getEmail()
  };
}

// ============ LOGGING (unified log_transacciones) ============

function logChange_(entidad, idEntidad, user, fieldName, oldValue, newValue) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var logSheet = ss.getSheetByName(T_LOG);
    if (!logSheet) {
      logSheet = ss.insertSheet(T_LOG);
      logSheet.appendRow(['id_log', 'timestamp', 'entidad', 'id_entidad', 'usuario', 'campo_modificado', 'valor_anterior', 'valor_nuevo']);
    }
    var nextId = getNextId_(logSheet, 'id_log');
    logSheet.appendRow([nextId, new Date(), entidad, idEntidad, user, fieldName, oldValue, newValue]);
  } catch (error) {
    Logger.log('Error logChange_: ' + error.message);
  }
}

// ============ API: UPDATE LEAD/DEAL FIELD ============

/**
 * Field-to-table routing map for leads.
 */
var LEAD_FIELD_MAP = {
  // Fields in fact_leads
  'Status': 'status', 'Calidad de Contacto': 'calidad_contacto',
  'Notas': 'notas', 'Tipo de Seguimiento': 'tipo_seguimiento',
  'Status del Seguimiento': 'status_seguimiento', 'Servicio': 'servicio_interes',
  'Toques de Contactación': 'numero_toques',
  '¿En qué toque va?': 'numero_toques',
  // Fields in dim_contactos (via _id_contacto)
  'Nombre': '_DIM_CONTACTO_nombre', 'Apellido': '_DIM_CONTACTO_apellido',
  'Email': '_DIM_CONTACTO_email', 'Teléfono': '_DIM_CONTACTO_telefono_1',
  'Teléfono 2': '_DIM_CONTACTO_telefono_2', 'empresa': '_DIM_CONTACTO_empresa',
  'Area': '_DIM_CONTACTO_area', 'Pais': '_DIM_CONTACTO_pais',
  'City': '_DIM_CONTACTO_ciudad', 'Empleados': '_DIM_CONTACTO_empleados',
  'Nivel': '_DIM_CONTACTO_nivel',
  // Fields in fact_calificacion (routed via _FACT_CALIFICACION_ prefix)
  '¿Entendió la información de Marketing?': '_FACT_CALIFICACION_entendio_info_marketing',
  '¿Mostró Interés genuino?': '_FACT_CALIFICACION_mostro_interes_genuino',
  '¿Cuál es tu necesidad puntual?': '_FACT_CALIFICACION_necesidad_puntual',
  '¿El perfil del prospecto es el adecuado?': '_FACT_CALIFICACION_perfil_adecuado',
  '¿Necesitas tocar base con alguién para decidir la compra?': '_FACT_CALIFICACION_necesita_decision_tercero',
  '¿Tienes presupuesto asignado para este proyecto, en este año?': '_FACT_CALIFICACION_tiene_presupuesto',
  '¿Cuánto?': '_FACT_CALIFICACION_monto_presupuesto',
  '¿han sido parte de alguna asociación de la industria?': '_FACT_CALIFICACION_asociacion_industria'
};

var DEAL_FIELD_MAP = {
  'Status de Venta': 'status_venta', 'Proyeccion': 'proyeccion',
  'Monto de proyección': 'monto_proyeccion', 'Monto de Apartado': 'monto_apartado',
  'Monto de cierre': 'monto_cierre', 'Fecha de Cierre': 'fecha_cierre',
  'Descuento': 'descuento_pct', 'Notas Vendedor': 'notas_vendedor',
  'Notas': 'notas_vendedor',
  '¿Por qué perdimos la venta?': 'razon_perdida',
  '¿Es recompra?': 'es_recompra', '¿Es cliente activo?': 'es_cliente_activo',
  'Producto de Cierre': 'producto_cierre', 'Fuente de origen': 'fuente_origen',
  'Tipo de Transacción': 'tipo_transaccion',
  // Contact fields route to dim_contactos
  'Nombre': '_DIM_CONTACTO_nombre', 'Apellido': '_DIM_CONTACTO_apellido',
  'Email': '_DIM_CONTACTO_email', 'Teléfono': '_DIM_CONTACTO_telefono_1',
  'empresa': '_DIM_CONTACTO_empresa'
};

function updateLeadField(rowNumber, colIdentifier, newValue, isDeal) {
  var lock = LockService.getScriptLock();
  var result = { updated: false, triggers: [] };
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var targetTable = isDeal ? T_DEALS : T_LEADS;
    var sheet = ss.getSheetByName(targetTable);
    if (!sheet) throw new Error('Hoja no encontrada: ' + targetTable);

    var colMap = getColumnMap_(sheet);
    var fieldName = String(colIdentifier);

    // Determine target column in fact table
    var fieldMap = isDeal ? DEAL_FIELD_MAP : LEAD_FIELD_MAP;
    var dbCol = fieldMap[fieldName];

    if (dbCol && dbCol.indexOf('_DIM_CONTACTO_') === 0) {
      // Write to dim_contactos
      var dimColName = dbCol.replace('_DIM_CONTACTO_', '');
      var idContactoCol = colMap['id_contacto'];
      var idContacto = idContactoCol ? sheet.getRange(rowNumber, idContactoCol).getValue() : null;
      if (idContacto) {
        var contactSheet = ss.getSheetByName(T_CONTACTOS);
        var contactColMap = getColumnMap_(contactSheet);
        var contactData = contactSheet.getDataRange().getValues();
        var contactIdCol = contactColMap['id_contacto'] || 1;
        for (var ci = 1; ci < contactData.length; ci++) {
          if (String(contactData[ci][contactIdCol - 1]) === String(idContacto)) {
            var targetCol = contactColMap[dimColName];
            if (targetCol) {
              var oldVal = contactSheet.getRange(ci + 1, targetCol).getValue();
              contactSheet.getRange(ci + 1, targetCol).setValue(newValue);
              logChange_(isDeal ? 'Deal' : 'Lead', sheet.getRange(rowNumber, colMap[isDeal ? 'id_deal' : 'id_lead'] || 1).getValue(),
                Session.getActiveUser().getEmail() || 'API', fieldName, oldVal, newValue);
            }
            break;
          }
        }
      }
      result.updated = true;
    } else if (dbCol) {
      // Write to fact table
      var factCol = colMap[dbCol];
      if (factCol) {
        var oldValue = sheet.getRange(rowNumber, factCol).getValue();
        var idCol = colMap[isDeal ? 'id_deal' : 'id_lead'] || 1;
        var entityId = sheet.getRange(rowNumber, idCol).getValue();
        sheet.getRange(rowNumber, factCol).setValue(newValue);
        result.updated = true;
        logChange_(isDeal ? 'Deal' : 'Lead', entityId,
          Session.getActiveUser().getEmail() || 'API', fieldName, oldValue, newValue);

        // Run triggers
        if (!isDeal) {
          result.triggers = processLeadTriggers_(ss, sheet, rowNumber, fieldName, newValue, colMap, entityId);
        }
      }
    } else {
      // Try direct column match
      var directCol = colMap[fieldName];
      if (directCol) {
        var oldVal2 = sheet.getRange(rowNumber, directCol).getValue();
        var idCol2 = colMap[isDeal ? 'id_deal' : 'id_lead'] || 1;
        var entityId2 = sheet.getRange(rowNumber, idCol2).getValue();
        sheet.getRange(rowNumber, directCol).setValue(newValue);
        result.updated = true;
        logChange_(isDeal ? 'Deal' : 'Lead', entityId2,
          Session.getActiveUser().getEmail() || 'API', fieldName, oldVal2, newValue);
        if (!isDeal) {
          result.triggers = processLeadTriggers_(ss, sheet, rowNumber, fieldName, newValue, colMap, entityId2);
        }
      }
    }
  } catch (err) {
    result.triggerError = err.message;
  } finally {
    lock.releaseLock();
  }
  return result;
}

function updateLeadMultiple(rowNumber, updates, isDeal) {
  var lock = LockService.getScriptLock();
  var result = { updated: false, triggers: [] };
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var targetTable = isDeal ? T_DEALS : T_LEADS;
    var sheet = ss.getSheetByName(targetTable);
    if (!sheet) throw new Error('Hoja no encontrada: ' + targetTable);

    var colMap = getColumnMap_(sheet);
    var fieldMap = isDeal ? DEAL_FIELD_MAP : LEAD_FIELD_MAP;
    var idColName = isDeal ? 'id_deal' : 'id_lead';
    var idCol = colMap[idColName] || 1;
    var entityId = sheet.getRange(rowNumber, idCol).getValue();
    var user = Session.getActiveUser().getEmail() || 'API';
    var entidad = isDeal ? 'Deal' : 'Lead';

    // Collect dim_contactos updates
    var contactUpdates = {};
    var calificacionUpdates = {};
    var idContacto = null;
    var contactoIdCol = colMap['id_contacto'];
    if (contactoIdCol) idContacto = sheet.getRange(rowNumber, contactoIdCol).getValue();

    for (var fieldName in updates) {
      var newValue = updates[fieldName];
      var dbCol = fieldMap[fieldName];

      if (dbCol && dbCol.indexOf('_DIM_CONTACTO_') === 0) {
        contactUpdates[dbCol.replace('_DIM_CONTACTO_', '')] = { field: fieldName, value: newValue };
      } else if (dbCol && dbCol.indexOf('_FACT_CALIFICACION_') === 0) {
        calificacionUpdates[dbCol.replace('_FACT_CALIFICACION_', '')] = { field: fieldName, value: newValue };
      } else if (dbCol) {
        var factCol = colMap[dbCol];
        if (factCol) {
          var oldValue = sheet.getRange(rowNumber, factCol).getValue();
          sheet.getRange(rowNumber, factCol).setValue(newValue);
          logChange_(entidad, entityId, user, fieldName, oldValue, newValue);
          if (!isDeal) {
            try {
              var trigs = processLeadTriggers_(ss, sheet, rowNumber, fieldName, newValue, colMap, entityId);
              result.triggers = result.triggers.concat(trigs);
            } catch (te) { result.triggerError = (result.triggerError || '') + ' | ' + te.message; }
          }
        }
      } else {
        var directCol = colMap[fieldName];
        if (directCol) {
          var oldVal = sheet.getRange(rowNumber, directCol).getValue();
          sheet.getRange(rowNumber, directCol).setValue(newValue);
          logChange_(entidad, entityId, user, fieldName, oldVal, newValue);
        }
      }
    }

    // Write contact updates to dim_contactos
    if (idContacto && Object.keys(contactUpdates).length > 0) {
      var contactSheet = ss.getSheetByName(T_CONTACTOS);
      var contactColMap = getColumnMap_(contactSheet);
      var contactData = contactSheet.getDataRange().getValues();
      var cIdCol = contactColMap['id_contacto'] || 1;
      for (var ci = 1; ci < contactData.length; ci++) {
        if (String(contactData[ci][cIdCol - 1]) === String(idContacto)) {
          for (var dimCol in contactUpdates) {
            var tCol = contactColMap[dimCol];
            if (tCol) {
              var oldC = contactSheet.getRange(ci + 1, tCol).getValue();
              contactSheet.getRange(ci + 1, tCol).setValue(contactUpdates[dimCol].value);
              logChange_(entidad, entityId, user, contactUpdates[dimCol].field, oldC, contactUpdates[dimCol].value);
            }
          }
          break;
        }
      }
    }

    // Write calificacion updates to fact_calificacion
    if (!isDeal && Object.keys(calificacionUpdates).length > 0) {
      var idLead = sheet.getRange(rowNumber, colMap['id_lead'] || 1).getValue();
      var calSheet = ss.getSheetByName(T_CALIFICACION);
      if (calSheet && idLead) {
        var calColMap = getColumnMap_(calSheet);
        var calData = calSheet.getDataRange().getValues();
        var calIdCol = calColMap['id_lead'] || 2;
        var calRowFound = false;
        for (var calIdx = 1; calIdx < calData.length; calIdx++) {
          if (String(calData[calIdx][calIdCol - 1]) === String(idLead)) {
            calRowFound = true;
            for (var calCol in calificacionUpdates) {
              var calTCol = calColMap[calCol];
              if (calTCol) {
                var oldCalVal = calSheet.getRange(calIdx + 1, calTCol).getValue();
                calSheet.getRange(calIdx + 1, calTCol).setValue(calificacionUpdates[calCol].value);
                logChange_(entidad, entityId, user, calificacionUpdates[calCol].field, oldCalVal, calificacionUpdates[calCol].value);
              }
            }
            break;
          }
        }
        if (!calRowFound) {
          var newCalRow = [null, idLead];
          var calHeaders = calData[0];
          for (var h = 2; h < calHeaders.length; h++) {
            var hdr = String(calHeaders[h]).trim();
            if (calificacionUpdates[hdr]) {
              newCalRow.push(calificacionUpdates[hdr].value);
            } else if (hdr === 'fecha_calificacion') {
              newCalRow.push(new Date().toISOString());
            } else {
              newCalRow.push('');
            }
          }
          calSheet.appendRow(newCalRow);
          for (var calFld in calificacionUpdates) {
            logChange_(entidad, entityId, user, calificacionUpdates[calFld].field, '', calificacionUpdates[calFld].value);
          }
        }
      }
    }

    result.updated = true;
  } catch (err) {
    result.triggerError = err.message;
  } finally {
    lock.releaseLock();
  }
  return result;
}

// ============ TRIGGERS ============

function processLeadTriggers_(ss, sheet, row, fieldName, newValue, colMap, leadId) {
  var executed = [];

  // TRIGGER: "Paso a Ventas" → create Deal in fact_deals
  if (fieldName === 'Status' || fieldName === 'status') {
    var status = String(newValue).trim();
    if (status.toLowerCase() === 'paso a ventas') {
      try {
        copyLeadToDeals_(ss, sheet, row, colMap, leadId);
        executed.push('copy_to_deals');
      } catch (err) {
        Logger.log('Error Paso a Ventas trigger: ' + err.message);
      }
    }
  }

  // TRIGGER: "Toques de Contactación" → INSERT in fact_interacciones
  if (fieldName === 'Toques de Contactación') {
    var parsed = parseToqueValue_(newValue);
    if (parsed) {
      try {
        var interSheet = ss.getSheetByName(T_INTERACCIONES);
        if (interSheet) {
          var nextInterId = getNextId_(interSheet, 'id_interaccion');
          var vendedorCol = colMap['id_vendedor_sdr'];
          var vendedorId = vendedorCol ? sheet.getRange(row, vendedorCol).getValue() : '';
          var numToqueCol = colMap['numero_toques'];
          var numToque = numToqueCol ? (parseInt(sheet.getRange(row, numToqueCol).getValue(), 10) || 0) + 1 : 1;
          interSheet.appendRow([nextInterId, leadId, '', vendedorId, parsed.tipo, parsed.resultado, numToque, new Date(), '', '']);
          if (numToqueCol) sheet.getRange(row, numToqueCol).setValue(numToque);
          executed.push('interaccion_' + parsed.tipo + '_' + parsed.resultado);
        }
      } catch (err) {
        Logger.log('Error interaccion trigger: ' + err.message);
      }
    }
  }

  return executed;
}

// ============ DEAL CREATION ============

function copyLeadToDeals_(ss, leadsSheet, row, leadsColMap, leadId) {
  var dealsSheet = ss.getSheetByName(T_DEALS);
  if (!dealsSheet) throw new Error('Hoja fact_deals no encontrada');

  // Check for duplicate
  var dealsColMap = getColumnMap_(dealsSheet);
  var idLeadCol = dealsColMap['id_lead'];
  if (idLeadCol) {
    var lastRow = dealsSheet.getLastRow();
    if (lastRow > 1) {
      var existingIds = dealsSheet.getRange(2, idLeadCol, lastRow - 1, 1).getValues();
      for (var e = 0; e < existingIds.length; e++) {
        if (String(existingIds[e][0]) === String(leadId)) {
          Logger.log('copyLeadToDeals_: Lead ID ' + leadId + ' already exists as Deal');
          return { success: false, error: 'Deal already exists for lead ' + leadId };
        }
      }
    }
  }

  // Get lead data for FKs
  var idContactoCol = leadsColMap['id_contacto'];
  var idContacto = idContactoCol ? leadsSheet.getRange(row, idContactoCol).getValue() : '';

  // Get initial status from catalogs
  var allCatalogs = getCatalogs();
  var statusVenta = (allCatalogs['Status de Venta'] || [])[0] || 'Recien llegado';

  // Build new deal row
  var nextDealId = getNextId_(dealsSheet, 'id_deal');
  var headers = dealsSheet.getRange(1, 1, 1, dealsSheet.getLastColumn()).getValues()[0];
  var newRow = new Array(headers.length).fill('');

  var colSet = function (name, val) {
    var col = dealsColMap[name];
    if (col) newRow[col - 1] = val;
  };

  colSet('id_deal', nextDealId);
  colSet('id_lead', leadId);
  colSet('id_contacto', idContacto);
  colSet('id_vendedor_ae', '');
  colSet('id_producto', '');
  colSet('status_venta', statusVenta);
  colSet('fecha_pase_ventas', new Date());

  var insertRow = getFirstEmptyRow_(dealsSheet, 'id_deal');
  dealsSheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);

  var user = Session.getActiveUser().getEmail() || 'System';
  logChange_('Lead', leadId, user, 'Pase a Ventas', '', 'Deal creado');
  logChange_('Deal', nextDealId, user, 'Deal Creado', '', 'Desde Lead #' + leadId);

  return { success: true, dealRow: insertRow, leadId: leadId };
}

function createDealFromLead(rowNumber) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var leadsSheet = ss.getSheetByName(T_LEADS);
    if (!leadsSheet) return { success: false, error: 'Hoja fact_leads no encontrada' };
    var colMap = getColumnMap_(leadsSheet);
    var idCol = colMap['id_lead'] || 1;
    var leadId = leadsSheet.getRange(rowNumber, idCol).getValue();
    return copyLeadToDeals_(ss, leadsSheet, rowNumber, colMap, leadId);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function createNewLeadOrDeal(payload, type) {
  try {
    var isDeal = (type === 'deal');
    var ss = SpreadsheetApp.openById(SHEET_ID);

    if (isDeal) {
      var dealsSheet = ss.getSheetByName(T_DEALS);
      if (!dealsSheet) return { status: 'error', message: 'fact_deals no encontrada' };
      var colMap = getColumnMap_(dealsSheet);
      var newId = getNextId_(dealsSheet, 'id_deal');
      var headers = dealsSheet.getRange(1, 1, 1, dealsSheet.getLastColumn()).getValues()[0];
      var newRow = new Array(headers.length).fill('');
      if (colMap['id_deal']) newRow[colMap['id_deal'] - 1] = newId;
      if (colMap['status_venta']) newRow[colMap['status_venta'] - 1] = payload['Status de Venta'] || 'Recien llegado';
      if (colMap['fecha_pase_ventas']) newRow[colMap['fecha_pase_ventas'] - 1] = new Date();
      // Map payload fields
      for (var key in payload) {
        var dbCol = DEAL_FIELD_MAP[key];
        if (dbCol && dbCol.indexOf('_DIM_CONTACTO_') !== 0 && colMap[dbCol]) {
          newRow[colMap[dbCol] - 1] = payload[key];
        }
      }
      var insertRow = getFirstEmptyRow_(dealsSheet, 'id_deal');
      dealsSheet.getRange(insertRow, 1, 1, newRow.length).setValues([newRow]);
      logChange_('Deal', newId, Session.getActiveUser().getEmail() || 'System', 'CREACIÓN MANUAL', '', 'Nuevo deal');
      return { status: 'success', data: { id: newId } };
    } else {
      // Create contact first
      var contactSheet = ss.getSheetByName(T_CONTACTOS);
      var contactColMap = getColumnMap_(contactSheet);
      var newContactId = getNextId_(contactSheet, 'id_contacto');
      var cHeaders = contactSheet.getRange(1, 1, 1, contactSheet.getLastColumn()).getValues()[0];
      var cRow = new Array(cHeaders.length).fill('');
      var cSet = function (n, v) { var c = contactColMap[n]; if (c) cRow[c - 1] = v; };
      cSet('id_contacto', newContactId);
      cSet('nombre', payload['Nombre'] || '');
      cSet('apellido', payload['Apellido'] || '');
      cSet('email', payload['Email'] || '');
      cSet('telefono_1', payload['Teléfono'] || '');
      cSet('telefono_2', payload['Teléfono 2'] || '');
      cSet('empresa', payload['empresa'] || '');
      cSet('area', payload['Area'] || '');
      cSet('pais', payload['Pais'] || '');
      cSet('ciudad', payload['City'] || '');
      cSet('empleados', payload['Empleados'] || '');
      cSet('nivel', payload['Nivel'] || '');
      cSet('fecha_creacion', new Date());
      contactSheet.appendRow(cRow);

      // Create lead
      var leadsSheet = ss.getSheetByName(T_LEADS);
      var leadColMap = getColumnMap_(leadsSheet);
      var newLeadId = getNextId_(leadsSheet, 'id_lead');
      var lHeaders = leadsSheet.getRange(1, 1, 1, leadsSheet.getLastColumn()).getValues()[0];
      var lRow = new Array(lHeaders.length).fill('');
      var lSet = function (n, v) { var c = leadColMap[n]; if (c) lRow[c - 1] = v; };
      lSet('id_lead', newLeadId);
      lSet('id_contacto', newContactId);
      lSet('status', payload['Status'] || 'Nuevo');
      lSet('calidad_contacto', payload['Calidad de Contacto'] || '');
      lSet('servicio_interes', payload['Servicio'] || '');
      lSet('fecha_ingreso', new Date());
      lSet('notas', payload['Notas'] || '');
      lSet('tipo_seguimiento', payload['Tipo de Seguimiento'] || '');
      lSet('status_seguimiento', payload['Status del Seguimiento'] || '');
      var insertRow = getFirstEmptyRow_(leadsSheet, 'id_lead');
      leadsSheet.getRange(insertRow, 1, 1, lRow.length).setValues([lRow]);
      logChange_('Lead', newLeadId, Session.getActiveUser().getEmail() || 'System', 'CREACIÓN MANUAL', '', 'Nuevo lead');
      return { status: 'success', data: { id: newLeadId } };
    }
  } catch (err) {
    Logger.log('createNewLeadOrDeal ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

// ============ API: HISTORY ============

function getLeadHistory(idLead) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var history = [];

    // Read from unified log
    var logRows = readTable_(T_LOG);
    for (var i = 0; i < logRows.length; i++) {
      var row = logRows[i];
      if (String(row.id_entidad) === String(idLead)) {
        history.push({
          timestamp: row.timestamp || '',
          usuario: String(row.usuario || ''),
          campo: String(row.campo_modificado || ''),
          valorAnterior: String(row.valor_anterior || ''),
          valorNuevo: String(row.valor_nuevo || ''),
          source: row.entidad || 'Lead'
        });
      }
    }

    // Read from fact_interacciones
    var interRows = readTable_(T_INTERACCIONES);
    for (var j = 0; j < interRows.length; j++) {
      var inter = interRows[j];
      if (String(inter.id_lead) === String(idLead) || String(inter.id_deal) === String(idLead)) {
        history.push({
          timestamp: inter.timestamp || '',
          usuario: String(inter.id_vendedor || ''),
          campo: 'Interacción',
          valorAnterior: '',
          valorNuevo: (inter.resultado || '') + ' ' + (inter.tipo_interaccion || '') + ' (#' + (inter.numero_toque || '') + ')',
          source: inter.id_deal ? 'Deal' : 'Lead'
        });
      }
    }

    history.sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

    var categorized = { pipeline: [], leads: [], deals: [] };
    for (var k = 0; k < history.length; k++) {
      var entry = history[k];
      var campo = (entry.campo || '').toLowerCase();
      if (campo === 'status' || campo === 'status de venta' || campo === 'pase a ventas' || campo === 'deal creado') {
        categorized.pipeline.push(entry);
      } else if (entry.source === 'Deal') {
        categorized.deals.push(entry);
      } else {
        categorized.leads.push(entry);
      }
    }

    return JSON.stringify({ status: 'success', data: categorized });
  } catch (error) {
    Logger.log('Error getLeadHistory: ' + error.message);
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

// ============ API: STATS ============

function getLeadStats() {
  try {
    var leadRows = readTable_(T_LEADS);
    var vendedores = readTable_(T_VENDEDORES);
    var vendedoresIdx = indexBy_(vendedores, 'id_vendedor');

    var total = leadRows.length;
    var byStatus = {};
    var byCalidad = {};
    var byVendedor = {};
    var thisWeek = 0;
    var thisMonth = 0;
    var now = new Date();
    var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    for (var i = 0; i < leadRows.length; i++) {
      var lead = leadRows[i];
      var status = String(lead.status || 'Sin Status').trim();
      byStatus[status] = (byStatus[status] || 0) + 1;

      var calidad = String(lead.calidad_contacto || 'Sin Calificar').trim();
      byCalidad[calidad] = (byCalidad[calidad] || 0) + 1;

      var vend = vendedoresIdx[String(lead.id_vendedor_sdr)] || {};
      var vendNombre = String(vend.nombre || '').trim();
      if (vendNombre) byVendedor[vendNombre] = (byVendedor[vendNombre] || 0) + 1;

      var ts = lead.fecha_ingreso;
      if (ts) {
        var d = new Date(ts);
        if (!isNaN(d.getTime())) {
          if (d >= weekAgo) thisWeek++;
          if (d >= monthStart) thisMonth++;
        }
      }
    }

    return {
      total: total, thisWeek: thisWeek, thisMonth: thisMonth,
      byStatus: byStatus, byCalidad: byCalidad, byVendedor: byVendedor
    };
  } catch (err) {
    Logger.log('getLeadStats ERROR: ' + err.message);
    return { total: 0, thisWeek: 0, thisMonth: 0, byStatus: {}, byCalidad: {}, byVendedor: {} };
  }
}

// ============ FORM INTEGRATION ============

function onFormSubmit(e) {
  try {
    var nv = e.namedValues;
    var leadData = {
      nombre: (nv['Nombre'] || [''])[0].trim(),
      apellido: (nv['Apellido'] || [''])[0].trim(),
      email: (nv['Email'] || [''])[0].trim(),
      telefono: (nv['Teléfono'] || nv['Telefono'] || [''])[0].trim(),
      empresa: (nv['Empresa'] || [''])[0].trim(),
      pais: (nv['País'] || nv['Pais'] || [''])[0].trim(),
      fuente: 'Google Form'
    };
    var result = createNewLeadOrDeal({
      'Nombre': leadData.nombre, 'Apellido': leadData.apellido,
      'Email': leadData.email, 'Teléfono': leadData.telefono,
      'empresa': leadData.empresa, 'Pais': leadData.pais,
      'Status': 'Nuevo'
    }, 'lead');
    Logger.log('Lead from form: ' + JSON.stringify(result));
  } catch (err) {
    Logger.log('onFormSubmit ERROR: ' + err.message);
  }
}

// ============ BACKWARD COMPAT: onEdit ============

function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();
  if (sheetName !== T_LEADS && sheetName !== T_DEALS) return;

  var isDeal = (sheetName === T_DEALS);
  var range = e.range;
  if (range.getNumRows() > 1 || range.getNumColumns() > 1) return;

  var row = range.getRow();
  if (row === 1) return;

  var colMap = getColumnMap_(sheet);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colIndex = range.getColumn();
  var fieldName = headers[colIndex - 1] || 'Desconocido';
  var newValue = e.value;
  var oldValue = e.oldValue;

  var idColName = isDeal ? 'id_deal' : 'id_lead';
  var idCol = colMap[idColName] || 1;
  var entityId = sheet.getRange(row, idCol).getValue();
  var user = Session.getActiveUser().getEmail() || 'Manual Editor';
  var entidad = isDeal ? 'Deal' : 'Lead';

  if (fieldName === 'status' || fieldName === 'status_venta') {
    logChange_(entidad, entityId, user, fieldName, oldValue || '', newValue || '');
  }

  if (!isDeal) {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      processLeadTriggers_(ss, sheet, row, fieldName, newValue, colMap, entityId);
    } catch (err) {
      Logger.log('onEdit trigger error: ' + err.message);
    }
  }
}

// ============ API: HMN CONFIG (Variables Globales) ============

/**
 * Lee todas las variables HMN_ de cat_opciones y las devuelve como objeto {clave: valor}.
 */
function getHMNConfig() {
  try {
    var rows = readTable_(T_CATALOGS);
    var data = {};
    for (var i = 0; i < rows.length; i++) {
      var cat = String(rows[i].categoria || '').trim();
      if (cat.indexOf('HMN_') === 0) {
        data[cat] = rows[i].valor || '';
      }
    }
    return { status: 'success', data: data };
  } catch (err) {
    Logger.log('getHMNConfig error: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

/**
 * Guarda/actualiza variables HMN en cat_opciones.
 * @param {Object} variables - {HMN_SLA_Respuesta_SDR: '24', HMN_Meta_Facturacion_Mensual: '50000', ...}
 */
function saveHMNConfig(variables) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_CATALOGS);
    if (!sheet) throw new Error('Hoja cat_opciones no encontrada');

    var colMap = getColumnMap_(sheet);
    var data = sheet.getDataRange().getValues();
    var catCol = colMap['categoria'];
    var valCol = colMap['valor'];
    var idCol = colMap['id_opcion'];
    var activoCol = colMap['activo'];
    var ordenCol = colMap['orden'];

    if (!catCol || !valCol) throw new Error('Columnas categoria/valor no encontradas en cat_opciones');

    var user = Session.getActiveUser().getEmail() || 'API';

    for (var key in variables) {
      if (key.indexOf('HMN_') !== 0) continue;
      var newValue = String(variables[key] || '');
      var found = false;

      // Search for existing row with this categoria
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][catCol - 1]).trim() === key) {
          var oldVal = String(data[i][valCol - 1] || '');
          sheet.getRange(i + 1, valCol).setValue(newValue);
          logChange_('HMN', key, user, key, oldVal, newValue);
          found = true;
          break;
        }
      }

      // If not found, insert new row
      if (!found) {
        var nextId = getNextId_(sheet, 'id_opcion');
        var insertRow = sheet.getLastRow() + 1;
        var numCols = data[0].length;
        var newRow = [];
        for (var c = 0; c < numCols; c++) newRow.push('');
        if (idCol) newRow[idCol - 1] = nextId;
        newRow[catCol - 1] = key;
        newRow[valCol - 1] = newValue;
        if (ordenCol) newRow[ordenCol - 1] = 1;
        if (activoCol) newRow[activoCol - 1] = true;
        sheet.getRange(insertRow, 1, 1, numCols).setValues([newRow]);
        logChange_('HMN', key, user, key, '', newValue);
      }
    }

    return { status: 'success' };
  } catch (err) {
    Logger.log('saveHMNConfig error: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============ API: USER MANAGEMENT ============

/**
 * Lee todos los usuarios de config_users.
 */
function getAllUsers() {
  try {
    var rows = readTable_(T_USERS);
    var users = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      users.push({
        email: String(r.email || '').trim(),
        nombre: String(r.nombre || ''),
        rol: String(r.rol || 'GUEST').toUpperCase(),
        activo: r.activo === true || r.activo === 'TRUE' || r.activo === 1 || r.activo === 'true',
        _row: r._row
      });
    }
    return { status: 'success', data: users };
  } catch (err) {
    Logger.log('getAllUsers error: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

/**
 * Crea un nuevo usuario en config_users.
 */
function createUser(email, nombre, rol) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!email || !email.trim()) throw new Error('Email es requerido');

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_USERS);
    if (!sheet) throw new Error('Hoja config_users no encontrada');

    // Check for duplicate email
    var data = sheet.getDataRange().getValues();
    var colMap = getColumnMap_(sheet);
    var emailCol = colMap['email'] || 1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailCol - 1] || '').trim().toLowerCase() === email.trim().toLowerCase()) {
        return { status: 'error', message: 'El usuario ya existe: ' + email };
      }
    }

    // Build new row
    var insertRow = sheet.getLastRow() + 1;
    var numCols = data[0].length;
    var newRow = [];
    for (var c = 0; c < numCols; c++) newRow.push('');

    if (colMap['email']) newRow[colMap['email'] - 1] = email.trim();
    if (colMap['nombre']) newRow[colMap['nombre'] - 1] = nombre || '';
    if (colMap['rol']) newRow[colMap['rol'] - 1] = (rol || 'SDR').toUpperCase();
    if (colMap['activo']) newRow[colMap['activo'] - 1] = true;
    if (colMap['conectado']) newRow[colMap['conectado'] - 1] = false;

    sheet.getRange(insertRow, 1, 1, numCols).setValues([newRow]);
    logChange_('User', email, Session.getActiveUser().getEmail() || 'API', 'createUser', '', rol);

    return { status: 'success' };
  } catch (err) {
    Logger.log('createUser error: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Activa/desactiva un usuario en config_users.
 */
function toggleUserActive(email) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_USERS);
    if (!sheet) throw new Error('Hoja config_users no encontrada');

    var colMap = getColumnMap_(sheet);
    var data = sheet.getDataRange().getValues();
    var emailCol = colMap['email'] || 1;
    var activoCol = colMap['activo'];

    if (!activoCol) throw new Error('Columna "activo" no encontrada');

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailCol - 1] || '').trim().toLowerCase() === email.trim().toLowerCase()) {
        var current = data[i][activoCol - 1];
        var isActive = current === true || current === 'TRUE' || current === 1 || current === 'true';
        var newVal = !isActive;
        sheet.getRange(i + 1, activoCol).setValue(newVal);
        logChange_('User', email, Session.getActiveUser().getEmail() || 'API', 'activo', String(isActive), String(newVal));
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'Usuario no encontrado: ' + email };
  } catch (err) {
    Logger.log('toggleUserActive error: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cambia el rol de un usuario en config_users.
 */
function updateUserRole(email, newRole) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_USERS);
    if (!sheet) throw new Error('Hoja config_users no encontrada');

    var colMap = getColumnMap_(sheet);
    var data = sheet.getDataRange().getValues();
    var emailCol = colMap['email'] || 1;
    var rolCol = colMap['rol'];

    if (!rolCol) throw new Error('Columna "rol" no encontrada');

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailCol - 1] || '').trim().toLowerCase() === email.trim().toLowerCase()) {
        var oldRole = String(data[i][rolCol - 1] || '');
        sheet.getRange(i + 1, rolCol).setValue(newRole.toUpperCase());
        logChange_('User', email, Session.getActiveUser().getEmail() || 'API', 'rol', oldRole, newRole.toUpperCase());
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'Usuario no encontrado: ' + email };
  } catch (err) {
    Logger.log('updateUserRole error: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

