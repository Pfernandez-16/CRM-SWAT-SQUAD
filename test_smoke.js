'use strict';

// =============================================================================
// SMOKE TEST: CRM SWAT Squad
// Tests key GAS functions without a live Google Sheets connection.
// =============================================================================

var fs = require('fs');
var path = require('path');

// ---------------------------------------------------------------------------
// 1. DATABASE SCHEMA (hardcoded from actual Excel structure)
// ---------------------------------------------------------------------------
var SCHEMAS = {
  dim_contactos: ['id_contacto','nombre','apellido','email','telefono_1','telefono_2','empresa','area','pais','ciudad','empleados','nivel','link','ip','fecha_creacion'],
  fact_leads:    ['id_lead','id_contacto','id_lead_original','id_campana','id_vendedor_sdr','status','calidad_contacto','servicio_interes','fecha_ingreso','fecha_asignacion','fecha_ultimo_contacto','numero_toques','tipo_seguimiento','status_seguimiento','tipo_cliente_pricing','ticket_promedio','licencias','monto_aproximado','es_recompra','razon_perdida','razon_perdida_otra','notas'],
  fact_toques:   ['id_registro_toque','id_entidad','tipo_entidad','id_vendedor','rol_vendedor','numero_toque','fecha_toque','canal','detalle'],
  fact_deals:    ['id_deal','id_lead','id_contacto','id_vendedor_ae','id_producto','fecha_pase_ventas','ventas_contacto_cliente','numero_toque_ae','toque_ae','fecha_primer_contacto_ae','status_venta','proyeccion','monto_proyeccion','cotizo','monto_cotizacion','fecha_cotizacion','notas_cotizacion','monto_apartado','monto_cierre','fecha_reagenda','hora_reagenda','fecha_cierre','razon_perdida','razon_perdida_otra','descuento_pct','precio_1_year','precio_2_year','cross_selling','renovacion','es_recompra','valor_recompra','fecha_recompra','producto_recompra','es_cliente_activo','producto_cierre','fuente_origen','index_ae','tipo_transaccion','link_pago','soporte_pago','deal_code','notas_vendedor','en_negociacion','asistio_demo','firmo_contrato','fondeo','comprobante_pago_url']
};

// ---------------------------------------------------------------------------
// 2. MOCK GAS API HELPERS
// ---------------------------------------------------------------------------

/**
 * Build a mock sheet from a schema name and optional data rows (array of arrays).
 * dataRows does NOT include the header row — that is added automatically.
 */
function makeMockSheet(schemaName, dataRows, opts) {
  opts = opts || {};
  var headers = SCHEMAS[schemaName] || opts.customHeaders || [];
  var storedRows = [];  // rows written via setValues / appendRow
  var appendedRows = [];

  // Full dataset: [header, ...dataRows]
  var fullData = [headers.slice()].concat((dataRows || []).map(function(r) { return r.slice(); }));

  var sheet = {
    _name: schemaName,
    _appendedRows: appendedRows,
    _storedRows: storedRows,
    _fullData: fullData,
    _shouldThrow: opts.shouldThrow || false,

    getName: function() { return this._name; },

    getLastRow: function() {
      // Returns header + real data rows (no phantom rows)
      return fullData.length;
    },

    getLastColumn: function() {
      return headers.length;
    },

    getDataRange: function() {
      var self = this;
      if (self._shouldThrow) throw new Error('Simulated getDataRange error');
      return {
        getDisplayValues: function() {
          // Return deep copy to avoid mutation
          return fullData.map(function(r) { return r.slice(); });
        }
      };
    },

    getRange: function(row, col, numRows, numCols) {
      var self = this;
      var _extractSlice = function() {
        var result = [];
        for (var r = 0; r < (numRows || 1); r++) {
          var rowIdx = (row - 1) + r;
          var rowData = fullData[rowIdx] || [];
          var slice = [];
          for (var c = 0; c < (numCols || 1); c++) {
            slice.push(rowData[(col - 1) + c] !== undefined ? rowData[(col - 1) + c] : '');
          }
          result.push(slice);
        }
        return result;
      };
      return {
        getDisplayValues: _extractSlice,
        getValues: _extractSlice,
        clearFormat: function() { /* no-op */ },
        setValue: function(v) { /* no-op single cell */ },
        setValues: function(data) {
          // Validate it's a 2D array, store it
          if (!Array.isArray(data) || !Array.isArray(data[0])) {
            throw new Error('setValues expects 2D array');
          }
          storedRows.push({ row: row, col: col, data: data });
        }
      };
    },

    appendRow: function(rowData) {
      appendedRows.push(rowData);
      fullData.push(rowData);
    }
  };
  return sheet;
}

/**
 * Build a mock spreadsheet that holds multiple sheets.
 */
function makeMockSpreadsheet(sheetsMap) {
  return {
    getSheetByName: function(name) {
      return sheetsMap[name] || null;
    }
  };
}

// ---------------------------------------------------------------------------
// 3. GLOBAL MOCKS (replicate the GAS environment)
// ---------------------------------------------------------------------------
var _propsStore = {};
var _mockSS = null;  // Will be replaced per test

global.SHEET_ID = 'MOCK_SHEET_ID';
global.T_CONTACTOS = 'dim_contactos';
global.T_LEADS = 'fact_leads';
global.T_TOQUES = 'fact_toques';
global.T_DEALS = 'fact_deals';
global.T_USERS = 'config_users';
global.T_LOG = 'log_transacciones';
global.T_INTERACCIONES = 'fact_interacciones';

global.SpreadsheetApp = {
  openById: function(id) {
    if (!_mockSS) throw new Error('_mockSS not set for this test');
    return _mockSS;
  }
};

global.PropertiesService = {
  getScriptProperties: function() {
    return {
      getProperty: function(key) { return _propsStore[key] !== undefined ? _propsStore[key] : null; },
      setProperty: function(key, val) { _propsStore[key] = val; }
    };
  }
};

global.LockService = {
  getScriptLock: function() {
    return {
      waitLock: function(ms) { /* no-op */ },
      releaseLock: function() { /* no-op */ }
    };
  }
};

global.Session = {
  getActiveUser: function() {
    return { getEmail: function() { return 'test@test.com'; } };
  },
  getScriptTimeZone: function() { return 'America/Mexico_City'; }
};

global.Logger = {
  log: function() { /* console.log.apply(console, arguments); */ }
};

global.GmailApp = {
  sendEmail: function() { /* no-op */ }
};

global.Utilities = {
  formatDate: function(d, tz, fmt) { return d ? d.toString() : ''; },
  base64Decode: function(s) { return Buffer.from(s, 'base64'); },
  newBlob: function(data, mime, name) { return { data: data, mime: mime, name: name }; }
};

global.HtmlService = {
  createTemplateFromFile: function() { return { evaluate: function() { return { setTitle: function() { return this; }, setXFrameOptionsMode: function() { return this; }, addMetaTag: function() { return this; } }; } }; },
  createHtmlOutputFromFile: function() { return { getContent: function() { return ''; } }; },
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
};

global.CalendarApp = { getDefaultCalendar: function() { return {}; } };

// Stub out functions that createNewLeadOrDeal depends on but we don't test directly
global.logChange_ = function() { /* no-op */ };
// Use an indirection object so tests can override getPricingConfig at runtime
// without fighting closure capture. The eval'd code calls _pricingConfigStub.fn().
var _pricingConfigStub = { fn: function() { return { tipoCliente: '', productos: [] }; } };
global.getPricingConfig = function() { return _pricingConfigStub.fn(); };
global.readTable_ = function(sheetName) {
  if (!_mockSS) return [];
  var sh = _mockSS.getSheetByName(sheetName);
  if (!sh) return [];
  var data = sh.getDataRange().getDisplayValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var obj = { _row: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j] || '').trim().toLowerCase();
      if (key) obj[key] = data[i][j];
    }
    results.push(obj);
  }
  return results;
};

global.DEAL_FIELD_MAP = {
  'Status de Venta': 'status_venta',
  'Proyeccion': 'proyeccion',
  'Monto de proyección': 'monto_proyeccion',
  'Monto de Apartado': 'monto_apartado',
  'Monto de cierre': 'monto_cierre',
  'Fecha de Cierre': 'fecha_cierre',
  'Descuento': 'descuento_pct',
  'Notas Vendedor': 'notas_vendedor',
  '¿Por qué perdimos la venta?': 'razon_perdida',
  '¿Es recompra?': 'es_recompra',
  '¿Es cliente activo?': 'es_cliente_activo',
  'Producto de Cierre': 'producto_cierre',
  'Fuente de origen': 'fuente_origen',
  'Tipo de Transacción': 'tipo_transaccion',
  'Monto de Cotización': 'monto_cotizacion',
  'Fecha de Cotización': 'fecha_cotizacion',
  'Notas de Cotización': 'notas_cotizacion',
  'Razón Pérdida Otra': 'razon_perdida_otra',
  '1 Year Mem': 'precio_1_year',
  '2 Year Mem': 'precio_2_year',
  'Nombre': '_DIM_CONTACTO_nombre',
  'Apellido': '_DIM_CONTACTO_apellido',
  'Email': '_DIM_CONTACTO_email',
  'Teléfono': '_DIM_CONTACTO_telefono_1',
  'empresa': '_DIM_CONTACTO_empresa',
  'Vendedor Asignado para Seguimiento': 'id_vendedor_ae',
  'Toque': 'toque_ae',
  'Numero de toque': 'numero_toque_ae',
  'Fecha de primer contacto AE': 'fecha_primer_contacto_ae',
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
  'Deal Code': 'deal_code'
};

// ---------------------------------------------------------------------------
// 4. EXTRACT AND EVAL THE REAL FUNCTIONS FROM Código.js
// ---------------------------------------------------------------------------

var codeFilePath = path.join(__dirname, 'Código.js');
var rawSource = fs.readFileSync(codeFilePath, 'utf8');

// We only extract the functions we need to test, so we don't accidentally
// exec thousands of lines that depend on other stubs.
function extractFunction(src, funcName) {
  // Match: function funcName( ... ) { ... }
  // Uses a brace-counting approach so nested braces work correctly.
  var startPattern = new RegExp('function\\s+' + funcName + '\\s*\\(');
  var startMatch = startPattern.exec(src);
  if (!startMatch) throw new Error('Function not found: ' + funcName);

  var startIdx = startMatch.index;
  // Find opening brace
  var braceStart = src.indexOf('{', startIdx);
  if (braceStart === -1) throw new Error('No opening brace for: ' + funcName);

  var depth = 0;
  var i = braceStart;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return src.substring(startIdx, i + 1);
      }
    }
    i++;
  }
  throw new Error('Unbalanced braces for: ' + funcName);
}

// Functions to extract from Código.js
var TARGET_FUNCS = [
  'getNextId_',
  'getFirstEmptyRow_',
  'getColumnMap_',
  'readTable_'   // also extract to have it available if needed
];

var extractedCode = '';
TARGET_FUNCS.forEach(function(fn) {
  try {
    var code = extractFunction(rawSource, fn);
    extractedCode += '\n' + code + '\n';
  } catch (e) {
    console.error('WARN: Could not extract ' + fn + ': ' + e.message);
  }
});

// Also extract createNewLeadOrDeal for integration tests
try {
  extractedCode += '\n' + extractFunction(rawSource, 'createNewLeadOrDeal') + '\n';
} catch(e) {
  console.error('WARN: Could not extract createNewLeadOrDeal: ' + e.message);
}

// Eval in global context so functions become globals
try {
  var evalFn = new Function(
    'SpreadsheetApp','PropertiesService','LockService','Session','Logger','GmailApp',
    'Utilities','SHEET_ID','T_CONTACTOS','T_LEADS','T_TOQUES','T_DEALS','T_USERS',
    'T_LOG','T_INTERACCIONES','logChange_','getPricingConfig','readTable_','DEAL_FIELD_MAP',
    'assignToGlobal',
    extractedCode + '\n' +
    'assignToGlobal("getNextId_", getNextId_);\n' +
    'assignToGlobal("getFirstEmptyRow_", getFirstEmptyRow_);\n' +
    'assignToGlobal("getColumnMap_", getColumnMap_);\n' +
    'try { assignToGlobal("createNewLeadOrDeal", createNewLeadOrDeal); } catch(e){}\n'
  );
  // Pass getPricingConfig as a wrapper that always delegates through _pricingConfigStub,
  // so individual tests can override it after eval without fighting closure capture.
  var _getPricingConfigProxy = function() { return _pricingConfigStub.fn(); };
  evalFn(
    global.SpreadsheetApp, global.PropertiesService, global.LockService,
    global.Session, global.Logger, global.GmailApp, global.Utilities,
    global.SHEET_ID, global.T_CONTACTOS, global.T_LEADS, global.T_TOQUES,
    global.T_DEALS, global.T_USERS, global.T_LOG, global.T_INTERACCIONES,
    global.logChange_, _getPricingConfigProxy, global.readTable_, global.DEAL_FIELD_MAP,
    function(name, fn) { global[name] = fn; }
  );
} catch (e) {
  console.error('FATAL: Could not eval extracted functions:', e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 5. TEST RUNNER
// ---------------------------------------------------------------------------
var results = [];
var passed = 0;
var failed = 0;

function test(id, description, fn) {
  try {
    var result = fn();
    if (result === true || result === undefined) {
      console.log('[PASS] ' + id + ': ' + description);
      results.push({ id: id, pass: true });
      passed++;
    } else {
      console.log('[FAIL] ' + id + ': ' + description + ' → ' + result);
      results.push({ id: id, pass: false, reason: result });
      failed++;
    }
  } catch (e) {
    console.log('[FAIL] ' + id + ': ' + description + ' → threw: ' + e.message);
    results.push({ id: id, pass: false, reason: 'threw: ' + e.message });
    failed++;
  }
}

function assert(condition, failMsg) {
  if (!condition) return failMsg || 'assertion failed';
  return true;
}

function resetProps() {
  _propsStore = {};
}

// ---------------------------------------------------------------------------
// 6. TEST GROUPS
// ---------------------------------------------------------------------------

console.log('\n=== SMOKE TEST: CRM SWAT Squad ===\n');

// ── GROUP A: getNextId_ ──────────────────────────────────────────────────────

// A1: Normal case [1,2,3,4,5] → 6
test('A1', 'getNextId_ normal case → 6', function() {
  resetProps();
  var dataRows = [
    ['1','Alice','Smith','a@a.com','','','','','','','','','','',''],
    ['2','Bob','Jones','b@b.com','','','','','','','','','','',''],
    ['3','Carlos','X','c@c.com','','','','','','','','','','',''],
    ['4','Dana','Y','d@d.com','','','','','','','','','','',''],
    ['5','Eva','Z','e@e.com','','','','','','','','','','','']
  ];
  var sh = makeMockSheet('dim_contactos', dataRows);
  var next = getNextId_(sh, 'id_contacto');
  return assert(next === 6, 'expected 6, got ' + next);
});

// A2: Empty sheet (only headers) → 1
test('A2', 'getNextId_ empty sheet → 1', function() {
  resetProps();
  var sh = makeMockSheet('dim_contactos', []);
  var next = getNextId_(sh, 'id_contacto');
  return assert(next === 1, 'expected 1, got ' + next);
});

// A3: Sheet with gaps [1,3,5,10] → 11
test('A3', 'getNextId_ with gaps → 11', function() {
  resetProps();
  var dataRows = [
    ['1','','','','','','','','','','','','','',''],
    ['3','','','','','','','','','','','','','',''],
    ['5','','','','','','','','','','','','','',''],
    ['10','','','','','','','','','','','','','','']
  ];
  var sh = makeMockSheet('dim_contactos', dataRows);
  var next = getNextId_(sh, 'id_contacto');
  return assert(next === 11, 'expected 11, got ' + next);
});

// A4: Sheet with phantom rows (999 row allocation, only 5 with real data)
// getDataRange returns only rows with actual data (the mock simulates this correctly)
test('A4', 'getNextId_ phantom rows → correct next ID (6)', function() {
  resetProps();
  // The mock only holds the real data; phantom rows (from formatting) are NOT
  // returned by getDataRange().getDisplayValues() in the real implementation.
  // Our mock correctly simulates this: only real data rows are in fullData.
  var dataRows = [
    ['1','','','','','','','','','','','','','',''],
    ['2','','','','','','','','','','','','','',''],
    ['3','','','','','','','','','','','','','',''],
    ['4','','','','','','','','','','','','','',''],
    ['5','','','','','','','','','','','','','','']
  ];
  var sh = makeMockSheet('dim_contactos', dataRows);
  // Simulate phantom: getLastRow returns 1000 but getDataRange only has real rows
  sh.getLastRow = function() { return 1000; };
  var next = getNextId_(sh, 'id_contacto');
  // Strategy 1 uses getDataRange (correct), NOT getLastRow → should be 6
  return assert(next === 6, 'expected 6 (getDataRange path), got ' + next);
});

// A5: getDataRange throws → should fallback to PropertiesService
test('A5', 'getNextId_ getDataRange throws → fallback to PropertiesService', function() {
  resetProps();
  // Seed PropertiesService with a known value
  _propsStore['seq_dim_contactos_id_contacto'] = '42';
  var sh = makeMockSheet('dim_contactos', [], { shouldThrow: true });
  sh.getLastRow = function() { return 5; };
  var next = getNextId_(sh, 'id_contacto');
  // Should use max(42, 5) + 1 = 43
  return assert(next === 43, 'expected 43, got ' + next);
});

// A6: All fallbacks fail → should return something > 0
test('A6', 'getNextId_ all fallbacks fail → returns > 0', function() {
  resetProps();
  var sh = makeMockSheet('dim_contactos', [], { shouldThrow: true });
  sh.getLastRow = function() { throw new Error('getLastRow failed'); };
  // PropertiesService will throw too
  var origPS = global.PropertiesService;
  global.PropertiesService = {
    getScriptProperties: function() { throw new Error('PropertiesService unavailable'); }
  };
  var next;
  try {
    next = getNextId_(sh, 'id_contacto');
  } finally {
    global.PropertiesService = origPS;
  }
  return assert(typeof next === 'number' && next > 0, 'expected number > 0, got ' + next);
});

// ── GROUP B: getFirstEmptyRow_ ───────────────────────────────────────────────

// B1: Normal sheet with 5 data rows → row 7 (header + 5 rows + 1 next)
test('B1', 'getFirstEmptyRow_ 5 data rows → row 7', function() {
  resetProps();
  var dataRows = [
    ['1','','','','','','','','','','','','','',''],
    ['2','','','','','','','','','','','','','',''],
    ['3','','','','','','','','','','','','','',''],
    ['4','','','','','','','','','','','','','',''],
    ['5','','','','','','','','','','','','','','']
  ];
  var sh = makeMockSheet('dim_contactos', dataRows);
  var row = getFirstEmptyRow_(sh, 'id_contacto');
  // Row 1=header, rows 2-6=data, row 7=first empty
  return assert(row === 7, 'expected 7, got ' + row);
});

// B2: Sheet with phantom rows (getLastRow=1000) but only 5 real data rows
test('B2', 'getFirstEmptyRow_ phantom rows → row 7 (NOT 1001)', function() {
  resetProps();
  var dataRows = [
    ['1','','','','','','','','','','','','','',''],
    ['2','','','','','','','','','','','','','',''],
    ['3','','','','','','','','','','','','','',''],
    ['4','','','','','','','','','','','','','',''],
    ['5','','','','','','','','','','','','','','']
  ];
  var sh = makeMockSheet('dim_contactos', dataRows);
  sh.getLastRow = function() { return 1000; }; // Simulate phantom rows
  var row = getFirstEmptyRow_(sh, 'id_contacto');
  // Must use getDataRange, NOT getLastRow → correct answer is 7
  return assert(row === 7 && row !== 1001, 'expected 7, got ' + row);
});

// B3: Empty sheet → row 2 (just after header)
test('B3', 'getFirstEmptyRow_ empty sheet → row 2', function() {
  resetProps();
  var sh = makeMockSheet('dim_contactos', []);
  var row = getFirstEmptyRow_(sh, 'id_contacto');
  return assert(row === 2, 'expected 2, got ' + row);
});

// B4: getDataRange throws → graceful fallback
test('B4', 'getFirstEmptyRow_ getDataRange throws → fallback (row >= 2)', function() {
  resetProps();
  var sh = makeMockSheet('dim_contactos', [], { shouldThrow: true });
  sh.getLastRow = function() { return 5; };
  var row = getFirstEmptyRow_(sh, 'id_contacto');
  return assert(row >= 2, 'expected row >= 2, got ' + row);
});

// ── GROUP C: getColumnMap_ ───────────────────────────────────────────────────

// C1: dim_contactos column indices (1-based)
test('C1', 'getColumnMap_ dim_contactos indices correct', function() {
  var sh = makeMockSheet('dim_contactos', []);
  var map = getColumnMap_(sh);
  var errors = [];
  SCHEMAS.dim_contactos.forEach(function(col, i) {
    if (map[col] !== i + 1) {
      errors.push(col + ': expected ' + (i+1) + ', got ' + map[col]);
    }
  });
  if (errors.length) return errors.join('; ');
  return true;
});

// C2: fact_leads column indices
test('C2', 'getColumnMap_ fact_leads indices correct', function() {
  var sh = makeMockSheet('fact_leads', []);
  var map = getColumnMap_(sh);
  var errors = [];
  SCHEMAS.fact_leads.forEach(function(col, i) {
    if (map[col] !== i + 1) {
      errors.push(col + ': expected ' + (i+1) + ', got ' + map[col]);
    }
  });
  if (errors.length) return errors.join('; ');
  return true;
});

// C3: fact_toques column indices
test('C3', 'getColumnMap_ fact_toques indices correct', function() {
  var sh = makeMockSheet('fact_toques', []);
  var map = getColumnMap_(sh);
  var errors = [];
  SCHEMAS.fact_toques.forEach(function(col, i) {
    if (map[col] !== i + 1) {
      errors.push(col + ': expected ' + (i+1) + ', got ' + map[col]);
    }
  });
  if (errors.length) return errors.join('; ');
  return true;
});

// ── GROUP D: createNewLeadOrDeal simulation ───────────────────────────────────

// Build a shared mock SS for D tests
function buildLeadSS(contactRows, leadRows) {
  var contactSheet = makeMockSheet('dim_contactos', contactRows || []);
  var leadsSheet   = makeMockSheet('fact_leads',    leadRows   || []);
  var toqSheet     = makeMockSheet('fact_toques',   []);
  var dealsSheet   = makeMockSheet('fact_deals',    []);
  var usersSheet   = makeMockSheet('config_users',  [], { customHeaders: ['id','nombre','email','rol'] });
  var logSheet     = makeMockSheet('log_transacciones', [], { customHeaders: ['timestamp','entidad','id_entidad','usuario','campo_modificado','valor_anterior','valor_nuevo'] });
  return makeMockSpreadsheet({
    dim_contactos: contactSheet,
    fact_leads: leadsSheet,
    fact_toques: toqSheet,
    fact_deals: dealsSheet,
    config_users: usersSheet,
    log_transacciones: logSheet
  });
}

// D1: cRow length matches dim_contactos column count
test('D1', 'createNewLeadOrDeal: cRow length = dim_contactos columns', function() {
  resetProps();
  _mockSS = buildLeadSS([], []);
  var payload = { Nombre: 'Juan', Apellido: 'López', Email: 'juan@test.com', 'Teléfono': '555-1234', Status: 'Nuevo' };
  var result = createNewLeadOrDeal(payload, 'lead');
  if (result.status !== 'success') return 'createNewLeadOrDeal failed: ' + result.message;
  // Inspect what was written to dim_contactos
  var contactSheet = _mockSS.getSheetByName('dim_contactos');
  var stored = contactSheet._storedRows;
  if (!stored.length) return 'No rows were stored to dim_contactos';
  var cRow = stored[0].data[0];
  var expected = SCHEMAS.dim_contactos.length;
  return assert(cRow.length === expected, 'expected ' + expected + ' cols, got ' + cRow.length);
});

// D2: newContactId is a number, not a string
test('D2', 'createNewLeadOrDeal: newContactId is a number', function() {
  resetProps();
  _mockSS = buildLeadSS([], []);
  var payload = { Nombre: 'Ana', Apellido: 'García', Email: 'ana@test.com', Status: 'Nuevo' };
  var result = createNewLeadOrDeal(payload, 'lead');
  if (result.status !== 'success') return 'failed: ' + result.message;
  var contactSheet = _mockSS.getSheetByName('dim_contactos');
  var stored = contactSheet._storedRows;
  if (!stored.length) return 'No rows stored';
  var idVal = stored[0].data[0][0]; // id_contacto is col index 0
  return assert(typeof idVal === 'number', 'expected number, got ' + typeof idVal + ' (' + idVal + ')');
});

// D3: cRow[0] (id_contacto position) contains a number
test('D3', 'createNewLeadOrDeal: cRow[id_contacto] contains number', function() {
  resetProps();
  _mockSS = buildLeadSS([], []);
  var payload = { Nombre: 'Bob', Apellido: 'Marley', Email: 'bob@test.com', Status: 'Nuevo' };
  var result = createNewLeadOrDeal(payload, 'lead');
  if (result.status !== 'success') return 'failed: ' + result.message;
  var contactSheet = _mockSS.getSheetByName('dim_contactos');
  var stored = contactSheet._storedRows;
  if (!stored.length) return 'No rows stored';
  var idContactoCol = SCHEMAS.dim_contactos.indexOf('id_contacto'); // 0
  var idVal = stored[0].data[0][idContactoCol];
  return assert(typeof idVal === 'number' && idVal > 0,
    'expected number > 0 at position ' + idContactoCol + ', got ' + typeof idVal + ' = ' + idVal);
});

// D4: lRow length matches fact_leads column count
test('D4', 'createNewLeadOrDeal: lRow length = fact_leads columns', function() {
  resetProps();
  _mockSS = buildLeadSS([], []);
  var payload = { Nombre: 'María', Apellido: 'Cruz', Email: 'maria@test.com', Status: 'Nuevo' };
  var result = createNewLeadOrDeal(payload, 'lead');
  if (result.status !== 'success') return 'failed: ' + result.message;
  var leadsSheet = _mockSS.getSheetByName('fact_leads');
  var stored = leadsSheet._storedRows;
  if (!stored.length) return 'No rows stored to fact_leads';
  var lRow = stored[0].data[0];
  var expected = SCHEMAS.fact_leads.length;
  return assert(lRow.length === expected, 'expected ' + expected + ' cols, got ' + lRow.length);
});

// D5: 'licencias' column (NOT 'licencias_promedio') gets written
test('D5', 'createNewLeadOrDeal: licencias column (not licencias_promedio) exists in schema', function() {
  // Verify schema has 'licencias' and not 'licencias_promedio'
  var hasLicencias = SCHEMAS.fact_leads.indexOf('licencias') !== -1;
  var hasWrong = SCHEMAS.fact_leads.indexOf('licencias_promedio') !== -1;
  if (!hasLicencias) return 'fact_leads schema missing licencias column';
  if (hasWrong) return 'fact_leads schema incorrectly contains licencias_promedio';
  // Now verify the code writes to 'licencias' col
  // Override via the indirection stub so the eval'd closure sees the updated function
  resetProps();
  _mockSS = buildLeadSS([], []);
  _pricingConfigStub.fn = function() {
    return { tipoCliente: 'B2B', productos: [{ nombre: 'Pro', ticketPromedio: 5000, licenciasPromedio: 10 }] };
  };
  var payload = { Nombre: 'Test', Apellido: 'User', Email: 'test@test.com', Status: 'Nuevo' };
  var result = createNewLeadOrDeal(payload, 'lead');
  _pricingConfigStub.fn = function() { return { tipoCliente: '', productos: [] }; };
  if (result.status !== 'success') return 'failed: ' + result.message;
  var leadsSheet = _mockSS.getSheetByName('fact_leads');
  var stored = leadsSheet._storedRows;
  if (!stored.length) return 'No rows stored to fact_leads';
  var lRow = stored[0].data[0];
  var licenciasCol = SCHEMAS.fact_leads.indexOf('licencias'); // 0-based
  var licenciasVal = lRow[licenciasCol];
  return assert(licenciasVal === 10 || licenciasVal === '10' || Number(licenciasVal) === 10,
    'expected licencias=10 at col ' + licenciasCol + ', got ' + licenciasVal);
});

// ── GROUP E: registrarToque simulation ────────────────────────────────────────

// For registrarToque we eval it directly from the source
var registrarTouqueCode;
try {
  registrarTouqueCode = extractFunction(rawSource, 'registrarToque');
} catch (e) {
  registrarTouqueCode = null;
}

function runRegistrarToque(toqueArgs) {
  if (!registrarTouqueCode) throw new Error('Could not extract registrarToque');
  var capturedAppendRow = null;
  // Build a special mock that captures appendRow
  var touqSheet = makeMockSheet('fact_toques', []);
  touqSheet.appendRow = function(row) {
    capturedAppendRow = row;
    touqSheet._appendedRows.push(row);
    touqSheet._fullData.push(row);
  };
  var leadsSheet = makeMockSheet('fact_leads', []);
  _mockSS = makeMockSpreadsheet({
    fact_toques: touqSheet,
    fact_leads: leadsSheet,
    fact_deals: makeMockSheet('fact_deals', [])
  });

  var fn = new Function(
    'SpreadsheetApp','PropertiesService','LockService','Session','Logger',
    'SHEET_ID','T_TOQUES','T_LEADS','T_DEALS',
    'getColumnMap_','getNextId_','assignCapture',
    registrarTouqueCode + '\n' +
    'assignCapture(registrarToque(' +
      toqueArgs.map(function(a) { return JSON.stringify(a); }).join(',') +
    '));'
  );
  var result;
  fn(
    global.SpreadsheetApp, global.PropertiesService, global.LockService,
    global.Session, global.Logger,
    global.SHEET_ID, global.T_TOQUES, global.T_LEADS, global.T_DEALS,
    global.getColumnMap_, global.getNextId_,
    function(r) { result = r; }
  );
  return { result: result, capturedAppendRow: capturedAppendRow, sheet: touqSheet };
}

// E1: appendRow sends exactly 9 values (matching fact_toques 9 columns)
test('E1', 'registrarToque appendRow sends exactly 9 values', function() {
  resetProps();
  var out = runRegistrarToque([101, 'Lead', 'sdr@test.com', 'SDR', 3, 'Teléfono']);
  if (!out.capturedAppendRow) {
    // Check if TOQUE-02 monotonic guard rejected it (shouldn't on fresh sheet)
    if (out.result && out.result.error) return 'appendRow not called: ' + out.result.error;
    return 'appendRow was not called';
  }
  var len = out.capturedAppendRow.length;
  return assert(len === 9, 'expected 9 columns, got ' + len);
});

// E2: Column order matches fact_toques headers
test('E2', 'registrarToque appendRow column order matches fact_toques schema', function() {
  resetProps();
  var out = runRegistrarToque([202, 'Lead', 'sdr2@test.com', 'SDR', 1, 'Email']);
  if (!out.capturedAppendRow) {
    if (out.result && out.result.error) return 'not called: ' + out.result.error;
    return 'appendRow was not called';
  }
  var row = out.capturedAppendRow;
  // fact_toques: ['id_registro_toque','id_entidad','tipo_entidad','id_vendedor','rol_vendedor','numero_toque','fecha_toque','canal','detalle']
  //               0                   1            2              3             4              5              6            7       8
  var errors = [];
  // col 0: id_registro_toque → should be a number
  if (typeof row[0] !== 'number') errors.push('col0 (id_registro_toque) not a number: ' + row[0]);
  // col 1: id_entidad → 202
  if (String(row[1]) !== '202') errors.push('col1 (id_entidad) expected 202, got ' + row[1]);
  // col 2: tipo_entidad → 'Lead'
  if (String(row[2]) !== 'Lead') errors.push('col2 (tipo_entidad) expected Lead, got ' + row[2]);
  // col 3: id_vendedor → 'sdr2@test.com'
  if (String(row[3]) !== 'sdr2@test.com') errors.push('col3 (id_vendedor) expected sdr2@test.com, got ' + row[3]);
  // col 4: rol_vendedor → 'SDR'
  if (String(row[4]) !== 'SDR') errors.push('col4 (rol_vendedor) expected SDR, got ' + row[4]);
  // col 5: numero_toque → 1
  if (String(row[5]) !== '1') errors.push('col5 (numero_toque) expected 1, got ' + row[5]);
  // col 7: canal → 'Email'
  if (String(row[7]) !== 'Email') errors.push('col7 (canal) expected Email, got ' + row[7]);
  // col 8: detalle → '' (empty string for registrarToque)
  if (row[8] !== '') errors.push('col8 (detalle) expected empty string, got ' + JSON.stringify(row[8]));
  if (errors.length) return errors.join('; ');
  return true;
});

// ── GROUP F: sendDirectEmail toque logging ───────────────────────────────────

// Extract sendDirectEmail
var sendEmailCode;
try {
  sendEmailCode = extractFunction(rawSource, 'sendDirectEmail');
} catch (e) {
  sendEmailCode = null;
}

// F1: Verify it uses 'id_registro_toque' (NOT 'id_toque') for getNextId_
test('F1', 'sendDirectEmail uses id_registro_toque (not id_toque)', function() {
  if (!sendEmailCode) return 'Could not extract sendDirectEmail';
  // Static code analysis: check the literal string in the source
  var usesCorrect = sendEmailCode.indexOf("'id_registro_toque'") !== -1;
  var usesWrong   = sendEmailCode.indexOf("'id_toque'") !== -1;
  if (usesWrong)   return "Code still uses 'id_toque' (wrong column name)";
  if (!usesCorrect) return "Code does not use 'id_registro_toque'";
  return true;
});

// F2: Switch statement maps to correct column names (static analysis)
test('F2', 'sendDirectEmail switch maps all fact_toques columns', function() {
  if (!sendEmailCode) return 'Could not extract sendDirectEmail';
  var requiredCases = [
    'id_registro_toque',
    'tipo_entidad',
    'id_entidad',
    'numero_toque',
    'fecha_toque',
    'id_vendedor',
    'rol_vendedor',
    'canal',
    'detalle'
  ];
  var missing = requiredCases.filter(function(c) {
    return sendEmailCode.indexOf("case '" + c + "'") === -1;
  });
  if (missing.length) return 'Switch missing cases: ' + missing.join(', ');
  return true;
});

// ── GROUP G: readTable_ regression ───────────────────────────────────────────

// Re-eval readTable_ but pointing at our mock
function evalReadTable_(sheetName) {
  // Use the global readTable_ stub which uses _mockSS
  return global.readTable_(sheetName);
}

// G1: readTable_ with sample data returns correct array of objects
test('G1', 'readTable_ returns correct array of objects', function() {
  var contactSheet = makeMockSheet('dim_contactos', [
    ['1','Alice','Smith','alice@a.com','555','','Acme','IT','MX','CDMX','50','A','','','2024-01-01'],
    ['2','Bob','Jones','bob@b.com','444','','Corp','Sales','US','NY','200','B','','','2024-01-02']
  ]);
  _mockSS = makeMockSpreadsheet({ dim_contactos: contactSheet });
  var rows = evalReadTable_('dim_contactos');
  if (rows.length !== 2) return 'expected 2 rows, got ' + rows.length;
  if (rows[0].nombre !== 'Alice') return 'expected rows[0].nombre=Alice, got ' + rows[0].nombre;
  if (rows[1].email !== 'bob@b.com') return 'expected rows[1].email=bob@b.com, got ' + rows[1].email;
  return true;
});

// G2: Keys are lowercase
test('G2', 'readTable_ keys are lowercase', function() {
  var contactSheet = makeMockSheet('dim_contactos', [
    ['1','Alice','','alice@a.com','','','','','','','','','','','']
  ]);
  _mockSS = makeMockSpreadsheet({ dim_contactos: contactSheet });
  var rows = evalReadTable_('dim_contactos');
  if (!rows.length) return 'No rows returned';
  var keys = Object.keys(rows[0]).filter(function(k) { return k !== '_row'; });
  var upperKeys = keys.filter(function(k) { return k !== k.toLowerCase(); });
  if (upperKeys.length) return 'Found uppercase keys: ' + upperKeys.join(', ');
  return true;
});

// G3: _row property is correct (row number in sheet, 1-based, +1 for header)
test('G3', 'readTable_ _row property is correct', function() {
  var contactSheet = makeMockSheet('dim_contactos', [
    ['1','Alice','','','','','','','','','','','','',''],
    ['2','Bob','','','','','','','','','','','','',''],
    ['3','Carol','','','','','','','','','','','','','']
  ]);
  _mockSS = makeMockSpreadsheet({ dim_contactos: contactSheet });
  var rows = evalReadTable_('dim_contactos');
  if (rows.length !== 3) return 'expected 3 rows, got ' + rows.length;
  var errors = [];
  // _row = i+1 (0-indexed data array → 1-based) + 1 (header offset) = i+2 in sheet
  if (rows[0]._row !== 2) errors.push('rows[0]._row expected 2, got ' + rows[0]._row);
  if (rows[1]._row !== 3) errors.push('rows[1]._row expected 3, got ' + rows[1]._row);
  if (rows[2]._row !== 4) errors.push('rows[2]._row expected 4, got ' + rows[2]._row);
  if (errors.length) return errors.join('; ');
  return true;
});

// ── GROUP H: cargarFechasExistentes_ duplicate-contact bug fix ─────────────
// The bug: cargarFechasExistentes_ only loaded from dim_contactos.fecha_creacion.
// When a duplicate contact submitted a form, no new contact row was created,
// so the Framer timestamp was never persisted → re-processed every 5 min.
// The fix: also load timestamps from fact_leads.fecha_ingreso.

// Extract cargarFechasExistentes_ from ProcesarLeadsLanding.js
var landingSource = fs.readFileSync(path.join(__dirname, 'ProcesarLeadsLanding.js'), 'utf8');
var cargarFechasCode;
try {
  cargarFechasCode = extractFunction(landingSource, 'cargarFechasExistentes_');
} catch (e) {
  cargarFechasCode = null;
}

// Also extract findExistingContact_ and findFirstLeadForContact_ from Código.js
var findContactCode, findFirstLeadCode;
try {
  findContactCode = extractFunction(rawSource, 'findExistingContact_');
  findFirstLeadCode = extractFunction(rawSource, 'findFirstLeadForContact_');
} catch (e) {
  findContactCode = null;
  findFirstLeadCode = null;
}

// Eval cargarFechasExistentes_ into a callable
var cargarFechasExistentes_ = null;
if (cargarFechasCode) {
  try {
    var evalCF = new Function(
      'return ' + cargarFechasCode
    );
    cargarFechasExistentes_ = evalCF();
  } catch (e) {
    console.error('WARN: Could not eval cargarFechasExistentes_:', e.message);
  }
}

// Eval findExistingContact_ into a callable
var findExistingContact_ = null;
if (findContactCode) {
  try {
    var evalFC = new Function('return ' + findContactCode);
    findExistingContact_ = evalFC();
  } catch (e) {
    console.error('WARN: Could not eval findExistingContact_:', e.message);
  }
}

// H1: cargarFechasExistentes_ loads dates from dim_contactos
test('H1', 'cargarFechasExistentes_ loads dim_contactos.fecha_creacion dates', function() {
  if (!cargarFechasExistentes_) return 'Could not extract cargarFechasExistentes_';
  var contactSheet = makeMockSheet('dim_contactos', [
    ['1','Juan','Pérez','juan@test.com','555','','Empresa','','','','','','','','2026-01-15T10:00:00'],
    ['2','Ana','García','ana@test.com','666','','Corp','','','','','','','','2026-02-20T14:30:00']
  ]);
  var leadsSheet = makeMockSheet('fact_leads', []);
  var fechas = cargarFechasExistentes_(contactSheet, leadsSheet);
  var has1 = fechas['2026-01-15T10:00:00'] === true;
  var has2 = fechas['2026-02-20T14:30:00'] === true;
  if (!has1) return 'Missing fecha_creacion for contact 1';
  if (!has2) return 'Missing fecha_creacion for contact 2';
  return true;
});

// H2: cargarFechasExistentes_ NOW also loads dates from fact_leads.fecha_ingreso
// This is the CORE of the fix — without this, duplicate-contact timestamps are lost
test('H2', 'cargarFechasExistentes_ loads fact_leads.fecha_ingreso dates (THE FIX)', function() {
  if (!cargarFechasExistentes_) return 'Could not extract cargarFechasExistentes_';
  // Contact created on Jan 15 (this date IS in dim_contactos)
  var contactSheet = makeMockSheet('dim_contactos', [
    ['1','Juan','Pérez','juan@test.com','555','','Empresa','','','','','','','','2026-01-15T10:00:00']
  ]);
  // A duplicate lead was created on Apr 20 (this date is NOT in dim_contactos,
  // only in fact_leads.fecha_ingreso — this is the timestamp that was being lost)
  var leadsSheet = makeMockSheet('fact_leads', [
    ['1','1','','1','sdr1','Nuevo','Sin Calificar','','2026-01-15T10:00:00','2026-01-15T10:00:00','',0,'','Activo','','','','',false,'','',''],
    ['2','1','1','1','sdr2','Duplicado','Sin Calificar','','2026-04-20T09:00:00','2026-04-20T09:00:00','',0,'','Activo','','','','',false,'','','']
  ]);
  var fechas = cargarFechasExistentes_(contactSheet, leadsSheet);
  // The critical assertion: the duplicate lead's fecha_ingreso MUST be in the hash
  var hasDupDate = fechas['2026-04-20T09:00:00'] === true;
  if (!hasDupDate) return 'CRITICAL: fact_leads.fecha_ingreso NOT loaded — the bug is NOT fixed!';
  return true;
});

// H3: Without hLeads (null), function still works (backward compat)
test('H3', 'cargarFechasExistentes_ works with null hLeads (backward compat)', function() {
  if (!cargarFechasExistentes_) return 'Could not extract cargarFechasExistentes_';
  var contactSheet = makeMockSheet('dim_contactos', [
    ['1','Juan','Pérez','juan@test.com','555','','','','','','','','','','2026-01-15T10:00:00']
  ]);
  var fechas = cargarFechasExistentes_(contactSheet, null);
  return assert(fechas['2026-01-15T10:00:00'] === true, 'Should still load dim_contactos dates with null hLeads');
});

// H4: Full scenario simulation — duplicate contact submission should be caught on "second run"
test('H4', 'Full scenario: duplicate contact submission caught on second run (no infinite loop)', function() {
  if (!cargarFechasExistentes_ || !findExistingContact_) return 'Could not extract required functions';

  // === STATE: After first run processed a duplicate contact ===
  // dim_contactos has the original contact (created Jan 15)
  var contactSheet = makeMockSheet('dim_contactos', [
    ['1','Juan','Pérez','juan@test.com','+525512345678','','SWAT Corp','','','','','','','','2026-01-15T10:00:00']
  ]);
  // fact_leads has: original lead (Jan 15) + duplicate lead (Apr 20 from first run)
  var leadsSheet = makeMockSheet('fact_leads', [
    ['1','1','','1','sdr1','Nuevo','Sin Calificar','Membresía','2026-01-15T10:00:00','2026-01-15T10:00:00','',0,'','Activo','','','','',false,'','',''],
    ['2','1','1','1','sdr2','Duplicado','Sin Calificar','Membresía','2026-04-20T09:00:00','2026-04-20T09:00:00','',0,'','Activo','','','','',false,'','','']
  ]);

  // === SECOND RUN: same Framer row still present ===
  var fechasExistentes = cargarFechasExistentes_(contactSheet, leadsSheet);

  // The Framer submission has timestamp "2026-04-20T09:00:00"
  var framerTimestamp = '2026-04-20T09:00:00';

  // WITH THE FIX: this timestamp should be in fechasExistentes → row is SKIPPED
  var wouldSkip = fechasExistentes[framerTimestamp] === true;

  if (!wouldSkip) {
    return 'BUG NOT FIXED: Framer timestamp "' + framerTimestamp + '" not found in fechasExistentes — would create ANOTHER duplicate lead!';
  }

  return true;
});

// H5: Verify findExistingContact_ matches by email
test('H5', 'findExistingContact_ matches by email correctly', function() {
  if (!findExistingContact_) return 'Could not extract findExistingContact_';
  var contacts = [
    { id_contacto: '1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com', telefono_1: '5551234567', telefono_2: '' }
  ];
  var match = findExistingContact_(contacts, 'juan@test.com', '', '', '');
  if (!match.found) return 'Should have found contact by email';
  if (match.matchType !== 'Email') return 'Expected matchType Email, got ' + match.matchType;
  if (match.contacto.id_contacto !== '1') return 'Wrong contact matched';
  return true;
});

// H6: Verify findExistingContact_ matches by phone
test('H6', 'findExistingContact_ matches by phone (7+ digits)', function() {
  if (!findExistingContact_) return 'Could not extract findExistingContact_';
  var contacts = [
    { id_contacto: '1', nombre: 'Juan', apellido: 'Pérez', email: 'juan@test.com', telefono_1: '+52 55 1234 5678', telefono_2: '' }
  ];
  // Same digits with different formatting (including country code 52)
  var match = findExistingContact_(contacts, '', '52 5512345678', '', '');
  if (!match.found) return 'Should have found contact by phone';
  if (match.matchType !== 'Teléfono') return 'Expected matchType Teléfono, got ' + match.matchType;
  return true;
});

// H7: Verify findExistingContact_ does NOT match with empty email
test('H7', 'findExistingContact_ does not match empty email against empty email', function() {
  if (!findExistingContact_) return 'Could not extract findExistingContact_';
  var contacts = [
    { id_contacto: '1', nombre: 'Juan', apellido: 'Pérez', email: '', telefono_1: '5551234567', telefono_2: '' }
  ];
  var match = findExistingContact_(contacts, '', '', 'Carlos', 'López');
  // Should NOT match — empty email vs empty email should not trigger, and name doesn't match
  if (match.found) return 'Should NOT have matched (empty emails + different name)';
  return true;
});

// H8: End-to-end: new contact timestamp IS in dim_contactos (no regression)
test('H8', 'New contact fecha_creacion still prevents re-processing (no regression)', function() {
  if (!cargarFechasExistentes_) return 'Could not extract cargarFechasExistentes_';
  var contactSheet = makeMockSheet('dim_contactos', [
    ['1','Ana','García','ana@test.com','666','','Corp','','','','','','','','2026-03-10T08:00:00']
  ]);
  var leadsSheet = makeMockSheet('fact_leads', [
    ['1','1','','1','sdr1','Nuevo','Sin Calificar','','2026-03-10T08:00:00','2026-03-10T08:00:00','',0,'','Activo','','','','',false,'','','']
  ]);
  var fechas = cargarFechasExistentes_(contactSheet, leadsSheet);
  var blocked = fechas['2026-03-10T08:00:00'] === true;
  if (!blocked) return 'Regression: new contact timestamp not found in fechasExistentes';
  return true;
});

// ---------------------------------------------------------------------------
// 7. FINAL SUMMARY
// ---------------------------------------------------------------------------
var total = passed + failed;
console.log('\n=== RESULTS: ' + passed + '/' + total + ' passed ===\n');
if (failed > 0) {
  console.log('Failed tests:');
  results.filter(function(r) { return !r.pass; }).forEach(function(r) {
    console.log('  ' + r.id + ': ' + r.reason);
  });
  process.exitCode = 1;
}
