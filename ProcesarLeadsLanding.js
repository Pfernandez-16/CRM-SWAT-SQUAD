/**
 * ============================================
 * CRM SWAT Squad — Procesar Leads de Landing
 * ============================================
 * Lee filas nuevas de la hoja "NO TOCAR" y las distribuye
 * en dim_contactos, fact_leads y fact_calificacion.
 *
 * - NUNCA escribe en "NO TOCAR" (es read-only, viene de IMPORTRANGE)
 * - Detecta leads nuevos comparando el timestamp exacto (col A de "NO TOCAR")
 *   contra fecha_creacion en dim_contactos
 * - Permite mismo email multiples veces (cada submission es un lead nuevo)
 * - Previene duplicados reales (mismo formulario procesado dos veces)
 * - Siempre hace APPEND, nunca sobreescribe
 *
 * SETUP:
 * 1. Pegar este script en el proyecto de Apps Script
 * 2. Ejecutar configurarTriggerLanding() UNA sola vez
 * 3. Listo — corre cada 5 minutos solo
 * ============================================
 */

// ── ID del Spreadsheet de la BBDD del CRM ──
var CRM_SS_ID = '1rpgt1XJikbDpYDI1IVCBzBJgSTzafxtFvdAgsmxr0k4';

// ── Nombre de la hoja donde caen los leads (IMPORTRANGE, no tocar) ──
var HOJA_LANDING = 'NO TOCAR';

function procesarLeadsLanding() {
  var ss = SpreadsheetApp.openById(CRM_SS_ID);
  var hojaLanding = ss.getSheetByName(HOJA_LANDING);

  if (!hojaLanding) {
    Logger.log('ERROR: No se encontró la hoja "' + HOJA_LANDING + '"');
    return;
  }

  var hContactos = ss.getSheetByName('dim_contactos');
  var hLeads = ss.getSheetByName('fact_leads');
  var hCalif = ss.getSheetByName('fact_calificacion');
  var hVendedores = ss.getSheetByName('dim_vendedores');

  if (!hContactos || !hLeads || !hCalif) {
    Logger.log('ERROR: Faltan hojas en la BBDD');
    return;
  }

  // ── Leer datos de la landing ──
  var lastRow = hojaLanding.getLastRow();
  if (lastRow < 2) {
    Logger.log('No hay datos en la hoja landing');
    return;
  }
  var datos = hojaLanding.getRange(2, 1, lastRow - 1, 9).getValues();

  // ── Cargar timestamps existentes en dim_contactos para detectar duplicados ──
  var fechasExistentes = {};
  var lastRowContactos = hContactos.getLastRow();
  if (lastRowContactos >= 2) {
    // fecha_creacion es la última columna con datos (col O = 15)
    var fechasCol = hContactos.getRange(2, 15, lastRowContactos - 1, 1).getValues();
    for (var k = 0; k < fechasCol.length; k++) {
      if (fechasCol[k][0]) {
        fechasExistentes[String(fechasCol[k][0])] = true;
      }
    }
  }

  // ── Filtrar solo leads que NO existen ya en dim_contactos ──
  var filasNuevas = [];
  var yaExisten = 0;
  for (var i = 0; i < datos.length; i++) {
    var fechaRaw = datos[i][0];
    if (!fechaRaw) continue;

    var fechaStr = String(fechaRaw);
    // Tambien comparar como Date ISO por si el formato difiere
    var fechaISO = '';
    try { fechaISO = new Date(fechaRaw).toISOString(); } catch(e) {}

    if (fechasExistentes[fechaStr] || fechasExistentes[fechaISO]) {
      yaExisten++;
      continue;
    }
    filasNuevas.push(datos[i]);
  }

  if (filasNuevas.length === 0) {
    Logger.log('No hay leads nuevos. Ya existen: ' + yaExisten + ', Total landing: ' + datos.length);
    return;
  }

  // ── Obtener últimos IDs ──
  var nextContactoId = getNextId_(hContactos, 1);
  var nextLeadId = getNextId_(hLeads, 1);
  var nextCalifId = getNextId_(hCalif, 1);

  // ── Round robin SDR ──
  var sdrs = getActiveSDRs_(hVendedores);
  var sdrIndex = 0;

  var procesados = 0;

  for (var i = 0; i < filasNuevas.length; i++) {
    var fila = filasNuevas[i];

    // Columnas: A=Date, B=phone, C=industria, D=empleados,
    //           E=enterprise, F=position, G=Radio, H=name, I=email
    var email = String(fila[8] || '').trim();
    var phone = String(fila[1] || '').trim();

    // Saltar filas vacías (sin email ni telefono)
    if (!email && !phone) continue;

    var fecha = fila[0] || new Date();
    var industria = String(fila[2] || '');
    var empleados = fila[3] || '';
    var empresa = String(fila[4] || '');
    var position = String(fila[5] || '');
    var radio = String(fila[6] || '');
    var nombre = String(fila[7] || '');

    // Separar nombre y apellido
    var partes = nombre.split(' ');
    var firstName = partes[0] || '';
    var lastName = partes.slice(1).join(' ') || '';

    // ── 1. dim_contactos ──
    var contactoId = nextContactoId++;
    hContactos.appendRow([
      contactoId, firstName, lastName, email, phone, '',
      empresa, industria, '', '', empleados, position,
      '', '', fecha
    ]);

    // ── 2. fact_leads ──
    var vendedorId = '';
    if (sdrs.length > 0) {
      vendedorId = sdrs[sdrIndex % sdrs.length].id;
      sdrIndex++;
    }

    var leadId = nextLeadId++;
    hLeads.appendRow([
      leadId, contactoId, '', '', vendedorId,
      'Nuevo', 'Sin Calificar', radio,
      fecha, fecha, '', 0,
      '', 'Activo', '', '', '', '',
      false, '', '', ''
    ]);

    // ── 3. fact_calificacion (vacía) ──
    var califId = nextCalifId++;
    hCalif.appendRow([
      califId, leadId, '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', ''
    ]);

    procesados++;
    Logger.log('Lead: ' + nombre + ' (' + email + ') → ID ' + leadId);
  }

  Logger.log('=== RESUMEN ===');
  Logger.log('Total landing: ' + datos.length);
  Logger.log('Ya existian: ' + yaExisten);
  Logger.log('Nuevos procesados: ' + procesados);

  if (procesados > 0) {
    SpreadsheetApp.flush();
  }
}

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

function getNextId_(sheet, col) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  var ids = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  var maxId = 0;
  for (var i = 0; i < ids.length; i++) {
    var val = Number(ids[i][0]);
    if (!isNaN(val) && val > maxId) maxId = val;
  }
  return maxId + 1;
}

function getActiveSDRs_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var sdrs = [];
  for (var i = 0; i < data.length; i++) {
    var rol = String(data[i][3]).toUpperCase();
    var activo = data[i][4];
    if ((rol === 'SDR') && (activo === true || activo === 'TRUE' || activo === 1)) {
      sdrs.push({ id: data[i][0], email: data[i][1], nombre: data[i][2] });
    }
  }
  return sdrs;
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
