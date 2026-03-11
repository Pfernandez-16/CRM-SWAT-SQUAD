/*************************************************************
 *  Code.gs — API Backend para CRM SWAT Squad Web App
 *  Todas las funciones renombradas a español.
 *  Mejoras: PropertiesService, validación de roles,
 *  sanitización de inputs, código deduplicado,
 *  formatos de retorno estandarizados.
 *************************************************************/

// ============ CONFIGURACIÓN ============

/**
 * Obtiene la configuración del proyecto.
 * Usa PropertiesService para valores sensibles con fallbacks.
 */
function obtenerConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    HOJA_ID: props.getProperty('HOJA_ID') || '1YKyCzqqODPywzcYOCkJSd9xtxF3KC8hwuBYWvTXX3vU',
    HOJA_LEADS: props.getProperty('HOJA_LEADS') || 'Leads',
    HOJA_DEALS: props.getProperty('HOJA_DEALS') || 'Deals_AE',
    HOJA_CATALOGOS: props.getProperty('HOJA_CATALOGOS') || 'Catalogs',
    HOJA_CATALOGOS_AE: props.getProperty('HOJA_CATALOGOS_AE') || 'Catalogs_2',
    HOJA_PRECIOS: props.getProperty('HOJA_PRECIOS') || 'PRicing Catalos',
    HOJA_LOG: props.getProperty('HOJA_LOG') || 'Transacciones_Log',
    HOJA_LOG_DEALS: props.getProperty('HOJA_LOG_DEALS') || 'Transacciones_Log_AE',
    HOJA_USUARIOS: props.getProperty('HOJA_USUARIOS') || 'Config_Users',
    MAPEO_ARCHIVOS_AE: {},
    ID_ARCHIVO_IA: props.getProperty('ID_ARCHIVO_IA') || '',
    TIEMPO_BLOQUEO_MS: 15000,
    CACHE_CATALOGOS_SEG: 21600
  };
}

// Cache lazy de configuración (se recarga por ejecución)
var _configCache = null;
function CONFIG_() {
  if (!_configCache) _configCache = obtenerConfig_();
  return _configCache;
}

// ============ WEB APP ENTRY ============

function doGet(e) {
  var html = HtmlService.createTemplateFromFile('Index').evaluate();
  html.setTitle('CRM SWAT Squad')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return html;
}

function incluir(nombreArchivo) {
  return HtmlService.createHtmlOutputFromFile(nombreArchivo).getContent();
}

// ============ UTILIDADES INTERNAS ============

/**
 * Sanitiza un valor antes de escribirlo en una celda.
 * Previene inyección de fórmulas (CSV/Excel injection).
 */
function sanitizarValorCelda_(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor;
  var str = String(valor);
  if (/^[=+@\-]/.test(str) && str.length > 1) {
    return "'" + str;
  }
  return str;
}

/**
 * Valida que el usuario actual tenga uno de los roles permitidos.
 * Retorna el objeto de configuración del usuario si es válido, o lanza error.
 */
function validarRol_(rolesPermitidos) {
  var usuario = obtenerConfigUsuario();
  if (!usuario || usuario.error) {
    throw new Error('No se pudo verificar el usuario');
  }
  var rol = (usuario.rol || 'GUEST').toUpperCase();
  if (rolesPermitidos.indexOf(rol) === -1) {
    throw new Error('Permiso denegado. Rol "' + rol + '" no autorizado para esta acción');
  }
  return usuario;
}

/**
 * Retorna un mapa { "NombreCabecera": indiceColumna_1_based, ... }
 */
function obtenerMapaColumnas_(hoja) {
  var cabeceras = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var mapa = {};
  for (var i = 0; i < cabeceras.length; i++) {
    var nombre = String(cabeceras[i] || '').trim();
    if (nombre) mapa[nombre] = i + 1;
  }
  return mapa;
}

/**
 * Obtiene una hoja por nombre con validación.
 * Lanza error si no existe (a menos que opcional=true).
 */
function obtenerHoja_(ss, nombreHoja, opcional) {
  var hoja = ss.getSheetByName(nombreHoja);
  if (!hoja && !opcional) {
    throw new Error('Hoja no encontrada: ' + nombreHoja);
  }
  return hoja;
}

/**
 * Busca columnas de Config_Users por nombre de cabecera.
 * Retorna objeto con índices 0-based.
 */
function obtenerColumnasUsuarios_(cabeceras) {
  var cols = { email: 0, nombre: 1, rol: 2, conectado: 3, horaEntrada: 4, hojaId: 5 };
  for (var h = 0; h < cabeceras.length; h++) {
    var nombre = String(cabeceras[h]).trim().toLowerCase();
    if (nombre === 'email') cols.email = h;
    else if (nombre === 'nombre') cols.nombre = h;
    else if (nombre === 'rol' || nombre === 'role') cols.rol = h;
    else if (nombre === 'isconnected' || nombre === 'conectado') cols.conectado = h;
    else if (nombre === 'clockintime' || nombre === 'clock_in' || nombre === 'entrada') cols.horaEntrada = h;
    else if (nombre === 'sheetid') cols.hojaId = h;
  }
  return cols;
}

/**
 * Registra un cambio en el log de auditoría.
 */
function registrarCambio_(idLead, usuario, campo, valorAnterior, valorNuevo, esDeal) {
  try {
    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var nombreLog = esDeal ? cfg.HOJA_LOG_DEALS : cfg.HOJA_LOG;
    var hojaLog = ss.getSheetByName(nombreLog);

    if (!hojaLog) {
      hojaLog = ss.insertSheet(nombreLog);
      hojaLog.appendRow(['Timestamp', 'ID_Lead', 'Usuario', 'Campo_Modificado', 'Valor_Anterior', 'Valor_Nuevo']);
      Logger.log('Hoja de log creada: ' + nombreLog);
    }

    hojaLog.appendRow([new Date(), idLead, usuario, campo, valorAnterior, valorNuevo]);
  } catch (error) {
    Logger.log('Error registrando cambio (' + (esDeal ? 'deals' : 'leads') + '): ' + error.message);
  }
}

/**
 * Sincroniza bidireccionalmente el status Vendido/Perdido entre Leads y Deals_AE.
 */
function sincronizarEstadoEspejo_(idLead, nuevoValor, esFuenteDeal) {
  try {
    var valorRaw = String(nuevoValor).trim();
    var valorLower = valorRaw.toLowerCase();
    if (valorLower !== 'vendido' && valorLower !== 'perdido') return;

    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var nombreHojaDestino = esFuenteDeal ? cfg.HOJA_LEADS : cfg.HOJA_DEALS;
    var nombreColStatus = esFuenteDeal ? 'Status' : 'Status de Venta';

    var hojaDestino = ss.getSheetByName(nombreHojaDestino);
    if (!hojaDestino) {
      Logger.log('sincronizarEstadoEspejo_: Hoja destino no encontrada: ' + nombreHojaDestino);
      return;
    }

    var mapaCol = obtenerMapaColumnas_(hojaDestino);
    var colId = mapaCol['ID'] || 2;
    var colStatus = mapaCol[nombreColStatus];
    if (!colStatus) return;

    var ultimaFila = hojaDestino.getLastRow();
    if (ultimaFila < 2) return;

    var datos = hojaDestino.getRange(2, 1, ultimaFila - 1, hojaDestino.getLastColumn()).getValues();
    for (var i = 0; i < datos.length; i++) {
      if (String(datos[i][colId - 1]) === String(idLead)) {
        hojaDestino.getRange(i + 2, colStatus).setValue(valorRaw);
        registrarCambio_(idLead, 'Sincronización', nombreColStatus, '', valorRaw, !esFuenteDeal);
        Logger.log('Espejo sincronizado: ' + valorRaw + ' → ID ' + idLead + ' en ' + nombreHojaDestino);
        break;
      }
    }
  } catch (e) {
    Logger.log('Error en sincronizarEstadoEspejo_: ' + e.message);
  }
}

// ============ API: LEADS ============

/**
 * Parsea una hoja completa en un array de objetos con aliases de conveniencia.
 */
function parsearHojaAObjetos_(hoja) {
  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];

  var cabeceras = datos[0];
  var mapaCol = {};
  for (var c = 0; c < cabeceras.length; c++) {
    var nombre = String(cabeceras[c] || '').trim();
    if (nombre) mapaCol[nombre] = c;
  }

  var PATRONES_HISTORIAL = [
    'Contestó Teléfono', 'No Contestó Teléfono', 'No Contesto Teléfono',
    'Contestó Whatsapp', 'No Contestó Whatsapp', 'No Contesto Whatsapp',
    'Contestó Correo', 'No Contestó Correo'
  ];

  var resultados = [];

  for (var i = 1; i < datos.length; i++) {
    var obj = { _row: i + 1 };
    for (var j = 0; j < cabeceras.length; j++) {
      var clave = cabeceras[j] || ('col_' + (j + 1));
      var val = datos[i][j];
      if (val instanceof Date) val = val.toISOString();
      obj[clave] = val;
    }

    // Aliases de conveniencia usando mapaCol (0-based para acceso a array)
    var col = function (nombre, indiceFallback) {
      var idx = mapaCol[nombre];
      if (idx !== undefined) return datos[i][idx] || '';
      if (indiceFallback !== undefined) return datos[i][indiceFallback] || '';
      return '';
    };

    obj._colW_Status = col('Status', 22);
    obj._colX_Calidad = col('Calidad de Contacto', 23);
    obj._colY_Toques = col('Toques de Contactación', 24);
    obj._colZ_Timestamp = col('time stamp', 25);
    obj._colAQ_Vendedor = col('Vendedor Asignado para Seguimiento', 42);
    obj._colAS_Notas = col('Notas', 44);
    obj._id = col('ID', 1) || i;
    obj._name = (col('Nombre', 2) + ' ' + col('Apellido', 3)).trim();
    obj._empresa = col('empresa', 7);
    obj._email = col('Email', 4);
    obj._tel = col('Teléfono', 5);

    // Historial de contacto
    var historial = [];
    for (var hdr in mapaCol) {
      var coincide = false;
      for (var p = 0; p < PATRONES_HISTORIAL.length; p++) {
        if (hdr.indexOf(PATRONES_HISTORIAL[p]) === 0) { coincide = true; break; }
      }
      if (!coincide) continue;
      var valorCelda = datos[i][mapaCol[hdr]];
      if (valorCelda && valorCelda instanceof Date) {
        historial.push({ type: hdr, date: valorCelda.toISOString() });
      } else if (valorCelda && valorCelda !== '') {
        historial.push({ type: hdr, date: String(valorCelda) });
      }
    }
    historial.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    obj._history = historial;

    resultados.push(obj);
  }
  return resultados;
}

/**
 * Retorna leads y deals como JSON.
 */
function obtenerLeads() {
  try {
    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var hojaLeads = ss.getSheetByName(cfg.HOJA_LEADS);
    var leads = hojaLeads ? parsearHojaAObjetos_(hojaLeads) : [];
    var hojaDeals = ss.getSheetByName(cfg.HOJA_DEALS);
    var deals = hojaDeals ? parsearHojaAObjetos_(hojaDeals) : [];
    return JSON.stringify({ leads: leads, deals: deals });
  } catch (err) {
    return JSON.stringify({ leads: [], deals: [], error: err.message });
  }
}

// ============ API: ACTUALIZAR ============

/**
 * Actualiza un campo individual de un lead o deal.
 * Incluye validación de rol, sanitización, bloqueo y triggers.
 */
function actualizarCampoLead(numFila, identificadorCol, nuevoValor, esDeal) {
  var lock = LockService.getScriptLock();
  var resultado = { updated: false, triggers: [] };

  try {
    validarRol_(['ADMIN', 'SDR', 'AE']);
    lock.waitLock(CONFIG_().TIEMPO_BLOQUEO_MS);

    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var nombreHoja = esDeal ? cfg.HOJA_DEALS : cfg.HOJA_LEADS;
    var hoja = obtenerHoja_(ss, nombreHoja);
    var mapaCol = obtenerMapaColumnas_(hoja);
    var cabeceras = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];

    // Determinar índice de columna y nombre del campo
    var indiceCol, nombreCampo = 'Desconocido';
    if (typeof identificadorCol === 'string' && isNaN(parseInt(identificadorCol, 10))) {
      indiceCol = mapaCol[identificadorCol];
      if (!indiceCol) throw new Error('Columna no encontrada: ' + identificadorCol);
      nombreCampo = identificadorCol;
    } else {
      indiceCol = parseInt(identificadorCol, 10);
      nombreCampo = cabeceras[indiceCol - 1] || ('Col ' + indiceCol);
    }

    // Validar rango
    if (numFila < 2 || numFila > hoja.getLastRow()) {
      throw new Error('Fila fuera de rango: ' + numFila);
    }

    var valorAnterior = hoja.getRange(numFila, indiceCol).getValue();
    var idLead = hoja.getRange(numFila, mapaCol['ID'] || 2).getValue();

    // Sanitizar y escribir
    var valorSanitizado = sanitizarValorCelda_(nuevoValor);
    hoja.getRange(numFila, indiceCol).setValue(valorSanitizado);
    resultado.updated = true;

    var usuarioActual = Session.getActiveUser().getEmail() || 'API/App User';
    registrarCambio_(idLead, usuarioActual, nombreCampo, valorAnterior, nuevoValor, esDeal);

    // Sincronizar Vendido/Perdido bidireccionalmente
    if (nombreCampo === 'Status' || nombreCampo === 'Status de Venta') {
      sincronizarEstadoEspejo_(idLead, nuevoValor, esDeal);
    }

    // Ejecutar triggers
    var triggers = esDeal
      ? procesarTriggersDeal_(hoja, numFila, indiceCol, nombreCampo, nuevoValor, mapaCol)
      : procesarTriggersLead_(hoja, numFila, indiceCol, nombreCampo, nuevoValor, mapaCol);
    resultado.triggers = triggers;

  } catch (err) {
    resultado.triggerError = err.message;
  } finally {
    lock.releaseLock();
  }

  return resultado;
}

/**
 * Actualiza múltiples campos de un lead o deal de una sola vez.
 */
function actualizarLeadMultiple(numFila, actualizaciones, esDeal) {
  var lock = LockService.getScriptLock();
  var resultado = { updated: false, triggers: [] };

  try {
    validarRol_(['ADMIN', 'SDR', 'AE']);
    lock.waitLock(CONFIG_().TIEMPO_BLOQUEO_MS);

    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var nombreHoja = esDeal ? cfg.HOJA_DEALS : cfg.HOJA_LEADS;
    var hoja = obtenerHoja_(ss, nombreHoja);
    var mapaCol = obtenerMapaColumnas_(hoja);
    var cabeceras = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    var idLead = hoja.getRange(numFila, mapaCol['ID'] || 2).getValue();
    var usuarioActual = Session.getActiveUser().getEmail() || 'API/App User';

    for (var colStr in actualizaciones) {
      var nuevoValor = actualizaciones[colStr];
      var indiceCol, nombreCampo;

      if (isNaN(parseInt(colStr, 10))) {
        indiceCol = mapaCol[colStr];
        nombreCampo = colStr;
      } else {
        indiceCol = parseInt(colStr, 10);
        nombreCampo = cabeceras[indiceCol - 1] || 'Col ' + indiceCol;
      }

      if (!indiceCol) continue;

      var valorAnterior = hoja.getRange(numFila, indiceCol).getValue();
      var valorSanitizado = sanitizarValorCelda_(nuevoValor);
      hoja.getRange(numFila, indiceCol).setValue(valorSanitizado);
      registrarCambio_(idLead, usuarioActual, nombreCampo, valorAnterior, nuevoValor, esDeal);

      if (nombreCampo === 'Status' || nombreCampo === 'Status de Venta') {
        sincronizarEstadoEspejo_(idLead, nuevoValor, esDeal);
      }

      // Triggers
      try {
        var triggers = esDeal
          ? procesarTriggersDeal_(hoja, numFila, indiceCol, nombreCampo, nuevoValor, mapaCol)
          : procesarTriggersLead_(hoja, numFila, indiceCol, nombreCampo, nuevoValor, mapaCol);
        resultado.triggers = resultado.triggers.concat(triggers);
      } catch (errTrigger) {
        resultado.triggerError = (resultado.triggerError || '') + ' | ' + errTrigger.message;
      }
    }
    resultado.updated = true;

  } catch (err) {
    resultado.triggerError = err.message;
  } finally {
    lock.releaseLock();
  }

  return resultado;
}

// ============ API: CATÁLOGOS ============

/**
 * Retorna todos los catálogos como { nombreCabecera: [valores] }.
 */
function obtenerCatalogos() {
  var cfg = CONFIG_();
  var cache = CacheService.getScriptCache();
  var cacheado = cache.get('catalogs_data');
  if (cacheado) {
    try { return JSON.parse(cacheado); } catch (e) { Logger.log('Cache corrupto, recargando catálogos'); }
  }

  var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
  var hoja = obtenerHoja_(ss, cfg.HOJA_CATALOGOS);
  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return {};

  var cabeceras = datos[0];
  var catalogos = {};

  for (var j = 0; j < cabeceras.length; j++) {
    var nombre = String(cabeceras[j] || '').trim();
    if (!nombre) continue;
    var valores = [];
    for (var i = 1; i < datos.length; i++) {
      var v = datos[i][j];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        valores.push(String(v).trim());
      }
    }
    catalogos[nombre] = valores;
  }

  // Merge catálogos AE desde Catalogs_2
  var hojaAE = ss.getSheetByName(cfg.HOJA_CATALOGOS_AE);
  if (hojaAE) {
    var datosAE = hojaAE.getDataRange().getValues();
    if (datosAE.length >= 2) {
      var cabAE = datosAE[0];
      for (var aj = 0; aj < cabAE.length; aj++) {
        var nombreAE = String(cabAE[aj] || '').trim();
        if (!nombreAE) continue;
        var valoresAE = [];
        for (var ai = 1; ai < datosAE.length; ai++) {
          var av = datosAE[ai][aj];
          if (av !== null && av !== undefined && String(av).trim() !== '') {
            valoresAE.push(String(av).trim());
          }
        }
        catalogos[nombreAE] = valoresAE;
      }
    }
  }

  try {
    cache.put('catalogs_data', JSON.stringify(catalogos), cfg.CACHE_CATALOGOS_SEG);
  } catch (e) { Logger.log('Error guardando catálogos en cache: ' + e.message); }

  return catalogos;
}

/**
 * Actualiza una columna del catálogo con nuevos valores.
 */
function actualizarCatalogo(nombreCabecera, valores) {
  validarRol_(['ADMIN']);

  if (!nombreCabecera || typeof nombreCabecera !== 'string') {
    throw new Error('Nombre de cabecera inválido');
  }
  if (!Array.isArray(valores)) {
    throw new Error('Los valores deben ser un array');
  }

  var cfg = CONFIG_();
  var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
  var hoja = obtenerHoja_(ss, cfg.HOJA_CATALOGOS);
  var cabeceras = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];

  var indiceCol = -1;
  for (var i = 0; i < cabeceras.length; i++) {
    if (String(cabeceras[i]).trim() === nombreCabecera) {
      indiceCol = i + 1;
      break;
    }
  }
  if (indiceCol === -1) throw new Error('Columna de catálogo "' + nombreCabecera + '" no encontrada.');

  var ultimaFila = hoja.getLastRow();
  if (ultimaFila > 1) {
    hoja.getRange(2, indiceCol, ultimaFila - 1, 1).clearContent();
  }

  if (valores && valores.length > 0) {
    var datosEscritura = valores.map(function (v) { return [sanitizarValorCelda_(v)]; });
    hoja.getRange(2, indiceCol, datosEscritura.length, 1).setValues(datosEscritura);
  }

  CacheService.getScriptCache().remove('catalogs_data');
  return { updated: true, column: nombreCabecera, count: valores.length };
}

// ============ API: PRECIOS ============

function obtenerDatosPrecios() {
  var cfg = CONFIG_();
  var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
  var hoja = ss.getSheetByName(cfg.HOJA_PRECIOS);
  if (!hoja) return [];

  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return [];

  var resultado = [];
  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    resultado.push({
      region: String(datos[i][0] || ''),
      membershipType: String(datos[i][1] || ''),
      attraction: String(datos[i][2] || ''),
      index: String(datos[i][3] || ''),
      oneYear: Number(datos[i][4]) || 0,
      twoYear: Number(datos[i][5]) || 0
    });
  }
  return resultado;
}

// ============ API: USUARIOS ============

/**
 * Lee la configuración del usuario actual desde Config_Users.
 */
function obtenerConfigUsuario() {
  try {
    var email = Session.getActiveUser().getEmail();
    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var hoja = ss.getSheetByName(cfg.HOJA_USUARIOS);

    if (!hoja) {
      return { email: email, nombre: email, rol: 'GUEST', sheetId: cfg.HOJA_ID, isConnected: false, clockInTime: null };
    }

    var datos = hoja.getDataRange().getValues();
    var cols = obtenerColumnasUsuarios_(datos[0]);

    for (var i = 1; i < datos.length; i++) {
      var emailFila = String(datos[i][cols.email] || '').trim().toLowerCase();
      if (emailFila === email.toLowerCase()) {
        var horaEntrada = datos[i][cols.horaEntrada];
        return {
          email: email,
          nombre: String(datos[i][cols.nombre] || email),
          rol: String(datos[i][cols.rol] || 'GUEST').toUpperCase(),
          sheetId: cfg.HOJA_ID,
          isConnected: datos[i][cols.conectado] === true || datos[i][cols.conectado] === 'TRUE' || datos[i][cols.conectado] === 1,
          clockInTime: (horaEntrada instanceof Date) ? horaEntrada.toISOString() : (horaEntrada ? String(horaEntrada) : null),
          _row: i + 1
        };
      }
    }

    return { email: email, nombre: email, rol: 'GUEST', sheetId: cfg.HOJA_ID, isConnected: false, clockInTime: null };
  } catch (err) {
    Logger.log('Error obtenerConfigUsuario: ' + err.message);
    return { email: '', nombre: 'Error', rol: 'GUEST', sheetId: '', isConnected: false, clockInTime: null, error: err.message };
  }
}

/**
 * Marca asistencia (clock-in) del usuario actual.
 */
function marcarEntrada() {
  try {
    var email = Session.getActiveUser().getEmail();
    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var hoja = ss.getSheetByName(cfg.HOJA_USUARIOS);
    if (!hoja) return { status: 'error', message: 'Hoja Config_Users no encontrada' };

    var datos = hoja.getDataRange().getValues();
    var cols = obtenerColumnasUsuarios_(datos[0]);

    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][cols.email] || '').trim().toLowerCase() === email.toLowerCase()) {
        var ahora = new Date();
        hoja.getRange(i + 1, cols.conectado + 1).setValue(true);
        hoja.getRange(i + 1, cols.horaEntrada + 1).setValue(ahora);
        return { status: 'success', clockInTime: ahora.toISOString() };
      }
    }
    return { status: 'error', message: 'Usuario no encontrado en Config_Users' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

/**
 * Marca salida (clock-out) del usuario actual.
 */
function marcarSalida() {
  try {
    var email = Session.getActiveUser().getEmail();
    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var hoja = ss.getSheetByName(cfg.HOJA_USUARIOS);
    if (!hoja) return { status: 'error', message: 'Hoja Config_Users no encontrada' };

    var datos = hoja.getDataRange().getValues();
    var cols = obtenerColumnasUsuarios_(datos[0]);

    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][cols.email] || '').trim().toLowerCase() === email.toLowerCase()) {
        hoja.getRange(i + 1, cols.conectado + 1).setValue(false);
        hoja.getRange(i + 1, cols.horaEntrada + 1).setValue('');
        return { status: 'success' };
      }
    }
    return { status: 'error', message: 'Usuario no encontrado en Config_Users' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

/**
 * Retorna la lista de AEs actualmente conectados.
 */
function obtenerAEsActivos() {
  try {
    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var hoja = ss.getSheetByName(cfg.HOJA_USUARIOS);
    if (!hoja) return { status: 'success', data: [] };

    var datos = hoja.getDataRange().getValues();
    var cols = obtenerColumnasUsuarios_(datos[0]);

    var activos = [];
    for (var i = 1; i < datos.length; i++) {
      var rol = String(datos[i][cols.rol] || '').toUpperCase();
      var conectado = datos[i][cols.conectado] === true || datos[i][cols.conectado] === 'TRUE' || datos[i][cols.conectado] === 1;
      if ((rol === 'AE' || rol === 'ADMIN') && conectado) {
        activos.push({
          email: String(datos[i][cols.email] || ''),
          nombre: String(datos[i][cols.nombre] || '')
        });
      }
    }
    return { status: 'success', data: activos };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

function obtenerUsuarioActual() {
  return {
    email: Session.getActiveUser().getEmail(),
    effectiveEmail: Session.getEffectiveUser().getEmail()
  };
}

// ============ API: HISTORIAL ============

/**
 * Retorna el historial de cambios de un Lead o Deal.
 * (Función única — se eliminó la definición duplicada)
 */
function obtenerHistorialLead(idLead, esDeal) {
  try {
    var cfg = CONFIG_();
    var nombreLog = esDeal ? cfg.HOJA_LOG_DEALS : cfg.HOJA_LOG;
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var hojaLog = ss.getSheetByName(nombreLog);

    var vacio = { status: 'success', data: { pipeline: [], leads: [], deals: [] } };
    if (!hojaLog) return JSON.stringify(vacio);

    var datos = hojaLog.getDataRange().getValues();
    if (datos.length < 2) return JSON.stringify(vacio);

    var cabeceras = datos[0];
    var colTs = 0, colId = 1, colUsuario = 2, colCampo = 3, colAnterior = 4, colNuevo = 5;
    for (var h = 0; h < cabeceras.length; h++) {
      var nombre = String(cabeceras[h]).trim().toLowerCase();
      if (nombre === 'timestamp') colTs = h;
      else if (nombre === 'id_lead' || nombre === 'id') colId = h;
      else if (nombre === 'usuario') colUsuario = h;
      else if (nombre === 'campo_modificado' || nombre === 'campo') colCampo = h;
      else if (nombre === 'valor_anterior') colAnterior = h;
      else if (nombre === 'valor_nuevo') colNuevo = h;
    }

    var historial = [];
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][colId]) === String(idLead)) {
        historial.push({
          timestamp: (datos[i][colTs] instanceof Date) ? datos[i][colTs].toISOString() : String(datos[i][colTs]),
          usuario: String(datos[i][colUsuario]),
          campo: String(datos[i][colCampo]),
          valorAnterior: String(datos[i][colAnterior]),
          valorNuevo: String(datos[i][colNuevo])
        });
      }
    }
    historial.reverse();

    return JSON.stringify({ status: 'success', data: { pipeline: historial, leads: historial, deals: historial } });
  } catch (error) {
    Logger.log('Error obtenerHistorialLead: ' + error.message);
    return JSON.stringify({ status: 'error', message: error.message });
  }
}

// ============ API: ESTADÍSTICAS ============

/**
 * Retorna estadísticas agregadas para el Dashboard.
 * Usa mapeo dinámico de columnas (no índices hardcodeados).
 */
function obtenerEstadisticasLeads() {
  var cfg = CONFIG_();
  var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
  var hoja = ss.getSheetByName(cfg.HOJA_LEADS);
  if (!hoja) return { total: 0, thisWeek: 0, thisMonth: 0, byStatus: {}, byCalidad: {}, byVendedor: {} };

  var datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return { total: 0, thisWeek: 0, thisMonth: 0, byStatus: {}, byCalidad: {}, byVendedor: {} };

  // Mapeo dinámico de columnas
  var cabeceras = datos[0];
  var mapaCol = {};
  for (var c = 0; c < cabeceras.length; c++) {
    var nombre = String(cabeceras[c] || '').trim();
    if (nombre) mapaCol[nombre] = c;
  }

  var colStatus = mapaCol['Status'] !== undefined ? mapaCol['Status'] : 22;
  var colCalidad = mapaCol['Calidad de Contacto'] !== undefined ? mapaCol['Calidad de Contacto'] : 23;
  var colVendedor = mapaCol['Vendedor Asignado para Seguimiento'] !== undefined ? mapaCol['Vendedor Asignado para Seguimiento'] : 42;
  var colTimestamp = mapaCol['time stamp'] !== undefined ? mapaCol['time stamp'] : 0;

  var total = datos.length - 1;
  var porStatus = {};
  var porCalidad = {};
  var porVendedor = {};
  var estaSemana = 0;
  var esteMes = 0;
  var ahora = new Date();
  var haceSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  var inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  for (var i = 1; i < datos.length; i++) {
    var status = String(datos[i][colStatus] || 'Sin Status').trim();
    porStatus[status] = (porStatus[status] || 0) + 1;

    var calidad = String(datos[i][colCalidad] || 'Sin Calificar').trim();
    porCalidad[calidad] = (porCalidad[calidad] || 0) + 1;

    var vendedor = String(datos[i][colVendedor] || '').trim();
    if (vendedor) porVendedor[vendedor] = (porVendedor[vendedor] || 0) + 1;

    var ts = datos[i][colTimestamp];
    if (ts instanceof Date) {
      if (ts >= haceSemana) estaSemana++;
      if (ts >= inicioMes) esteMes++;
    }
  }

  return {
    total: total,
    thisWeek: estaSemana,
    thisMonth: esteMes,
    byStatus: porStatus,
    byCalidad: porCalidad,
    byVendedor: porVendedor
  };
}

// ============ TRIGGERS ============

/**
 * Procesa triggers para Deals cuando el AE modifica el campo "Toque".
 */
function procesarTriggersDeal_(hoja, fila, indiceCol, nombreCampo, nuevoValor, mapaCol) {
  var ejecutados = [];

  if (nombreCampo === 'Toque') {
    var dato = String(nuevoValor).trim();
    if (!dato) return ejecutados;

    var colHistorial = mapaCol[dato];

    if (!colHistorial) {
      var COLS_HISTORIAL = [
        'Contestó Teléfono 1', 'Contestó Teléfono 2', 'Contestó Teléfono 3',
        'No Contestó Teléfono 1', 'No Contestó Teléfono 2', 'No Contesto Teléfono 3',
        'No Contestó Teléfono 4', 'No Contestó Teléfono 5', 'No Contesto Teléfono 6',
        'Contestó Whatsapp 1', 'Contestó Whatsapp 2', 'Contestó Whatsapp 3',
        'No Contestó Whatsapp 1', 'No Contestó Whatsapp 2', 'No Contestó Whatsapp 3',
        'No Contestó Whatsapp 4', 'No Contestó Whatsapp 5', 'No Contestó Whatsapp 6'
      ];
      for (var h = 0; h < COLS_HISTORIAL.length; h++) {
        if (COLS_HISTORIAL[h] === dato && mapaCol[COLS_HISTORIAL[h]]) {
          colHistorial = mapaCol[COLS_HISTORIAL[h]];
          break;
        }
      }
    }

    if (colHistorial) {
      var ahora = new Date();
      hoja.getRange(fila, colHistorial).setValue(ahora);

      var colPrimerContacto = mapaCol['Fecha de primer contacto AE'];
      if (colPrimerContacto) {
        var existente = hoja.getRange(fila, colPrimerContacto).getValue();
        if (!existente || existente === '') {
          hoja.getRange(fila, colPrimerContacto).setValue(ahora);
          ejecutados.push('auto_fecha_primer_contacto');
        }
      }

      var colNumToque = mapaCol['Numero de toque'];
      if (colNumToque) {
        var actual = hoja.getRange(fila, colNumToque).getValue();
        hoja.getRange(fila, colNumToque).setValue((parseInt(actual, 10) || 0) + 1);
        ejecutados.push('auto_increment_toque');
      }

      ejecutados.push('deal_timestamp_' + dato);
    }
  }

  return ejecutados;
}

/**
 * Procesa triggers cuando se modifica un campo de un lead.
 */
function procesarTriggersLead_(hoja, fila, indiceCol, nombreCampo, nuevoValor, mapaCol) {
  var ejecutados = [];
  var cfg = CONFIG_();

  // TRIGGER 1: Timestamp al cambiar "Toques de Contactación"
  if (nombreCampo === 'Toques de Contactación' || (!mapaCol['Toques de Contactación'] && indiceCol === 25)) {
    var dato = String(nuevoValor).trim();
    var colHistorial = mapaCol[dato];

    if (!colHistorial) {
      var colsFallback = {
        'Contestó Teléfono 1': 46, 'Contestó Teléfono 2': 47,
        'Contestó Teléfono 3': 48, 'No Contestó Teléfono 1': 49,
        'No Contestó Teléfono 2': 50, 'No Contesto Teléfono 3': 51,
        'No Contestó Teléfono 4': 52, 'No Contestó Teléfono 5': 53,
        'No Contesto Teléfono 6': 54, 'Contestó Whatsapp 1': 55,
        'Contestó Whatsapp 2': 56, 'Contestó Whatsapp 3': 57,
        'No Contestó Whatsapp 1': 58, 'No Contestó Whatsapp 2': 59,
        'No Contestó Whatsapp 3': 60, 'No Contestó Whatsapp 4': 61,
        'No Contestó Whatsapp 5': 62, 'No Contestó Whatsapp 6': 63,
        'Contestó Correo 1': 64, 'Contestó Correo 2': 65,
        'Contestó Correo 3': 66, 'No Contestó Correo 1': 67,
        'No Contestó Correo 2': 68, 'No Contestó Correo 3': 69
      };
      colHistorial = colsFallback[dato];
    }

    if (colHistorial) {
      var ahora = new Date();
      var colTs = mapaCol['Timestamp'] || 26;
      hoja.getRange(fila, colTs).setValue(ahora);
      hoja.getRange(fila, colHistorial).setValue(ahora);
      ejecutados.push('timestamp_' + dato);
    }
  }

  // TRIGGER 2: Copiar a archivo AE al asignar vendedor
  if (nombreCampo === 'Vendedor' || (!mapaCol['Vendedor'] && indiceCol === 43)) {
    var asignadoA = String(nuevoValor).trim();
    if (cfg.MAPEO_ARCHIVOS_AE.hasOwnProperty(asignadoA) && cfg.MAPEO_ARCHIVOS_AE[asignadoA]) {
      try {
        var idArchivo = cfg.MAPEO_ARCHIVOS_AE[asignadoA];
        var archivoAE = SpreadsheetApp.openById(idArchivo);
        var hojaAE = archivoAE.getSheetByName('AE');
        var datosFila = hoja.getRange(fila, 1, 1, hoja.getLastColumn()).getValues()[0];
        var filaDestino = obtenerPrimeraFilaVacia_(hojaAE, datosFila.length);
        hojaAE.getRange(filaDestino, 1, 1, datosFila.length).setValues([datosFila]);
        ejecutados.push('copiar_a_AE_' + asignadoA);
      } catch (error) {
        Logger.log('Error transfiriendo datos a AE: ' + error.message);
      }
    }
    var colAsigTs = mapaCol['Fecha de asignación'] || 44;
    hoja.getRange(fila, colAsigTs).setValue(new Date());
    ejecutados.push('timestamp_asignacion');
  }

  // TRIGGER 3: Enviar a IA si Status = "Contactado sin Respuesta"
  if (nombreCampo === 'Status' || (!mapaCol['Status'] && indiceCol === 23)) {
    var status = String(nuevoValor).trim();
    if (status === 'Contactado sin Respuesta' && cfg.ID_ARCHIVO_IA) {
      try {
        var datosFila = hoja.getRange(fila, 1, 1, hoja.getLastColumn()).getValues()[0];
        var payload = [
          datosFila[(mapaCol['Timestamp'] || 1) - 1],
          datosFila[(mapaCol['ID'] || 2) - 1],
          datosFila[(mapaCol['Nombre'] || 3) - 1],
          datosFila[(mapaCol['Apellido'] || 4) - 1],
          datosFila[(mapaCol['Email'] || 5) - 1],
          datosFila[(mapaCol['Teléfono'] || 6) - 1],
          datosFila[(mapaCol['Empresa'] || 8) - 1],
          datosFila[(mapaCol['Status'] || 23) - 1]
        ];
        var archivoIA = SpreadsheetApp.openById(cfg.ID_ARCHIVO_IA);
        var hojaIA = archivoIA.getSheetByName('IA');
        var filaDestino = obtenerPrimeraFilaVacia_(hojaIA, payload.length);
        hojaIA.getRange(filaDestino, 1, 1, payload.length).setValues([payload]);
        ejecutados.push('enviado_a_IA');
      } catch (err) {
        Logger.log('Error enviando a IA: ' + err.message);
      }
    }

    // TRIGGER 4: Copiar lead a Deals_AE cuando Status = "Paso a Ventas"
    if (status.toLowerCase() === 'paso a ventas') {
      try {
        copiarLeadADeals_(hoja, fila, mapaCol);
        ejecutados.push('copiar_a_deals_ae');
      } catch (err) {
        Logger.log('Error en trigger Paso a Ventas: ' + err.message);
      }
    }
  }

  return ejecutados;
}

/**
 * Copia un lead de Leads a Deals_AE.
 * No duplica si ya existe un deal con el mismo ID.
 * Registra datos de métricas: fecha de pase, SDR, tiempo de conversión, snapshot.
 *
 * Columnas extra requeridas en Deals_AE (agregar como cabeceras):
 *   - "Fecha de pase a ventas"
 *   - "SDR que pasó a ventas"
 *   - "Días hasta pase"
 *   - "Calidad al pase"
 *   - "Toques al pase"
 *   - "Status seguimiento al pase"
 */
function copiarLeadADeals_(hojaLeads, fila, mapaColLeads) {
  var cfg = CONFIG_();
  var ss = hojaLeads.getParent();
  var hojaDeals = ss.getSheetByName(cfg.HOJA_DEALS);
  if (!hojaDeals) {
    Logger.log('copiarLeadADeals_: Hoja Deals_AE no encontrada');
    return;
  }

  var colId = mapaColLeads['ID'] || 2;
  var idLead = hojaLeads.getRange(fila, colId).getValue();

  // Verificar duplicados
  var mapaColDeals = obtenerMapaColumnas_(hojaDeals);
  var colIdDeals = mapaColDeals['ID'];
  if (colIdDeals && idLead) {
    var ultimaFila = hojaDeals.getLastRow();
    if (ultimaFila > 1) {
      var idsExistentes = hojaDeals.getRange(2, colIdDeals, ultimaFila - 1, 1).getValues();
      for (var e = 0; e < idsExistentes.length; e++) {
        if (String(idsExistentes[e][0]) === String(idLead)) {
          Logger.log('copiarLeadADeals_: ID ' + idLead + ' ya existe, omitiendo.');
          return;
        }
      }
    }
  }

  var cabLeads = hojaLeads.getRange(1, 1, 1, hojaLeads.getLastColumn()).getValues()[0];
  var datosLead = hojaLeads.getRange(fila, 1, 1, hojaLeads.getLastColumn()).getValues()[0];
  var cabDeals = hojaDeals.getRange(1, 1, 1, hojaDeals.getLastColumn()).getValues()[0];

  // Diccionario de mapeo manual para columnas con nombres diferentes entre Leads y Deals_AE
  var mapeoManual = {
    'Apellidos': 'Apellido',
    'Teléfono Celular': 'Teléfono',
    'Added Time': 'Timestamp',
    'IP Address': 'Ip',
    'utm_source': 'source',
    'utm_medium': 'medium',
    'utm_campaign': 'campaign',
    'utm_term': 'term',
    'utm_content': 'content'
  };

  // Construir fila para Deals_AE mapeando por nombre de cabecera
  // Si la columna de Deals_AE tiene un nombre diferente al de Leads, usar el mapeo manual
  var nuevaFila = [];
  for (var d = 0; d < cabDeals.length; d++) {
    var cabDeal = String(cabDeals[d] || '').trim();
    var nombreBuscar = mapeoManual[cabDeal] || cabDeal; // Traducir nombre si aplica
    var encontrado = false;
    for (var l = 0; l < cabLeads.length; l++) {
      if (nombreBuscar && String(cabLeads[l] || '').trim() === nombreBuscar) {
        nuevaFila.push(datosLead[l]);
        encontrado = true;
        break;
      }
    }
    if (!encontrado) nuevaFila.push('');
  }

  if (hojaDeals.getLastColumn() === 0) {
    Logger.log('copiarLeadADeals_: Deals_AE no tiene cabeceras.');
    return;
  }

  // ── Status de Venta inicial (dinámico desde catálogo) ──
  var todosCatalogos = obtenerCatalogos();
  var opcionesAE = todosCatalogos['Status de Venta'] || [];
  var statusInicial = opcionesAE.length > 0 ? opcionesAE[0] : 'Recien llegado';
  var colSV = mapaColDeals['Status de Venta'];
  if (colSV) nuevaFila[colSV - 1] = statusInicial;

  // ── DATOS DE MÉTRICAS AL MOMENTO DEL PASE ──
  var ahora = new Date();
  var usuario = Session.getActiveUser().getEmail() || 'Sistema';

  // 1. Fecha exacta del pase a ventas
  var colFechaPase = mapaColDeals['Fecha de pase a ventas'];
  if (colFechaPase) nuevaFila[colFechaPase - 1] = ahora;

  // 2. SDR que hizo el pase
  var colSDR = mapaColDeals['SDR que pasó a ventas'];
  if (colSDR) nuevaFila[colSDR - 1] = usuario;

  // 3. Días desde la creación del lead hasta el pase
  var colDias = mapaColDeals['Días hasta pase'];
  if (colDias) {
    var colTimestampLead = mapaColLeads['time stamp'] || mapaColLeads['Timestamp'] || 1;
    var fechaCreacion = datosLead[colTimestampLead - 1];
    if (fechaCreacion instanceof Date) {
      var diffMs = ahora.getTime() - fechaCreacion.getTime();
      var dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
      nuevaFila[colDias - 1] = dias;
    } else {
      nuevaFila[colDias - 1] = '';
    }
  }

  // 4. Snapshot del estado del lead al momento del pase
  var colCalidadPase = mapaColDeals['Calidad al pase'];
  if (colCalidadPase) {
    var idxCalidad = mapaColLeads['Calidad de Contacto'];
    nuevaFila[colCalidadPase - 1] = idxCalidad ? datosLead[idxCalidad - 1] || '' : '';
  }

  var colToquesPase = mapaColDeals['Toques al pase'];
  if (colToquesPase) {
    var idxToques = mapaColLeads['Toques de Contactación'];
    nuevaFila[colToquesPase - 1] = idxToques ? datosLead[idxToques - 1] || '' : '';
  }

  var colSeguimientoPase = mapaColDeals['Status seguimiento al pase'];
  if (colSeguimientoPase) {
    var idxSeguimiento = mapaColLeads['Status del Seguimiento'];
    nuevaFila[colSeguimientoPase - 1] = idxSeguimiento ? datosLead[idxSeguimiento - 1] || '' : '';
  }

  // ── Escribir la fila en Deals_AE ──
  hojaDeals.appendRow(nuevaFila);

  // ── Logs de auditoría ──
  registrarCambio_(idLead, usuario, 'Pase a Ventas', '', 'Deal enviado a Deals_AE', false);
  registrarCambio_(idLead, usuario, 'Deal Creado', '', 'Deal recibido de Leads (SDR: ' + usuario + ')', true);
  Logger.log('copiarLeadADeals_: Lead #' + idLead + ' copiado con métricas. Días: ' + (colDias ? nuevaFila[colDias - 1] : 'N/A'));
}

// ============ UTILIDADES ============

function obtenerPrimeraFilaVacia_(hoja, ancho) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila === 0) return 1;
  var valores = hoja.getRange(1, 1, ultimaFila, ancho).getValues();
  for (var i = 0; i < valores.length; i++) {
    var vacia = valores[i].every(function (celda) { return celda === '' || celda === null; });
    if (vacia) return i + 1;
  }
  return ultimaFila + 1;
}

function generarIdLead_(hoja) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return 1;
  var ids = hoja.getRange(2, 2, ultimaFila - 1, 1).getValues();
  var maxId = 0;
  for (var i = 0; i < ids.length; i++) {
    var num = parseInt(ids[i][0], 10);
    if (!isNaN(num) && num > maxId) maxId = num;
  }
  return maxId + 1;
}

// ============ INTEGRACIÓN FORMULARIO ============

function onFormSubmit(e) {
  try {
    var namedValues = e.namedValues;
    var datosLead = {
      nombre: (namedValues['Nombre'] || [''])[0].trim(),
      apellido: (namedValues['Apellido'] || [''])[0].trim(),
      email: (namedValues['Email'] || [''])[0].trim(),
      telefono: (namedValues['Teléfono'] || namedValues['Telefono'] || [''])[0].trim(),
      empresa: (namedValues['Empresa'] || [''])[0].trim(),
      pais: (namedValues['País'] || namedValues['Pais'] || [''])[0].trim(),
      fuente: 'Google Form'
    };
    var resultado = crearLead(datosLead);
    Logger.log('Lead creado desde formulario: fila ' + resultado.row + ', ID ' + resultado.id);
  } catch (err) {
    Logger.log('onFormSubmit ERROR: ' + err.message);
  }
}

/**
 * Crea un nuevo Lead en la hoja Leads.
 */
function crearLead(datosLead) {
  var cfg = CONFIG_();
  var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
  var hoja = obtenerHoja_(ss, cfg.HOJA_LEADS);
  var ahora = new Date();
  var nuevoId = generarIdLead_(hoja);

  // Usar mapeo dinámico de columnas cuando sea posible
  var mapaCol = obtenerMapaColumnas_(hoja);
  var ultimaCol = hoja.getLastColumn() || 69;
  var nuevaFila = new Array(ultimaCol).fill('');

  // Helper para escribir en la posición correcta (0-based para array)
  var escribir = function (nombreCol, indiceFallback, valor) {
    var idx = mapaCol[nombreCol] ? mapaCol[nombreCol] - 1 : indiceFallback;
    if (idx !== undefined && idx < nuevaFila.length) nuevaFila[idx] = valor;
  };

  escribir('time stamp', 0, ahora);
  escribir('ID', 1, nuevoId);
  escribir('Nombre', 2, sanitizarValorCelda_(datosLead.nombre || ''));
  escribir('Apellido', 3, sanitizarValorCelda_(datosLead.apellido || ''));
  escribir('Email', 4, sanitizarValorCelda_(datosLead.email || ''));
  escribir('Teléfono', 5, sanitizarValorCelda_(datosLead.telefono || ''));
  escribir('empresa', 7, sanitizarValorCelda_(datosLead.empresa || ''));
  escribir('Pais', 20, sanitizarValorCelda_(datosLead.pais || ''));
  escribir('Status', 22, 'Nuevo');
  escribir('Timestamp', 25, ahora);

  hoja.appendRow(nuevaFila);
  return { success: true, row: hoja.getLastRow(), id: nuevoId };
}

/**
 * Crea un nuevo Lead o Deal desde la web app.
 * (Esta función faltaba en el backend original — bug corregido)
 */
function crearNuevoLeadODeal(datos, tipo) {
  try {
    validarRol_(['ADMIN', 'SDR', 'AE']);

    var cfg = CONFIG_();
    var ss = SpreadsheetApp.openById(cfg.HOJA_ID);
    var nombreHoja = (tipo === 'deal') ? cfg.HOJA_DEALS : cfg.HOJA_LEADS;
    var hoja = obtenerHoja_(ss, nombreHoja);
    var ahora = new Date();
    var nuevoId = generarIdLead_(hoja);
    var mapaCol = obtenerMapaColumnas_(hoja);
    var ultimaCol = hoja.getLastColumn() || 69;
    var nuevaFila = new Array(ultimaCol).fill('');

    // Escribir ID y Timestamp
    var colId = mapaCol['ID'];
    if (colId) nuevaFila[colId - 1] = nuevoId;
    else nuevaFila[1] = nuevoId;

    var colTs = mapaCol['time stamp'] || mapaCol['Timestamp'];
    if (colTs) nuevaFila[colTs - 1] = ahora;
    else nuevaFila[0] = ahora;

    // Mapear todos los campos del payload
    for (var campo in datos) {
      if (!datos.hasOwnProperty(campo)) continue;
      var colIdx = mapaCol[campo];
      if (colIdx) {
        nuevaFila[colIdx - 1] = sanitizarValorCelda_(datos[campo]);
      }
    }

    // Status por defecto si no fue proporcionado
    if (tipo === 'deal') {
      var colSV = mapaCol['Status de Venta'];
      if (colSV && !nuevaFila[colSV - 1]) {
        var catalogos = obtenerCatalogos();
        var opciones = catalogos['Status de Venta'] || [];
        nuevaFila[colSV - 1] = opciones.length > 0 ? opciones[0] : 'Recien llegado';
      }
    } else {
      var colStatus = mapaCol['Status'];
      if (colStatus && !nuevaFila[colStatus - 1]) {
        nuevaFila[colStatus - 1] = 'Nuevo';
      }
    }

    hoja.appendRow(nuevaFila);
    var filaInsertada = hoja.getLastRow();

    var usuario = Session.getActiveUser().getEmail() || 'Sistema';
    var etiqueta = tipo === 'deal' ? 'Deal' : 'Lead';
    registrarCambio_(nuevoId, usuario, etiqueta + ' Creado', '', 'Creado manualmente desde web app', tipo === 'deal');

    return { status: 'success', data: { id: nuevoId, row: filaInsertada } };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

// ============ COMPATIBILIDAD: onEdit (trigger de hoja) ============

function onEdit(e) {
  var hoja = e.source.getActiveSheet();
  var cfg = CONFIG_();
  if (hoja.getName() !== cfg.HOJA_LEADS) return;

  var rango = e.range;
  var indiceCol = rango.getColumn();
  var fila = rango.getRow();
  var nuevoValor = rango.getValue();

  var mapaCol = obtenerMapaColumnas_(hoja);
  var cabeceras = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var nombreCampo = cabeceras[indiceCol - 1] || 'Desconocido';

  procesarTriggersLead_(hoja, fila, indiceCol, nombreCampo, nuevoValor, mapaCol);
}

// ============ TESTS / DIAGNÓSTICO ============

function testCrearLead() {
  var resultado = crearLead({
    nombre: 'Test',
    apellido: 'Lead',
    email: 'test@example.com',
    telefono: '+52 555 123 4567',
    empresa: 'Empresa Prueba',
    pais: 'México',
    fuente: 'Test Manual'
  });
  Logger.log('Resultado test: ' + JSON.stringify(resultado));
}

/**
 * FUNCIÓN DE DIAGNÓSTICO — Ejecutar desde el editor de Apps Script.
 * Muestra en Logger:
 *   1. Columnas de Leads
 *   2. Columnas de Deals_AE
 *   3. Cuáles coinciden y cuáles no
 *   4. Valores del catálogo "Status" (para verificar que existe "Paso a Ventas")
 *   5. Las 6 columnas de métricas requeridas
 */
function diagnosticoLeadADeal() {
  var cfg = CONFIG_();
  var ss = SpreadsheetApp.openById(cfg.HOJA_ID);

  // ── 1. Cabeceras de Leads ──
  var hojaLeads = ss.getSheetByName(cfg.HOJA_LEADS);
  if (!hojaLeads) {
    Logger.log('ERROR: Hoja "' + cfg.HOJA_LEADS + '" NO encontrada');
    return;
  }
  var cabLeads = hojaLeads.getRange(1, 1, 1, hojaLeads.getLastColumn()).getValues()[0];
  Logger.log('═══ COLUMNAS DE LEADS (' + cabLeads.length + ' cols) ═══');
  for (var i = 0; i < cabLeads.length; i++) {
    Logger.log('  [' + (i + 1) + '] ' + cabLeads[i]);
  }

  // ── 2. Cabeceras de Deals_AE ──
  var hojaDeals = ss.getSheetByName(cfg.HOJA_DEALS);
  if (!hojaDeals) {
    Logger.log('ERROR: Hoja "' + cfg.HOJA_DEALS + '" NO encontrada. ¡Debe existir para que funcione el pase!');
    return;
  }
  var cabDeals = hojaDeals.getRange(1, 1, 1, hojaDeals.getLastColumn()).getValues()[0];
  Logger.log('\n═══ COLUMNAS DE DEALS_AE (' + cabDeals.length + ' cols) ═══');
  for (var j = 0; j < cabDeals.length; j++) {
    Logger.log('  [' + (j + 1) + '] ' + cabDeals[j]);
  }

  // ── 3. Mapeo: qué coincide y qué no ──
  Logger.log('\n═══ MAPEO LEADS → DEALS_AE ═══');
  var coinciden = 0;
  var noCoinciden = [];
  for (var d = 0; d < cabDeals.length; d++) {
    var cabDeal = String(cabDeals[d] || '').trim();
    if (!cabDeal) continue;
    var encontrado = false;
    for (var l = 0; l < cabLeads.length; l++) {
      if (String(cabLeads[l] || '').trim() === cabDeal) {
        encontrado = true;
        break;
      }
    }
    if (encontrado) {
      Logger.log('  ✓ "' + cabDeal + '" → coincide');
      coinciden++;
    } else {
      Logger.log('  ✗ "' + cabDeal + '" → SIN coincidencia en Leads (quedará vacío)');
      noCoinciden.push(cabDeal);
    }
  }
  Logger.log('  RESUMEN: ' + coinciden + ' coinciden, ' + noCoinciden.length + ' sin coincidencia');

  // ── 4. Verificar catálogo de Status ──
  Logger.log('\n═══ VALORES DEL CATÁLOGO "Status" ═══');
  var catalogos = obtenerCatalogos();
  var statusValues = catalogos['Status'] || [];
  var tienePasoAVentas = false;
  for (var s = 0; s < statusValues.length; s++) {
    var val = statusValues[s];
    Logger.log('  [' + s + '] "' + val + '"');
    if (String(val).toLowerCase().trim() === 'paso a ventas') {
      tienePasoAVentas = true;
    }
  }
  if (tienePasoAVentas) {
    Logger.log('  ✓ "Paso a Ventas" EXISTE en el catálogo');
  } else {
    Logger.log('  ✗ "Paso a Ventas" NO encontrado — el trigger NO se activará');
    Logger.log('    Los valores disponibles son: ' + JSON.stringify(statusValues));
  }

  // ── 5. Columnas de métricas requeridas ──
  Logger.log('\n═══ COLUMNAS DE MÉTRICAS EN DEALS_AE ═══');
  var metricasRequeridas = [
    'Fecha de pase a ventas',
    'SDR que pasó a ventas',
    'Días hasta pase',
    'Calidad al pase',
    'Toques al pase',
    'Status seguimiento al pase'
  ];
  var mapaDeals = obtenerMapaColumnas_(hojaDeals);
  for (var m = 0; m < metricasRequeridas.length; m++) {
    var nombre = metricasRequeridas[m];
    if (mapaDeals[nombre]) {
      Logger.log('  ✓ "' + nombre + '" → columna ' + mapaDeals[nombre]);
    } else {
      Logger.log('  ✗ "' + nombre + '" → NO encontrada (agregar como cabecera)');
    }
  }

  // ── 6. Verificar si ya hay datos en Deals_AE ──
  var filasDeals = hojaDeals.getLastRow();
  Logger.log('\n═══ ESTADO DE DEALS_AE ═══');
  Logger.log('  Filas totales (incluyendo cabecera): ' + filasDeals);
  Logger.log('  Deals existentes: ' + Math.max(0, filasDeals - 1));

  // ── 7. Verificar si hay leads con "Paso a Ventas" ──
  var mapaLeads = obtenerMapaColumnas_(hojaLeads);
  var colStatus = mapaLeads['Status'];
  if (colStatus) {
    var filasLeads = hojaLeads.getLastRow();
    if (filasLeads > 1) {
      var statusLeads = hojaLeads.getRange(2, colStatus, filasLeads - 1, 1).getValues();
      var conPaso = 0;
      for (var p = 0; p < statusLeads.length; p++) {
        if (String(statusLeads[p][0]).toLowerCase().trim() === 'paso a ventas') conPaso++;
      }
      Logger.log('  Leads con Status "Paso a Ventas": ' + conPaso);
    }
  } else {
    Logger.log('  ✗ Columna "Status" NO encontrada en Leads');
  }

  Logger.log('\n═══ FIN DEL DIAGNÓSTICO ═══');
}
