/**
 * ============================================
 * CRM SWAT Squad — Procesar Leads de Landing
 * ============================================
 * Lee filas nuevas de MULTIPLES hojas de landing pages y las distribuye
 * en dim_contactos, fact_leads y fact_calificacion.
 *
 * ARQUITECTURA MULTI-LANDING:
 * - Cada landing page de Framer tiene su propia hoja en el spreadsheet
 *   (conectada via IMPORTRANGE al Google Sheet que Framer crea)
 * - El procesador lee TODAS las hojas configuradas en LANDING_SOURCES
 * - Usa mapeo dinamico por HEADERS (no por indice) para ser robusto
 *   contra el orden variable de columnas que Framer genera
 * - Cada lead queda taggeado con su fuente via dim_campanas
 *
 * - NUNCA escribe en las hojas de landing (son read-only, IMPORTRANGE)
 * - Detecta leads nuevos comparando el timestamp exacto
 * - Permite mismo email multiples veces (cada submission = lead nuevo)
 * - Previene duplicados reales (mismo formulario procesado dos veces)
 * - Siempre hace APPEND, nunca sobreescribe
 *
 * SETUP:
 * 1. Ejecutar crearHojasLanding() para crear las hojas en la BBDD
 * 2. Poner IMPORTRANGE en celda A1 de cada hoja (ver instrucciones)
 * 3. Ejecutar configurarTriggerLanding() UNA sola vez
 * 4. Listo — corre cada 5 minutos solo
 * ============================================
 */

// ── ID del Spreadsheet de la BBDD del CRM ──
var CRM_SS_ID = '1rpgt1XJikbDpYDI1IVCBzBJgSTzafxtFvdAgsmxr0k4';

// ══════════════════════════════════════════
// CONFIGURACION DE FUENTES DE LANDING PAGES
// ══════════════════════════════════════════
// Para agregar una nueva landing page en el futuro:
// 1. Agregar un objeto aqui con sheetName unico y campaignName descriptivo
// 2. Crear la hoja en la BBDD con IMPORTRANGE apuntando al Sheet de Framer
// 3. El procesador la detecta automaticamente en la proxima corrida

var LANDING_SOURCES = [
  {
    sheetName: 'NO TOCAR',
    campaignName: 'LP - Principal',
    source: 'Landing Page',
    medium: 'Formulario Web'
  },
  {
    sheetName: 'LP_Directores',
    campaignName: 'LP - Directores',
    source: 'Landing Page',
    medium: 'Formulario Web'
  },
  {
    sheetName: 'LP_RRHH',
    campaignName: 'LP - Recursos Humanos',
    source: 'Landing Page',
    medium: 'Formulario Web'
  },
  {
    sheetName: 'LP_Webinar',
    campaignName: 'LP - Webinar',
    source: 'Landing Page',
    medium: 'Formulario Web'
  }
];

// ── Mapeo de headers de Framer → campos internos del CRM ──
// Framer usa estos nombres de columna (se normalizan a lowercase)
var HEADER_FIELD_MAP = {
  'date':       'fecha',
  'name':       'nombre',
  'email':      'email',
  'phone':      'phone',
  'enterprise': 'empresa',
  'industria':  'industria',
  'empleados':  'empleados',
  'position':   'position',
  'radio':      'radio'
};

// ══════════════════════════════════════════
// FUNCION PRINCIPAL
// ══════════════════════════════════════════

function procesarLeadsLanding() {
  var ss = SpreadsheetApp.openById(CRM_SS_ID);

  var hContactos  = ss.getSheetByName('dim_contactos');
  var hLeads      = ss.getSheetByName('fact_leads');
  var hCalif      = ss.getSheetByName('fact_calificacion');
  var hVendedores = ss.getSheetByName('dim_vendedores');
  var hCampanas   = ss.getSheetByName('dim_campanas');

  if (!hContactos || !hLeads || !hCalif || !hCampanas) {
    Logger.log('ERROR: Faltan hojas en la BBDD (dim_contactos, fact_leads, fact_calificacion, o dim_campanas)');
    return;
  }

  // ── Cargar timestamps existentes para detectar duplicados ──
  // CRITICAL: Load from BOTH dim_contactos.fecha_creacion AND fact_leads.fecha_ingreso
  // Without fact_leads, duplicate-contact submissions (which don't create a new
  // contact row) have their timestamp lost between runs, causing the same Framer
  // row to be re-processed every 5 minutes indefinitely.
  var fechasExistentes = cargarFechasExistentes_(hContactos, hLeads);

  // ── Obtener/crear campanas para cada landing ──
  var campanasCache = {};
  for (var s = 0; s < LANDING_SOURCES.length; s++) {
    var src = LANDING_SOURCES[s];
    campanasCache[src.sheetName] = getOrCreateCampana_(
      hCampanas, src.campaignName, src.source, src.medium
    );
  }

  // ── Obtener ultimos IDs ──
  // CRITICAL: pass column NAME strings, not index numbers.
  // getNextId_ in Código.js matches by header name — passing a number
  // would stringify to "1" which never matches, causing ID = 1 always.
  var nextContactoId = getNextId_(hContactos, 'id_contacto');
  var nextLeadId     = getNextId_(hLeads, 'id_lead');
  var nextCalifId    = getNextId_(hCalif, 'id_calificacion');

  // ── Round robin SDR (global, no por landing) ──
  var sdrs = getActiveSDRs_(hVendedores);
  var sdrIndex = 0;

  // Pre-load all existing contacts for smart duplicate detection
  var existingContacts = readTable_('dim_contactos');
  // Pre-load leads for finding original lead ID
  var existingLeadRows = readTable_('fact_leads');

  var totalProcesados = 0;
  var totalYaExisten  = 0;
  var totalDuplicados = 0;

  // ── Procesar cada fuente de landing ──
  for (var s = 0; s < LANDING_SOURCES.length; s++) {
    var src = LANDING_SOURCES[s];
    var hojaLanding = ss.getSheetByName(src.sheetName);

    if (!hojaLanding) {
      Logger.log('AVISO: Hoja "' + src.sheetName + '" no encontrada, saltando...');
      continue;
    }

    var lastRow = hojaLanding.getLastRow();
    var lastCol = hojaLanding.getLastColumn();
    if (lastRow < 2 || lastCol < 1) {
      Logger.log(src.sheetName + ': sin datos');
      continue;
    }

    // ── Leer headers y construir mapeo dinamico ──
    var headers = hojaLanding.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = buildColumnMap_(headers);

    if (!colMap) {
      Logger.log('ERROR: Headers invalidos en "' + src.sheetName + '" — no se encontro email ni phone');
      continue;
    }

    // ── Leer datos (fila 2 en adelante) ──
    var datos = hojaLanding.getRange(2, 1, lastRow - 1, lastCol).getValues();

    var idCampana = campanasCache[src.sheetName];
    var procesados = 0;
    var yaExisten = 0;

    for (var i = 0; i < datos.length; i++) {
      var fila = datos[i];

      // ── Extraer fecha y verificar duplicado ──
      var fechaRaw = colMap.fecha !== -1 ? fila[colMap.fecha] : null;
      if (!fechaRaw) continue;

      var fechaStr = String(fechaRaw);
      var fechaISO = '';
      try { fechaISO = new Date(fechaRaw).toISOString(); } catch (e) {}

      if (fechasExistentes[fechaStr] || fechasExistentes[fechaISO]) {
        yaExisten++;
        continue;
      }

      // ── Extraer campos con mapeo dinamico ──
      var email = getField_(fila, colMap.email);
      var phone = getField_(fila, colMap.phone);

      // Saltar filas vacias (sin email ni telefono)
      if (!email && !phone) continue;

      var fecha     = fechaRaw || new Date();
      var industria = getField_(fila, colMap.industria);
      var empleados = colMap.empleados !== -1 ? (fila[colMap.empleados] || '') : '';
      var empresa   = getField_(fila, colMap.empresa);
      var position  = getField_(fila, colMap.position);
      var radio     = getField_(fila, colMap.radio);
      var nombre    = getField_(fila, colMap.nombre);

      // Separar nombre y apellido
      var partes = nombre.split(' ');
      var firstName = partes[0] || '';
      var lastName  = partes.slice(1).join(' ') || '';

      // ── 1. Smart contact detection: find existing or create new ──
      var contactMatch = findExistingContact_(existingContacts, email, phone, firstName, lastName);
      var contactoId;
      var isDuplicate = false;
      var originalLeadId = '';

      if (contactMatch.found && contactMatch.contacto) {
        // Reuse existing contact — skip creation
        contactoId = contactMatch.contacto.id_contacto;
        isDuplicate = true;
        originalLeadId = findFirstLeadForContact_(existingLeadRows, contactoId) || '';
        Logger.log('[DUP] Contacto existente encontrado: ' + contactoId + ' (' + contactMatch.matchType + ')');
      } else {
        // Create new contact
        contactoId = nextContactoId++;
        hContactos.appendRow([
          contactoId, firstName, lastName, email, phone, '',
          empresa, industria, '', '', empleados, position,
          '', '', fecha
        ]);
        // Add to in-memory index for intra-run dedup
        existingContacts.push({
          id_contacto: String(contactoId), nombre: firstName, apellido: lastName,
          email: email, telefono_1: phone, telefono_2: ''
        });
      }

      // Registrar timestamp para evitar duplicados intra-corrida
      fechasExistentes[fechaStr] = true;
      if (fechaISO) fechasExistentes[fechaISO] = true;

      // ── 2. fact_leads (siempre se crea, marcado como Duplicado si aplica) ──
      var vendedorId = '';
      if (sdrs.length > 0) {
        vendedorId = sdrs[sdrIndex % sdrs.length].id;
        sdrIndex++;
      }

      var leadStatus = isDuplicate ? 'Duplicado' : 'Nuevo';
      var leadId = nextLeadId++;
      hLeads.appendRow([
        leadId, contactoId, isDuplicate ? originalLeadId : '', idCampana, vendedorId,
        leadStatus, 'Sin Calificar', radio,
        fecha, fecha, '', 0,
        '', 'Activo', '', '', '', '',
        false, '', '', ''
      ]);
      // Track new lead in memory for subsequent lookups
      existingLeadRows.push({ id_lead: String(leadId), id_contacto: String(contactoId), status: leadStatus });
      if (isDuplicate) totalDuplicados++;

      // Auto-detect "prueba" in field values and flag the lead
      if (detectPruebaInText_([nombre, email, empresa, phone, position, industria])) {
        var leadsColMap = getColumnMap_(hLeads);
        if (leadsColMap['es_prueba']) {
          hLeads.getRange(hLeads.getLastRow(), leadsColMap['es_prueba']).setValue('TRUE');
        }
        // Also flag the contact
        var contactsColMap = getColumnMap_(hContactos);
        if (contactsColMap['es_prueba'] && !contactMatch.found) {
          hContactos.getRange(hContactos.getLastRow(), contactsColMap['es_prueba']).setValue('TRUE');
        }
      }

      // ── 3. fact_calificacion (vacia) ──
      var califId = nextCalifId++;
      hCalif.appendRow([
        califId, leadId, '', '', '', '', '', '', '', '',
        '', '', '', '', '', '', '', ''
      ]);

      procesados++;
      Logger.log('[' + src.campaignName + '] Lead: ' + nombre + ' (' + email + ') -> SDR ' + vendedorId + ' -> Lead ID ' + leadId);
    }

    totalProcesados += procesados;
    totalYaExisten += yaExisten;
    Logger.log(src.sheetName + ': nuevos=' + procesados + ', ya existian=' + yaExisten + ', total filas=' + datos.length);
  }

  Logger.log('=== RESUMEN GLOBAL ===');
  Logger.log('Fuentes procesadas: ' + LANDING_SOURCES.length);
  Logger.log('Total nuevos procesados: ' + totalProcesados);
  Logger.log('Total ya existian (timestamp): ' + totalYaExisten);
  Logger.log('Total duplicados (contacto reutilizado): ' + totalDuplicados);

  if (totalProcesados > 0) {
    SpreadsheetApp.flush();
  }
}

// ══════════════════════════════════════════
// MAPEO DINAMICO DE COLUMNAS
// ══════════════════════════════════════════

/**
 * Lee los headers de la hoja y devuelve un objeto con el indice de cada campo.
 * Usa HEADER_FIELD_MAP para normalizar los nombres de Framer.
 * Retorna null si faltan campos criticos (email Y phone ambos ausentes).
 */
function buildColumnMap_(headers) {
  var map = {
    fecha: -1, nombre: -1, email: -1, phone: -1,
    empresa: -1, industria: -1, empleados: -1,
    position: -1, radio: -1
  };

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim().toLowerCase();
    var field = HEADER_FIELD_MAP[h];
    if (field) {
      map[field] = i;
    }
  }

  // Validar que al menos email o phone existan
  if (map.email === -1 && map.phone === -1) {
    return null;
  }

  return map;
}

/**
 * Extrae un campo string de la fila por indice, retorna '' si no existe.
 */
function getField_(fila, idx) {
  if (idx === -1) return '';
  var val = String(fila[idx] || '').trim();
  // Framer a veces pone un espacio en blanco en campos vacios
  return val === ' ' ? '' : val;
}

// ══════════════════════════════════════════
// GESTION DE CAMPANAS (dim_campanas)
// ══════════════════════════════════════════

/**
 * Busca una campana existente por nombre de campaign.
 * Si no existe, la crea automaticamente.
 * Retorna el id_campana.
 */
function getOrCreateCampana_(hCampanas, campaignName, source, medium) {
  var lastRow = hCampanas.getLastRow();

  // Buscar campana existente por nombre de campaign (col D = indice 3)
  if (lastRow >= 2) {
    var data = hCampanas.getRange(2, 1, lastRow - 1, 4).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][3]).trim() === campaignName) {
        return data[i][0]; // id_campana
      }
    }
  }

  // No existe → crear nueva
  var newId = getNextId_(hCampanas, 'id_campana');
  // dim_campanas: id_campana, source, medium, campaign, term, content, fecha_inicio, activa
  hCampanas.appendRow([
    newId, source, medium, campaignName, '', '', new Date(), true
  ]);

  Logger.log('Campana creada: "' + campaignName + '" (ID: ' + newId + ')');
  return newId;
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
// getNextId_ is defined in Codigo.js — DO NOT redefine here.

/**
 * Carga todos los timestamps de AMBAS fuentes para dedup completo:
 *  - dim_contactos.fecha_creacion  (covers new contacts)
 *  - fact_leads.fecha_ingreso      (covers duplicate-contact submissions)
 *
 * Without fact_leads, a duplicate-contact submission never writes to
 * dim_contactos, so its timestamp is lost between runs — causing the
 * same Framer row to generate a new "Duplicado" lead every 5 minutes.
 *
 * @param {Sheet} hContactos
 * @param {Sheet} hLeads
 * @returns {Object} hash of timestamp strings → true
 */
function cargarFechasExistentes_(hContactos, hLeads) {
  var fechas = {};

  // ── 1. dim_contactos.fecha_creacion (existing logic) ──
  var lastRowC = hContactos.getLastRow();
  if (lastRowC >= 2) {
    var headersC = hContactos.getRange(1, 1, 1, hContactos.getLastColumn()).getValues()[0];
    var fechaColC = -1;
    for (var h = 0; h < headersC.length; h++) {
      if (String(headersC[h]).trim().toLowerCase() === 'fecha_creacion') { fechaColC = h + 1; break; }
    }
    if (fechaColC === -1) fechaColC = 15; // fallback

    var fechasColC = hContactos.getRange(2, fechaColC, lastRowC - 1, 1).getValues();
    for (var k = 0; k < fechasColC.length; k++) {
      if (fechasColC[k][0]) {
        fechas[String(fechasColC[k][0])] = true;
      }
    }
  }

  // ── 2. fact_leads.fecha_ingreso (NEW — covers duplicate-contact rows) ──
  if (hLeads) {
    var lastRowL = hLeads.getLastRow();
    if (lastRowL >= 2) {
      var headersL = hLeads.getRange(1, 1, 1, hLeads.getLastColumn()).getValues()[0];
      var fechaColL = -1;
      for (var h2 = 0; h2 < headersL.length; h2++) {
        if (String(headersL[h2]).trim().toLowerCase() === 'fecha_ingreso') { fechaColL = h2 + 1; break; }
      }
      if (fechaColL === -1) fechaColL = 9; // fallback (column 9 in schema)

      var fechasColL = hLeads.getRange(2, fechaColL, lastRowL - 1, 1).getValues();
      for (var m = 0; m < fechasColL.length; m++) {
        if (fechasColL[m][0]) {
          fechas[String(fechasColL[m][0])] = true;
        }
      }
    }
  }

  return fechas;
}

/**
 * Detects the word "prueba" (case-insensitive) in an array of values.
 */
function detectPruebaInText_(values) {
  for (var i = 0; i < values.length; i++) {
    if (String(values[i] || '').toLowerCase().indexOf('prueba') !== -1) return true;
  }
  return false;
}

function getActiveSDRs_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
  var sdrs = [];
  for (var i = 0; i < data.length; i++) {
    var rol = String(data[i][3]).toUpperCase();
    var activo = String(data[i][4]).toUpperCase();
    if ((rol === 'SDR') && (activo === 'TRUE' || activo === '1')) {
      sdrs.push({ id: data[i][0], email: data[i][1], nombre: data[i][2] });
    }
  }
  return sdrs;
}

// ══════════════════════════════════════════
// SETUP: CREAR HOJAS DE LANDING EN LA BBDD
// ══════════════════════════════════════════

/**
 * Ejecutar UNA VEZ para crear las hojas de landing en la BBDD del CRM.
 * Despues, Pedro debe poner la formula IMPORTRANGE manualmente en cada hoja.
 *
 * Tambien se puede usar para agregar nuevas hojas en el futuro —
 * solo agrega la fuente a LANDING_SOURCES y vuelve a ejecutar.
 * No duplica hojas que ya existen.
 */
function crearHojasLanding() {
  var ss = SpreadsheetApp.openById(CRM_SS_ID);
  var creadas = [];
  var yaExisten = [];

  for (var i = 0; i < LANDING_SOURCES.length; i++) {
    var nombre = LANDING_SOURCES[i].sheetName;
    var hoja = ss.getSheetByName(nombre);

    if (hoja) {
      yaExisten.push(nombre);
    } else {
      ss.insertSheet(nombre);
      creadas.push(nombre);
    }
  }

  Logger.log('=== SETUP HOJAS LANDING ===');
  if (creadas.length > 0) {
    Logger.log('Hojas CREADAS: ' + creadas.join(', '));
  }
  if (yaExisten.length > 0) {
    Logger.log('Hojas que ya existian: ' + yaExisten.join(', '));
  }

  Logger.log('');
  Logger.log('SIGUIENTE PASO:');
  Logger.log('En cada hoja creada, ir a la celda A1 y poner la formula IMPORTRANGE:');
  Logger.log('');
  for (var i = 0; i < LANDING_SOURCES.length; i++) {
    Logger.log(LANDING_SOURCES[i].sheetName + ':');
    Logger.log('  =IMPORTRANGE("URL_DEL_SHEET_DE_FRAMER", "Hoja 1!A:I")');
    Logger.log('  (Reemplazar URL_DEL_SHEET_DE_FRAMER con la URL del Google Sheet de Framer para ' + LANDING_SOURCES[i].campaignName + ')');
    Logger.log('');
  }
  Logger.log('IMPORTANTE: Al pegar la primera IMPORTRANGE, Google pedira "Permitir acceso". Hacer clic en "Permitir".');
}

// ══════════════════════════════════════════
// TRIGGER
// ══════════════════════════════════════════

function configurarTriggerLanding() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'procesarLeadsLanding') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('procesarLeadsLanding')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Trigger configurado: cada 5 minutos');
}

function desactivarTriggerLanding() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'procesarLeadsLanding') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log('Triggers removidos: ' + removed);
}

// ══════════════════════════════════════════
// DIAGNOSTICO
// ══════════════════════════════════════════

/**
 * Ejecutar para verificar que las hojas estan correctamente configuradas
 * y que los headers de Framer se mapean bien.
 */
function diagnosticarLandings() {
  var ss = SpreadsheetApp.openById(CRM_SS_ID);

  Logger.log('=== DIAGNOSTICO DE LANDING PAGES ===');
  Logger.log('');

  for (var s = 0; s < LANDING_SOURCES.length; s++) {
    var src = LANDING_SOURCES[s];
    Logger.log('--- ' + src.sheetName + ' (' + src.campaignName + ') ---');

    var hoja = ss.getSheetByName(src.sheetName);
    if (!hoja) {
      Logger.log('  ESTADO: NO EXISTE - Ejecutar crearHojasLanding()');
      Logger.log('');
      continue;
    }

    var lastRow = hoja.getLastRow();
    var lastCol = hoja.getLastColumn();

    if (lastRow < 1 || lastCol < 1) {
      Logger.log('  ESTADO: VACIA - Falta la formula IMPORTRANGE');
      Logger.log('');
      continue;
    }

    // Leer headers
    var headers = hoja.getRange(1, 1, 1, lastCol).getValues()[0];
    var colMap = buildColumnMap_(headers);

    Logger.log('  Headers encontrados: ' + headers.join(', '));
    Logger.log('  Filas de datos: ' + (lastRow - 1));

    if (!colMap) {
      Logger.log('  ESTADO: ERROR - No se encontraron columnas email ni phone');
    } else {
      Logger.log('  Mapeo:');
      var campos = ['fecha', 'nombre', 'email', 'phone', 'empresa', 'industria', 'empleados', 'position', 'radio'];
      var faltantes = [];
      for (var c = 0; c < campos.length; c++) {
        var campo = campos[c];
        if (colMap[campo] !== -1) {
          Logger.log('    ' + campo + ' -> columna ' + (colMap[campo] + 1) + ' ("' + headers[colMap[campo]] + '")');
        } else {
          faltantes.push(campo);
        }
      }
      if (faltantes.length > 0) {
        Logger.log('  Campos sin mapear: ' + faltantes.join(', '));
      }
      Logger.log('  ESTADO: OK');
    }
    Logger.log('');
  }

  // Verificar campanas
  var hCampanas = ss.getSheetByName('dim_campanas');
  if (hCampanas) {
    var lastRowCamp = hCampanas.getLastRow();
    if (lastRowCamp >= 2) {
      var campData = hCampanas.getRange(2, 1, lastRowCamp - 1, 4).getValues();
      Logger.log('--- Campanas en dim_campanas ---');
      for (var i = 0; i < campData.length; i++) {
        Logger.log('  ID ' + campData[i][0] + ': ' + campData[i][3] + ' (source: ' + campData[i][1] + ')');
      }
    }
  }
}

// ══════════════════════════════════════════
// DATA REPAIR: Fix duplicate IDs & campaign assignment
// ══════════════════════════════════════════
// Run ONCE to fix the database after the getNextId_ bug.
// This script:
// 1. Assigns unique sequential IDs to ALL campaigns in dim_campanas
// 2. Reassigns unique sequential IDs to ALL contacts in dim_contactos
// 3. Reassigns unique sequential IDs to ALL leads in fact_leads
//    + fixes id_contacto FK to match new contact IDs
//    + fixes id_campana FK based on which LP sheet the lead came from
// 4. Reassigns unique sequential IDs to ALL calificaciones in fact_calificacion
//    + fixes id_lead FK to match new lead IDs

function repararBaseDeDatos() {
  var ss = SpreadsheetApp.openById(CRM_SS_ID);
  var hContactos  = ss.getSheetByName('dim_contactos');
  var hLeads      = ss.getSheetByName('fact_leads');
  var hCalif      = ss.getSheetByName('fact_calificacion');
  var hCampanas   = ss.getSheetByName('dim_campanas');

  if (!hContactos || !hLeads || !hCalif || !hCampanas) {
    Logger.log('ERROR: Missing sheets');
    return;
  }

  // ══════════════════════════════════════════
  // STEP 1: Fix dim_campanas — assign unique IDs
  // ══════════════════════════════════════════
  var campLastRow = hCampanas.getLastRow();
  if (campLastRow >= 2) {
    var campData = hCampanas.getRange(2, 1, campLastRow - 1, hCampanas.getLastColumn()).getValues();
    // Build map: campaign name → new unique ID
    var campaignNameToId = {};
    for (var i = 0; i < campData.length; i++) {
      var newCampId = i + 1;
      campData[i][0] = newCampId; // Set unique ID
      var campName = String(campData[i][3] || '').trim();
      campaignNameToId[campName] = newCampId;
      Logger.log('Campaign "' + campName + '" → ID ' + newCampId);
    }
    hCampanas.getRange(2, 1, campData.length, campData[0].length).setValues(campData);
    Logger.log('✓ dim_campanas: ' + campData.length + ' campaigns fixed with unique IDs');
  }

  // ══════════════════════════════════════════
  // STEP 2: Build timestamp→campaign lookup from LP sheets
  // ══════════════════════════════════════════
  // For each lead, we can identify which LP sheet it came from by matching
  // the fecha_creacion timestamp against the data in each LP sheet.
  var timestampToCampaign = {};
  for (var s = 0; s < LANDING_SOURCES.length; s++) {
    var src = LANDING_SOURCES[s];
    var hojaLP = ss.getSheetByName(src.sheetName);
    if (!hojaLP || hojaLP.getLastRow() < 2) continue;

    var lpLastCol = hojaLP.getLastColumn();
    var lpHeaders = hojaLP.getRange(1, 1, 1, lpLastCol).getValues()[0];
    var lpColMap = buildColumnMap_(lpHeaders);
    if (!lpColMap) continue;

    var lpData = hojaLP.getRange(2, 1, hojaLP.getLastRow() - 1, lpLastCol).getValues();
    var campId = campaignNameToId[src.campaignName] || 1;

    for (var r = 0; r < lpData.length; r++) {
      var fechaRaw = lpColMap.fecha !== -1 ? lpData[r][lpColMap.fecha] : null;
      if (!fechaRaw) continue;
      var fechaStr = String(fechaRaw);
      var fechaISO = '';
      try { fechaISO = new Date(fechaRaw).toISOString(); } catch (e) {}
      timestampToCampaign[fechaStr] = campId;
      if (fechaISO) timestampToCampaign[fechaISO] = campId;
    }
    Logger.log('LP sheet "' + src.sheetName + '": mapped ' + lpData.length + ' timestamps → campaign ID ' + campId);
  }

  // ══════════════════════════════════════════
  // STEP 3: Fix dim_contactos — assign unique sequential IDs
  // ══════════════════════════════════════════
  var contLastRow = hContactos.getLastRow();
  if (contLastRow < 2) { Logger.log('dim_contactos empty'); return; }

  var contData = hContactos.getRange(2, 1, contLastRow - 1, hContactos.getLastColumn()).getValues();
  // Build old→new ID map (row index based, since old IDs are duplicated)
  // We also need the timestamp (col O = index 14) for campaign matching
  var oldContactoRowToNewId = {}; // contData index → new ID
  for (var i = 0; i < contData.length; i++) {
    var newId = i + 1;
    oldContactoRowToNewId[i] = newId;
    contData[i][0] = newId; // Set unique ID
  }
  hContactos.getRange(2, 1, contData.length, contData[0].length).setValues(contData);
  Logger.log('✓ dim_contactos: ' + contData.length + ' contacts fixed with unique IDs (1..' + contData.length + ')');

  // ══════════════════════════════════════════
  // STEP 4: Fix fact_leads — unique IDs + fix FKs
  // ══════════════════════════════════════════
  var leadLastRow = hLeads.getLastRow();
  if (leadLastRow < 2) { Logger.log('fact_leads empty'); return; }

  var leadData = hLeads.getRange(2, 1, leadLastRow - 1, hLeads.getLastColumn()).getValues();
  // fact_leads columns: id_lead(0), id_contacto(1), id_lead_original(2), id_campana(3),
  //                     ...fecha_ingreso(8)
  var oldLeadRowToNewId = {};
  for (var i = 0; i < leadData.length; i++) {
    var newLeadId = i + 1;
    oldLeadRowToNewId[i] = newLeadId;
    leadData[i][0] = newLeadId; // Fix id_lead

    // Fix id_contacto FK — row i of fact_leads maps to row i of dim_contactos
    // (they were created in parallel by procesarLeadsLanding)
    leadData[i][1] = i + 1;

    // Fix id_campana FK — match by timestamp
    var fechaIngreso = leadData[i][8]; // fecha_ingreso column
    var matchedCampId = null;
    if (fechaIngreso) {
      var fStr = String(fechaIngreso);
      var fISO = '';
      try { fISO = new Date(fechaIngreso).toISOString(); } catch (e) {}
      matchedCampId = timestampToCampaign[fStr] || timestampToCampaign[fISO] || null;
    }
    if (matchedCampId) {
      leadData[i][3] = matchedCampId;
    }
    // If no match and campaign was 1, try to identify from the original lead data
    // (leave as-is for manual leads that weren't from LP)
  }
  hLeads.getRange(2, 1, leadData.length, leadData[0].length).setValues(leadData);
  Logger.log('✓ fact_leads: ' + leadData.length + ' leads fixed with unique IDs (1..' + leadData.length + ')');

  // ══════════════════════════════════════════
  // STEP 5: Fix fact_calificacion — unique IDs + fix id_lead FK
  // ══════════════════════════════════════════
  var califLastRow = hCalif.getLastRow();
  if (califLastRow >= 2) {
    var califData = hCalif.getRange(2, 1, califLastRow - 1, hCalif.getLastColumn()).getValues();
    // fact_calificacion: id_calificacion(0), id_lead(1), ...
    for (var i = 0; i < califData.length; i++) {
      califData[i][0] = i + 1; // Fix id_calificacion
      califData[i][1] = i + 1; // Fix id_lead FK (same order as fact_leads)
    }
    hCalif.getRange(2, 1, califData.length, califData[0].length).setValues(califData);
    Logger.log('✓ fact_calificacion: ' + califData.length + ' rows fixed');
  }

  // ══════════════════════════════════════════
  // STEP 6: Fix fact_deals — update id_lead and id_contacto FKs
  // ══════════════════════════════════════════
  var hDeals = ss.getSheetByName('fact_deals');
  if (hDeals && hDeals.getLastRow() >= 2) {
    var dealData = hDeals.getRange(2, 1, hDeals.getLastRow() - 1, hDeals.getLastColumn()).getValues();
    // fact_deals: id_deal(0), id_lead(1), id_contacto(2), ...
    // Deals reference leads by id_lead — since leads were sequentially created,
    // old lead row index maps to new id
    var changed = 0;
    for (var i = 0; i < dealData.length; i++) {
      // id_lead FK — try to find in new mapping
      var oldLeadId = dealData[i][1];
      if (oldLeadId && oldLeadRowToNewId[oldLeadId - 1] !== undefined) {
        dealData[i][1] = oldLeadRowToNewId[oldLeadId - 1];
        changed++;
      }
      // id_contacto FK
      var oldContId = dealData[i][2];
      if (oldContId && oldContactoRowToNewId[oldContId - 1] !== undefined) {
        dealData[i][2] = oldContactoRowToNewId[oldContId - 1];
      }
    }
    hDeals.getRange(2, 1, dealData.length, dealData[0].length).setValues(dealData);
    Logger.log('✓ fact_deals: ' + dealData.length + ' rows checked, ' + changed + ' FKs updated');
  }

  SpreadsheetApp.flush();

  // ── Summary ──
  Logger.log('');
  Logger.log('══════════════════════════════════════');
  Logger.log('DATABASE REPAIR COMPLETE');
  Logger.log('══════════════════════════════════════');
  Logger.log('Campaigns with unique IDs: ' + Object.keys(campaignNameToId).length);
  Logger.log('Campaign mapping: ' + JSON.stringify(campaignNameToId));
  Logger.log('Contacts re-IDd: ' + contData.length);
  Logger.log('Leads re-IDd: ' + leadData.length);
  Logger.log('Timestamps matched to campaigns: ' + Object.keys(timestampToCampaign).length);
  Logger.log('');
  Logger.log('NEXT: Run diagnosticarLandings() to verify everything looks correct.');
}
