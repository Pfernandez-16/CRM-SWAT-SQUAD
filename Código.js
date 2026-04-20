/*************************************************************
 *  Code.gs — Backend API para CRM SWAT Squad Web App
 *  Refactored for Normalized v6 Database (Star Schema)
 *************************************************************/

// ============ CONFIG ============
var CRM_VERSION = '2.1.0-fix-type-conversion';
var SHEET_ID = '1rpgt1XJikbDpYDI1IVCBzBJgSTzafxtFvdAgsmxr0k4';

// Tablas normalizadas
var T_CONTACTOS = 'dim_contactos';
var T_CAMPANAS = 'dim_campanas';
var T_VENDEDORES = 'dim_vendedores';
var T_PRODUCTOS = 'dim_productos';
var T_LEADS = 'fact_leads';
var T_DEALS = 'fact_deals';
var T_INTERACCIONES = 'fact_interacciones';
var T_CALIFICACION = 'fact_calificacion';
var T_TOQUES = 'fact_toques';
var T_DEAL_PRODUCTOS = 'fact_deal_productos';
var T_CATALOGS = 'cat_opciones';
var T_LOG = 'log_transacciones';
var T_USERS = 'config_users';
var T_PLANTILLAS = 'config_plantillas_notas';


// Phase 3B: System columns excluded from frontend editing
var SYSTEM_COLS = {
  '_row':1, 'id_lead':1, 'id_deal':1, 'id_contacto':1, 'id_campana':1,
  'id_vendedor_sdr':1, 'id_vendedor_ae':1, 'id_producto':1, 'id_calificacion':1,
  'id_interaccion':1, 'id_toque':1, 'id_lead_original':1, 'id_registro_toque':1,
  'id_entidad':1, 'tipo_entidad':1, 'fecha_ingreso':1, 'fecha_creacion':1,
  'rol_vendedor':1, 'id_plantilla':1, 'id_deal_producto':1
};

// Mapeo de categorías cat_opciones → claves del frontend
var CATEGORY_MAP = {
  'Status Lead': 'Status',
  'Status Seguimiento': 'Status del Seguimiento',
  'Razón de Pérdida': 'Razón de pérdida',
  'Región': '¿Cual es su región?',
  'Membership Type': '¿Que tipo de membresía es?',
  'Producto Cierre': 'Producto de Cierre',
  'Fuente de Origen': 'Fuente de origen',
  'Proyección': 'Proyeccion',
  'Tipo de Cliente': 'Tipo de Cliente'
};

// ============ UTILITY FUNCTIONS ============

/**
 * Lee una hoja completa como array de objetos {header: value}.
 * IMPORTANT: Reads header row (row 1) and data rows (row 2+) SEPARATELY
 * to avoid uncatchable type-conversion errors when number-formatted columns
 * contain text headers in multi-row reads.
 */
function readTable_(sheetName) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  // Read header row ALONE (single-row reads work on formatted columns)
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  // Read data rows SEPARATELY (row 2 onward — no header text to convert)
  var dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

  var results = [];
  for (var i = 0; i < dataRows.length; i++) {
    var obj = { _row: i + 2 };
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j] || '').trim().toLowerCase();
      if (key) {
        obj[key] = dataRows[i][j];
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
 * Safe bulk read: reads header (row 1) and data (row 2+) SEPARATELY.
 * Multi-row reads that include headers in number-formatted columns throw
 * uncatchable "No se puede convertir X en int" errors in GAS.
 * Returns 2D array identical to getDataRange().getDisplayValues() but safe.
 */
function safeReadAll_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  if (lastRow < 2) return [headers];
  var dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  var result = [headers];
  for (var i = 0; i < dataRows.length; i++) result.push(dataRows[i]);
  return result;
}

/**
 * Retorna {header: colIndex_1based} para una hoja.
 */
function getColumnMap_(sheet) {
  var range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  var headers = range.getDisplayValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim().toLowerCase();
    if (h && !map[h]) map[h] = i + 1;
  }
  return map;
}

/**
 * Genera el siguiente ID auto-incremental para una hoja.
 * CRITICAL: Reads header (row 1) and data (row 2+) SEPARATELY.
 * Multi-row reads that include headers in number-formatted columns
 * throw uncatchable "No se puede convertir X en int" errors in GAS.
 */
function getNextId_(sheet, idColName) {
  var target = String(idColName).trim().toLowerCase();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  // Use safeReadAll_ (multi-column read) — CONFIRMED working by diagnosticTest().
  // Single-column reads on number-formatted columns throw uncatchable errors in GAS.
  var data = safeReadAll_(sheet);
  if (!data || data.length < 2) return 1;

  // Find ID column in header row
  var idCol = -1;
  for (var h = 0; h < data[0].length; h++) {
    if (String(data[0][h]).trim().toLowerCase() === target) { idCol = h; break; }
  }
  if (idCol === -1) return 1;

  // Scan data rows for max ID
  var maxId = 0;
  for (var r = 1; r < data.length; r++) {
    var raw = String(data[r][idCol] || '').trim();
    if (!raw) continue;
    var n = parseFloat(raw);
    if (!isNaN(n) && isFinite(n) && n > maxId) maxId = n;
  }

  var nextId = Math.floor(maxId) + 1;
  try {
    PropertiesService.getScriptProperties().setProperty(
      'seq_' + sheet.getName() + '_' + target, String(nextId));
  } catch (ignore) {}
  return nextId;
}

/**
 * Busca la primera fila después de la última con datos reales.
 * CRITICAL: Reads ONLY data rows (row 2+), never includes header in bulk read.
 */
function getFirstEmptyRow_(sh, idColName) {
  var target = String(idColName || 'id_lead').trim().toLowerCase();
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return 2;

  // Use safeReadAll_ (multi-column read) to avoid single-column format errors
  var data = safeReadAll_(sh);
  if (!data || data.length <= 1) return 2;

  // Find the ID column
  var idCol = 0;
  for (var h = 0; h < data[0].length; h++) {
    if (String(data[0][h]).trim().toLowerCase() === target) { idCol = h; break; }
  }

  // Scan backward to find last row with actual data in ID column
  for (var i = data.length - 1; i >= 1; i--) {
    var cell = String(data[i][idCol] || '').trim();
    if (cell !== '') return (i + 1) + 1; // i+1 = sheet row (0-indexed), +1 = next row
  }
  return 2;
}

/**
 * Calcula Calidad de Contacto BANT (MVP — sin ponderaciones).
 * Score 0-5: cada campo BANT verdadero suma 1 punto.
 * necesita_decision_tercero es inverso (FALSE = bueno).
 * @param {Sheet} calSheet - fact_calificacion sheet object
 * @param {string} idLead  - ID del lead
 * @return {string} 'Alto' | 'Medio' | 'Bajo' | 'Sin Calificar'
 */
function calcBANTScore_(calSheet, idLead) {
  var calColMap = getColumnMap_(calSheet);
  var calData; calData = safeReadAll_(calSheet);
  var calIdLeadCol = calColMap['id_lead'] || 2;

  var calif = null;
  for (var i = 1; i < calData.length; i++) {
    if (String(calData[i][calIdLeadCol - 1]) === String(idLead)) {
      calif = calData[i];
      break;
    }
  }
  if (!calif) return '';

  // Robust check — handles boolean true, 'TRUE', 'true', 'Si', 'Sí', 'Yes', 1
  function isYes(val) {
    if (val === true || val === 1) return true;
    var s = String(val || '').trim().toLowerCase();
    return s === 'true' || s === 'si' || s === 'sí' || s === 'yes';
  }
  // Inverse: no necesitar tercero para decidir = positivo
  function isNo(val) {
    if (val === false || val === 0 || val === '') return true;
    var s = String(val || '').trim().toLowerCase();
    return s === 'false' || s === 'no';
  }

  var score = 0;
  var perfilCol   = calColMap['perfil_adecuado'];
  var presupCol   = calColMap['tiene_presupuesto'];
  var interesCol  = calColMap['mostro_interes_genuino'];
  var entendioCol = calColMap['entendio_info_marketing'];
  var terceroCol  = calColMap['necesita_decision_tercero'];

  if (perfilCol   && isYes(calif[perfilCol   - 1])) score++;
  if (presupCol   && isYes(calif[presupCol   - 1])) score++;
  if (interesCol  && isYes(calif[interesCol  - 1])) score++;
  if (entendioCol && isYes(calif[entendioCol - 1])) score++;
  if (terceroCol  && isNo(calif[terceroCol   - 1])) score++;

  if (score >= 5) return 'Alto';
  if (score >= 3) return 'Medio';
  if (score >= 1) return 'Bajo';
  return 'Sin Calificar';
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
 * Formats a Date object or ISO string to 'YYYY-MM-DD' for <input type="date">.
 */
function formatHtmlDate(d) {
  if (!d) return '';
  var dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return d || '';
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/**
 * Formats a Date object or ISO string to 'HH:mm' for <input type="time">.
 */
function formatHtmlTime(d) {
  if (!d) return '';
  var dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return d || '';
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "HH:mm");
}

/**
 * Formats a value representing a percentage to a string ending in '%'.
 * Handles decimals (0.15 -> 15%), raw numbers (15 -> 15%), and strings.
 */
function formatHtmlPercentage(val) {
  if (val === undefined || val === null || val === '') return '';
  var s = String(val).trim();
  if (s === '') return '';
  var num = Number(val);
  // If Sheets returned a decimal (e.g. cell 15% -> 0.15)
  if (!isNaN(num) && num > 0 && num <= 1 && s.indexOf('%') === -1) {
    return Math.round(num * 100) + '%';
  }
  // Add % if missing
  if (!s.endsWith('%')) {
    return s + '%';
  }
  return s;
}

/**
 * Migración: mueve lista_negra de fact_leads/fact_deals a dim_contactos.
 * Idempotente — solo ejecuta una vez. Detecta si ya migró.
 */
function migrateListaNegraToContacto_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var newCols = ['lista_negra', 'fecha_lista_negra', 'motivo_lista_negra'];

  // Step 1: Add columns to dim_contactos if missing
  var cSheet = ss.getSheetByName(T_CONTACTOS);
  if (!cSheet) return;
  var cHeaders = cSheet.getRange(1, 1, 1, cSheet.getLastColumn()).getValues()[0].map(String);
  var alreadyMigrated = cHeaders.indexOf('lista_negra') !== -1;
  if (!alreadyMigrated) {
    newCols.forEach(function (col) {
      var nextCol = cSheet.getLastColumn() + 1;
      cSheet.getRange(1, nextCol).setValue(col);
    });
    // Reload headers after adding
    cHeaders = cSheet.getRange(1, 1, 1, cSheet.getLastColumn()).getValues()[0].map(String);
  }

  // Step 2: Migrate existing data from fact_leads/fact_deals → dim_contactos (one-time)
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('lista_negra_migrated') === 'true') return;

  var cColMap = {};
  for (var ci = 0; ci < cHeaders.length; ci++) cColMap[cHeaders[ci].trim().toLowerCase()] = ci + 1;

  [T_LEADS, T_DEALS].forEach(function (tName) {
    var fSheet = ss.getSheetByName(tName);
    if (!fSheet || fSheet.getLastRow() < 2) return;
    var fHeaders = fSheet.getRange(1, 1, 1, fSheet.getLastColumn()).getValues()[0].map(String);
    var fColMap = {};
    for (var fi = 0; fi < fHeaders.length; fi++) fColMap[fHeaders[fi].trim().toLowerCase()] = fi + 1;
    if (!fColMap['lista_negra'] || !fColMap['id_contacto']) return;

    var data = fSheet.getRange(2, 1, fSheet.getLastRow() - 1, fSheet.getLastColumn()).getValues();
    // Read all dim_contactos to build index
    var cData = cSheet.getLastRow() >= 2
      ? cSheet.getRange(2, 1, cSheet.getLastRow() - 1, cSheet.getLastColumn()).getValues() : [];
    var cRowByContacto = {};
    var idContactoCol = cColMap['id_contacto'];
    for (var cr = 0; cr < cData.length; cr++) {
      cRowByContacto[String(cData[cr][idContactoCol - 1])] = cr + 2;
    }

    for (var r = 0; r < data.length; r++) {
      var val = String(data[r][fColMap['lista_negra'] - 1] || '').toUpperCase();
      if (val !== 'TRUE') continue;
      var idC = String(data[r][fColMap['id_contacto'] - 1] || '');
      var cRow = cRowByContacto[idC];
      if (!cRow) continue;
      // Only write if contact not already blacklisted
      var existing = cSheet.getRange(cRow, cColMap['lista_negra']).getValue();
      if (String(existing).toUpperCase() === 'TRUE') continue;
      cSheet.getRange(cRow, cColMap['lista_negra']).setValue('TRUE');
      if (fColMap['fecha_lista_negra'] && cColMap['fecha_lista_negra'])
        cSheet.getRange(cRow, cColMap['fecha_lista_negra']).setValue(data[r][fColMap['fecha_lista_negra'] - 1] || '');
      if (fColMap['motivo_lista_negra'] && cColMap['motivo_lista_negra'])
        cSheet.getRange(cRow, cColMap['motivo_lista_negra']).setValue(data[r][fColMap['motivo_lista_negra'] - 1] || '');
    }

    // Clear lista_negra values from fact table
    if (fColMap['lista_negra']) {
      for (var cr2 = 0; cr2 < data.length; cr2++) {
        if (String(data[cr2][fColMap['lista_negra'] - 1] || '').toUpperCase() === 'TRUE') {
          fSheet.getRange(cr2 + 2, fColMap['lista_negra']).setValue('');
          if (fColMap['fecha_lista_negra']) fSheet.getRange(cr2 + 2, fColMap['fecha_lista_negra']).setValue('');
          if (fColMap['motivo_lista_negra']) fSheet.getRange(cr2 + 2, fColMap['motivo_lista_negra']).setValue('');
        }
      }
    }
  });
  props.setProperty('lista_negra_migrated', 'true');
}

/**
 * Retorna leads y deals como JSON. Hace JOINs server-side
 * y devuelve objetos con las mismas claves que el frontend espera.
 */
function getLeads() {
  try {
    // Auto-migrate lista_negra to dim_contactos if needed
    try { migrateListaNegraToContacto_(); } catch (mig) { Logger.log('Migration skip: ' + mig.message); }

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

    // Read calificacion data — single source of truth keyed by id_lead
    var calificaciones = readTable_(T_CALIFICACION);
    var calificacionIdx = indexBy_(calificaciones, 'id_lead');

    // Read interactions for history
    var interacciones = readTable_(T_INTERACCIONES);

    // Read toques from fact_toques (relational model)
    var toquesRaw = readTable_(T_TOQUES);
    var leadToquesIdx = {};
    var dealToquesIdx = {};
    for (var ti = 0; ti < toquesRaw.length; ti++) {
      var tq = toquesRaw[ti];
      var tipoEnt = String(tq.tipo_entidad || '').toLowerCase();
      var tEntId = String(tq.id_entidad || '');
      if (tipoEnt === 'lead' && tEntId) {
        if (!leadToquesIdx[tEntId]) leadToquesIdx[tEntId] = [];
        leadToquesIdx[tEntId].push(tq);
      } else if (tipoEnt === 'deal' && tEntId) {
        if (!dealToquesIdx[tEntId]) dealToquesIdx[tEntId] = [];
        dealToquesIdx[tEntId].push(tq);
      }
    }

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
    // Phase 8: Read global pricing config once (outside the loop)
    var pricingCfg = getPricingConfig();

    // Phase 3B: Pre-compute sets of already-mapped DB columns to avoid duplicates in passthrough
    var _mappedLeadFactCols = {};
    for (var _mk in LEAD_FIELD_MAP) {
      var _mv = LEAD_FIELD_MAP[_mk];
      if (_mv.indexOf('_DIM_CONTACTO_') === 0) { _mappedLeadFactCols[_mv.replace('_DIM_CONTACTO_', '')] = '_c_'; }
      else if (_mv.indexOf('_FACT_CALIFICACION_') === 0) { _mappedLeadFactCols[_mv.replace('_FACT_CALIFICACION_', '')] = '_q_'; }
      else { _mappedLeadFactCols[_mv] = 'fact'; }
    }
    var _mappedDealFactCols = {};
    for (var _dk in DEAL_FIELD_MAP) {
      var _dv = DEAL_FIELD_MAP[_dk];
      if (_dv.indexOf('_DIM_CONTACTO_') === 0) { _mappedDealFactCols[_dv.replace('_DIM_CONTACTO_', '')] = '_c_'; }
      else if (_dv.indexOf('_FACT_CALIFICACION_') === 0) { _mappedDealFactCols[_dv.replace('_FACT_CALIFICACION_', '')] = '_q_'; }
      else { _mappedDealFactCols[_dv] = 'fact'; }
    }
    var _tipo = String(pricingCfg.tipoCliente || '').trim();
    // Multi-product pricing: use first product as default fallback
    var _firstProd = (pricingCfg.productos && pricingCfg.productos.length > 0) ? pricingCfg.productos[0] : null;
    var _ticket = _firstProd ? (parseFloat(_firstProd.ticketPromedio) || 0) : (parseFloat(pricingCfg.ticketPromedio) || 0);
    var _licencias = parseFloat(pricingCfg.licenciasPromedio) || 0;
    var _globalMonto = 0;
    if (_tipo === 'Fichas Mensuales (FEE)') _globalMonto = _ticket * 12;
    else if (_tipo === 'Proyectos') _globalMonto = _ticket;
    else if (_tipo === 'SaaS') _globalMonto = _ticket * (_licencias || 1) * 12;

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
        _campaign: campana.campaign || '',
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
        'Licencias': fl.licencias || '',
        'Vendedor Asignado para Seguimiento': vendedor.nombre || '',
        'Vendedor asignado (SDR)': fl.id_vendedor_sdr || '',
        'Notas': fl.notas || '', 'Razón de pérdida': fl.razon_perdida || '',
        'Razón Pérdida Otra': fl.razon_perdida_otra || '',
        '¿Es recompra?': fl.es_recompra || '',
        'Tipo de Seguimiento': fl.tipo_seguimiento || '',
        'Status del Seguimiento': fl.status_seguimiento || '',
        'source': campana.source || '',
        'medium': campana.medium || '',
        'campaign': campana.campaign || '',
        'term': campana.term || '',
        'content': campana.content || '',
        // Phase 1.11: Timestamp derived from fact_toques below (after _toquesList is built)
        'time stamp': '',
        'Timestamp': '',
        // Internal FKs for updates
        _id_contacto: fl.id_contacto,
        _id_campana: fl.id_campana,
        _id_vendedor_sdr: fl.id_vendedor_sdr,
        // Phase 1.2: Assignment
        'Fecha y Hora de asignación': fl.fecha_asignacion || '',
        // Contact-level fields (IP, Link, fbclid)
        'Ip': contacto.ip || '',
        'Link': contacto.link || '',
        'fbclid': contacto.fbclid || '',
        // Phase 21: Duplicate FK link
        'Lead Original': fl.id_lead_original || '',
        _leadOriginalId: fl.id_lead_original || '',
        // Lista Negra (sourced from dim_contactos)
        _listaNegra: contacto.lista_negra === true || contacto.lista_negra === 'TRUE' || contacto.lista_negra === 'true',
        'lista_negra': contacto.lista_negra || '',
        'fecha_lista_negra': contacto.fecha_lista_negra || '',
        'motivo_lista_negra': contacto.motivo_lista_negra || '',
        // Prueba flag
        _esPrueba: fl.es_prueba === true || fl.es_prueba === 'TRUE' || fl.es_prueba === 'true',
        'es_prueba': fl.es_prueba || ''
      };

      // Pricing fields — from global config (Phase 8: Pricing Global)
      obj['Tipo de Cliente'] = pricingCfg.tipoCliente || '';
      obj['Ticket Promedio'] = pricingCfg.ticketPromedio || '';
      obj['Licencias Promedio'] = pricingCfg.licenciasPromedio || '';
      obj['Monto Aproximado'] = _globalMonto;

      // Add tracking fields
      obj['Toques de Contactación'] = String(fl.numero_toques || 0);
      obj['¿En qué toque va?'] = String(fl.numero_toques || 0);

      // Add calificacion fields (from fact_calificacion JOIN via id_lead — Single Source of Truth)
      var calif = calificacionIdx[String(fl.id_lead)] || {};
      obj['¿Entendió la información de Marketing?'] = calif.entendio_info_marketing || '';
      obj['¿Mostró Interés genuino?'] = calif.mostro_interes_genuino || '';
      obj['¿Cuál es tu necesidad puntual?'] = calif.necesidad_puntual || '';
      obj['¿El perfil del prospecto es el adecuado?'] = calif.perfil_adecuado || '';
      obj['¿Necesitas tocar base con alguién para decidir la compra?'] = calif.necesita_decision_tercero || '';
      obj['¿Tienes presupuesto asignado para este proyecto, en este año?'] = calif.tiene_presupuesto || '';
      obj['¿Cuánto?'] = calif.monto_presupuesto || '';
      obj['Modo Presupuesto'] = calif.modo_presupuesto || 'Exacto';
      obj['Presupuesto Rango Alto'] = calif.presupuesto_rango_alto || '';
      obj['¿han sido parte de alguna asociación de la industria?'] = calif.asociacion_industria || '';
      obj['Pricing Tier'] = calif.pricing_tier || '';
      // PARAM-01: Custom question responses (JSON)
      try { obj['_respuestasCustom'] = JSON.parse(calif.respuestas_custom || '{}'); } catch(e) { obj['_respuestasCustom'] = {}; }
      // Phase 1.6: Missing BANT fields
      obj['¿Cual es su región?'] = calif.region || '';
      obj['¿Que tipo de membresía es?'] = calif.tipo_membresia || '';

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
      // Phase 1.10: Inject immutable lifecycle events into history timeline
      if (fl.fecha_ingreso) {
        history.push({ type: 'Ingreso al CRM', date: fl.fecha_ingreso });
      }
      if (fl.fecha_asignacion) {
        history.push({ type: 'Asignación a SDR', date: fl.fecha_asignacion });
      }
      if (calif.fecha_calificacion) {
        history.push({ type: 'Calificación (BANT)', date: calif.fecha_calificacion });
      }
      history.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      obj._history = history;
      obj._colY_Toques = String(fl.numero_toques || 0);

      // Build toques list from fact_toques (relational)
      var toquesArr = leadToquesIdx[String(fl.id_lead)] || [];
      toquesArr.sort(function (a, b) { return Number(a.numero_toque || 0) - Number(b.numero_toque || 0); });
      obj._toquesList = toquesArr.map(function (t) {
        return { toque: t.numero_toque, fecha: t.fecha_toque, vendedor: t.id_vendedor, rol: t.rol_vendedor, canal: t.canal || '' };
      });

      // Phase 1.11: Derive Timestamp from the last fact_toques entry (single source of truth)
      var ultimaFechaToque = fl.fecha_ultimo_contacto || '';
      if (toquesArr.length > 0) {
        var lastTq = toquesArr[toquesArr.length - 1];
        if (lastTq && lastTq.fecha_toque) {
          ultimaFechaToque = lastTq.fecha_toque;
        }
      }
      obj['time stamp'] = ultimaFechaToque;
      obj['Timestamp'] = ultimaFechaToque;

      // Phase 3B: Passthrough unmapped columns from all joined tables
      for (var _fk in fl) {
        if (_fk === '_row' || SYSTEM_COLS[_fk] || _mappedLeadFactCols[_fk]) continue;
        if (obj[_fk] === undefined) obj[_fk] = fl[_fk] !== undefined ? fl[_fk] : '';
      }
      for (var _ck in contacto) {
        if (_ck === '_row' || SYSTEM_COLS[_ck] || _mappedLeadFactCols[_ck] === '_c_') continue;
        var _cpk = '_c_' + _ck;
        if (obj[_cpk] === undefined && obj[_ck] === undefined) obj[_cpk] = contacto[_ck] !== undefined ? contacto[_ck] : '';
      }
      for (var _qk in calif) {
        if (_qk === '_row' || SYSTEM_COLS[_qk] || _mappedLeadFactCols[_qk] === '_q_') continue;
        var _qpk = '_q_' + _qk;
        if (obj[_qpk] === undefined && obj[_qk] === undefined) obj[_qpk] = calif[_qk] !== undefined ? calif[_qk] : '';
      }
      for (var _campk in campana) {
        if (_campk === '_row' || SYSTEM_COLS[_campk]) continue;
        var _camppk = '_camp_' + _campk;
        if (obj[_camppk] === undefined && obj[_campk] === undefined) obj[_camppk] = campana[_campk] !== undefined ? campana[_campk] : '';
      }

      leads.push(obj);
    }

    // Build rawLeads index by id_lead for Deal -> Lead SDR field lookups
    var rawLeadsIdx = {};
    for (var ri = 0; ri < rawLeads.length; ri++) {
      var rl = rawLeads[ri];
      if (rl.id_lead) rawLeadsIdx[String(rl.id_lead)] = rl;
    }

    // --- Build Deals ---
    var rawDeals = readTable_(T_DEALS);
    var deals = [];
    for (var d = 0; d < rawDeals.length; d++) {
      var fd = rawDeals[d];
      var dc = contactosIdx[String(fd.id_contacto)] || {};
      var dv = vendedoresIdx[String(fd.id_vendedor_ae)] || {};
      var dp = productosIdx[String(fd.id_producto)] || {};

      // Lookup original SDR Lead data via id_lead FK
      var sdrLead = rawLeadsIdx[String(fd.id_lead)] || {};
      var sdrVendedor = vendedoresIdx[String(sdrLead.id_vendedor_sdr)] || {};
      var sdrCampana = campanasIdx[String(sdrLead.id_campana)] || {};

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
        _aeEmail: dv.email || '',
        _colAS_Notas: fd.notas_vendedor || '',
        // Direct fields
        'ID': fd.id_deal,
        'Nombre': dc.nombre || '',
        'Apellido': dc.apellido || '',
        'Email': dc.email || '',
        'Teléfono': dc.telefono_1 || '',
        'Teléfono 2': dc.telefono_2 || '',
        'empresa': dc.empresa || '',
        'Area': dc.area || '',
        'Status de Venta': fd.status_venta || '',
        'Proyeccion': fd.proyeccion || '',
        'Monto de proyección': fd.monto_proyeccion || '',
        'Monto de Apartado': fd.monto_apartado || '',
        'Monto de cierre': fd.monto_cierre || '',
        'Fecha de Cierre': formatHtmlDate(fd.fecha_cierre),
        'Descuento': formatHtmlPercentage(fd.descuento_pct),
        'Notas Vendedor': fd.notas_vendedor || '',
        'Notas': sdrLead.notas || '',
        '¿Por qué perdimos la venta?': fd.razon_perdida || '',
        '¿Es recompra?': fd.es_recompra || '',
        '¿Es cliente activo?': fd.es_cliente_activo || '',
        'Producto de Cierre': fd.producto_cierre || '',
        'Fuente de origen': fd.fuente_origen || '',
        'Tipo de Transacción': fd.tipo_transaccion || '',
        'Monto de Cotización': fd.monto_cotizacion || '',
        'Fecha de Cotización': formatHtmlDate(fd.fecha_cotizacion),
        'Notas de Cotización': fd.notas_cotizacion || '',
        'Razón Pérdida Otra': fd.razon_perdida_otra || '',
        'Vendedor Asignado para Seguimiento': fd.id_vendedor_ae || '',
        // AE-exclusive fields
        'Toque': fd.toque_ae || '',
        'Numero de toque': fd.numero_toque_ae || '',
        'Fecha de primer contacto AE': fd.fecha_primer_contacto_ae || '',
        '¿Ventas Contactó Cliente?': fd.ventas_contacto_cliente || '',
        'Fecha de Reagenda': formatHtmlDate(fd.fecha_reagenda),
        'Hora de Reagenda': formatHtmlTime(fd.hora_reagenda),
        'Index': fd.index_ae || '',
        'Cross Selling?': fd.cross_selling || '',
        'Producto de Recompra': fd.producto_recompra || '',
        'Valor de recompra': fd.valor_recompra || '',
        'Fecha de recompra': fd.fecha_recompra || '',
        'Link de Pago': fd.link_pago || '',
        'Renovación': fd.renovacion || '',
        'Soporte de pago': fd.soporte_pago || '',
        'Comprobante de Pago URL': fd.comprobante_pago_url || '',
        'Deal Code': fd.deal_code || '',
        // Pricing from fact_deals (1/2 Year Mem stored per deal)
        '1 Year Mem': fd.precio_1_year || '',
        '2 Year Mem': fd.precio_2_year || '',
        // Internal FKs
        _id_lead: fd.id_lead,
        _id_contacto: fd.id_contacto,
        _id_vendedor_ae: fd.id_vendedor_ae,
        _id_producto: fd.id_producto,
        // Lista Negra (sourced from dim_contactos via dc)
        _listaNegra: dc.lista_negra === true || dc.lista_negra === 'TRUE' || dc.lista_negra === 'true',
        'lista_negra': dc.lista_negra || '',
        'fecha_lista_negra': dc.fecha_lista_negra || '',
        'motivo_lista_negra': dc.motivo_lista_negra || '',
        // Prueba flag
        _esPrueba: fd.es_prueba === true || fd.es_prueba === 'TRUE' || fd.es_prueba === 'true',
        'es_prueba': fd.es_prueba || ''
      };

      // ── SDR Qualification Fields (read-only for AE, synced via id_lead FK) ──
      dealObj['Vendedor asignado (SDR)'] = sdrVendedor.nombre || '';
      dealObj['Fecha y Hora de asignación'] = sdrLead.fecha_asignacion || '';
      dealObj['Status'] = sdrLead.status || '';
      dealObj['Calidad de Contacto'] = sdrLead.calidad_contacto || '';
      dealObj['Toques de Contactación'] = String(sdrLead.numero_toques || 0);
      dealObj['¿En qué toque va?'] = String(sdrLead.numero_toques || 0);
      dealObj['Tipo de Seguimiento'] = sdrLead.tipo_seguimiento || '';
      dealObj['Toques de Seguimiento'] = String(sdrLead.toques_seguimiento || '');
      dealObj['Status del Seguimiento'] = sdrLead.status_seguimiento || '';
      dealObj['Razón de pérdida'] = sdrLead.razon_perdida || '';
      dealObj['time stamp'] = sdrLead.fecha_ultimo_contacto || '';
      dealObj['Timestamp'] = sdrLead.fecha_ultimo_contacto || '';
      dealObj['Servicio'] = sdrLead.servicio_interes || '';

      // Pricing fields — from global config (Phase 8: reuses pricingCfg from leads section)
      dealObj['Tipo de Cliente'] = pricingCfg.tipoCliente || '';
      dealObj['Ticket Promedio'] = pricingCfg.ticketPromedio || '';
      dealObj['Licencias Promedio'] = pricingCfg.licenciasPromedio || '';
      dealObj['Monto Aproximado'] = _globalMonto;

      // SDR UTM / Campaign data (from dim_campanas via Lead FK)
      dealObj['source'] = sdrCampana.source || '';
      dealObj['medium'] = sdrCampana.medium || '';
      dealObj['campaign'] = sdrCampana.campaign || '';
      dealObj['term'] = sdrCampana.term || '';
      dealObj['content'] = sdrCampana.content || '';

      // SDR Contact extended fields (from dim_contactos — already joined via dc)
      dealObj['Pais'] = dc.pais || '';
      dealObj['City'] = dc.ciudad || '';
      dealObj['Nivel'] = dc.nivel || '';
      dealObj['Empleados'] = dc.empleados || '';
      dealObj['Ip'] = dc.ip || '';
      dealObj['Link'] = dc.link || '';
      dealObj['fbclid'] = dc.fbclid || '';

      // ── BANT calificación fields (from fact_calificacion JOIN via id_lead — SSOT) ──
      var dealCalif = calificacionIdx[String(fd.id_lead)] || {};
      dealObj['¿Entendió la información de Marketing?'] = dealCalif.entendio_info_marketing || '';
      dealObj['¿Mostró Interés genuino?'] = dealCalif.mostro_interes_genuino || '';
      dealObj['¿Cuál es tu necesidad puntual?'] = dealCalif.necesidad_puntual || '';
      dealObj['¿El perfil del prospecto es el adecuado?'] = dealCalif.perfil_adecuado || '';
      dealObj['¿Necesitas tocar base con alguién para decidir la compra?'] = dealCalif.necesita_decision_tercero || '';
      dealObj['¿Tienes presupuesto asignado para este proyecto, en este año?'] = dealCalif.tiene_presupuesto || '';
      dealObj['¿Cuánto?'] = dealCalif.monto_presupuesto || '';
      dealObj['Modo Presupuesto'] = dealCalif.modo_presupuesto || 'Exacto';
      dealObj['Presupuesto Rango Alto'] = dealCalif.presupuesto_rango_alto || '';
      dealObj['¿han sido parte de alguna asociación de la industria?'] = dealCalif.asociacion_industria || '';
      // BANT Pricing fields from fact_calificacion (SSOT — NOT from dim_productos)
      dealObj['¿Cual es su región?'] = dealCalif.region || '';
      dealObj['¿Que tipo de membresía es?'] = dealCalif.tipo_membresia || '';
      dealObj['Pricing Tier'] = dealCalif.pricing_tier || '';
      try { dealObj['_respuestasCustom'] = JSON.parse(dealCalif.respuestas_custom || '{}'); } catch(e) { dealObj['_respuestasCustom'] = {}; }

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

      // ── Inject lifecycle events from SDR lead into deal history timeline ──
      if (sdrLead.fecha_ingreso) {
        dealHistory.push({ type: 'Ingreso al CRM', date: sdrLead.fecha_ingreso });
      }
      if (sdrLead.fecha_asignacion) {
        dealHistory.push({ type: 'Asignación a SDR', date: sdrLead.fecha_asignacion });
      }
      if (dealCalif.fecha_calificacion) {
        dealHistory.push({ type: 'Calificación (BANT)', date: dealCalif.fecha_calificacion });
      }
      if (fd.fecha_creacion_deal) {
        dealHistory.push({ type: 'Traspaso al AE', date: fd.fecha_creacion_deal });
      }
      dealHistory.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      dealObj._history = dealHistory;

      // ── Combine SDR toques (via id_lead FK) + AE toques (via id_deal) ──
      var sdrToques = (leadToquesIdx[String(fd.id_lead)] || []).map(function (t) {
        return { toque: t.numero_toque, fecha: t.fecha_toque, vendedor: t.id_vendedor, rol: t.rol_vendedor || 'SDR', canal: t.canal || '' };
      });
      var aeToques = (dealToquesIdx[String(fd.id_deal)] || []).map(function (t) {
        return { toque: t.numero_toque, fecha: t.fecha_toque, vendedor: t.id_vendedor, rol: t.rol_vendedor || 'AE', canal: t.canal || '' };
      });
      var combinedToques = sdrToques.concat(aeToques);
      combinedToques.sort(function (a, b) { return new Date(a.fecha || 0) - new Date(b.fecha || 0); });
      dealObj._toquesList = combinedToques;

      // ── Derive SDR Timestamp from the last SDR toque (overrides fecha_ultimo_contacto if available) ──
      var ultimoToqueSDR = null;
      var ultimoToqueAE = null;
      for (var ct = 0; ct < combinedToques.length; ct++) {
        if (combinedToques[ct].rol === 'SDR') ultimoToqueSDR = combinedToques[ct];
        if (combinedToques[ct].rol === 'AE') ultimoToqueAE = combinedToques[ct];
      }
      if (ultimoToqueSDR && ultimoToqueSDR.fecha) {
        dealObj['Toques de Contactación'] = String(ultimoToqueSDR.toque);
        dealObj['¿En qué toque va?'] = String(ultimoToqueSDR.toque);
        dealObj['time stamp'] = ultimoToqueSDR.fecha;
        dealObj['Timestamp'] = ultimoToqueSDR.fecha;
      }
      // ── Derive AE Timestamp from the last AE toque ──
      dealObj['Timestamp AE'] = (ultimoToqueAE && ultimoToqueAE.fecha) ? ultimoToqueAE.fecha : '';

      // ── Derive Fecha de primer contacto AE from the FIRST AE toque (chronological) ──
      var primerToqueAE = null;
      for (var pt = 0; pt < combinedToques.length; pt++) {
        if (combinedToques[pt].rol === 'AE') { primerToqueAE = combinedToques[pt]; break; }
      }
      if (primerToqueAE && primerToqueAE.fecha) {
        dealObj['Fecha de primer contacto AE'] = primerToqueAE.fecha;
      }

      // Phase v3.2: Auto-derive ¿Ventas Contactó Cliente? from AE toques existence
      var hasAnyAeToque = false;
      for (var at = 0; at < combinedToques.length; at++) {
        if (combinedToques[at].rol === 'AE') { hasAnyAeToque = true; break; }
      }
      dealObj['¿Ventas Contactó Cliente?'] = hasAnyAeToque ? 'Si' : 'No';

      // Phase 3B: Passthrough unmapped columns from all joined tables (deals)
      for (var _dfk in fd) {
        if (_dfk === '_row' || SYSTEM_COLS[_dfk] || _mappedDealFactCols[_dfk]) continue;
        if (dealObj[_dfk] === undefined) dealObj[_dfk] = fd[_dfk] !== undefined ? fd[_dfk] : '';
      }
      for (var _dck in dc) {
        if (_dck === '_row' || SYSTEM_COLS[_dck] || _mappedDealFactCols[_dck] === '_c_') continue;
        var _dcpk = '_c_' + _dck;
        if (dealObj[_dcpk] === undefined && dealObj[_dck] === undefined) dealObj[_dcpk] = dc[_dck] !== undefined ? dc[_dck] : '';
      }
      var dealCalif = calificacionIdx[String(fd.id_lead)] || {};
      for (var _dqk in dealCalif) {
        if (_dqk === '_row' || SYSTEM_COLS[_dqk] || _mappedDealFactCols[_dqk] === '_q_') continue;
        var _dqpk = '_q_' + _dqk;
        if (dealObj[_dqpk] === undefined && dealObj[_dqk] === undefined) dealObj[_dqpk] = dealCalif[_dqk] !== undefined ? dealCalif[_dqk] : '';
      }

      deals.push(dealObj);
    }

    // ── Phase 1.5: Inject _hasDeal / _dealId into leads ──
    var dealsByLeadId = {};
    for (var dl = 0; dl < deals.length; dl++) {
      var dlId = String(deals[dl]._id_lead || '');
      if (dlId) dealsByLeadId[dlId] = deals[dl]._id;
    }
    for (var lk = 0; lk < leads.length; lk++) {
      var lkId = String(leads[lk]._id || '');
      if (dealsByLeadId[lkId]) {
        leads[lk]._hasDeal = true;
        leads[lk]._dealId = dealsByLeadId[lkId];
      } else {
        leads[lk]._hasDeal = false;
        leads[lk]._dealId = '';
      }
    }

    return JSON.stringify({ leads: leads, deals: deals, vendedores: vendedores });
  } catch (err) {
    Logger.log('getLeads ERROR: ' + err.message);
    return JSON.stringify({ leads: [], deals: [], error: err.message });
  }
}

// ============ API: SCHEMA DISCOVERY (Phase 3B) ============

/**
 * Returns column headers from each entity table plus a reverse FIELD_MAP
 * so the frontend knows which table owns each column.
 * Cached for 5 minutes.
 * @return {Object} { tables: {tableName: [col1,col2,...]}, fieldMap: {frontendKey: {table, dbCol}} }
 */
function getSchema(forceRefresh) {
  var cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    var cached = cache.get('schema_v1');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { }
    }
  }

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var tableMap = {
    fact_leads: T_LEADS,
    fact_deals: T_DEALS,
    dim_contactos: T_CONTACTOS,
    fact_calificacion: T_CALIFICACION,
    dim_campanas: T_CAMPANAS
  };

  var schema = {};    // { tableName: [{name, format}] }
  var colFormats = {}; // { tableName: {colName: formatString} }
  for (var alias in tableMap) {
    var sheet = ss.getSheetByName(tableMap[alias]);
    if (!sheet || sheet.getLastColumn() === 0) { schema[alias] = []; colFormats[alias] = {}; continue; }
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    // Read number formats from row 2 (first data row) to detect column types
    var formats = [];
    if (sheet.getLastRow() >= 2) {
      formats = sheet.getRange(2, 1, 1, lastCol).getNumberFormats()[0];
    }
    var cols = [];
    var fmts = {};
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i] || '').trim().toLowerCase();
      if (!h) continue;
      cols.push(h);
      if (formats[i]) fmts[h] = formats[i];
    }
    schema[alias] = cols;
    colFormats[alias] = fmts;
  }

  // Build reverse FIELD_MAP: { frontendKey: { table, dbCol } }
  var reverseMap = {};
  function mapFields(fieldMap, defaultTable) {
    for (var fk in fieldMap) {
      if (reverseMap[fk]) continue;
      var v = fieldMap[fk];
      if (v.indexOf('_DIM_CONTACTO_') === 0) {
        reverseMap[fk] = { table: 'dim_contactos', dbCol: v.replace('_DIM_CONTACTO_', '') };
      } else if (v.indexOf('_FACT_CALIFICACION_') === 0) {
        reverseMap[fk] = { table: 'fact_calificacion', dbCol: v.replace('_FACT_CALIFICACION_', '') };
      } else {
        reverseMap[fk] = { table: defaultTable, dbCol: v };
      }
    }
  }
  mapFields(LEAD_FIELD_MAP, 'fact_leads');
  mapFields(DEAL_FIELD_MAP, 'fact_deals');

  var result = { tables: schema, fieldMap: reverseMap, formats: colFormats };
  try {
    cache.put('schema_v1', JSON.stringify(result), 30);
  } catch (e) { }
  return result;
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

  var data; data = safeReadAll_(sheet);
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
  var refreshData; refreshData = safeReadAll_(sheet);
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

/** Limpia el caché de catálogos para forzar recarga desde cat_opciones. */
function clearCatalogsCache() {
  CacheService.getScriptCache().remove('catalogs_data');
  return { cleared: true };
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

// ============ API: DEAL PRODUCTS (Phase 10 — DEAL-03) ============

function getDealProducts(idDeal) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_DEAL_PRODUCTOS);
    if (!sheet) return [];
    var rows = readTable_(T_DEAL_PRODUCTOS);
    var result = [];
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id_deal) === String(idDeal)) {
        result.push({
          _row: rows[i]._row,
          id_linea: rows[i].id_linea || '',
          id_deal: rows[i].id_deal || '',
          nombre_producto: rows[i].nombre_producto || '',
          cantidad: Number(rows[i].cantidad) || 1,
          precio_unitario: Number(rows[i].precio_unitario) || 0,
          descuento_pct: Number(rows[i].descuento_pct) || 0,
          subtotal: Number(rows[i].subtotal) || 0
        });
      }
    }
    return result;
  } catch (e) {
    Logger.log('getDealProducts ERROR: ' + e.message);
    return [];
  }
}

function saveDealProducts(idDeal, lineas) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { status: 'error', message: 'Lock timeout' };
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_DEAL_PRODUCTOS);
    if (!sheet) {
      // Auto-create the table with headers
      sheet = ss.insertSheet(T_DEAL_PRODUCTOS);
      sheet.getRange(1, 1, 1, 7).setValues([['id_linea', 'id_deal', 'nombre_producto', 'cantidad', 'precio_unitario', 'descuento_pct', 'subtotal']]);
    }
    // Delete existing lines for this deal
    var data; data = safeReadAll_(sheet);
    var colMap = {};
    for (var c = 0; c < data[0].length; c++) colMap[String(data[0][c]).trim()] = c;
    var idDealCol = colMap['id_deal'];
    // Collect rows to delete (from bottom up)
    var rowsToDelete = [];
    for (var r = data.length - 1; r >= 1; r--) {
      if (String(data[r][idDealCol]) === String(idDeal)) {
        rowsToDelete.push(r + 1); // 1-indexed
      }
    }
    for (var d = 0; d < rowsToDelete.length; d++) {
      sheet.deleteRow(rowsToDelete[d]);
    }
    // Insert new lines
    var nextId = getNextId_(sheet, 'id_linea');
    for (var li = 0; li < lineas.length; li++) {
      var l = lineas[li];
      var qty = Number(l.cantidad) || 1;
      var price = Number(l.precio_unitario) || 0;
      var disc = Number(l.descuento_pct) || 0;
      var subtotal = qty * price * (1 - disc / 100);
      sheet.appendRow([nextId + li, idDeal, l.nombre_producto || '', qty, price, disc, Math.round(subtotal * 100) / 100]);
    }
    // DEAL-04: Auto-classify deal type
    var clasificacion = classifyDealType_(idDeal, lineas);
    if (clasificacion) {
      var dealSheet = ss.getSheetByName(T_DEALS);
      var dealColMap = getColumnMap_(dealSheet);
      var dealRows = readTable_(T_DEALS);
      for (var dr = 0; dr < dealRows.length; dr++) {
        if (String(dealRows[dr].id_deal) === String(idDeal)) {
          if (dealColMap['tipo_transaccion']) {
            dealSheet.getRange(dealRows[dr]._row, dealColMap['tipo_transaccion']).setValue(clasificacion);
          }
          break;
        }
      }
    }
    return { status: 'success', message: lineas.length + ' producto(s) guardados', clasificacion: clasificacion || '' };
  } catch (e) {
    Logger.log('saveDealProducts ERROR: ' + e.message);
    return { status: 'error', message: e.message };
  } finally {
    lock.releaseLock();
  }
}

// DEAL-04: Classify deal as cross-selling, up-selling, or venta directa
function classifyDealType_(idDeal, lineas) {
  try {
    // Get the original SDR product of interest from the lead
    var dealRows = readTable_(T_DEALS);
    var deal = null;
    for (var i = 0; i < dealRows.length; i++) {
      if (String(dealRows[i].id_deal) === String(idDeal)) { deal = dealRows[i]; break; }
    }
    if (!deal || !deal.id_lead) return '';
    var leadRows = readTable_(T_LEADS);
    var lead = null;
    for (var j = 0; j < leadRows.length; j++) {
      if (String(leadRows[j].id_lead) === String(deal.id_lead)) { lead = leadRows[j]; break; }
    }
    if (!lead) return '';
    var productoSDR = String(lead.producto_interes || lead.servicio || '').trim().toLowerCase();
    if (!productoSDR) return '';
    var productosAE = lineas.map(function(l) { return String(l.nombre_producto || '').trim().toLowerCase(); });
    if (productosAE.length === 0) return '';
    var hayMatch = productosAE.some(function(p) { return p === productoSDR; });
    var hayOtros = productosAE.some(function(p) { return p !== productoSDR && p !== ''; });
    if (hayMatch && hayOtros) return 'Cross-Selling';
    if (!hayMatch && hayOtros) return 'Up-Selling';
    return 'Venta Directa';
  } catch (e) {
    Logger.log('classifyDealType_ ERROR: ' + e.message);
    return '';
  }
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
          _row: row._row
        };
      }
    }
    return { email: email, nombre: email, rol: 'GUEST', sheetId: SHEET_ID };
  } catch (err) {
    Logger.log('getUserConfig error: ' + err.message);
    return { email: '', nombre: 'Error', rol: 'GUEST', sheetId: SHEET_ID, error: err.message };
  }
}

/**
 * Autentica un usuario por email y password contra config_users.
 * Retorna el config del usuario si las credenciales son válidas.
 */
function loginUser(email, password) {
  try {
    if (!email || !password) return { status: 'error', message: 'Email y contraseña son requeridos' };

    var rows = readTable_(T_USERS);
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (String(row.email || '').trim().toLowerCase() === email.trim().toLowerCase()) {
        // Check activo
        var isActive = row.activo === true || row.activo === 'TRUE' || row.activo === 1 || row.activo === 'true';
        if (!isActive) return { status: 'error', message: 'Usuario desactivado. Contacta al administrador.' };

        // Check password
        var storedPwd = String(row.password || '').trim();
        if (storedPwd !== password.trim()) return { status: 'error', message: 'Contraseña incorrecta' };

        return {
          status: 'success',
          data: {
            email: String(row.email || '').trim(),
            nombre: String(row.nombre || email),
            rol: String(row.rol || 'GUEST').toUpperCase(),
            sheetId: SHEET_ID,
            _row: row._row
          }
        };
      }
    }
    return { status: 'error', message: 'Usuario no encontrado' };
  } catch (err) {
    Logger.log('loginUser error: ' + err.message);
    return { status: 'error', message: 'Error de autenticación: ' + err.message };
  }
}

/**
 * Obtiene la config de un usuario por email (sin depender de Session).
 * Usado para restaurar sesión desde localStorage.
 */
function getUserConfigByEmail(email) {
  try {
    if (!email) return { email: '', nombre: 'Error', rol: 'GUEST', sheetId: SHEET_ID };

    var rows = readTable_(T_USERS);
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (String(row.email || '').trim().toLowerCase() === email.trim().toLowerCase()) {
        var isActive = row.activo === true || row.activo === 'TRUE' || row.activo === 1 || row.activo === 'true';
        if (!isActive) return { email: email, nombre: 'Desactivado', rol: 'GUEST', sheetId: SHEET_ID, inactive: true };

        return {
          email: String(row.email || '').trim(),
          nombre: String(row.nombre || email),
          rol: String(row.rol || 'GUEST').toUpperCase(),
          sheetId: SHEET_ID,
          _row: row._row
        };
      }
    }
    return { email: email, nombre: email, rol: 'GUEST', sheetId: SHEET_ID };
  } catch (err) {
    Logger.log('getUserConfigByEmail error: ' + err.message);
    return { email: '', nombre: 'Error', rol: 'GUEST', sheetId: SHEET_ID, error: err.message };
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
          activeAEs.push({
            email: row.email || '',
            nombre: row.nombre || '',
            orden: parseInt(row.orden_round_robin, 10) || 0
          });
        }
      }
    }
    // Sort by order safely
    activeAEs.sort(function (a, b) { return a.orden - b.orden; });

    return { status: 'success', data: activeAEs };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

function updateRoundRobinOrder(orderedEmails) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_VENDEDORES);
    if (!sheet) return { status: 'error', message: 'Hoja dim_vendedores no encontrada' };

    var colMap = getColumnMap_(sheet);
    if (!colMap['orden_round_robin']) return { status: 'error', message: 'Falta columna Orden_Round_Robin' };

    var data; data = safeReadAll_(sheet);
    var emailColIdx = (colMap['email'] || 1) - 1;
    var orderColIdx = colMap['orden_round_robin']; // is 1-based logic usually

    for (var r = 1; r < data.length; r++) {
      var email = String(data[r][emailColIdx] || '').trim().toLowerCase();
      var rank = orderedEmails.findIndex(function (e) { return e.toLowerCase() === email; });
      if (rank !== -1) {
        // Encontrado en el listado ordenado
        sheet.getRange(r + 1, orderColIdx).setValue(rank + 1);
      }
    }
    // Reset cache just in case
    try { CacheService.getScriptCache().remove('dim_vendedores'); } catch(e) { /* no cache to clear */ }
    return { status: 'success', message: 'Orden de Round Robin actualizado' };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
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
  'Licencias': 'licencias',
  'Toques de Contactación': 'numero_toques',
  '¿En qué toque va?': 'numero_toques',
  // Phase 1.10: Timestamp routes to fecha_ultimo_contacto
  'Timestamp': 'fecha_ultimo_contacto',
  'time stamp': 'fecha_ultimo_contacto',
  // Fields in dim_contactos (via _id_contacto)
  'Nombre': '_DIM_CONTACTO_nombre', 'Apellido': '_DIM_CONTACTO_apellido',
  'Email': '_DIM_CONTACTO_email', 'Teléfono': '_DIM_CONTACTO_telefono_1',
  'Teléfono 2': '_DIM_CONTACTO_telefono_2', 'empresa': '_DIM_CONTACTO_empresa',
  'Area': '_DIM_CONTACTO_area', 'Pais': '_DIM_CONTACTO_pais',
  'City': '_DIM_CONTACTO_ciudad', 'Empleados': '_DIM_CONTACTO_empleados',
  'Nivel': '_DIM_CONTACTO_nivel',
  // BANT Calificación fields (routed via _FACT_CALIFICACION_ prefix)
  '¿Entendió la información de Marketing?': '_FACT_CALIFICACION_entendio_info_marketing',
  '¿Mostró Interés genuino?': '_FACT_CALIFICACION_mostro_interes_genuino',
  '¿Cuál es tu necesidad puntual?': '_FACT_CALIFICACION_necesidad_puntual',
  '¿El perfil del prospecto es el adecuado?': '_FACT_CALIFICACION_perfil_adecuado',
  '¿Necesitas tocar base con alguién para decidir la compra?': '_FACT_CALIFICACION_necesita_decision_tercero',
  '¿Tienes presupuesto asignado para este proyecto, en este año?': '_FACT_CALIFICACION_tiene_presupuesto',
  '¿Cuánto?': '_FACT_CALIFICACION_monto_presupuesto',
  'Modo Presupuesto': '_FACT_CALIFICACION_modo_presupuesto',
  'Presupuesto Rango Alto': '_FACT_CALIFICACION_presupuesto_rango_alto',
  '¿han sido parte de alguna asociación de la industria?': '_FACT_CALIFICACION_asociacion_industria',
  'Pricing Tier': '_FACT_CALIFICACION_pricing_tier',
  // Phase 1.6: Missing BANT fields
  '¿Cual es su región?': '_FACT_CALIFICACION_region',
  '¿Que tipo de membresía es?': '_FACT_CALIFICACION_tipo_membresia',
  'Razón de pérdida': 'razon_perdida',
  'Razón Pérdida Otra': 'razon_perdida_otra',
  '¿Es recompra?': 'es_recompra',
  // Pricing & Tracking fields (in fact_leads)
  'Tipo de Cliente': 'tipo_cliente_pricing',
  'Ticket Promedio': 'ticket_promedio',
  'Licencias Promedio': 'licencias_promedio',
  'Monto Aproximado': 'monto_aproximado',
  'Vendedor asignado (SDR)': 'id_vendedor_sdr',
  'Fecha y Hora de asignación': 'fecha_asignacion',
  // Contact & Campaign external bindings (contact fields are editable; campaign fields are read-only in UI)
  'Ip': '_DIM_CONTACTO_ip',
  'Link': '_DIM_CONTACTO_link',
  'fbclid': '_DIM_CONTACTO_fbclid',
  // Phase 21: Duplicate FK link
  'Lead Original': 'id_lead_original',
  // Prueba flag (in fact_leads)
  'es_prueba': 'es_prueba',
  // Lista Negra (routed to dim_contactos)
  'lista_negra': '_DIM_CONTACTO_lista_negra',
  'fecha_lista_negra': '_DIM_CONTACTO_fecha_lista_negra',
  'motivo_lista_negra': '_DIM_CONTACTO_motivo_lista_negra'
};

var DEAL_FIELD_MAP = {
  'Status de Venta': 'status_venta', 'Proyeccion': 'proyeccion',
  'Monto de proyección': 'monto_proyeccion', 'Monto de Apartado': 'monto_apartado',
  'Monto de cierre': 'monto_cierre', 'Fecha de Cierre': 'fecha_cierre',
  'Descuento': 'descuento_pct', 'Notas Vendedor': 'notas_vendedor',
  // NOTE: 'Notas' is intentionally NOT mapped here — SDR notes live in fact_leads only
  '¿Por qué perdimos la venta?': 'razon_perdida',
  '¿Es recompra?': 'es_recompra', '¿Es cliente activo?': 'es_cliente_activo',
  'Producto de Cierre': 'producto_cierre', 'Fuente de origen': 'fuente_origen',
  'Tipo de Transacción': 'tipo_transaccion',
  'Monto de Cotización': 'monto_cotizacion', 'Fecha de Cotización': 'fecha_cotizacion', 'Notas de Cotización': 'notas_cotizacion',
  'Razón Pérdida Otra': 'razon_perdida_otra',
  '1 Year Mem': 'precio_1_year', '2 Year Mem': 'precio_2_year',
  // Contact fields route to dim_contactos
  'Nombre': '_DIM_CONTACTO_nombre', 'Apellido': '_DIM_CONTACTO_apellido',
  'Email': '_DIM_CONTACTO_email', 'Teléfono': '_DIM_CONTACTO_telefono_1',
  'empresa': '_DIM_CONTACTO_empresa',
  // Calificación BANT fields routed to fact_calificacion (via id_deal)
  '¿Entendió la información de Marketing?': '_FACT_CALIFICACION_entendio_info_marketing',
  '¿Mostró Interés genuino?': '_FACT_CALIFICACION_mostro_interes_genuino',
  '¿Cuál es tu necesidad puntual?': '_FACT_CALIFICACION_necesidad_puntual',
  '¿El perfil del prospecto es el adecuado?': '_FACT_CALIFICACION_perfil_adecuado',
  '¿Necesitas tocar base con alguién para decidir la compra?': '_FACT_CALIFICACION_necesita_decision_tercero',
  '¿Tienes presupuesto asignado para este proyecto, en este año?': '_FACT_CALIFICACION_tiene_presupuesto',
  '¿Cuánto?': '_FACT_CALIFICACION_monto_presupuesto',
  'Modo Presupuesto': '_FACT_CALIFICACION_modo_presupuesto',
  'Presupuesto Rango Alto': '_FACT_CALIFICACION_presupuesto_rango_alto',
  '¿han sido parte de alguna asociación de la industria?': '_FACT_CALIFICACION_asociacion_industria',
  'Pricing Tier': '_FACT_CALIFICACION_pricing_tier',
  '¿Cual es su región?': '_FACT_CALIFICACION_region',
  '¿Que tipo de membresía es?': '_FACT_CALIFICACION_tipo_membresia',
  // Phase 1.4: AE assignment by ID
  'Vendedor Asignado para Seguimiento': 'id_vendedor_ae',
  // AE-exclusive fields
  'Toque': 'toque_ae',
  'Numero de toque': 'numero_toque_ae',
  'Fecha de primer contacto AE': 'fecha_primer_contacto_ae',
  // Phase v3.2: ventas_contacto_cliente is now auto-derived from AE toques — removed from writable map
  // '¿Ventas Contactó Cliente?': 'ventas_contacto_cliente',
  'Fecha de Reagenda': 'fecha_reagenda',
  'Hora de Reagenda': 'hora_reagenda',
  'Index': 'index_ae',
  'Cross Selling?': 'cross_selling',
  'Producto de Recompra': 'producto_recompra',
  'Valor de recompra': 'valor_recompra',
  'Fecha de recompra': 'fecha_recompra',
  'Link de Pago': 'link_pago',
  'Renovación': 'renovacion',
  'Soporte de pago': 'soporte_pago',
  'Comprobante de Pago URL': 'comprobante_pago_url',
  'Deal Code': 'deal_code',
  // Prueba flag (in fact_deals)
  'es_prueba': 'es_prueba',
  // Lista Negra (routed to dim_contactos)
  'lista_negra': '_DIM_CONTACTO_lista_negra',
  'fecha_lista_negra': '_DIM_CONTACTO_fecha_lista_negra',
  'motivo_lista_negra': '_DIM_CONTACTO_motivo_lista_negra'
};

function updateLeadField(rowNumber, colIdentifier, newValue, isDeal, callerEmail) {
  var lock = LockService.getScriptLock();
  var result = { updated: false, triggers: [] };
  var _user = callerEmail || Session.getActiveUser().getEmail() || 'API';
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
        var contactData; contactData = safeReadAll_(contactSheet);
        var contactIdCol = contactColMap['id_contacto'] || 1;
        for (var ci = 1; ci < contactData.length; ci++) {
          if (String(contactData[ci][contactIdCol - 1]) === String(idContacto)) {
            var targetCol = contactColMap[dimColName];
            if (targetCol) {
              var oldVal = contactSheet.getRange(ci + 1, targetCol).getValue();
              contactSheet.getRange(ci + 1, targetCol).setValue(newValue);
              logChange_(isDeal ? 'Deal' : 'Lead', sheet.getRange(rowNumber, colMap[isDeal ? 'id_deal' : 'id_lead'] || 1).getValue(),
                _user, fieldName, oldVal, newValue);
            }
            break;
          }
        }
      }
      result.updated = true;
    } else if (dbCol && dbCol.indexOf('_FACT_CALIFICACION_') === 0) {
      // Phase 1.7: Write to fact_calificacion
      var calColName = dbCol.replace('_FACT_CALIFICACION_', '');
      var calSheet = ss.getSheetByName(T_CALIFICACION);
      if (calSheet) {
        var calColMap = getColumnMap_(calSheet);
        var calData; calData = safeReadAll_(calSheet);
        var idLeadCol = colMap['id_lead'] || 1;
        var idLead = sheet.getRange(rowNumber, idLeadCol).getValue();
        var calIdLeadCol = calColMap['id_lead'] || 2;
        var calRowFound = false;
        // Phase 1.9: Update ALL matching rows (not just first) to handle duplicates
        for (var calIdx = 1; calIdx < calData.length; calIdx++) {
          if (String(calData[calIdx][calIdLeadCol - 1]) === String(idLead)) {
            var calTargetCol = calColMap[calColName];
            if (calTargetCol) {
              var oldCalVal = calSheet.getRange(calIdx + 1, calTargetCol).getValue();
              calSheet.getRange(calIdx + 1, calTargetCol).setValue(newValue);
              logChange_('Lead', idLead, _user, fieldName, oldCalVal, newValue);
            }
            calRowFound = true;
            // NO break — update ALL duplicates for consistency
          }
        }
        if (!calRowFound && idLead) {
          // Phase 1.9: Dynamic column placement using calColMap
          var calHeaders = calData[0] || [];
          var newCalRow = [];
          for (var h = 0; h < calHeaders.length; h++) newCalRow.push('');
          // Place id_lead at its exact column
          if (calColMap['id_lead']) newCalRow[calColMap['id_lead'] - 1] = idLead;
          // Place the field value at its exact column
          if (calColMap[calColName]) newCalRow[calColMap[calColName] - 1] = newValue;
          // Place fecha_calificacion if column exists
          if (calColMap['fecha_calificacion']) {
            newCalRow[calColMap['fecha_calificacion'] - 1] = new Date().toISOString();
          }
          calSheet.appendRow(newCalRow);
          logChange_('Lead', idLead, _user, fieldName, '', newValue);
        }
        result.updated = true;

        // 6.4 Auto-calculate calidad_contacto from BANT score after any BANT field update
        SpreadsheetApp.flush(); // commit calificacion write before re-reading for score
        var bantScore = calcBANTScore_(calSheet, idLead);
        var leadsSheet = ss.getSheetByName(T_LEADS);
        if (leadsSheet) {
          var leadsColMap = getColumnMap_(leadsSheet);
          var leadsData; leadsData = safeReadAll_(leadsSheet);
          var leadsIdCol = leadsColMap['id_lead'] || 1;
          var calidadCol = leadsColMap['calidad_contacto'];
          if (calidadCol) {
            for (var li = 1; li < leadsData.length; li++) {
              if (String(leadsData[li][leadsIdCol - 1]) === String(idLead)) {
                var scoreToWrite = bantScore || 'Sin Calificar';
                leadsSheet.getRange(li + 1, calidadCol).setValue(scoreToWrite);
                result.calidadContacto = scoreToWrite; // send back to frontend
                break;
              }
            }
          }
        }
      }
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
          _user, fieldName, oldValue, newValue);

        // Run triggers
        if (!isDeal) {
          result.triggers = processLeadTriggers_(ss, sheet, rowNumber, fieldName, newValue, colMap, entityId);
        }
      }
    } else if (fieldName.indexOf('_c_') === 0) {
      // Phase 3B: Dynamic routing to dim_contactos via prefix — write directly
      var dcColName = fieldName.substring(3);
      var dcIdContactoCol = colMap['id_contacto'];
      var dcIdContacto = dcIdContactoCol ? sheet.getRange(rowNumber, dcIdContactoCol).getValue() : null;
      if (dcIdContacto) {
        var dcSheet = ss.getSheetByName(T_CONTACTOS);
        if (dcSheet) {
          var dcColMap = getColumnMap_(dcSheet);
          var dcData; dcData = safeReadAll_(dcSheet);
          var dcIdCol = dcColMap['id_contacto'] || 1;
          for (var dci = 1; dci < dcData.length; dci++) {
            if (String(dcData[dci][dcIdCol - 1]) === String(dcIdContacto)) {
              var dcTargetCol = dcColMap[dcColName];
              if (dcTargetCol) {
                dcSheet.getRange(dci + 1, dcTargetCol).setValue(newValue);
                result.updated = true;
              }
              break;
            }
          }
        }
      }
    } else if (fieldName.indexOf('_q_') === 0) {
      // Phase 3B: Dynamic routing to fact_calificacion via prefix — write directly
      var dqColName = fieldName.substring(3);
      var dqCalSheet = ss.getSheetByName(T_CALIFICACION);
      if (dqCalSheet) {
        var dqColMap = getColumnMap_(dqCalSheet);
        var dqData; dqData = safeReadAll_(dqCalSheet);
        var dqIdLeadCol = colMap['id_lead'] || 1;
        var dqIdLead = sheet.getRange(rowNumber, dqIdLeadCol).getValue();
        var dqCalIdCol = dqColMap['id_lead'] || 2;
        for (var dqi = 1; dqi < dqData.length; dqi++) {
          if (String(dqData[dqi][dqCalIdCol - 1]) === String(dqIdLead)) {
            var dqTargetCol = dqColMap[dqColName];
            if (dqTargetCol) {
              dqCalSheet.getRange(dqi + 1, dqTargetCol).setValue(newValue);
              result.updated = true;
            }
            break;
          }
        }
      }
    } else if (fieldName.indexOf('_camp_') === 0) {
      // Phase 3B: dim_campanas is read-only — skip silently
    } else {
      // Try direct column match on fact table
      var directCol = colMap[fieldName];
      if (directCol) {
        var oldVal2 = sheet.getRange(rowNumber, directCol).getValue();
        var idCol2 = colMap[isDeal ? 'id_deal' : 'id_lead'] || 1;
        var entityId2 = sheet.getRange(rowNumber, idCol2).getValue();
        sheet.getRange(rowNumber, directCol).setValue(newValue);
        result.updated = true;
        logChange_(isDeal ? 'Deal' : 'Lead', entityId2,
          _user, fieldName, oldVal2, newValue);
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

function updateLeadMultiple(rowNumber, updates, isDeal, callerEmail) {
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
    var user = callerEmail || Session.getActiveUser().getEmail() || 'API';
    var entidad = isDeal ? 'Deal' : 'Lead';

    // Collect updates for dimensional tables
    var contactUpdates = {};
    var calificacionUpdates = {};
    var idContacto = null;
    var contactoIdCol = colMap['id_contacto'];
    if (contactoIdCol) idContacto = sheet.getRange(rowNumber, contactoIdCol).getValue();

    // ── Deferred triggers: collect trigger-worthy field changes, execute AFTER all writes ──
    var pendingTriggers = [];

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
            pendingTriggers.push({ fieldName: fieldName, newValue: newValue });
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
      var contactData; contactData = safeReadAll_(contactSheet);
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

    // Write calificacion updates to fact_calificacion (SSOT via id_lead — works for both Leads and Deals)
    if (Object.keys(calificacionUpdates).length > 0) {
      var calSheet = ss.getSheetByName(T_CALIFICACION);
      if (calSheet) {
        var calColMap = getColumnMap_(calSheet);
        var calData; calData = safeReadAll_(calSheet);
        var calRowFound = false;
        var idLead = sheet.getRange(rowNumber, colMap['id_lead'] || 1).getValue();
        if (idLead) {
          var calIdLeadCol = calColMap['id_lead'] || 2;
          // Phase 1.9: Update ALL matching rows (not just first) to handle duplicates
          for (var calIdx = 1; calIdx < calData.length; calIdx++) {
            if (String(calData[calIdx][calIdLeadCol - 1]) === String(idLead)) {
              calRowFound = true;
              for (var calCol in calificacionUpdates) {
                var calTCol = calColMap[calCol];
                if (calTCol) {
                  var oldCalVal = calSheet.getRange(calIdx + 1, calTCol).getValue();
                  calSheet.getRange(calIdx + 1, calTCol).setValue(calificacionUpdates[calCol].value);
                  logChange_('Lead', entityId, user, calificacionUpdates[calCol].field, oldCalVal, calificacionUpdates[calCol].value);
                }
              }
              // NO break — update ALL duplicates so getLeads reads consistent data
            }
          }
          if (!calRowFound) {
            // Phase 1.9: Dynamic column placement using calColMap
            var calHeaders = calData[0] || [];
            var newCalRow = [];
            for (var h = 0; h < calHeaders.length; h++) newCalRow.push('');
            // Place id_lead at its exact column
            if (calColMap['id_lead']) newCalRow[calColMap['id_lead'] - 1] = idLead;
            // Place each BANT field at its exact column
            for (var calFld in calificacionUpdates) {
              if (calColMap[calFld]) {
                newCalRow[calColMap[calFld] - 1] = calificacionUpdates[calFld].value;
              }
            }
            // Place fecha_calificacion if column exists
            if (calColMap['fecha_calificacion']) {
              newCalRow[calColMap['fecha_calificacion'] - 1] = new Date().toISOString();
            }
            calSheet.appendRow(newCalRow);
            for (var calLog in calificacionUpdates) {
              logChange_('Lead', entityId, user, calificacionUpdates[calLog].field, '', calificacionUpdates[calLog].value);
            }
          }

          // 6.4 Auto-calculate calidad_contacto from BANT score after any BANT update
          SpreadsheetApp.flush();
          var bantScore = calcBANTScore_(calSheet, idLead);
          var leadsSheet2 = ss.getSheetByName(T_LEADS);
          if (leadsSheet2) {
            var leadsColMap2 = getColumnMap_(leadsSheet2);
            var leadsData2 = safeReadAll_(leadsSheet2);
            var leadsIdCol2 = leadsColMap2['id_lead'] || 1;
            var calidadCol2 = leadsColMap2['calidad_contacto'];
            if (calidadCol2) {
              for (var li2 = 1; li2 < leadsData2.length; li2++) {
                if (String(leadsData2[li2][leadsIdCol2 - 1]) === String(idLead)) {
                  var scoreToWrite2 = bantScore || 'Sin Calificar';
                  leadsSheet2.getRange(li2 + 1, calidadCol2).setValue(scoreToWrite2);
                  result.calidadContacto = scoreToWrite2;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // ── Execute deferred triggers AFTER all writes are complete ──
    if (!isDeal && pendingTriggers.length > 0) {
      for (var pt = 0; pt < pendingTriggers.length; pt++) {
        try {
          var trigs = processLeadTriggers_(ss, sheet, rowNumber, pendingTriggers[pt].fieldName, pendingTriggers[pt].newValue, colMap, entityId);
          result.triggers = result.triggers.concat(trigs);
        } catch (te) { result.triggerError = (result.triggerError || '') + ' | ' + te.message; }
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

// ============ TOQUE REGISTRATION (Relational) ============

/**
 * Registers a toque (touch) in fact_toques sheet.
 * Called atomically from frontend when SDR/AE changes toque dropdown.
 */
function registrarToque(idEntidad, tipoEntidad, idVendedor, rolVendedor, numeroToque, canal) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_TOQUES);
    if (!sheet) throw new Error('Hoja fact_toques no encontrada');

    // TOQUE-02: Monotonic increment — reject if new toque <= current max
    var colMap = getColumnMap_(sheet);
    var entidadCol = colMap['id_entidad'];
    var toqueCol = colMap['numero_toque'];
    if (entidadCol && toqueCol) {
      var data;
      data = safeReadAll_(sheet);
      var maxToque = 0;
      for (var r = 1; r < data.length; r++) {
        if (String(data[r][entidadCol - 1]) === String(idEntidad)) {
          var t = Number(data[r][toqueCol - 1]) || 0;
          if (t > maxToque) maxToque = t;
        }
      }
      if (Number(numeroToque) <= maxToque) {
        return { success: false, error: 'No se puede registrar toque #' + numeroToque + '. El toque actual es #' + maxToque + '. Solo se permite avanzar.' };
      }
    }

    var nextId = getNextId_(sheet, 'id_registro_toque');
    var fechaToque = new Date().toISOString();
    sheet.appendRow([nextId, idEntidad, tipoEntidad, idVendedor, rolVendedor, numeroToque, fechaToque, canal || '', '']);

    // Write-back: Update numero_toques and fecha_ultimo_contacto in the source sheet
    try {
      if (tipoEntidad === 'Deal') {
        var wbSheet = ss.getSheetByName(T_DEALS);
        if (wbSheet) {
          var wbColMap = getColumnMap_(wbSheet);
          var wbIdCol = wbColMap['id_deal'];
          var wbNtCol = wbColMap['numero_toque_ae'];
          if (wbIdCol && wbNtCol) {
            var wbData; wbData = safeReadAll_(wbSheet);
            for (var wr = 1; wr < wbData.length; wr++) {
              if (String(wbData[wr][wbIdCol - 1]) === String(idEntidad)) {
                wbSheet.getRange(wr + 1, wbNtCol).setValue(numeroToque);
                break;
              }
            }
          }
        }
      } else {
        var wbSheet2 = ss.getSheetByName(T_LEADS);
        if (wbSheet2) {
          var wbColMap2 = getColumnMap_(wbSheet2);
          var wbIdCol2 = wbColMap2['id_lead'];
          var wbNtCol2 = wbColMap2['numero_toques'];
          var wbFucCol2 = wbColMap2['fecha_ultimo_contacto'];
          if (wbIdCol2) {
            var wbData2 = safeReadAll_(wbSheet2);
            for (var wr2 = 1; wr2 < wbData2.length; wr2++) {
              if (String(wbData2[wr2][wbIdCol2 - 1]) === String(idEntidad)) {
                if (wbNtCol2) wbSheet2.getRange(wr2 + 1, wbNtCol2).setValue(numeroToque);
                if (wbFucCol2) wbSheet2.getRange(wr2 + 1, wbFucCol2).setValue(fechaToque);
                break;
              }
            }
          }
        }
      }
    } catch (wbErr) { Logger.log('registrarToque write-back: ' + wbErr.message); }

    // Phase v3.2: Cache-write ventas_contacto_cliente when AE records first toque
    if (String(rolVendedor).toUpperCase() === 'AE') {
      try {
        var dealsSheet = ss.getSheetByName(T_DEALS);
        if (dealsSheet) {
          var dColMap = getColumnMap_(dealsSheet);
          var dData; dData = safeReadAll_(dealsSheet);
          var idCol = dColMap['id_deal'];
          var vcCol = dColMap['ventas_contacto_cliente'];
          if (idCol && vcCol) {
            for (var dr = 1; dr < dData.length; dr++) {
              if (String(dData[dr][idCol - 1]) === String(idEntidad)) {
                dealsSheet.getRange(dr + 1, vcCol).setValue('Si');
                break;
              }
            }
          }
        }
      } catch (cacheErr) { Logger.log('ventas_contacto cache-write: ' + cacheErr.message); }
    }

    return { success: true, id: nextId, fecha: fechaToque };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
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

  // ── Phase 1.5: Check for existing Deal — soft-update instead of blocking ──
  var dealsColMap = getColumnMap_(dealsSheet);
  var idLeadCol = dealsColMap['id_lead'];
  if (idLeadCol) {
    var lastRow = dealsSheet.getLastRow();
    if (lastRow > 1) {
      var existingIds = dealsSheet.getRange(2, idLeadCol, lastRow - 1, 1).getDisplayValues();
      for (var e = 0; e < existingIds.length; e++) {
        if (String(existingIds[e][0]) === String(leadId)) {
          // ── Soft-Update: Reactivate existing Deal instead of creating duplicate ──
          var existingDealRow = e + 2; // +2 because: 0-indexed array + header row
          Logger.log('copyLeadToDeals_: Lead ID ' + leadId + ' already has Deal. Reactivating row ' + existingDealRow);

          // Reset status_venta to initial catalog value
          var allCatalogs = getCatalogs();
          var resetStatus = (allCatalogs['Status de Venta'] || [])[0] || 'Recien llegado';
          var statusCol = dealsColMap['status_venta'];
          if (statusCol) dealsSheet.getRange(existingDealRow, statusCol).setValue(resetStatus);

          // Get existing Deal ID for logging
          var dealIdCol = dealsColMap['id_deal'];
          var existingDealId = dealIdCol ? dealsSheet.getRange(existingDealRow, dealIdCol).getValue() : '';

          // Log the reactivation event
          var user = Session.getActiveUser().getEmail() || 'System';
          logChange_('Deal', existingDealId, user, 'Reactivación', '', 'Lead #' + leadId + ' re-enviado a ventas por SDR');

          // Register interaction in fact_interacciones
          try {
            var interSheet = ss.getSheetByName(T_INTERACCIONES);
            if (interSheet) {
              var nextInterId = getNextId_(interSheet, 'id_interaccion');
              interSheet.appendRow([nextInterId, leadId, existingDealId, '', 'Reactivación', 'Lead re-enviado a ventas', '', new Date(), '', '']);
            }
          } catch (interErr) {
            Logger.log('Error logging reactivation interaction: ' + interErr.message);
          }

          return { success: true, reactivated: true, dealRow: existingDealRow, leadId: leadId, dealId: existingDealId };
        }
      }
    }
  }

  // ── Extract ALL lead data to transfer to the Deal ──
  var idContactoCol = leadsColMap['id_contacto'];
  var idContacto = idContactoCol ? leadsSheet.getRange(row, idContactoCol).getValue() : '';
  var notasCol = leadsColMap['notas'];
  var leadNotas = notasCol ? leadsSheet.getRange(row, notasCol).getValue() : '';
  var servicioCol = leadsColMap['servicio_interes'];
  var leadServicio = servicioCol ? leadsSheet.getRange(row, servicioCol).getValue() : '';
  var calidadCol = leadsColMap['calidad_contacto'];
  var leadCalidad = calidadCol ? leadsSheet.getRange(row, calidadCol).getValue() : '';
  var sdrCol = leadsColMap['id_vendedor_sdr'];
  var leadSdrId = sdrCol ? leadsSheet.getRange(row, sdrCol).getValue() : '';

  // Get initial status from catalogs
  var allCatalogs = getCatalogs();
  var statusVenta = (allCatalogs['Status de Venta'] || [])[0] || 'Recien llegado';

  // Build new deal row
  var nextDealId = getNextId_(dealsSheet, 'id_deal');
  var headers = dealsSheet.getRange(1, 1, 1, dealsSheet.getLastColumn()).getDisplayValues()[0];
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
  // ── Clone SDR information into Deal fields ──
  colSet('notas_vendedor', leadNotas);         // Transfer SDR notes so AE sees them immediately
  colSet('fuente_origen', leadServicio);        // Preserve service interest as origin

  var insertRow = getFirstEmptyRow_(dealsSheet, 'id_deal');
  var dealInsertTarget = dealsSheet.getRange(insertRow, 1, 1, newRow.length);
  dealInsertTarget.clearFormat();
  dealInsertTarget.setValues([newRow]);

  var user = Session.getActiveUser().getEmail() || 'System';
  logChange_('Lead', leadId, user, 'Paso a Ventas', '', 'Deal creado');
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

// ============ PARAM-01: Save Custom Question Responses ============
function saveCustomResponses(idLead, responses) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var calSheet = ss.getSheetByName(T_CALIFICACION);
    if (!calSheet) return { status: 'error', message: 'Hoja no encontrada' };
    var colMap = getColumnMap_(calSheet);
    var respCol = colMap['respuestas_custom'];
    if (!respCol) return { status: 'error', message: 'Columna respuestas_custom no encontrada' };
    var data; data = safeReadAll_(calSheet);
    var idCol = colMap['id_lead'] || 2;
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol - 1]) === String(idLead)) {
        calSheet.getRange(i + 1, respCol).setValue(JSON.stringify(responses));
        found = true;
      }
    }
    if (!found) return { status: 'error', message: 'Lead no encontrado en fact_calificacion' };
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

// ============ DUP-01: Duplicate Lead Detection ============

/**
 * Busca un contacto existente por email, teléfono, o nombre+apellido.
 * Reutilizable desde checkDuplicateLeads, createNewLeadOrDeal y procesarLeadsLanding.
 * @param {Array} contactos — array de objetos de readTable_(T_CONTACTOS)
 * @param {string} email
 * @param {string} phone
 * @param {string} nombre
 * @param {string} apellido
 * @returns {{ found: boolean, contacto: object|null, matchType: string }}
 */
function findExistingContact_(contactos, email, phone, nombre, apellido) {
  var emailNorm = String(email || '').trim().toLowerCase();
  var telNorm = String(phone || '').replace(/\D/g, '');
  var nombreNorm = String(nombre || '').trim().toLowerCase();
  var apellidoNorm = String(apellido || '').trim().toLowerCase();

  for (var i = 0; i < contactos.length; i++) {
    var c = contactos[i];
    var rEmail = String(c.email || '').trim().toLowerCase();
    var rTel1 = String(c.telefono_1 || '').replace(/\D/g, '');
    var rTel2 = String(c.telefono_2 || '').replace(/\D/g, '');
    var rNombre = String(c.nombre || '').trim().toLowerCase();
    var rApellido = String(c.apellido || '').trim().toLowerCase();

    if (emailNorm && rEmail && emailNorm === rEmail)
      return { found: true, contacto: c, matchType: 'Email' };
    if (telNorm && telNorm.length >= 7 && (telNorm === rTel1 || telNorm === rTel2))
      return { found: true, contacto: c, matchType: 'Teléfono' };
    if (nombreNorm && apellidoNorm && rNombre && rApellido && nombreNorm === rNombre && apellidoNorm === rApellido)
      return { found: true, contacto: c, matchType: 'Nombre+Apellido' };
  }
  return { found: false, contacto: null, matchType: '' };
}

/**
 * Encuentra el primer lead no-duplicado para un contacto (para id_lead_original).
 */
function findFirstLeadForContact_(leads, idContacto) {
  var cid = String(idContacto);
  for (var i = 0; i < leads.length; i++) {
    if (String(leads[i].id_contacto) === cid && leads[i].status !== 'Duplicado') return leads[i].id_lead;
  }
  // Fallback: any lead
  for (var j = 0; j < leads.length; j++) {
    if (String(leads[j].id_contacto) === cid) return leads[j].id_lead;
  }
  return '';
}

function checkDuplicateLeads(email, telefono, nombre, apellido) {
  try {
    var contactos = readTable_(T_CONTACTOS);
    var leads = readTable_(T_LEADS);
    var contactoLeadIdx = {};
    for (var li = 0; li < leads.length; li++) {
      var ld = leads[li];
      var cid = String(ld.id_contacto || '');
      if (cid && !contactoLeadIdx[cid]) contactoLeadIdx[cid] = ld;
    }

    var matches = [];
    var emailNorm = String(email || '').trim().toLowerCase();
    var telNorm = String(telefono || '').replace(/\D/g, '');
    var nombreNorm = String(nombre || '').trim().toLowerCase();
    var apellidoNorm = String(apellido || '').trim().toLowerCase();

    for (var i = 0; i < contactos.length; i++) {
      var c = contactos[i];
      var rEmail = String(c.email || '').trim().toLowerCase();
      var rTel1 = String(c.telefono_1 || '').replace(/\D/g, '');
      var rTel2 = String(c.telefono_2 || '').replace(/\D/g, '');
      var rNombre = String(c.nombre || '').trim().toLowerCase();
      var rApellido = String(c.apellido || '').trim().toLowerCase();
      var matchType = '';
      if (emailNorm && rEmail && emailNorm === rEmail) matchType = 'Email';
      else if (telNorm && telNorm.length >= 7 && (telNorm === rTel1 || telNorm === rTel2)) matchType = 'Teléfono';
      else if (nombreNorm && apellidoNorm && rNombre && rApellido && nombreNorm === rNombre && apellidoNorm === rApellido) matchType = 'Nombre+Apellido';
      if (matchType) {
        var linkedLead = contactoLeadIdx[String(c.id_contacto || '')];
        var isBlacklisted = c.lista_negra === 'TRUE' || c.lista_negra === true;
        matches.push({
          id: linkedLead ? linkedLead.id_lead : '',
          id_contacto: c.id_contacto,
          nombre: ((c.nombre || '') + ' ' + (c.apellido || '')).trim(),
          email: c.email || '',
          telefono: c.telefono_1 || '',
          status: linkedLead ? (linkedLead.status || '') : '',
          matchType: matchType,
          listaNegra: isBlacklisted
        });
        if (matches.length >= 5) break;
      }
    }
    return { found: matches.length > 0, matches: matches };
  } catch (e) {
    Logger.log('checkDuplicateLeads ERROR: ' + e.message);
    return { found: false };
  }
}

function createNewLeadOrDeal(payload, type, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return { status: 'error', message: 'Sistema ocupado, intenta de nuevo en unos segundos.' };
  }
  try {
    var isDeal = (type === 'deal');
    var ss = SpreadsheetApp.openById(SHEET_ID);

    if (isDeal) {
      var dealsSheet = ss.getSheetByName(T_DEALS);
      if (!dealsSheet) return { status: 'error', message: 'fact_deals no encontrada' };
      var colMap = getColumnMap_(dealsSheet);
      var newId = getNextId_(dealsSheet, 'id_deal');
      var headers = dealsSheet.getRange(1, 1, 1, dealsSheet.getLastColumn()).getDisplayValues()[0];
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
      var dealTarget = dealsSheet.getRange(insertRow, 1, 1, newRow.length);
      dealTarget.clearFormat();
      dealTarget.setValues([newRow]);
      logChange_('Deal', newId, callerEmail || Session.getActiveUser().getEmail() || 'System', 'CREACIÓN MANUAL', '', 'Nuevo deal');
      return { status: 'success', data: { id: newId } };
    } else {
      // ── STEP 1: Find existing contact or create new one ──
      var contactSheet = ss.getSheetByName(T_CONTACTOS);
      if (!contactSheet) return { status: 'error', message: 'Hoja dim_contactos no encontrada' };

      var contactColMap, newContactId, cHeaders, cRow, cInsertRow;
      try { contactColMap = getColumnMap_(contactSheet); } catch (e1) { return { status: 'error', message: '[S1-colMap] ' + e1.message }; }

      var existingContactos = readTable_(T_CONTACTOS);

      if (payload['_linkedContactId']) {
        // Explicit contact link from UI picker
        newContactId = payload['_linkedContactId'];
        var linkedC = null;
        for (var lci = 0; lci < existingContactos.length; lci++) {
          if (String(existingContactos[lci].id_contacto) === String(newContactId)) { linkedC = existingContactos[lci]; break; }
        }
        if (linkedC && (linkedC.lista_negra === 'TRUE' || linkedC.lista_negra === true)) {
          return { status: 'error', message: 'Este contacto está en la Lista Negra y no puede recibir nuevas fichas.' };
        }
        // Check if this contact already has leads (mark as duplicate)
        var existingLeadsForLink = readTable_(T_LEADS);
        var firstLeadForLink = findFirstLeadForContact_(existingLeadsForLink, newContactId);
        if (firstLeadForLink) {
          payload['_isDuplicate'] = true;
          payload['_idLeadOriginal'] = firstLeadForLink;
        }
      } else {
        // Smart duplicate detection: search for existing contact
        var matchResult = findExistingContact_(existingContactos,
          payload['Email'] || '', payload['Teléfono'] || '', payload['Nombre'] || '', payload['Apellido'] || '');

        if (matchResult.found && matchResult.contacto) {
          // Check if contact is blacklisted
          if (matchResult.contacto.lista_negra === 'TRUE' || matchResult.contacto.lista_negra === true) {
            return { status: 'error', message: 'Este contacto está en la Lista Negra y no puede recibir nuevas fichas.' };
          }
          // Reuse existing contact
          newContactId = matchResult.contacto.id_contacto;
          // Force duplicate flag if not already set
          if (!payload['_isDuplicate']) {
            payload['_isDuplicate'] = true;
            var existingLeads = readTable_(T_LEADS);
            payload['_idLeadOriginal'] = findFirstLeadForContact_(existingLeads, newContactId) || '';
          }
        } else {
        // Create new contact
        try { newContactId = parseInt(getNextId_(contactSheet, 'id_contacto'), 10) || 1; } catch (e2) { return { status: 'error', message: '[S1-nextId] ' + e2.message }; }
        try { cHeaders = contactSheet.getRange(1, 1, 1, contactSheet.getLastColumn()).getDisplayValues()[0]; } catch (e3) { return { status: 'error', message: '[S1-headers] ' + e3.message }; }

        cRow = new Array(cHeaders.length).fill('');
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

        try { cInsertRow = getFirstEmptyRow_(contactSheet, 'id_contacto'); } catch (e4) { return { status: 'error', message: '[S1-emptyRow] ' + e4.message }; }

        try {
          var cTarget = contactSheet.getRange(cInsertRow, 1, 1, cRow.length);
          cTarget.clearFormat();
          cTarget.setValues([cRow]);
        } catch (contactErr) {
          return { status: 'error', message: '[S1-insert row=' + cInsertRow + ' cols=' + cRow.length + ' id=' + newContactId + '] ' + contactErr.message };
        }
      } // end else (create new contact)
      } // end else (no explicit _linkedContactId)

      // ── STEP 2: Create lead ──
      var leadsSheet = ss.getSheetByName(T_LEADS);
      if (!leadsSheet) return { status: 'error', message: 'Hoja fact_leads no encontrada' };
      var leadColMap, newLeadId;
      try { leadColMap = getColumnMap_(leadsSheet); } catch (e5) { return { status: 'error', message: '[S2-colMap] ' + e5.message }; }
      try { newLeadId = parseInt(getNextId_(leadsSheet, 'id_lead'), 10) || 1; } catch (e6) { return { status: 'error', message: '[S2-nextId] ' + e6.message }; }
      var lHeaders = leadsSheet.getRange(1, 1, 1, leadsSheet.getLastColumn()).getDisplayValues()[0];
      var lRow = new Array(lHeaders.length).fill('');
      var lSet = function (n, v) { var c = leadColMap[n]; if (c) lRow[c - 1] = v; };
      lSet('id_lead', newLeadId);
      lSet('id_contacto', newContactId);
      // Set campaign to "Manual" for manually created leads
      try {
        var campanasSheet = ss.getSheetByName(T_CAMPANAS);
        if (campanasSheet) {
          var manualCampId = getOrCreateCampana_(campanasSheet, 'Manual', 'CRM', 'Manual');
          lSet('id_campana', manualCampId);
        }
      } catch (campErr) { Logger.log('Manual campaign error: ' + campErr.message); }
      // Phase 21: If duplicate info provided, set status and FK link
      if (payload['_isDuplicate'] && payload['_idLeadOriginal']) {
        lSet('status', 'Duplicado');
        lSet('id_lead_original', payload['_idLeadOriginal']);
      } else {
        lSet('status', payload['Status'] || 'Nuevo');
      }
      lSet('calidad_contacto', payload['Calidad de Contacto'] || '');
      lSet('servicio_interes', payload['Servicio'] || '');
      lSet('fecha_ingreso', new Date());
      lSet('notas', payload['Notas'] || '');
      lSet('tipo_seguimiento', payload['Tipo de Seguimiento'] || '');
      lSet('status_seguimiento', payload['Status del Seguimiento'] || '');
      lSet('id_vendedor_sdr', payload['Vendedor asignado (SDR)'] || '');
      lSet('razon_perdida', payload['Razón de pérdida'] || '');
      // Phase 8: Write global pricing config to new lead
      var newLeadPricingCfg = getPricingConfig();
      var _firstProd = (newLeadPricingCfg.productos && newLeadPricingCfg.productos.length > 0) ? newLeadPricingCfg.productos[0] : null;
      lSet('tipo_cliente_pricing', newLeadPricingCfg.tipoCliente || '');
      lSet('ticket_promedio', _firstProd ? (parseFloat(_firstProd.ticketPromedio) || 0) : 0);
      lSet('licencias', _firstProd ? (parseFloat(_firstProd.licenciasPromedio) || 0) : 0);
      var insertRow = getFirstEmptyRow_(leadsSheet, 'id_lead');
      try {
        var lTarget = leadsSheet.getRange(insertRow, 1, 1, lRow.length);
        lTarget.clearFormat();
        lTarget.setValues([lRow]);
      } catch (leadErr) {
        return { status: 'error', message: '[LEAD row=' + insertRow + ' cols=' + lRow.length + ' id=' + newLeadId + '] ' + leadErr.message };
      }
      logChange_('Lead', newLeadId, callerEmail || Session.getActiveUser().getEmail() || 'System', 'CREACIÓN MANUAL', '', 'Nuevo lead');
      return { status: 'success', data: { id: newLeadId, isDuplicate: !!payload['_isDuplicate'], originalId: payload['_idLeadOriginal'] || '' } };
    }
  } catch (err) {
    return { status: 'error', message: '[OUTER] ' + err.message };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// ============ API: DUPLICATE ANALYSIS ============

function analyzeAllDuplicates() {
  try {
    var contactos = readTable_(T_CONTACTOS);
    var leads = readTable_(T_LEADS);
    var deals = readTable_(T_DEALS);

    // Build lead/deal lists per contact
    var leadsByC = {}, dealsByC = {};
    for (var li = 0; li < leads.length; li++) {
      var lc = String(leads[li].id_contacto || '');
      if (!leadsByC[lc]) leadsByC[lc] = [];
      leadsByC[lc].push({ id: leads[li].id_lead, status: leads[li].status || '', fecha: leads[li].fecha_ingreso || '' });
    }
    for (var di = 0; di < deals.length; di++) {
      var dc2 = String(deals[di].id_contacto || '');
      if (!dealsByC[dc2]) dealsByC[dc2] = [];
      dealsByC[dc2].push({ id: deals[di].id_deal, status: deals[di].status_venta || '' });
    }

    // Group contacts by email / phone / nombre+apellido
    var groups = [];
    var assigned = {};

    for (var i = 0; i < contactos.length; i++) {
      var c = contactos[i];
      var cid = String(c.id_contacto || '');
      if (assigned[cid]) continue;

      var eNorm = String(c.email || '').trim().toLowerCase();
      var tNorm = String(c.telefono_1 || '').replace(/\D/g, '');
      var nNorm = String(c.nombre || '').trim().toLowerCase();
      var aNorm = String(c.apellido || '').trim().toLowerCase();

      var group = [c];
      assigned[cid] = true;

      for (var j = i + 1; j < contactos.length; j++) {
        var c2 = contactos[j];
        var cid2 = String(c2.id_contacto || '');
        if (assigned[cid2]) continue;

        var e2 = String(c2.email || '').trim().toLowerCase();
        var t2 = String(c2.telefono_1 || '').replace(/\D/g, '');
        var n2 = String(c2.nombre || '').trim().toLowerCase();
        var a2 = String(c2.apellido || '').trim().toLowerCase();

        var match = (eNorm && e2 && eNorm === e2) ||
                    (tNorm.length >= 7 && t2.length >= 7 && tNorm === t2) ||
                    (nNorm && aNorm && nNorm === n2 && aNorm === a2);

        if (match) {
          group.push(c2);
          assigned[cid2] = true;
        }
      }

      if (group.length > 1) {
        groups.push(group.map(function (gc) {
          var gcid = String(gc.id_contacto || '');
          return {
            id_contacto: gc.id_contacto, nombre: gc.nombre || '', apellido: gc.apellido || '',
            email: gc.email || '', telefono_1: gc.telefono_1 || '', empresa: gc.empresa || '',
            fecha_creacion: gc.fecha_creacion || '', lista_negra: gc.lista_negra || '',
            leads: leadsByC[gcid] || [], deals: dealsByC[gcid] || []
          };
        }));
      }
    }

    // Sort each group oldest → newest
    groups.forEach(function (g) {
      g.sort(function (a, b) { return new Date(a.fecha_creacion || 0) - new Date(b.fecha_creacion || 0); });
    });

    return JSON.stringify({ groups: groups, total: groups.length });
  } catch (e) {
    Logger.log('analyzeAllDuplicates ERROR: ' + e.message);
    return JSON.stringify({ groups: [], total: 0, error: e.message });
  }
}

// ============ PHANTOM DUPLICATE CLEANUP ============

/**
 * Scans fact_leads for "phantom" duplicate leads caused by the processor bug:
 * the same Framer row re-processed every 5 minutes because timestamps of
 * duplicate-contact submissions were not persisted between runs.
 *
 * Detection: groups leads by (id_contacto + fecha_ingreso). Within each group,
 * keeps the FIRST lead (lowest id_lead) and marks all subsequent leads with
 * status="Duplicado" as phantoms.
 *
 * @param {string} mode - 'preview' (default) or 'execute'
 * @return {string} JSON with { phantoms: [...], totalFound, totalCleaned, error? }
 */
function cleanPhantomDuplicates(mode) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return JSON.stringify({ error: 'Sistema ocupado, intenta de nuevo.' });
  }
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var leadsSheet = ss.getSheetByName(T_LEADS);
    var califSheet = ss.getSheetByName('fact_calificacion');
    if (!leadsSheet) return JSON.stringify({ error: 'fact_leads no encontrada' });

    var leads = readTable_(T_LEADS);
    var contactos = readTable_(T_CONTACTOS);
    var contactosIdx = indexBy_(contactos, 'id_contacto');

    // ── Group leads by (id_contacto, fecha_ingreso_normalized) ──
    var groups = {};
    for (var i = 0; i < leads.length; i++) {
      var ld = leads[i];
      var cid = String(ld.id_contacto || '').trim();
      var fecha = String(ld.fecha_ingreso || '').trim();
      if (!cid || !fecha) continue;

      // Normalize: try ISO, fall back to string
      var fechaNorm;
      try { fechaNorm = new Date(fecha).toISOString(); } catch (e) { fechaNorm = fecha; }

      var key = cid + '|' + fechaNorm;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ld);
    }

    // ── Identify phantoms ──
    var phantoms = [];
    var keys = Object.keys(groups);
    for (var k = 0; k < keys.length; k++) {
      var grp = groups[keys[k]];
      if (grp.length < 2) continue;

      // Sort by id_lead ascending (oldest first = keeper)
      grp.sort(function (a, b) { return Number(a.id_lead) - Number(b.id_lead); });

      // The first non-Duplicado lead is the keeper; if all are Duplicado, keep the first one
      var keeperIdx = 0;
      for (var g = 0; g < grp.length; g++) {
        if (String(grp[g].status || '').trim() !== 'Duplicado') { keeperIdx = g; break; }
      }

      for (var g2 = 0; g2 < grp.length; g2++) {
        if (g2 === keeperIdx) continue;
        // Only delete leads that are "Duplicado" — never touch active/working leads
        if (String(grp[g2].status || '').trim() !== 'Duplicado') continue;
        var contact = contactosIdx[String(grp[g2].id_contacto || '')] || {};
        phantoms.push({
          id_lead: grp[g2].id_lead,
          _row: grp[g2]._row,
          id_contacto: grp[g2].id_contacto,
          nombre: ((contact.nombre || '') + ' ' + (contact.apellido || '')).trim(),
          email: contact.email || '',
          fecha_ingreso: grp[g2].fecha_ingreso || '',
          keeper_id: grp[keeperIdx].id_lead
        });
      }
    }

    // Sort phantoms by _row DESCENDING (delete from bottom up to preserve row indices)
    phantoms.sort(function (a, b) { return b._row - a._row; });

    var totalFound = phantoms.length;
    var totalCleaned = 0;

    if (mode === 'execute' && totalFound > 0) {
      // Build set of phantom lead IDs for O(1) lookup
      var phantomIds = {};
      for (var p = 0; p < phantoms.length; p++) {
        phantomIds[String(phantoms[p].id_lead)] = true;
      }

      // ── BATCH STRATEGY: read all → filter → clear → rewrite ──
      // This is O(2) API calls (clear + setValues) instead of O(N) deleteRow calls.
      // Critical for 100+ phantoms to avoid the 6-minute GAS timeout.

      // 1. Rewrite fact_leads (keep non-phantom rows)
      var leadsAll = leadsSheet.getDataRange().getDisplayValues();
      var leadsHeader = leadsAll[0];
      var leadsKeep = [leadsHeader];
      for (var li = 1; li < leadsAll.length; li++) {
        var leadId = String(leadsAll[li][0] || '').trim();
        if (!phantomIds[leadId]) {
          leadsKeep.push(leadsAll[li]);
        } else {
          totalCleaned++;
        }
      }
      // Clear data rows (preserve header) and rewrite
      if (leadsAll.length > 1) {
        leadsSheet.getRange(2, 1, leadsAll.length - 1, leadsHeader.length).clearContent();
      }
      if (leadsKeep.length > 1) {
        leadsSheet.getRange(2, 1, leadsKeep.length - 1, leadsHeader.length)
          .setValues(leadsKeep.slice(1));
      }

      // 2. Rewrite fact_calificacion (keep non-phantom rows)
      if (califSheet) {
        var califAll = califSheet.getDataRange().getDisplayValues();
        if (califAll.length > 1) {
          var califHeader = califAll[0];
          // Find id_lead column index in calificacion
          var califLeadCol = -1;
          for (var ch = 0; ch < califHeader.length; ch++) {
            if (String(califHeader[ch]).trim().toLowerCase() === 'id_lead') { califLeadCol = ch; break; }
          }
          if (califLeadCol !== -1) {
            var califKeep = [califHeader];
            for (var ci = 1; ci < califAll.length; ci++) {
              var califLeadId = String(califAll[ci][califLeadCol] || '').trim();
              if (!phantomIds[califLeadId]) {
                califKeep.push(califAll[ci]);
              }
            }
            califSheet.getRange(2, 1, califAll.length - 1, califHeader.length).clearContent();
            if (califKeep.length > 1) {
              califSheet.getRange(2, 1, califKeep.length - 1, califHeader.length)
                .setValues(califKeep.slice(1));
            }
          }
        }
      }

      SpreadsheetApp.flush();
      Logger.log('cleanPhantomDuplicates: cleaned ' + totalCleaned + ' phantom leads (batch mode)');
    }

    // Build summary for frontend (limit preview to 50 for performance)
    var preview = phantoms.slice(0, 50).map(function (ph) {
      return {
        id_lead: ph.id_lead,
        nombre: ph.nombre,
        email: ph.email,
        fecha_ingreso: ph.fecha_ingreso,
        keeper_id: ph.keeper_id
      };
    });

    return JSON.stringify({
      phantoms: preview,
      totalFound: totalFound,
      totalCleaned: totalCleaned,
      mode: mode || 'preview'
    });
  } catch (e) {
    Logger.log('cleanPhantomDuplicates ERROR: ' + e.message);
    return JSON.stringify({ error: e.message, totalFound: 0, totalCleaned: 0 });
  } finally {
    lock.releaseLock();
  }
}

// ============ API: CONTACTOS ============

function getContacts() {
  try {
    var contactos = readTable_(T_CONTACTOS);
    var leads = readTable_(T_LEADS);
    var deals = readTable_(T_DEALS);
    var leadCount = {}, dealCount = {};
    for (var i = 0; i < leads.length; i++) {
      var c = String(leads[i].id_contacto || '');
      leadCount[c] = (leadCount[c] || 0) + 1;
    }
    for (var j = 0; j < deals.length; j++) {
      var d = String(deals[j].id_contacto || '');
      dealCount[d] = (dealCount[d] || 0) + 1;
    }
    var result = contactos.map(function (c) {
      var cid = String(c.id_contacto || '');
      return {
        _row: c._row, id_contacto: c.id_contacto,
        nombre: c.nombre || '', apellido: c.apellido || '',
        empresa: c.empresa || '', email: c.email || '',
        telefono_1: c.telefono_1 || '', telefono_2: c.telefono_2 || '',
        area: c.area || '', pais: c.pais || '', ciudad: c.ciudad || '',
        empleados: c.empleados || '', nivel: c.nivel || '',
        fecha_creacion: c.fecha_creacion || '',
        lista_negra: c.lista_negra === 'TRUE' || c.lista_negra === true,
        motivo_lista_negra: c.motivo_lista_negra || '',
        fecha_lista_negra: c.fecha_lista_negra || '',
        es_prueba: c.es_prueba === 'TRUE' || c.es_prueba === true,
        _leadCount: leadCount[cid] || 0,
        _dealCount: dealCount[cid] || 0
      };
    });
    return JSON.stringify(result);
  } catch (e) {
    Logger.log('getContacts ERROR: ' + e.message);
    return '[]';
  }
}

// ============ BULK UPDATE ============

function bulkUpdateField(rows, fieldName, newValue, isDeal, callerEmail) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { status: 'error', message: 'Sistema ocupado' }; }
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tableName = isDeal ? T_DEALS : T_LEADS;
    var fieldMap = isDeal ? DEAL_FIELD_MAP : LEAD_FIELD_MAP;
    var sheet = ss.getSheetByName(tableName);
    if (!sheet) return { status: 'error', message: 'Hoja no encontrada' };
    var colMap = getColumnMap_(sheet);
    var dbCol = fieldMap[fieldName] || fieldName;
    if (dbCol.indexOf('_DIM_CONTACTO_') === 0 || dbCol.indexOf('_FACT_CALIFICACION_') === 0) {
      return { status: 'error', message: 'Este campo no es editable masivamente' };
    }
    var targetCol = colMap[dbCol];
    if (!targetCol) return { status: 'error', message: 'Columna no encontrada: ' + dbCol };
    for (var i = 0; i < rows.length; i++) {
      sheet.getRange(rows[i], targetCol).setValue(newValue);
    }
    logChange_(isDeal ? 'Deal' : 'Lead', 'BULK(' + rows.length + ')', callerEmail || Session.getActiveUser().getEmail(), 'EDICIÓN MASIVA', '', fieldName + ' → ' + String(newValue));
    return { status: 'success', updated: rows.length };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function bulkUpdateContacts(rows, fieldName, newValue, callerEmail) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { status: 'error', message: 'Sistema ocupado' }; }
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_CONTACTOS);
    if (!sheet) return { status: 'error', message: 'dim_contactos no encontrada' };
    var colMap = getColumnMap_(sheet);
    var targetCol = colMap[fieldName];
    if (!targetCol) return { status: 'error', message: 'Columna no encontrada: ' + fieldName };
    for (var i = 0; i < rows.length; i++) {
      sheet.getRange(rows[i], targetCol).setValue(newValue);
    }
    logChange_('Contacto', 'BULK(' + rows.length + ')', callerEmail || Session.getActiveUser().getEmail(), 'EDICIÓN MASIVA', '', fieldName + ' → ' + String(newValue));
    return { status: 'success', updated: rows.length };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function createContact(contactData, callerEmail) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { status: 'error', message: 'Sistema ocupado' }; }
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_CONTACTOS);
    if (!sheet) return { status: 'error', message: 'dim_contactos no encontrada' };
    var colMap = getColumnMap_(sheet);
    var newId = getNextId_(sheet, 'id_contacto');
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    var row = new Array(headers.length).fill('');
    var set = function (n, v) { var c = colMap[n]; if (c) row[c - 1] = v; };
    set('id_contacto', newId);
    set('nombre', contactData.nombre || '');
    set('apellido', contactData.apellido || '');
    set('email', contactData.email || '');
    set('telefono_1', contactData.telefono_1 || '');
    set('telefono_2', contactData.telefono_2 || '');
    set('empresa', contactData.empresa || '');
    set('area', contactData.area || '');
    set('pais', contactData.pais || '');
    set('ciudad', contactData.ciudad || '');
    set('empleados', contactData.empleados || '');
    set('nivel', contactData.nivel || '');
    set('fecha_creacion', new Date());
    if (contactData.es_prueba) set('es_prueba', 'TRUE');
    var insertRow = getFirstEmptyRow_(sheet, 'id_contacto');
    var target = sheet.getRange(insertRow, 1, 1, row.length);
    target.clearFormat();
    target.setValues([row]);
    logChange_('Contacto', newId, callerEmail || Session.getActiveUser().getEmail(), 'CREACIÓN MANUAL', '', 'Nuevo contacto');
    return { status: 'success', data: { id: newId } };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function updateContact(rowNumber, updates, callerEmail) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { status: 'error', message: 'Sistema ocupado' }; }
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_CONTACTOS);
    if (!sheet) return { status: 'error', message: 'dim_contactos no encontrada' };
    var colMap = getColumnMap_(sheet);
    var user = callerEmail || Session.getActiveUser().getEmail() || 'System';
    var idCol = colMap['id_contacto'];
    var idContacto = idCol ? sheet.getRange(rowNumber, idCol).getValue() : rowNumber;
    var updated = 0;
    for (var key in updates) {
      if (!updates.hasOwnProperty(key)) continue;
      var col = colMap[key.toLowerCase()];
      if (col) {
        var oldVal = sheet.getRange(rowNumber, col).getValue();
        sheet.getRange(rowNumber, col).setValue(updates[key]);
        logChange_('Contacto', idContacto, user, key, oldVal, updates[key]);
        updated++;
      }
    }
    return { status: 'success', updated: updated };
  } catch (e) {
    return { status: 'error', message: e.message };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function getContactRelated(idContacto) {
  try {
    var cid = String(idContacto);
    var leads = readTable_(T_LEADS);
    var deals = readTable_(T_DEALS);
    var relLeads = [], relDeals = [];
    for (var i = 0; i < leads.length; i++) {
      if (String(leads[i].id_contacto) === cid) {
        relLeads.push({
          id_lead: leads[i].id_lead, status: leads[i].status || '',
          fecha_ingreso: leads[i].fecha_ingreso || '', servicio: leads[i].servicio_interes || '',
          calidad: leads[i].calidad_contacto || '', _row: leads[i]._row
        });
      }
    }
    for (var j = 0; j < deals.length; j++) {
      if (String(deals[j].id_contacto) === cid) {
        relDeals.push({
          id_deal: deals[j].id_deal, status_venta: deals[j].status_venta || '',
          fecha_pase: deals[j].fecha_pase_ventas || '', _row: deals[j]._row
        });
      }
    }
    return JSON.stringify({ leads: relLeads, deals: relDeals });
  } catch (e) {
    return JSON.stringify({ leads: [], deals: [] });
  }
}

// ============ API: LISTA NEGRA ============

/**
 * Agrega o quita un contacto de la Lista Negra.
 * Escribe a dim_contactos y CASCADE: todos los leads/deals del contacto → Perdido.
 * @param {number} rowNumber  Fila del lead/deal en su hoja
 * @param {boolean} isDeal    true = fact_deals, false = fact_leads
 * @param {boolean} addToList true = agregar, false = quitar
 * @param {string} motivo     Razón (solo al agregar)
 * @param {string} callerEmail
 */
function toggleListaNegra(rowNumber, isDeal, addToList, motivo, callerEmail) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { status: 'error', message: 'Sistema ocupado' }; }
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var user = callerEmail || Session.getActiveUser().getEmail() || 'System';

    // Step 1: Read id_contacto from the source lead/deal row
    var factSheet = ss.getSheetByName(isDeal ? T_DEALS : T_LEADS);
    if (!factSheet) return { status: 'error', message: 'Hoja no encontrada' };
    var factColMap = getColumnMap_(factSheet);
    var idContactoCol = factColMap['id_contacto'];
    if (!idContactoCol) return { status: 'error', message: 'Columna id_contacto no encontrada' };
    var idContacto = String(factSheet.getRange(rowNumber, idContactoCol).getValue());

    // Step 2: Find the dim_contactos row for this contact
    var cSheet = ss.getSheetByName(T_CONTACTOS);
    if (!cSheet) return { status: 'error', message: 'dim_contactos no encontrada' };
    var cColMap = getColumnMap_(cSheet);
    var cData = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, cSheet.getLastColumn()).getValues();
    var idcCol = cColMap['id_contacto'];
    var cTargetRow = -1;
    for (var i = 0; i < cData.length; i++) {
      if (String(cData[i][idcCol - 1]) === idContacto) { cTargetRow = i + 2; break; }
    }
    if (cTargetRow === -1) return { status: 'error', message: 'Contacto ' + idContacto + ' no encontrado' };

    // Step 3: Write lista_negra to dim_contactos
    if (addToList) {
      if (cColMap['lista_negra']) cSheet.getRange(cTargetRow, cColMap['lista_negra']).setValue('TRUE');
      if (cColMap['fecha_lista_negra']) cSheet.getRange(cTargetRow, cColMap['fecha_lista_negra']).setValue(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"));
      if (cColMap['motivo_lista_negra']) cSheet.getRange(cTargetRow, cColMap['motivo_lista_negra']).setValue(motivo || '');
      logChange_('Contacto', idContacto, user, 'LISTA NEGRA', '', 'Agregado: ' + (motivo || 'Sin motivo'));
    } else {
      if (cColMap['lista_negra']) cSheet.getRange(cTargetRow, cColMap['lista_negra']).setValue('');
      if (cColMap['fecha_lista_negra']) cSheet.getRange(cTargetRow, cColMap['fecha_lista_negra']).setValue('');
      if (cColMap['motivo_lista_negra']) cSheet.getRange(cTargetRow, cColMap['motivo_lista_negra']).setValue('');
      logChange_('Contacto', idContacto, user, 'LISTA NEGRA', 'En lista negra', 'Removido');
    }

    // Step 4: CASCADE — set all related leads and deals to Perdido (only when adding)
    var cascadedLeads = 0, cascadedDeals = 0;
    if (addToList) {
      // Cascade leads
      var leadsSheet = ss.getSheetByName(T_LEADS);
      if (leadsSheet && leadsSheet.getLastRow() >= 2) {
        var lColMap = getColumnMap_(leadsSheet);
        var lIdcCol = lColMap['id_contacto'];
        var lStatusCol = lColMap['status'];
        if (lIdcCol && lStatusCol) {
          var lData = leadsSheet.getRange(2, lIdcCol, leadsSheet.getLastRow() - 1, 1).getValues();
          for (var li = 0; li < lData.length; li++) {
            if (String(lData[li][0]) === idContacto) {
              var currentStatus = String(leadsSheet.getRange(li + 2, lStatusCol).getValue() || '').trim();
              if (currentStatus !== 'Perdido') {
                leadsSheet.getRange(li + 2, lStatusCol).setValue('Perdido');
                cascadedLeads++;
              }
            }
          }
        }
      }
      // Cascade deals
      var dealsSheet = ss.getSheetByName(T_DEALS);
      if (dealsSheet && dealsSheet.getLastRow() >= 2) {
        var dColMap = getColumnMap_(dealsSheet);
        var dIdcCol = dColMap['id_contacto'];
        var dStatusCol = dColMap['status_venta'];
        if (dIdcCol && dStatusCol) {
          var dData = dealsSheet.getRange(2, dIdcCol, dealsSheet.getLastRow() - 1, 1).getValues();
          for (var di = 0; di < dData.length; di++) {
            if (String(dData[di][0]) === idContacto) {
              var dCurrentStatus = String(dealsSheet.getRange(di + 2, dStatusCol).getValue() || '').trim();
              if (dCurrentStatus !== 'Perdido') {
                dealsSheet.getRange(di + 2, dStatusCol).setValue('Perdido');
                cascadedDeals++;
              }
            }
          }
        }
      }
    }

    return { status: 'success', added: addToList, idContacto: idContacto, cascadedLeads: cascadedLeads, cascadedDeals: cascadedDeals };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
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

    var campanas = readTable_(T_CAMPANAS);
    var campanasIdx = indexBy_(campanas, 'id_campana');

    var total = leadRows.length;
    var byStatus = {};
    var byCalidad = {};
    var byVendedor = {};
    var byCampana = {};
    var thisWeek = 0;
    var thisMonth = 0;
    var now = new Date();
    // Semana calendario: lunes 00:00 de esta semana
    var dayOfWeek = now.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
    var daysSinceMonday = (dayOfWeek === 0) ? 6 : (dayOfWeek - 1);
    var weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
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

      var camp = campanasIdx[String(lead.id_campana)] || {};
      var campNombre = String(camp.campaign || 'Sin Campaña').trim();
      byCampana[campNombre] = (byCampana[campNombre] || 0) + 1;

      var ts = lead.fecha_ingreso;
      if (ts) {
        var d = new Date(ts);
        if (!isNaN(d.getTime())) {
          if (d >= weekStart) thisWeek++;
          if (d >= monthStart) thisMonth++;
        }
      }
    }

    // Formatear fechas para mostrar en dashboard (dd/MM)
    var fmt = function (dt) {
      var dd = ('0' + dt.getDate()).slice(-2);
      var mm = ('0' + (dt.getMonth() + 1)).slice(-2);
      return dd + '/' + mm;
    };
    var weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    return {
      total: total, thisWeek: thisWeek, thisMonth: thisMonth,
      weekRange: fmt(weekStart) + ' – ' + fmt(weekEnd),
      monthRange: fmt(monthStart) + ' – ' + fmt(now),
      byStatus: byStatus, byCalidad: byCalidad, byVendedor: byVendedor, byCampana: byCampana
    };
  } catch (err) {
    Logger.log('getLeadStats ERROR: ' + err.message);
    return { total: 0, thisWeek: 0, thisMonth: 0, byStatus: {}, byCalidad: {}, byVendedor: {}, byCampana: {} };
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
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
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
function saveHMNConfig(variables, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_CATALOGS);
    if (!sheet) throw new Error('Hoja cat_opciones no encontrada');

    var colMap = getColumnMap_(sheet);
    var data; data = safeReadAll_(sheet);
    var catCol = colMap['categoria'];
    var valCol = colMap['valor'];
    var idCol = colMap['id_opcion'];
    var activoCol = colMap['activo'];
    var ordenCol = colMap['orden'];

    if (!catCol || !valCol) throw new Error('Columnas categoria/valor no encontradas en cat_opciones');

    var user = callerEmail || Session.getActiveUser().getEmail() || 'API';

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
function createUser(email, nombre, rol, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    if (!email || !email.trim()) throw new Error('Email es requerido');

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_USERS);
    if (!sheet) throw new Error('Hoja config_users no encontrada');

    // Check for duplicate email
    var data; data = safeReadAll_(sheet);
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
    if (colMap['password']) newRow[colMap['password'] - 1] = '123456';

    sheet.getRange(insertRow, 1, 1, numCols).setValues([newRow]);
    logChange_('User', email, callerEmail || Session.getActiveUser().getEmail() || 'API', 'createUser', '', rol);

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
function toggleUserActive(email, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_USERS);
    if (!sheet) throw new Error('Hoja config_users no encontrada');

    var colMap = getColumnMap_(sheet);
    var data; data = safeReadAll_(sheet);
    var emailCol = colMap['email'] || 1;
    var activoCol = colMap['activo'];

    if (!activoCol) throw new Error('Columna "activo" no encontrada');

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailCol - 1] || '').trim().toLowerCase() === email.trim().toLowerCase()) {
        var current = data[i][activoCol - 1];
        var isActive = current === true || current === 'TRUE' || current === 1 || current === 'true';
        var newVal = !isActive;
        sheet.getRange(i + 1, activoCol).setValue(newVal);
        logChange_('User', email, callerEmail || Session.getActiveUser().getEmail() || 'API', 'activo', String(isActive), String(newVal));
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
function updateUserRole(email, newRole, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_USERS);
    if (!sheet) throw new Error('Hoja config_users no encontrada');

    var colMap = getColumnMap_(sheet);
    var data; data = safeReadAll_(sheet);
    var emailCol = colMap['email'] || 1;
    var rolCol = colMap['rol'];

    if (!rolCol) throw new Error('Columna "rol" no encontrada');

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][emailCol - 1] || '').trim().toLowerCase() === email.trim().toLowerCase()) {
        var oldRole = String(data[i][rolCol - 1] || '');
        sheet.getRange(i + 1, rolCol).setValue(newRole.toUpperCase());
        logChange_('User', email, callerEmail || Session.getActiveUser().getEmail() || 'API', 'rol', oldRole, newRole.toUpperCase());
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

// ============ API: GMAIL INTEGRATION (Phase 4 — Omnichannel) ============

/**
 * Sends an email using the logged-in user's Gmail (GmailApp.sendEmail).
 * Supports rich HTML body and file attachments (Base64-encoded).
 * After sending, logs the action as a touch in fact_toques with canal="Email".
 *
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} body - Plain-text email body (fallback).
 * @param {number|string} entityId - The ID of the Lead or Deal.
 * @param {string} entityType - "lead" or "deal".
 * @param {string} [htmlBody] - Optional HTML body from rich text editor.
 * @param {Array} [attachments] - Optional array of {filename, mimeType, data (Base64)}.
 * @return {Object} {status, message}
 */
function sendDirectEmail(to, subject, body, entityId, entityType, htmlBody, attachments, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    // 1. Validate inputs
    if (!to || !subject) {
      return { status: 'error', message: 'Los campos Para y Asunto son obligatorios.' };
    }
    if (!body && !htmlBody) {
      return { status: 'error', message: 'El cuerpo del correo es obligatorio.' };
    }

    // 2. Build email options
    var emailOptions = {};

    // HTML body (from Quill rich text editor)
    if (htmlBody && htmlBody.trim() !== '' && htmlBody !== '<p><br></p>') {
      emailOptions.htmlBody = htmlBody;
    }

    // Attachments: decode Base64 → Blob
    if (attachments && attachments.length > 0) {
      var blobArray = [];
      for (var a = 0; a < attachments.length; a++) {
        var att = attachments[a];
        if (att.data && att.filename) {
          var decoded = Utilities.base64Decode(att.data);
          var blob = Utilities.newBlob(decoded, att.mimeType || 'application/octet-stream', att.filename);
          blobArray.push(blob);
        }
      }
      if (blobArray.length > 0) {
        emailOptions.attachments = blobArray;
      }
    }

    // 3. Send email via GmailApp
    GmailApp.sendEmail(to, subject, body || '', emailOptions);

    // 4. Log the touch in fact_toques
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var toquesSheet = ss.getSheetByName(T_TOQUES);
    if (toquesSheet) {
      var nextId = getNextId_(toquesSheet, 'id_registro_toque');
      var user = callerEmail || Session.getActiveUser().getEmail() || 'API';
      var now = new Date();

      // Lookup vendedor name from config_users
      var vendedorId = '';
      var usersRows = readTable_(T_USERS);
      for (var u = 0; u < usersRows.length; u++) {
        if (String(usersRows[u].email || '').trim().toLowerCase() === user.toLowerCase()) {
          vendedorId = usersRows[u].nombre || user;
          break;
        }
      }

      // Build new row matching the fact_toques schema dynamically
      var headers = toquesSheet.getRange(1, 1, 1, toquesSheet.getLastColumn()).getDisplayValues()[0];
      var newRow = [];
      for (var h = 0; h < headers.length; h++) {
        var headerName = String(headers[h]).trim().toLowerCase();
        switch (headerName) {
          case 'id_registro_toque': newRow.push(nextId); break;
          case 'tipo_entidad': newRow.push(entityType === 'deal' ? 'Deal' : 'Lead'); break;
          case 'id_entidad': newRow.push(entityId || ''); break;
          case 'numero_toque': newRow.push(''); break;
          case 'fecha_toque': newRow.push(now); break;
          case 'id_vendedor': newRow.push(vendedorId); break;
          case 'rol_vendedor': newRow.push(entityType === 'deal' ? 'AE' : 'SDR'); break;
          case 'canal': newRow.push('Email'); break;
          case 'detalle': newRow.push(subject); break;
          default: newRow.push('');
        }
      }
      toquesSheet.appendRow(newRow);
    }

    // 5. Log in log_transacciones
    var attachCount = (attachments && attachments.length) ? ' | Adjuntos: ' + attachments.length : '';
    logChange_(
      entityType === 'deal' ? 'Deal' : 'Lead',
      entityId,
      callerEmail || Session.getActiveUser().getEmail() || 'API',
      'Envío de Email',
      '',
      'Asunto: ' + subject + ' | Para: ' + to + attachCount
    );

    return { status: 'success', message: 'Correo enviado exitosamente a ' + to };

  } catch (err) {
    Logger.log('sendDirectEmail ERROR: ' + err.message);
    return { status: 'error', message: 'Error al enviar correo: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============ API: GOOGLE CALENDAR (Phase 1.2) ============

/**
 * Crea un evento, tarea o recordatorio en el calendario default del usuario.
 * Estrategia "Camino 2": Usa CalendarApp con EventColors para diferenciar visualmente.
 *
 * @param {string} tipo - "Evento", "Tarea", "Recordatorio" o "Registro Visual".
 * @param {string} asunto - Título del evento.
 * @param {string} fechaStr - Fecha en formato YYYY-MM-DD.
 * @param {string} [horaStr] - Hora en formato HH:MM (opcional; sin hora = todo el día).
 * @return {Object} {status, message}
 */
function createCalendarEvent(tipo, asunto, fechaStr, horaStr, notifOpts, visOpts) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var cal = CalendarApp.getDefaultCalendar();
    var event;

    // Si no hay hora, se fuerza a evento de todo el día
    var isAllDay = !horaStr;
    var startDate = new Date(fechaStr + (horaStr ? 'T' + horaStr + ':00' : 'T00:00:00'));

    if (isAllDay || tipo === 'Registro Visual') {
      // Registro visual o sin hora específica -> Todo el día
      event = cal.createAllDayEvent(asunto, startDate);
    } else {
      // Tiene hora específica. Asumimos duración defecto de 1 hora
      var endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      event = cal.createEvent(asunto, startDate, endDate);
    }

    // Set Notifications and Visibility if it's an Event
    if (tipo === 'Evento') {
      if (visOpts) {
        if (visOpts === 'PUBLIC') event.setVisibility(CalendarApp.Visibility.PUBLIC);
        else if (visOpts === 'PRIVATE') event.setVisibility(CalendarApp.Visibility.PRIVATE);
        else if (visOpts === 'CONFIDENTIAL') event.setVisibility(CalendarApp.Visibility.CONFIDENTIAL);
        else event.setVisibility(CalendarApp.Visibility.DEFAULT);
      }
      if (notifOpts !== undefined && notifOpts !== null) {
        event.removeAllReminders();
        if (notifOpts > 0) {
          event.addPopupReminder(notifOpts);
        }
      }
    }

    // 'Hack de Colores' para simular distintas modalidades
    if (tipo === 'Tarea') {
      event.setColor(CalendarApp.EventColor.PALE_RED);       // Naranja/Rojo pálido
    } else if (tipo === 'Recordatorio') {
      event.setColor(CalendarApp.EventColor.RED);             // Rojo intenso
    } else if (tipo === 'Registro Visual') {
      event.setColor(CalendarApp.EventColor.GRAY);            // Gris
    }
    // Si es 'Evento', retiene el color azul por defecto de Google

    return { status: 'success', message: tipo + ' creado en el calendario: ' + asunto };
  } catch (err) {
    Logger.log('createCalendarEvent ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Obtiene los eventos del usuario en un rango de fechas para FullCalendar.
 * Incluye descripción, notificaciones y visibilidad para el modal avanzado.
 *
 * @param {string} startISO - Fecha inicio en formato ISO.
 * @param {string} endISO - Fecha fin en formato ISO.
 * @return {string} JSON con {status, data: [{id, title, start, end, allDay, color, description, notificationMinutes, visibility}]}
 */
function getAgentEvents(startISO, endISO) {
  try {
    var cal = CalendarApp.getDefaultCalendar();
    var start = new Date(startISO);
    var end = new Date(endISO);
    var events = cal.getEvents(start, end);

    var colorMap = {
      '': '#4285f4',    // Default Google Blue (Evento)
      '4': '#e67c73',   // PALE_RED (Tarea)
      '11': '#dc2127',  // RED (Recordatorio)
      '8': '#616161'    // GRAY (Registro Visual)
    };

    var result = [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      var rawColor = String(e.getColor() || '');

      // Extraer notificaciones (popup reminders)
      var notifMinutes = 30; // default
      try {
        var reminders = e.getPopupReminders();
        if (reminders && reminders.length > 0) {
          notifMinutes = reminders[0];
        }
      } catch (rErr) { /* algunas cuentas no soportan esto */ }

      // Extraer visibilidad
      var vis = 'DEFAULT';
      try {
        var gVis = e.getVisibility();
        if (gVis === CalendarApp.Visibility.PUBLIC) vis = 'PUBLIC';
        else if (gVis === CalendarApp.Visibility.PRIVATE) vis = 'PRIVATE';
        else if (gVis === CalendarApp.Visibility.CONFIDENTIAL) vis = 'CONFIDENTIAL';
      } catch (vErr) { }

      result.push({
        id: e.getId(),
        title: e.getTitle(),
        start: e.isAllDayEvent() ? e.getAllDayStartDate().toISOString() : e.getStartTime().toISOString(),
        end: e.isAllDayEvent() ? e.getAllDayEndDate().toISOString() : e.getEndTime().toISOString(),
        allDay: e.isAllDayEvent(),
        color: colorMap[rawColor] || '#4285f4',
        description: e.getDescription() || '',
        notificationMinutes: notifMinutes,
        visibility: vis
      });
    }

    return JSON.stringify({ status: 'success', data: result });
  } catch (err) {
    Logger.log('getAgentEvents ERROR: ' + err.message);
    return JSON.stringify({ status: 'error', message: err.message });
  }
}

/**
 * Actualiza un evento existente en Google Calendar.
 *
 * @param {string} eventId - ID del evento de Google Calendar.
 * @param {Object} data - { title, start, end, description, notificationMinutes, tipo, visibility }
 * @return {Object} { status, message }
 */
function updateCalendarEvent(eventId, data) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var cal = CalendarApp.getDefaultCalendar();
    var event = cal.getEventById(eventId);
    if (!event) return { status: 'error', message: 'Evento no encontrado con ID: ' + eventId };

    // Título
    if (data.title) event.setTitle(data.title);

    // Horarios
    if (data.start) {
      var newStart = new Date(data.start);
      var newEnd = data.end ? new Date(data.end) : new Date(newStart.getTime() + 60 * 60 * 1000);
      event.setTime(newStart, newEnd);
    }

    // Descripción
    if (data.description !== undefined) event.setDescription(data.description);

    // Color (hack de colores Camino 2)
    if (data.tipo) {
      if (data.tipo === 'Tarea') event.setColor(CalendarApp.EventColor.PALE_RED);
      else if (data.tipo === 'Recordatorio') event.setColor(CalendarApp.EventColor.RED);
      else if (data.tipo === 'Registro Visual') event.setColor(CalendarApp.EventColor.GRAY);
      else event.setColor(CalendarApp.EventColor.CYAN); // Reset a default
    }

    // Notificaciones
    if (data.notificationMinutes !== undefined && data.notificationMinutes !== '') {
      event.removeAllReminders();
      var mins = parseInt(data.notificationMinutes, 10);
      if (!isNaN(mins) && mins > 0) {
        event.addPopupReminder(mins);
      }
    }

    // Visibilidad
    if (data.visibility) {
      if (data.visibility === 'PUBLIC') event.setVisibility(CalendarApp.Visibility.PUBLIC);
      else if (data.visibility === 'PRIVATE') event.setVisibility(CalendarApp.Visibility.PRIVATE);
      else if (data.visibility === 'CONFIDENTIAL') event.setVisibility(CalendarApp.Visibility.CONFIDENTIAL);
      else event.setVisibility(CalendarApp.Visibility.DEFAULT);
    }

    return { status: 'success', message: 'Evento actualizado: ' + event.getTitle() };
  } catch (err) {
    Logger.log('updateCalendarEvent ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Elimina un evento del Google Calendar del usuario.
 *
 * @param {string} eventId - ID del evento.
 * @return {Object} { status, message }
 */
function deleteCalendarEvent(eventId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var cal = CalendarApp.getDefaultCalendar();
    var event = cal.getEventById(eventId);
    if (!event) return { status: 'error', message: 'Evento no encontrado' };
    var title = event.getTitle();
    event.deleteEvent();
    return { status: 'success', message: 'Evento eliminado: ' + title };
  } catch (err) {
    Logger.log('deleteCalendarEvent ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============ API: HANDOFF (Paso a Ventas) ============

/**
 * Crea una ficha de negociación (deal) a partir de un lead calificado y asigna al AE
 * según la regla de routing configurada.
 *
 * @param {Object} payload - { leadId, aeEmail (optional), notas }
 * @return {Object} { status, message, dealId, aeAssigned }
 */
function processHandoff(payload, callerEmail) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var leadSheet = ss.getSheetByName(T_LEADS);
    var dealSheet = ss.getSheetByName(T_DEALS);

    if (!leadSheet || !dealSheet) return { status: 'error', message: 'Hojas fact_leads o fact_deals no encontradas' };

    // 1. Find the lead
    var leads = readTable_(T_LEADS);
    var lead = null;
    for (var i = 0; i < leads.length; i++) {
      if (String(leads[i].id_lead) === String(payload.leadId)) { lead = leads[i]; break; }
    }
    if (!lead) return { status: 'error', message: 'Lead no encontrado con ID: ' + payload.leadId };

    // 2. Check if this lead already has a deal
    var existingDeals = readTable_(T_DEALS);
    for (var d = 0; d < existingDeals.length; d++) {
      if (String(existingDeals[d].id_lead) === String(payload.leadId)) {
        return { status: 'error', message: 'Este lead ya tiene una ficha de negociación (Deal #' + existingDeals[d].id_deal + ')' };
      }
    }

    // 3. Determine AE based on routing config
    var config = getRoutingConfig();
    var aeEmail = '';
    var aeNombre = '';
    var assignmentMethod = config.aeAssignmentMode || 'SDR_CHOICE';

    if (assignmentMethod === 'SDR_CHOICE') {
      // SDR chose manually
      aeEmail = payload.aeEmail || '';
      if (!aeEmail) return { status: 'error', message: 'Debe seleccionar un Account Executive' };
      // Look up AE name
      var vendedores = readTable_(T_VENDEDORES);
      for (var v = 0; v < vendedores.length; v++) {
        if (vendedores[v].email === aeEmail) { aeNombre = vendedores[v].nombre || aeEmail; break; }
      }
    } else if (assignmentMethod === 'AUTO') {
      // Round Robin Inteligente
      var rrResult = assignNextUserRR('AE', 'lastAeRRSavedEmail');
      if (rrResult.status !== 'success') return { status: 'error', message: 'Round Robin: ' + rrResult.message };
      aeEmail = rrResult.email;
      aeNombre = rrResult.nombre;
    } else if (assignmentMethod === 'MANAGER_REVIEW') {
      aeEmail = config.managerEmail || '';
      aeNombre = 'Gerente (revisión)';
      if (!aeEmail) return { status: 'error', message: 'No hay email de gerente configurado en Routing' };
    }

    // 4. Find AE id_vendedor
    var aeIdVendedor = '';
    var allVendedores = readTable_(T_VENDEDORES);
    for (var av = 0; av < allVendedores.length; av++) {
      if (allVendedores[av].email === aeEmail) { aeIdVendedor = allVendedores[av].id_vendedor; break; }
    }

    // 5. Create the deal row in fact_deals
    var newDealId = getNextId_(dealSheet, 'id_deal');
    var colMap = getColumnMap_(dealSheet);
    var emptyRow = getFirstEmptyRow_(dealSheet, 'id_deal');
    var now = new Date();

    var dealData = {
      'id_deal': newDealId,
      'id_lead': lead.id_lead,
      'id_contacto': lead.id_contacto || '',
      'id_vendedor_ae': aeIdVendedor,
      'status_venta': 'Primer Contacto',
      'fecha_creacion_deal': Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      'notas_vendedor': payload.notas || ''
    };

    // Write each field to the correct column
    for (var field in dealData) {
      if (colMap[field]) {
        dealSheet.getRange(emptyRow, colMap[field]).setValue(dealData[field]);
      }
    }

    // 6. Update lead status to "Paso a Ventas"
    var leadColMap = getColumnMap_(leadSheet);
    if (lead._row && leadColMap['status']) {
      leadSheet.getRange(lead._row, leadColMap['status']).setValue('Paso a Ventas');
    }

    // 7. Log the transaction
    var user = callerEmail || Session.getActiveUser().getEmail() || 'System';
    logChange_('DEAL', newDealId, user, 'HANDOFF', '', 'Paso a Ventas → AE: ' + aeNombre + ' (' + aeEmail + ') [' + assignmentMethod + ']');

    return {
      status: 'success',
      message: 'Negociación #' + newDealId + ' creada y asignada a ' + aeNombre,
      dealId: newDealId,
      aeAssigned: aeNombre + ' (' + aeEmail + ')',
      assignmentMethod: assignmentMethod
    };
  } catch (err) {
    Logger.log('processHandoff ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============ PRICING: Configuración Global ============

/**
 * Obtiene la configuración global de pricing del cliente.
 * Supports multi-product format: { tipoCliente, productos: [{nombre, ticketPromedio}] }
 * Backward compatible: if old format detected, migrates to new format.
 * @return {Object} { tipoCliente, productos: [{nombre, ticketPromedio}] }
 */
function getPricingConfig() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('APP_PRICING_CONFIG');
  if (raw) {
    try {
      var cfg = JSON.parse(raw);
      // Backward compat: migrate old single-product format to multi-product
      if (!cfg.productos) {
        cfg.productos = [];
        if (cfg.ticketPromedio) {
          cfg.productos.push({ nombre: 'Default', ticketPromedio: parseFloat(cfg.ticketPromedio) || 0 });
        }
      }
      return { tipoCliente: cfg.tipoCliente || '', productos: cfg.productos || [] };
    } catch (e) { }
  }
  return { tipoCliente: '', productos: [] };
}

/**
 * Guarda la configuración global de pricing. Solo ADMIN/GERENTE.
 * @param {Object} config - { tipoCliente, productos: [{nombre, ticketPromedio}] }
 * @return {Object} { status, message }
 */
function savePricingConfig(config, callerEmail) {
  try {
    var email = callerEmail || Session.getActiveUser().getEmail();
    var users = readTable_(T_USERS);
    var userRol = '';
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email || '').toLowerCase() === String(email || '').toLowerCase()) {
        userRol = String(users[i].rol || '').toUpperCase();
        break;
      }
    }
    if (userRol !== 'ADMIN' && userRol !== 'GERENTE') {
      return { status: 'error', message: 'Solo ADMIN o GERENTE pueden cambiar la configuración de pricing' };
    }
    var productos = [];
    if (config.productos && config.productos.length) {
      for (var p = 0; p < config.productos.length; p++) {
        productos.push({
          nombre: String(config.productos[p].nombre || '').trim(),
          ticketPromedio: parseFloat(config.productos[p].ticketPromedio) || 0
        });
      }
    }
    var payload = {
      tipoCliente: String(config.tipoCliente || ''),
      productos: productos.slice(0, 10) // Max 10 products
    };
    PropertiesService.getScriptProperties().setProperty('APP_PRICING_CONFIG', JSON.stringify(payload));
    return { status: 'success', message: 'Configuración de pricing guardada (' + productos.length + ' productos)' };
  } catch (err) {
    Logger.log('savePricingConfig ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

// ============ FIELD LAYOUT: Configuración de Campos Parametrizables ============

var T_FIELD_LAYOUT = 'config_field_layout';

/**
 * Obtiene la configuración de campos para un tipo de ficha.
 * @param {string} tipoFicha - 'lead' o 'deal'
 * @return {Array} Array de objetos de configuración de campo, ordenados por seccion+campo.
 */
function getFieldLayout(tipoFicha) {
  try {
    var rows = readTable_(T_FIELD_LAYOUT);
    var filtered = [];
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].tipo_ficha || '').toLowerCase() === String(tipoFicha || '').toLowerCase()) {
        filtered.push({
          id_field: rows[i].id_field,
          tipo_ficha: rows[i].tipo_ficha,
          campo_key: rows[i].campo_key || '',
          campo_label: rows[i].campo_label || '',
          tipo_input: rows[i].tipo_input || 'text',
          seccion: rows[i].seccion || '',
          seccion_icono: rows[i].seccion_icono || '',
          orden_seccion: parseInt(rows[i].orden_seccion) || 0,
          orden_campo: parseInt(rows[i].orden_campo) || 0,
          visible: rows[i].visible !== false && rows[i].visible !== 'FALSE' && rows[i].visible !== 'false' && rows[i].visible !== 0,
          ancho: rows[i].ancho || 'half',
          requerido: rows[i].requerido === true || rows[i].requerido === 'TRUE' || rows[i].requerido === 'true',
          solo_lectura: rows[i].solo_lectura === true || rows[i].solo_lectura === 'TRUE' || rows[i].solo_lectura === 'true',
          opciones_catalog: rows[i].opciones_catalog || '',
          rol_visible: rows[i].rol_visible || 'ALL'
        });
      }
    }
    filtered.sort(function (a, b) {
      if (a.orden_seccion !== b.orden_seccion) return a.orden_seccion - b.orden_seccion;
      return a.orden_campo - b.orden_campo;
    });
    return filtered;
  } catch (err) {
    Logger.log('getFieldLayout ERROR: ' + err.message);
    return [];
  }
}

/**
 * Guarda la configuración completa de campos para un tipo de ficha. Solo ADMIN.
 * Deletes all existing rows for that tipo_ficha, then inserts the new config.
 * @param {string} tipoFicha - 'lead' o 'deal'
 * @param {Array} fields - Array de objetos de configuración de campo.
 * @return {Object} { status, message }
 */
function saveFieldLayout(tipoFicha, fields, callerEmail) {
  try {
    var email = callerEmail || Session.getActiveUser().getEmail();
    var users = readTable_(T_USERS);
    var userRol = '';
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email || '').toLowerCase() === String(email || '').toLowerCase()) {
        userRol = String(users[i].rol || '').toUpperCase();
        break;
      }
    }
    if (userRol !== 'ADMIN') {
      return { status: 'error', message: 'Solo ADMIN puede modificar la configuración de campos' };
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_FIELD_LAYOUT);
    if (!sheet) return { status: 'error', message: 'Hoja config_field_layout no encontrada' };

    var colMap = getColumnMap_(sheet);
    var lastRow = sheet.getLastRow();

    // Delete existing rows for this tipo_ficha (iterate backwards)
    if (lastRow > 1) {
      var tipoCol = colMap['tipo_ficha'];
      if (tipoCol) {
        var allVals = sheet.getRange(2, tipoCol, lastRow - 1, 1).getDisplayValues();
        for (var d = allVals.length - 1; d >= 0; d--) {
          if (String(allVals[d][0]).toLowerCase() === String(tipoFicha).toLowerCase()) {
            sheet.deleteRow(d + 2);
          }
        }
      }
    }

    // Insert new rows
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    var nextId = getNextId_(sheet, 'id_field');

    for (var f = 0; f < fields.length; f++) {
      var field = fields[f];
      var row = new Array(headers.length).fill('');
      var set = function (name, val) {
        var c = colMap[name];
        if (c) row[c - 1] = val;
      };
      set('id_field', nextId + f);
      set('tipo_ficha', tipoFicha);
      set('campo_key', field.campo_key || '');
      set('campo_label', field.campo_label || '');
      set('tipo_input', field.tipo_input || 'text');
      set('seccion', field.seccion || '');
      set('seccion_icono', field.seccion_icono || '');
      set('orden_seccion', field.orden_seccion != null && field.orden_seccion !== '' ? field.orden_seccion : 0);
      set('orden_campo', field.orden_campo != null && field.orden_campo !== '' ? field.orden_campo : f);
      set('visible', field.visible !== false ? 'TRUE' : 'FALSE');
      set('ancho', field.ancho || 'half');
      set('requerido', field.requerido ? 'TRUE' : 'FALSE');
      set('solo_lectura', field.solo_lectura ? 'TRUE' : 'FALSE');
      set('opciones_catalog', field.opciones_catalog || '');
      set('rol_visible', field.rol_visible || 'ALL');
      sheet.appendRow(row);
    }

    // Phase 3B: Invalidate schema cache so frontend picks up changes
    try { CacheService.getScriptCache().remove('schema_v1'); } catch (e) { }
    return { status: 'success', message: 'Configuración de campos guardada (' + fields.length + ' campos)' };
  } catch (err) {
    Logger.log('saveFieldLayout ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

// ============ ROUTING: Configuración y Round Robin ============

/**
 * Obtiene la configuración global de enrutamiento.
 * @return {Object} Objeto de configuración de routing.
 */
function getRoutingConfig() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('APP_ROUTING_CONFIG');
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { }
  }
  // Default config
  return {
    aeAssignmentMode: 'SDR_CHOICE',  // SDR_CHOICE | AUTO | MANAGER_REVIEW
    managerEmail: '',
    lastSdrRRSavedEmail: '',
    lastAeRRSavedEmail: ''
  };
}

/**
 * Guarda la configuración global de enrutamiento.
 * @param {Object} newConfig - Configuración a guardar.
 * @return {Object} { status, message }
 */
function saveRoutingConfig(newConfig) {
  try {
    var current = getRoutingConfig();
    // Preserve RR indices if not explicitly sent
    if (newConfig.lastSdrRRSavedEmail === undefined) newConfig.lastSdrRRSavedEmail = current.lastSdrRRSavedEmail;
    if (newConfig.lastAeRRSavedEmail === undefined) newConfig.lastAeRRSavedEmail = current.lastAeRRSavedEmail;
    PropertiesService.getScriptProperties().setProperty('APP_ROUTING_CONFIG', JSON.stringify(newConfig));
    return { status: 'success', message: 'Configuración de routing guardada' };
  } catch (err) {
    Logger.log('saveRoutingConfig ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

/**
 * Obtiene usuarios activos filtrados por rol y ordenados por Orden_Round_Robin.
 * @param {string} roleKeyword - Ej: 'AE', 'SDR'
 * @return {Array} Lista de objetos vendedor activos, ordenados.
 */
function getActiveSortedUsers(roleKeyword) {
  var vendedores = readTable_(T_VENDEDORES);
  var keyword = String(roleKeyword).toUpperCase();

  // Filtrar por rol y estado activo
  var filtered = [];
  for (var i = 0; i < vendedores.length; i++) {
    var v = vendedores[i];
    var rol = String(v.rol || '').toUpperCase();
    var activo = v.activo;
    // Consideramos activo si no es explícitamente false/0/"false"/"0"/"no"
    var isActivo = activo !== false && activo !== 'false' && activo !== '0' && activo !== 0 && activo !== 'no' && activo !== 'NO';
    if (rol.indexOf(keyword) !== -1 && isActivo) {
      filtered.push(v);
    }
  }

  // Ordenar por Orden_Round_Robin (menor a mayor)
  filtered.sort(function (a, b) {
    var oa = parseInt(a['Orden_Round_Robin'] || a['orden_round_robin'] || 999, 10);
    var ob = parseInt(b['Orden_Round_Robin'] || b['orden_round_robin'] || 999, 10);
    return oa - ob;
  });

  return filtered;
}

/**
 * Algoritmo Round Robin: asigna el siguiente usuario activo de una cola.
 * Thread-safe con LockService.
 * @param {string} roleKeyword - 'AE' o 'SDR'
 * @param {string} lastSavedEmailKey - Llave en routingConfig: 'lastAeRRSavedEmail' o 'lastSdrRRSavedEmail'
 * @return {Object} { status, email, nombre } o { status, message }
 */
function assignNextUserRR(roleKeyword, lastSavedEmailKey) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var config = getRoutingConfig();
    var pool = getActiveSortedUsers(roleKeyword);

    if (pool.length === 0) {
      // Fallback: si nadie está activo, devuelve al gerente o error
      if (config.managerEmail) {
        return { status: 'success', email: config.managerEmail, nombre: 'Gerente (fallback)', fallback: true };
      }
      return { status: 'error', message: 'No hay ' + roleKeyword + 's activos para asignar' };
    }

    if (pool.length === 1) {
      // Solo un usuario activo → asignación directa
      var solo = pool[0];
      config[lastSavedEmailKey] = solo.email;
      PropertiesService.getScriptProperties().setProperty('APP_ROUTING_CONFIG', JSON.stringify(config));
      return { status: 'success', email: solo.email, nombre: solo.nombre || solo.email };
    }

    // Múltiples usuarios → Round Robin
    var lastEmail = config[lastSavedEmailKey] || '';
    var lastIdx = -1;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].email === lastEmail) { lastIdx = i; break; }
    }
    var nextIdx = (lastIdx + 1) % pool.length;
    var next = pool[nextIdx];

    // Guardar el nuevo índice
    config[lastSavedEmailKey] = next.email;
    PropertiesService.getScriptProperties().setProperty('APP_ROUTING_CONFIG', JSON.stringify(config));

    return { status: 'success', email: next.email, nombre: next.nombre || next.email };
  } catch (err) {
    Logger.log('assignNextUserRR ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============ Phase 21: Duplicate Detection ============

/**
 * Auto-detect duplicate by email/phone in dim_contactos.
 * Returns { isDuplicate, originalId } for use by createNewLeadOrDeal.
 */
function autoDetectDuplicate(email, telefono) {
  try {
    var result = checkDuplicateLeads(email, telefono);
    if (result.found && result.matches && result.matches.length > 0) {
      // Return the first match's lead ID as the original
      var originalId = result.matches[0].id;
      return { isDuplicate: true, originalId: originalId || '' };
    }
    return { isDuplicate: false, originalId: '' };
  } catch (e) {
    Logger.log('autoDetectDuplicate ERROR: ' + e.message);
    return { isDuplicate: false, originalId: '' };
  }
}

/**
 * Get all leads that are duplicates of a given lead (where id_lead_original = idLead).
 */
function getLeadDuplicates(idLead) {
  try {
    var leads = readTable_(T_LEADS);
    var contactos = readTable_(T_CONTACTOS);
    var contactosIdx = indexBy_(contactos, 'id_contacto');
    var duplicates = [];
    for (var i = 0; i < leads.length; i++) {
      var ld = leads[i];
      if (String(ld.id_lead_original || '') === String(idLead)) {
        var contact = contactosIdx[String(ld.id_contacto || '')] || {};
        duplicates.push({
          id_lead: ld.id_lead,
          nombre: ((contact.nombre || '') + ' ' + (contact.apellido || '')).trim(),
          email: contact.email || '',
          status: ld.status || '',
          fecha_ingreso: ld.fecha_ingreso || '',
          servicio: ld.servicio_interes || ''
        });
      }
    }
    return duplicates;
  } catch (e) {
    Logger.log('getLeadDuplicates ERROR: ' + e.message);
    return [];
  }
}

// ============ Duplicate Alerts: Recent duplicates for SDR banner ============

/**
 * Returns leads with status 'Duplicado' that arrived in the last N days.
 * Used by the frontend to show an alert banner to SDRs.
 * @param {number} days - Number of days to look back (default 7)
 * @return {Array} Array of { id_lead, nombre, email, fecha_ingreso, servicio }
 */
function getRecentDuplicates(days) {
  try {
    days = parseInt(days) || 7;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    var leads = readTable_(T_LEADS);
    var contactos = readTable_(T_CONTACTOS);
    var contactosIdx = indexBy_(contactos, 'id_contacto');
    var results = [];

    for (var i = 0; i < leads.length; i++) {
      var ld = leads[i];
      if (String(ld.status || '').trim() !== 'Duplicado') continue;

      var fechaStr = ld.fecha_ingreso || '';
      if (!fechaStr) continue;
      var fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime()) || fecha < cutoff) continue;

      var contact = contactosIdx[String(ld.id_contacto || '')] || {};
      results.push({
        id_lead: ld.id_lead || '',
        nombre: ((contact.nombre || '') + ' ' + (contact.apellido || '')).trim(),
        email: contact.email || '',
        fecha_ingreso: fechaStr,
        servicio: ld.servicio_interes || ''
      });
    }
    return results;
  } catch (e) {
    Logger.log('getRecentDuplicates ERROR: ' + e.message);
    return [];
  }
}

// ============ Upload Payment Proof to Google Drive ============

// ============ Cross-view: Fetch deal data for a lead (SDR tab) ============

/**
 * Returns the deal object associated with a given lead ID.
 * Used by SDR to see deal progress in their lead modal.
 * @param {string} idLead - The lead ID
 * @return {Object|null} Deal fields or null if no deal exists
 */
function getDealForLead(idLead) {
  try {
    if (!idLead) return null;
    var deals = readTable_(T_DEALS);
    var deal = null;
    for (var i = 0; i < deals.length; i++) {
      if (String(deals[i].id_lead) === String(idLead)) { deal = deals[i]; break; }
    }
    if (!deal) return null;

    var vendedores = readTable_('dim_vendedores');
    var vendedorIdx = indexBy_(vendedores, 'id_vendedor');
    var ae = vendedorIdx[String(deal.id_vendedor_ae || '')] || {};

    return {
      id_deal: deal.id_deal || '',
      status_venta: deal.status_venta || '',
      proyeccion: deal.proyeccion || '',
      monto_proyeccion: deal.monto_proyeccion || '',
      monto_apartado: deal.monto_apartado || '',
      monto_cierre: deal.monto_cierre || '',
      monto_cotizacion: deal.monto_cotizacion || '',
      fecha_cotizacion: deal.fecha_cotizacion || '',
      fecha_pase_ventas: deal.fecha_pase_ventas || '',
      fecha_primer_contacto_ae: deal.fecha_primer_contacto_ae || '',
      fecha_cierre: deal.fecha_cierre || '',
      fecha_reagenda: deal.fecha_reagenda || '',
      razon_perdida: deal.razon_perdida || '',
      razon_perdida_otra: deal.razon_perdida_otra || '',
      descuento_pct: deal.descuento_pct || '',
      es_recompra: deal.es_recompra || '',
      producto_cierre: deal.producto_cierre || '',
      fuente_origen: deal.fuente_origen || '',
      tipo_transaccion: deal.tipo_transaccion || '',
      numero_toque_ae: deal.numero_toque_ae || '',
      notas_vendedor: deal.notas_vendedor || '',
      notas_cotizacion: deal.notas_cotizacion || '',
      ae_nombre: ae.nombre || '',
      ae_email: ae.email || ''
    };
  } catch (e) {
    Logger.log('getDealForLead ERROR: ' + e.message);
    return null;
  }
}

/**
 * Returns fresh SDR lead data for a given deal ID.
 * Mirror of getDealForLead — allows AE to see up-to-date SDR work.
 */
function getLeadForDeal(idDeal) {
  try {
    if (!idDeal) return null;
    var deals = readTable_(T_DEALS);
    var deal = null;
    for (var i = 0; i < deals.length; i++) {
      if (String(deals[i].id_deal) === String(idDeal)) { deal = deals[i]; break; }
    }
    if (!deal || !deal.id_lead) return null;

    // Get the SDR lead
    var leads = readTable_(T_LEADS);
    var lead = null;
    for (var i = 0; i < leads.length; i++) {
      if (String(leads[i].id_lead) === String(deal.id_lead)) { lead = leads[i]; break; }
    }
    if (!lead) return null;

    // Get contact info
    var contactos = readTable_(T_CONTACTOS);
    var contacto = null;
    if (lead.id_contacto) {
      for (var i = 0; i < contactos.length; i++) {
        if (String(contactos[i].id_contacto) === String(lead.id_contacto)) { contacto = contactos[i]; break; }
      }
    }
    contacto = contacto || {};

    // Get SDR vendedor name
    var vendedores = readTable_('dim_vendedores');
    var vendedorIdx = indexBy_(vendedores, 'id_vendedor');
    var sdr = vendedorIdx[String(lead.id_vendedor_sdr || '')] || {};

    // Get calificacion
    var califs = readTable_(T_CALIFICACION);
    var calif = null;
    for (var i = 0; i < califs.length; i++) {
      if (String(califs[i].id_lead) === String(lead.id_lead)) { calif = califs[i]; break; }
    }
    calif = calif || {};

    // Get campaign
    var campanas = readTable_(T_CAMPANAS);
    var campanaIdx = indexBy_(campanas, 'id_campana');
    var camp = campanaIdx[String(lead.id_campana || '')] || {};

    return {
      id_lead: lead.id_lead || '',
      // Contact info
      nombre: contacto.nombre || '',
      apellido: contacto.apellido || '',
      email: contacto.email || '',
      telefono: contacto.telefono_1 || '',
      empresa: contacto.empresa || '',
      pais: contacto.pais || '',
      ciudad: contacto.ciudad || '',
      area: contacto.area || '',
      empleados: contacto.empleados || '',
      nivel: contacto.nivel || '',
      // Lead status
      status: lead.status || '',
      calidad_contacto: lead.calidad_contacto || '',
      servicio: lead.servicio_interes || '',
      numero_toques: lead.numero_toques || 0,
      tipo_seguimiento: lead.tipo_seguimiento || '',
      status_seguimiento: lead.status_seguimiento || '',
      razon_perdida: lead.razon_perdida || '',
      razon_perdida_otra: lead.razon_perdida_otra || '',
      fecha_ingreso: lead.fecha_ingreso || '',
      fecha_asignacion: lead.fecha_asignacion || '',
      fecha_ultimo_contacto: lead.fecha_ultimo_contacto || '',
      es_recompra: lead.es_recompra || '',
      notas: lead.notas || '',
      sdr_nombre: sdr.nombre || '',
      sdr_email: sdr.email || '',
      // BANT / Calificación
      entendio_marketing: calif.entendio_info_marketing || '',
      mostro_interes: calif.mostro_interes_genuino || '',
      necesidad_puntual: calif.necesidad_puntual || '',
      perfil_adecuado: calif.perfil_adecuado || '',
      necesita_decision_tercero: calif.necesita_decision_tercero || '',
      tiene_presupuesto: calif.tiene_presupuesto || '',
      monto_presupuesto: calif.monto_presupuesto || '',
      asociacion_industria: calif.asociacion_industria || '',
      region: calif.region || '',
      tipo_membresia: calif.tipo_membresia || '',
      pricing_tier: calif.pricing_tier || '',
      // Campaign
      source: camp.source || '',
      medium: camp.medium || '',
      campaign: camp.campaign || ''
    };
  } catch (e) {
    Logger.log('getLeadForDeal ERROR: ' + e.message);
    return null;
  }
}

/**
 * Uploads a payment proof file to Google Drive and stores the link in the deal row.
 * @param {string} base64Data - Base64-encoded file content
 * @param {string} fileName - Original file name
 * @param {string} mimeType - MIME type (e.g., 'image/png', 'application/pdf')
 * @param {number} dealRow - Row number of the deal in fact_deals
 * @return {Object} { status, url, message }
 */
function uploadPaymentProof(base64Data, fileName, mimeType, dealRow, callerEmail) {
  try {
    if (!base64Data || !fileName || !dealRow) {
      return { status: 'error', message: 'Faltan datos para subir el archivo' };
    }

    // Decode base64
    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);

    // Create or find the CRM folder
    var folders = DriveApp.getFoldersByName('CRM_Comprobantes_Pago');
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder('CRM_Comprobantes_Pago');
    }

    // Upload file
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = file.getUrl();

    // Save URL in fact_deals
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_DEALS);
    if (!sheet) return { status: 'error', message: 'fact_deals no encontrada' };

    var colMap = getColumnMap_(sheet);
    var col = colMap['comprobante_pago_url'];
    if (col) {
      sheet.getRange(dealRow, col).setValue(fileUrl);
      // Log the change only if column exists and write succeeded
      var idDealCol = colMap['id_deal'];
      var idDeal = idDealCol ? sheet.getRange(dealRow, idDealCol).getValue() : '';
      var userEmail = callerEmail || Session.getActiveUser().getEmail() || 'System';
      logChange_('deal', idDeal, userEmail, 'comprobante_pago_url', '', fileUrl);
    }

    return { status: 'success', url: fileUrl, message: 'Comprobante subido correctamente' };
  } catch (err) {
    Logger.log('uploadPaymentProof ERROR: ' + err.message);
    return { status: 'error', message: err.message };
  }
}

// ============ Phase 23: Plantillas Per-User CRUD ============

/**
 * Get templates for a user: their own + shared by others.
 */
function getPlantillas(email, tipo) {
  try {
    var rows = readTable_(T_PLANTILLAS);
    var mine = [];
    var shared = [];
    var emailNorm = String(email || '').trim().toLowerCase();
    // Build vendedor lookup for id_vendedor matching
    var vendedores = readTable_(T_VENDEDORES);
    var myVendedorId = '';
    for (var v = 0; v < vendedores.length; v++) {
      if (String(vendedores[v].email || '').trim().toLowerCase() === emailNorm) {
        myVendedorId = String(vendedores[v].id_vendedor || '');
        break;
      }
    }

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      // Filter by tipo if specified (treat empty/missing tipo as 'nota')
      var rowTipo = String(r.tipo || 'nota').trim().toLowerCase();
      if (tipo && rowTipo !== String(tipo).toLowerCase()) continue;

      var isOwner = false;
      var rowVendedorId = String(r.id_vendedor || '');
      var rowEmail = String(r.email_usuario || '').trim().toLowerCase();
      if (myVendedorId && rowVendedorId && rowVendedorId === myVendedorId) isOwner = true;
      else if (rowEmail === emailNorm) isOwner = true;

      if (isOwner) {
        mine.push({
          id: r.id_plantilla,
          nombre: r.nombre || '',
          contenido: r.contenido || '',
          tipo: rowTipo,
          compartida: String(r.compartida || '').toLowerCase() === 'true',
          fecha: r.fecha_creacion || '',
          _row: r._row
        });
      } else if (String(r.compartida || '').toLowerCase() === 'true') {
        shared.push({
          id: r.id_plantilla,
          nombre: r.nombre || '',
          contenido: r.contenido || '',
          tipo: rowTipo,
          owner: r.email_usuario || '',
          fecha: r.fecha_creacion || '',
          _row: r._row
        });
      }
    }
    return { mine: mine, shared: shared };
  } catch (e) {
    Logger.log('getPlantillas ERROR: ' + e.message);
    return { mine: [], shared: [] };
  }
}

/**
 * Create or update a plantilla. If idPlantilla is provided, updates; otherwise creates.
 */
function savePlantilla(email, nombre, contenido, compartida, idPlantilla, tipo, idVendedor) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_PLANTILLAS);
    if (!sheet) return { status: 'error', message: 'Hoja config_plantillas_notas no encontrada' };
    var colMap = getColumnMap_(sheet);
    var tipoNorm = String(tipo || 'nota').toLowerCase();

    if (idPlantilla) {
      // Update existing
      var rows = readTable_(T_PLANTILLAS);
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i].id_plantilla) === String(idPlantilla)) {
          // Verify ownership: id_vendedor first, fallback email
          var ownerMatch = false;
          if (idVendedor && String(rows[i].id_vendedor || '') === String(idVendedor)) ownerMatch = true;
          else if (String(rows[i].email_usuario || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()) ownerMatch = true;
          if (!ownerMatch) return { status: 'error', message: 'No tienes permiso para editar esta plantilla' };

          var row = rows[i]._row;
          if (colMap['nombre']) sheet.getRange(row, colMap['nombre']).setValue(nombre);
          if (colMap['contenido']) sheet.getRange(row, colMap['contenido']).setValue(contenido);
          if (colMap['compartida']) sheet.getRange(row, colMap['compartida']).setValue(compartida ? 'TRUE' : 'FALSE');
          if (colMap['tipo']) sheet.getRange(row, colMap['tipo']).setValue(tipoNorm);
          return { status: 'success', id: idPlantilla };
        }
      }
      return { status: 'error', message: 'Plantilla no encontrada' };
    } else {
      // Create new
      var newId = getNextId_(sheet, 'id_plantilla');
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
      var newRow = new Array(headers.length).fill('');
      var set = function (n, v) { var c = colMap[n]; if (c) newRow[c - 1] = v; };
      set('id_plantilla', newId);
      set('id_vendedor', idVendedor || '');
      set('email_usuario', email);
      set('nombre', nombre);
      set('contenido', contenido);
      set('tipo', tipoNorm);
      set('compartida', compartida ? 'TRUE' : 'FALSE');
      set('fecha_creacion', new Date().toISOString());
      sheet.appendRow(newRow);
      return { status: 'success', id: newId };
    }
  } catch (e) {
    Logger.log('savePlantilla ERROR: ' + e.message);
    return { status: 'error', message: e.message };
  }
}

/**
 * Delete a plantilla (only if user is the owner).
 */
function deletePlantilla(email, idPlantilla, idVendedor) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_PLANTILLAS);
    if (!sheet) return { status: 'error', message: 'Hoja no encontrada' };
    var rows = readTable_(T_PLANTILLAS);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id_plantilla) === String(idPlantilla)) {
        // Verify ownership: id_vendedor first, fallback email
        var ownerMatch = false;
        if (idVendedor && String(rows[i].id_vendedor || '') === String(idVendedor)) ownerMatch = true;
        else if (String(rows[i].email_usuario || '').trim().toLowerCase() === String(email || '').trim().toLowerCase()) ownerMatch = true;
        if (!ownerMatch) return { status: 'error', message: 'No tienes permiso para eliminar esta plantilla' };

        sheet.deleteRow(rows[i]._row);
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'Plantilla no encontrada' };
  } catch (e) {
    Logger.log('deletePlantilla ERROR: ' + e.message);
    return { status: 'error', message: e.message };
  }
}

// ============ IMPORTADOR UNIVERSAL DE LEADS ============

var T_IMPORT_TEMP = '_importar_temporal';

/** Registry of CRM fields with aliases for smart matching. */
var IMPORT_FIELD_REGISTRY_ = [
  // ── Contacto ──
  {key:'nombre',table:'contacto',label:'Nombre',aliases:['nombre','name','first_name','first name','primer nombre'],type:'text'},
  {key:'apellido',table:'contacto',label:'Apellido',aliases:['apellido','last_name','last name','surname'],type:'text'},
  {key:'email',table:'contacto',label:'Email',aliases:['email','correo','e-mail','mail','correo electronico'],type:'email'},
  {key:'telefono_1',table:'contacto',label:'Teléfono',aliases:['tel','phone','telefono','celular','movil','whatsapp'],type:'phone'},
  {key:'telefono_2',table:'contacto',label:'Teléfono 2',aliases:['telefono 2','phone 2','tel 2','celular 2'],type:'phone'},
  {key:'empresa',table:'contacto',label:'Empresa',aliases:['empresa','company','organizacion','compania','razon social'],type:'text'},
  {key:'area',table:'contacto',label:'Área/Industria',aliases:['industria','industry','area','sector','giro','ramo'],type:'text'},
  {key:'nivel',table:'contacto',label:'Posición/Nivel',aliases:['posicion','position','cargo','puesto','nivel','title','job title','rol'],type:'text'},
  {key:'empleados',table:'contacto',label:'Empleados',aliases:['empleados','colaboradores','employees','headcount','num empleados'],type:'number'},
  {key:'ciudad',table:'contacto',label:'Ciudad',aliases:['ciudad','city','localidad','municipio'],type:'text'},
  {key:'pais',table:'contacto',label:'País',aliases:['pais','country','nacion'],type:'text'},
  {key:'link',table:'contacto',label:'Link/LinkedIn',aliases:['link','linkedin','url','perfil','profile'],type:'text'},
  // ── Lead ──
  {key:'fecha_ingreso',table:'lead',label:'Fecha de Ingreso',aliases:['timestamp','fecha','date','fecha_ingreso','created','fecha de registro','fecha ingreso'],type:'date'},
  {key:'status',table:'lead',label:'Status',aliases:['status','estado','etapa','stage','estatus'],type:'select'},
  {key:'calidad_contacto',table:'lead',label:'Calidad de Contacto',aliases:['calidad','quality','calidad de contacto','calidad contacto'],type:'select'},
  {key:'numero_toques',table:'lead',label:'Número de Toques',aliases:['toques','touches','intentos','en que toque va','numero toques'],type:'number'},
  {key:'tipo_seguimiento',table:'lead',label:'Tipo de Seguimiento',aliases:['tipo de seguimiento','tipo seguimiento','follow-up type'],type:'text'},
  {key:'status_seguimiento',table:'lead',label:'Status del Seguimiento',aliases:['status del seguimiento','status seguimiento'],type:'text'},
  {key:'razon_perdida',table:'lead',label:'Razón de Pérdida',aliases:['razon de perdida','loss reason','motivo perdida','razon perdida'],type:'text'},
  {key:'razon_perdida_otra',table:'lead',label:'Razón Pérdida (Otra)',aliases:['razon perdida otra','other loss reason'],type:'text'},
  {key:'monto_aproximado',table:'lead',label:'Monto Aproximado',aliases:['monto','monto aproximado','amount','valor','monto aproximado de inversion','inversion'],type:'currency'},
  {key:'notas',table:'lead',label:'Notas',aliases:['notas','notes','comentarios','observaciones','remarks'],type:'text'},
  {key:'fecha_asignacion',table:'lead',label:'Fecha de Asignación',aliases:['fecha de asignacion','assignment date','fecha asignacion'],type:'date'},
  {key:'vendedor_sdr',table:'lead',label:'Vendedor SDR',aliases:['vendedor','vendedor asignado','sdr','assigned to','asignado','responsable'],type:'lookup'},
  {key:'servicio_interes',table:'lead',label:'Servicio de Interés',aliases:['servicio','service','servicio de interes','producto','product'],type:'text'},
  {key:'es_recompra',table:'lead',label:'Es Recompra',aliases:['recompra','es recompra','repurchase'],type:'boolean'},
  // ── Campaña ──
  {key:'source',table:'campana',label:'Source (UTM)',aliases:['source','fuente','origen','utm_source'],type:'text'},
  {key:'medium',table:'campana',label:'Medium (UTM)',aliases:['medium','medio','utm_medium'],type:'text'},
  {key:'campaign',table:'campana',label:'Campaign (UTM)',aliases:['campaign','campana','utm_campaign'],type:'text'},
  {key:'term',table:'campana',label:'Term (UTM)',aliases:['term','termino','keyword','utm_term'],type:'text'},
  {key:'content',table:'campana',label:'Content (UTM)',aliases:['content','contenido','ad content','utm_content','fbclid'],type:'text'},
  // ── Calificación BANT ──
  {key:'entendio_info_marketing',table:'calificacion',label:'¿Entendió info Marketing?',aliases:['entendio la informacion de marketing','entendio marketing'],type:'yn'},
  {key:'mostro_interes_genuino',table:'calificacion',label:'¿Mostró interés genuino?',aliases:['mostro interes genuino','interes genuino'],type:'yn'},
  {key:'necesidad_puntual',table:'calificacion',label:'Necesidad puntual',aliases:['cual es tu necesidad puntual','necesidad','need'],type:'text'},
  {key:'perfil_adecuado',table:'calificacion',label:'¿Perfil adecuado?',aliases:['el perfil del prospecto es el adecuado','perfil adecuado'],type:'yn'},
  {key:'necesita_decision_tercero',table:'calificacion',label:'¿Necesita decisión de tercero?',aliases:['necesitas tocar base con alguien','decision maker','necesita decision'],type:'yn'},
  {key:'tiene_presupuesto',table:'calificacion',label:'¿Tiene presupuesto?',aliases:['tienes presupuesto asignado','presupuesto','budget'],type:'yn'},
  {key:'monto_presupuesto',table:'calificacion',label:'Monto Presupuesto',aliases:['monto presupuesto','budget amount','cuanto'],type:'currency'},
  // ── Special ──
  {key:'_notas_extra',table:'lead',label:'Agregar a Notas',aliases:[],type:'notes_append'}
];

/** Normalize text: lowercase, strip accents/punctuation. */
function normalizeImportText_(text) {
  return String(text || '').trim().toLowerCase()
    .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[¿?¡!]/g, '').replace(/[.,;:]/g, '').replace(/\s+/g, ' ');
}

/** Match score (0-100) between CSV header and a field definition. */
function fieldMatchScore_(csvHeader, fieldDef) {
  var norm = normalizeImportText_(csvHeader);
  if (!norm) return 0;
  if (norm === fieldDef.key) return 100;
  for (var i = 0; i < fieldDef.aliases.length; i++) {
    if (norm === normalizeImportText_(fieldDef.aliases[i])) return 95;
  }
  for (var j = 0; j < fieldDef.aliases.length; j++) {
    var alias = normalizeImportText_(fieldDef.aliases[j]);
    if (alias.length >= 3 && norm.indexOf(alias) !== -1) return 80;
    if (norm.length >= 3 && alias.indexOf(norm) !== -1) return 70;
  }
  var normWords = norm.split(' ');
  var maxOverlap = 0;
  for (var k = 0; k < fieldDef.aliases.length; k++) {
    var aliasWords = normalizeImportText_(fieldDef.aliases[k]).split(' ');
    var overlap = 0;
    for (var w = 0; w < normWords.length; w++) {
      if (normWords[w].length >= 3 && aliasWords.indexOf(normWords[w]) !== -1) overlap++;
    }
    var score = aliasWords.length > 0 ? (overlap / Math.max(normWords.length, aliasWords.length)) * 60 : 0;
    if (score > maxOverlap) maxOverlap = score;
  }
  return Math.round(maxOverlap);
}

function capitalizeTable_(str) {
  var labels = { contacto: 'Contacto', lead: 'Lead', campana: 'Campaña', calificacion: 'Calificación' };
  return labels[str] || str;
}

/** Clean/transform import value by type. */
function cleanImportValue_(value, type) {
  var v = String(value || '').trim();
  if (!v || v === 'undefined' || v === 'null') return '';
  switch (type) {
    case 'phone':
      if (/^\d+\.\d+E\+\d+$/i.test(v)) v = String(Math.round(parseFloat(v)));
      return v.replace(/[^\d+\-() ]/g, '');
    case 'currency':
      var num = v.replace(/[$,\s]/g, '');
      var parsed = parseFloat(num);
      return isNaN(parsed) ? '' : String(parsed);
    case 'number':
      var n = parseFloat(v.replace(/[,\s]/g, ''));
      return isNaN(n) ? '' : String(Math.round(n));
    case 'date':
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
        var parts = v.split('/');
        return parts[2] + '-' + ('0' + parts[0]).slice(-2) + '-' + ('0' + parts[1]).slice(-2);
      }
      if (v === '12/30/1899' || v === '0') return '';
      return v;
    case 'yn':
      var lower = v.toLowerCase();
      if (lower === 'si' || lower === 'sí' || lower === 'yes' || lower === 'true' || lower === '1') return 'Si';
      if (lower === 'no' || lower === 'false' || lower === '0') return 'No';
      return v;
    case 'boolean':
      var b = v.toLowerCase();
      return (b === 'si' || b === 'sí' || b === 'yes' || b === 'true' || b === '1') ? 'TRUE' : 'FALSE';
    case 'email':
      return v.toLowerCase();
    default:
      return v;
  }
}

/** Creates or clears the temp import sheet. */
function initImportSheet() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_IMPORT_TEMP);
    if (sheet) { sheet.clear(); } else { sheet = ss.insertSheet(T_IMPORT_TEMP); }
    return { status: 'success', message: 'Hoja "' + T_IMPORT_TEMP + '" lista. Pega tus datos y haz clic en "Analizar datos".' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

/** Reads temp sheet headers + sample data, returns smart mapping suggestions. */
function readImportData() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_IMPORT_TEMP);
    if (!sheet) return { status: 'error', message: 'No existe la hoja "' + T_IMPORT_TEMP + '". Créala primero.' };
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return { status: 'error', message: 'La hoja está vacía o sin datos. Pega tus datos (con encabezados en fila 1) y vuelve a intentar.' };

    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var sampleRows = sheet.getRange(2, 1, Math.min(5, lastRow - 1), lastCol).getDisplayValues();

    // Generate smart suggestions — two-pass to avoid duplicate assignments
    var candidates = [];
    for (var h = 0; h < headers.length; h++) {
      var header = headers[h];
      if (!header || header === '|') { candidates.push(null); continue; }
      var bestScore = 0, bestField = null;
      for (var f = 0; f < IMPORT_FIELD_REGISTRY_.length; f++) {
        var field = IMPORT_FIELD_REGISTRY_[f];
        if (field.key === '_notas_extra') continue;
        var score = fieldMatchScore_(header, field);
        if (score > bestScore) { bestScore = score; bestField = field; }
      }
      candidates.push({ score: bestScore, field: bestField, header: header });
    }

    var usedFields = {};
    var suggestions = [];
    for (var c = 0; c < candidates.length; c++) {
      var cand = candidates[c];
      if (!cand || !cand.field || cand.score < 40) {
        suggestions.push({ csvIndex: c, csvHeader: headers[c] || '', target: '', targetLabel: '', confidence: 0 });
        continue;
      }
      var fieldKey = cand.field.table + '.' + cand.field.key;
      if (usedFields[fieldKey] && usedFields[fieldKey].score >= cand.score) {
        suggestions.push({ csvIndex: c, csvHeader: cand.header, target: '', targetLabel: '', confidence: 0 });
      } else {
        if (usedFields[fieldKey]) {
          var prevIdx = usedFields[fieldKey].sugIdx;
          suggestions[prevIdx].target = '';
          suggestions[prevIdx].targetLabel = '';
          suggestions[prevIdx].confidence = 0;
        }
        usedFields[fieldKey] = { score: cand.score, sugIdx: suggestions.length };
        suggestions.push({
          csvIndex: c, csvHeader: cand.header, target: fieldKey,
          targetLabel: cand.field.label + ' (' + capitalizeTable_(cand.field.table) + ')',
          confidence: cand.score
        });
      }
    }

    return {
      status: 'success', headers: headers, sampleData: sampleRows, suggestions: suggestions,
      totalRows: lastRow - 1,
      fieldRegistry: IMPORT_FIELD_REGISTRY_.map(function(f) {
        return { key: f.table + '.' + f.key, label: f.label, table: f.table, type: f.type };
      })
    };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

/** Preview import data with applied mappings. */
function previewImportData(config) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_IMPORT_TEMP);
    if (!sheet) return { status: 'error', message: 'Hoja temporal no encontrada.' };
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var dataRows = sheet.getRange(2, 1, Math.min(10, lastRow - 1), lastCol).getDisplayValues();

    var mappings = (config.mappings || []).filter(function(m) { return m.target; });
    var previewHeaders = [];
    var resolvedTypes = [];
    for (var m = 0; m < mappings.length; m++) {
      previewHeaders.push(mappings[m].targetLabel || mappings[m].target);
      var parts = mappings[m].target.split('.');
      var fType = 'text';
      for (var fd = 0; fd < IMPORT_FIELD_REGISTRY_.length; fd++) {
        if (IMPORT_FIELD_REGISTRY_[fd].table === parts[0] && IMPORT_FIELD_REGISTRY_[fd].key === parts[1]) {
          fType = IMPORT_FIELD_REGISTRY_[fd].type; break;
        }
      }
      resolvedTypes.push(fType);
    }

    var previewRows = [];
    var validCount = 0, skipCount = 0;
    for (var r = 0; r < dataRows.length; r++) {
      var row = dataRows[r], previewRow = [], hasEmail = false, hasTel = false;
      for (var p = 0; p < mappings.length; p++) {
        var rawVal = row[mappings[p].csvIndex] || '';
        var cleaned = cleanImportValue_(rawVal, resolvedTypes[p]);
        previewRow.push(cleaned || rawVal);
        if (mappings[p].target === 'contacto.email' && cleaned) hasEmail = true;
        if (mappings[p].target === 'contacto.telefono_1' && cleaned) hasTel = true;
      }
      if (hasEmail || hasTel) validCount++; else skipCount++;
      previewRows.push(previewRow);
    }

    return {
      status: 'success', headers: previewHeaders, rows: previewRows,
      totalRows: lastRow - 1, previewCount: dataRows.length,
      stats: { valid: validCount, skipped: skipCount, note: 'Preview de ' + dataRows.length + ' de ' + (lastRow - 1) + ' filas' }
    };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

/** Execute lead import — batch writes to all CRM tables. */
function executeLeadImport(config, callerEmail) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (lockErr) {
    return { status: 'error', message: 'Sistema ocupado. Intenta en unos segundos.' };
  }
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tempSheet = ss.getSheetByName(T_IMPORT_TEMP);
    if (!tempSheet) return { status: 'error', message: 'Hoja temporal no encontrada.' };
    var lastRow = tempSheet.getLastRow();
    var lastCol = tempSheet.getLastColumn();
    if (lastRow < 2) return { status: 'error', message: 'Sin datos para importar.' };

    var tempHeaders = tempSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var tempData = tempSheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    var mappings = (config.mappings || []).filter(function(m) { return m.target; });
    if (!mappings.length) return { status: 'error', message: 'No hay columnas mapeadas.' };

    // Open target sheets
    var contactSheet = ss.getSheetByName(T_CONTACTOS);
    var leadsSheet = ss.getSheetByName(T_LEADS);
    var campSheet = ss.getSheetByName(T_CAMPANAS);
    var califSheet = ss.getSheetByName(T_CALIFICACION);
    if (!contactSheet || !leadsSheet) return { status: 'error', message: 'Hojas CRM no encontradas.' };

    // Column maps & headers per table
    var tables = {
      contacto: { sheet: contactSheet, colMap: getColumnMap_(contactSheet), headers: contactSheet.getRange(1,1,1,contactSheet.getLastColumn()).getDisplayValues()[0] },
      lead: { sheet: leadsSheet, colMap: getColumnMap_(leadsSheet), headers: leadsSheet.getRange(1,1,1,leadsSheet.getLastColumn()).getDisplayValues()[0] }
    };
    if (campSheet) tables.campana = { sheet: campSheet, colMap: getColumnMap_(campSheet), headers: campSheet.getRange(1,1,1,campSheet.getLastColumn()).getDisplayValues()[0] };
    if (califSheet) tables.calificacion = { sheet: califSheet, colMap: getColumnMap_(califSheet), headers: califSheet.getRange(1,1,1,califSheet.getLastColumn()).getDisplayValues()[0] };

    // Next IDs
    var nextIds = {
      contacto: parseInt(getNextId_(contactSheet, 'id_contacto'), 10) || 1,
      lead: parseInt(getNextId_(leadsSheet, 'id_lead'), 10) || 1,
      campana: campSheet ? (parseInt(getNextId_(campSheet, 'id_campana'), 10) || 1) : 1,
      calificacion: califSheet ? (parseInt(getNextId_(califSheet, 'id_calificacion'), 10) || 1) : 1
    };

    // Pre-load vendedores for name→ID lookup
    var vendedorByName = {};
    try {
      var vendedores = readTable_(T_VENDEDORES);
      for (var vi = 0; vi < vendedores.length; vi++) {
        vendedorByName[normalizeImportText_(vendedores[vi].nombre || '')] = vendedores[vi].id_vendedor;
      }
    } catch (ignore) {}

    // Campaign dedup cache
    var campaignCache = {};
    if (campSheet) {
      var existCamps = readTable_(T_CAMPANAS);
      for (var ec = 0; ec < existCamps.length; ec++) {
        var camp = existCamps[ec];
        campaignCache[(camp.source || '') + '|' + (camp.medium || '') + '|' + (camp.campaign || '')] = camp.id_campana;
      }
    }

    // Resolve mappings with field types
    var resolvedMaps = [];
    for (var rm = 0; rm < mappings.length; rm++) {
      var parts = mappings[rm].target.split('.');
      var tbl = parts[0], fld = parts[1], fType = 'text';
      for (var fr = 0; fr < IMPORT_FIELD_REGISTRY_.length; fr++) {
        if (IMPORT_FIELD_REGISTRY_[fr].table === tbl && IMPORT_FIELD_REGISTRY_[fr].key === fld) {
          fType = IMPORT_FIELD_REGISTRY_[fr].type; break;
        }
      }
      resolvedMaps.push({ csvIndex: mappings[rm].csvIndex, table: tbl, field: fld, type: fType });
    }

    // Helper: set cell value by column name
    var setC = function(colMap, arr, name, val) { var c = colMap[name]; if (c) arr[c - 1] = val; };

    // Process all rows
    var newContacts = [], newLeads = [], newCampaigns = [], newCalifs = [];
    var imported = 0, skipped = 0;

    for (var i = 0; i < tempData.length; i++) {
      var row = tempData[i];
      var cf = {}, lf = {}, cpf = {}, clf = {};
      var notesExtra = [];

      for (var j = 0; j < resolvedMaps.length; j++) {
        var rM = resolvedMaps[j];
        var raw = (row[rM.csvIndex] || '').trim();
        if (!raw || raw === 'undefined') continue;

        if (rM.type === 'notes_append') {
          notesExtra.push('[' + (tempHeaders[rM.csvIndex] || 'Info') + '] ' + raw);
          continue;
        }
        var clean = cleanImportValue_(raw, rM.type);
        if (!clean) continue;

        if (rM.table === 'contacto') { cf[rM.field] = clean; }
        else if (rM.table === 'lead') {
          if (rM.field === 'notas') { lf.notas = (lf.notas || '') + (lf.notas ? '\n' : '') + clean; }
          else { lf[rM.field] = clean; }
        }
        else if (rM.table === 'campana') { cpf[rM.field] = clean; }
        else if (rM.table === 'calificacion') { clf[rM.field] = clean; }
      }

      // Append extra notes columns
      if (notesExtra.length) {
        lf.notas = (lf.notas || '') + (lf.notas ? '\n---\n' : '') + notesExtra.join('\n');
      }

      // Skip rows without email AND phone
      if (!cf.email && !cf.telefono_1) { skipped++; continue; }

      // ── Campaign ──
      var campId = '';
      if (cpf.source || cpf.medium || cpf.campaign) {
        var ck = (cpf.source || '') + '|' + (cpf.medium || '') + '|' + (cpf.campaign || '');
        if (campaignCache[ck]) {
          campId = campaignCache[ck];
        } else if (tables.campana) {
          campId = nextIds.campana++;
          campaignCache[ck] = campId;
          var campRow = new Array(tables.campana.headers.length).fill('');
          setC(tables.campana.colMap, campRow, 'id_campana', campId);
          setC(tables.campana.colMap, campRow, 'source', cpf.source || '');
          setC(tables.campana.colMap, campRow, 'medium', cpf.medium || '');
          setC(tables.campana.colMap, campRow, 'campaign', cpf.campaign || '');
          setC(tables.campana.colMap, campRow, 'term', cpf.term || '');
          setC(tables.campana.colMap, campRow, 'content', cpf.content || '');
          newCampaigns.push(campRow);
        }
      }

      // ── Contact ──
      var contactId = nextIds.contacto++;
      var ctRow = new Array(tables.contacto.headers.length).fill('');
      setC(tables.contacto.colMap, ctRow, 'id_contacto', contactId);
      setC(tables.contacto.colMap, ctRow, 'nombre', cf.nombre || '');
      setC(tables.contacto.colMap, ctRow, 'apellido', cf.apellido || '');
      setC(tables.contacto.colMap, ctRow, 'email', cf.email || '');
      setC(tables.contacto.colMap, ctRow, 'telefono_1', cf.telefono_1 || '');
      setC(tables.contacto.colMap, ctRow, 'telefono_2', cf.telefono_2 || '');
      setC(tables.contacto.colMap, ctRow, 'empresa', cf.empresa || '');
      setC(tables.contacto.colMap, ctRow, 'area', cf.area || '');
      setC(tables.contacto.colMap, ctRow, 'nivel', cf.nivel || '');
      setC(tables.contacto.colMap, ctRow, 'empleados', cf.empleados || '');
      setC(tables.contacto.colMap, ctRow, 'ciudad', cf.ciudad || '');
      setC(tables.contacto.colMap, ctRow, 'pais', cf.pais || '');
      setC(tables.contacto.colMap, ctRow, 'link', cf.link || '');
      setC(tables.contacto.colMap, ctRow, 'fecha_creacion', lf.fecha_ingreso || new Date());
      newContacts.push(ctRow);

      // ── Lead ──
      var leadId = nextIds.lead++;
      var ldRow = new Array(tables.lead.headers.length).fill('');
      setC(tables.lead.colMap, ldRow, 'id_lead', leadId);
      setC(tables.lead.colMap, ldRow, 'id_contacto', contactId);
      setC(tables.lead.colMap, ldRow, 'id_campana', campId);
      setC(tables.lead.colMap, ldRow, 'status', lf.status || 'Nuevo');
      setC(tables.lead.colMap, ldRow, 'calidad_contacto', lf.calidad_contacto || '');
      setC(tables.lead.colMap, ldRow, 'servicio_interes', lf.servicio_interes || '');
      setC(tables.lead.colMap, ldRow, 'fecha_ingreso', lf.fecha_ingreso || new Date());
      setC(tables.lead.colMap, ldRow, 'fecha_asignacion', lf.fecha_asignacion || '');
      setC(tables.lead.colMap, ldRow, 'numero_toques', lf.numero_toques || '');
      setC(tables.lead.colMap, ldRow, 'tipo_seguimiento', lf.tipo_seguimiento || '');
      setC(tables.lead.colMap, ldRow, 'status_seguimiento', lf.status_seguimiento || '');
      setC(tables.lead.colMap, ldRow, 'razon_perdida', lf.razon_perdida || '');
      setC(tables.lead.colMap, ldRow, 'razon_perdida_otra', lf.razon_perdida_otra || '');
      setC(tables.lead.colMap, ldRow, 'monto_aproximado', lf.monto_aproximado || '');
      setC(tables.lead.colMap, ldRow, 'notas', lf.notas || '');
      setC(tables.lead.colMap, ldRow, 'es_recompra', lf.es_recompra || '');
      if (lf.vendedor_sdr) {
        var vId = vendedorByName[normalizeImportText_(lf.vendedor_sdr)];
        if (vId) setC(tables.lead.colMap, ldRow, 'id_vendedor_sdr', vId);
      }
      newLeads.push(ldRow);

      // ── Calificación BANT ──
      var hasCalif = false;
      for (var ck2 in clf) { if (clf.hasOwnProperty(ck2)) { hasCalif = true; break; } }
      if (hasCalif && tables.calificacion) {
        var califId = nextIds.calificacion++;
        var calRow = new Array(tables.calificacion.headers.length).fill('');
        setC(tables.calificacion.colMap, calRow, 'id_calificacion', califId);
        setC(tables.calificacion.colMap, calRow, 'id_lead', leadId);
        setC(tables.calificacion.colMap, calRow, 'entendio_info_marketing', clf.entendio_info_marketing || '');
        setC(tables.calificacion.colMap, calRow, 'mostro_interes_genuino', clf.mostro_interes_genuino || '');
        setC(tables.calificacion.colMap, calRow, 'necesidad_puntual', clf.necesidad_puntual || '');
        setC(tables.calificacion.colMap, calRow, 'perfil_adecuado', clf.perfil_adecuado || '');
        setC(tables.calificacion.colMap, calRow, 'necesita_decision_tercero', clf.necesita_decision_tercero || '');
        setC(tables.calificacion.colMap, calRow, 'tiene_presupuesto', clf.tiene_presupuesto || '');
        setC(tables.calificacion.colMap, calRow, 'monto_presupuesto', clf.monto_presupuesto || '');
        setC(tables.calificacion.colMap, calRow, 'fecha_calificacion', lf.fecha_ingreso || new Date());
        newCalifs.push(calRow);
      }
      imported++;
    }

    // ── Batch write to all tables ──
    if (newCampaigns.length > 0 && tables.campana) {
      var ci = getFirstEmptyRow_(tables.campana.sheet, 'id_campana');
      tables.campana.sheet.getRange(ci, 1, newCampaigns.length, tables.campana.headers.length).setValues(newCampaigns);
    }
    if (newContacts.length > 0) {
      var cti = getFirstEmptyRow_(tables.contacto.sheet, 'id_contacto');
      tables.contacto.sheet.getRange(cti, 1, newContacts.length, tables.contacto.headers.length).setValues(newContacts);
    }
    if (newLeads.length > 0) {
      var li = getFirstEmptyRow_(tables.lead.sheet, 'id_lead');
      tables.lead.sheet.getRange(li, 1, newLeads.length, tables.lead.headers.length).setValues(newLeads);
    }
    if (newCalifs.length > 0 && tables.calificacion) {
      var qi = getFirstEmptyRow_(tables.calificacion.sheet, 'id_calificacion');
      tables.calificacion.sheet.getRange(qi, 1, newCalifs.length, tables.calificacion.headers.length).setValues(newCalifs);
    }

    logChange_('Import', 0, callerEmail || Session.getActiveUser().getEmail() || 'System', 'IMPORTACIÓN MASIVA', '',
      imported + ' leads, ' + newContacts.length + ' contactos, ' + newCampaigns.length + ' campañas, ' + newCalifs.length + ' calificaciones');

    return { status: 'success', imported: imported, skipped: skipped,
      contacts: newContacts.length, campaigns: newCampaigns.length, qualifications: newCalifs.length };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/** Delete the temp import sheet. */
function clearImportSheet() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(T_IMPORT_TEMP);
    if (sheet) ss.deleteSheet(sheet);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}


// ============ DIAGNOSTICS ============

/** Returns CRM version to verify deployment. */
function getVersion() { return CRM_VERSION; }

/**
 * Repairs sheet header formats — sets row 1 to Plain Text on all sheets.
 * Run ONCE from the Apps Script editor to permanently fix the root cause
 * of "No se puede convertir X en int" errors.
 */
function repairSheetFormats() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheets = ss.getSheets();
  var fixed = [];
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var name = sh.getName();
    var lastCol = sh.getLastColumn();
    if (lastCol > 0) {
      sh.getRange(1, 1, 1, lastCol).setNumberFormat('@');
      fixed.push(name + ' (' + lastCol + ' cols)');
    }
  }
  return 'Fixed headers on: ' + fixed.join(', ');
}

/**
 * Diagnostic test — run from GAS editor to identify exactly what fails.
 * Returns detailed report of which operations work on each sheet.
 */
function diagnosticTest() {
  var results = [];
  results.push('CRM Version: ' + CRM_VERSION);
  results.push('Timestamp: ' + new Date().toISOString());
  results.push('');

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var testSheets = ['dim_contactos', 'fact_leads', 'fact_toques', 'fact_deals'];

  for (var s = 0; s < testSheets.length; s++) {
    var name = testSheets[s];
    var sheet = ss.getSheetByName(name);
    if (!sheet) { results.push('SKIP: ' + name + ' not found'); continue; }

    results.push('=== ' + name + ' ===');
    var lastRow, lastCol;
    try { lastRow = sheet.getLastRow(); results.push('  getLastRow: ' + lastRow); } catch(e) { results.push('  getLastRow FAIL: ' + e.message); }
    try { lastCol = sheet.getLastColumn(); results.push('  getLastColumn: ' + lastCol); } catch(e) { results.push('  getLastColumn FAIL: ' + e.message); }

    // Test 1: Read header row only (single row)
    try {
      var h = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
      results.push('  Header row (single): OK — ' + h.slice(0,3).join(', ') + '...');
    } catch(e) { results.push('  Header row (single) FAIL: ' + e.message); }

    // Test 2: Read data rows only (row 2+)
    if (lastRow >= 2) {
      try {
        var d = sheet.getRange(2, 1, Math.min(lastRow - 1, 5), lastCol).getDisplayValues();
        results.push('  Data rows (2-' + Math.min(lastRow, 6) + '): OK — ' + d.length + ' rows');
      } catch(e) { results.push('  Data rows FAIL: ' + e.message); }
    }

    // Test 3: Full getDataRange (header + data together — the problematic one)
    try {
      var full = sheet.getDataRange().getDisplayValues();
      results.push('  getDataRange FULL: OK — ' + full.length + ' rows');
    } catch(e) { results.push('  getDataRange FULL FAIL: ' + e.message); }

    // Test 4: safeReadAll_
    try {
      var safe = safeReadAll_(sheet);
      results.push('  safeReadAll_: OK — ' + safe.length + ' rows');
    } catch(e) { results.push('  safeReadAll_ FAIL: ' + e.message); }

    // Test 5: getColumnMap_
    try {
      var cm = getColumnMap_(sheet);
      var keys = Object.keys(cm);
      results.push('  getColumnMap_: OK — ' + keys.length + ' cols');
    } catch(e) { results.push('  getColumnMap_ FAIL: ' + e.message); }

    // Test 6: getNextId_
    var idColName = name === 'dim_contactos' ? 'id_contacto' :
                    name === 'fact_leads' ? 'id_lead' :
                    name === 'fact_toques' ? 'id_registro_toque' : 'id_deal';
    try {
      var nid = getNextId_(sheet, idColName);
      results.push('  getNextId_(' + idColName + '): OK — ' + nid);
    } catch(e) { results.push('  getNextId_ FAIL: ' + e.message); }

    // Test 7: Column A number format
    try {
      var fmt = sheet.getRange(1, 1).getNumberFormat();
      results.push('  Col A format: "' + fmt + '"');
    } catch(e) { results.push('  Col A format FAIL: ' + e.message); }

    results.push('');
  }

  var report = results.join('\n');
  Logger.log(report);
  return report;
}
