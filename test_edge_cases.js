/**
 * Edge Case & Integration Tests — CRM SWAT Squad
 * Tests dangerous production scenarios that the smoke tests don't cover.
 */

var fs = require('fs');
var path = require('path');

var passed = 0, failed = 0, total = 0;

function assert(testId, desc, condition, detail) {
  total++;
  if (condition) {
    passed++;
    console.log('[PASS] ' + testId + ': ' + desc);
  } else {
    failed++;
    console.log('[FAIL] ' + testId + ': ' + desc + (detail ? ' — ' + detail : ''));
  }
}

// ── Extract functions from Código.js ──
var codigo = fs.readFileSync(path.join(__dirname, 'Código.js'), 'utf8');

function extractFn(name) {
  var start = codigo.indexOf('function ' + name);
  if (start === -1) return null;
  var depth = 0, i = codigo.indexOf('{', start);
  for (; i < codigo.length; i++) {
    if (codigo[i] === '{') depth++;
    if (codigo[i] === '}') depth--;
    if (depth === 0) return codigo.substring(start, i + 1);
  }
  return null;
}

// ── Mock GAS APIs ──
var propsStore = {};
var mockProps = {
  getScriptProperties: function() {
    return {
      getProperty: function(k) { return propsStore[k] || null; },
      setProperty: function(k, v) { propsStore[k] = v; }
    };
  }
};

function makeMockSheet(name, headers, dataRows, opts) {
  opts = opts || {};
  var allData = [headers].concat(dataRows);
  var appendedRows = [];
  var writtenRows = {};
  var clearFormatCalls = [];

  return {
    _name: name,
    _appended: appendedRows,
    _written: writtenRows,
    _clearFormatCalls: clearFormatCalls,
    getName: function() { return name; },
    getLastRow: function() {
      if (opts.lastRowOverride) return opts.lastRowOverride;
      return allData.length;
    },
    getLastColumn: function() { return headers.length; },
    getDataRange: function() {
      if (opts.getDataRangeThrows) throw new Error(opts.getDataRangeThrows);
      // If phantom rows, include them
      var result = allData.slice();
      if (opts.phantomRows) {
        for (var p = 0; p < opts.phantomRows; p++) {
          result.push(new Array(headers.length).fill(''));
        }
      }
      return {
        getDisplayValues: function() { return result.map(function(r) { return r.map(String); }); },
        getLastRow: function() { return result.length; }
      };
    },
    getRange: function(r, c, numR, numC) {
      return {
        getDisplayValues: function() {
          if (opts.getRangeThrows) throw new Error(opts.getRangeThrows);
          var out = [];
          for (var i = 0; i < (numR || 1); i++) {
            var row = allData[r - 1 + i] || [];
            var slice = [];
            for (var j = 0; j < (numC || 1); j++) slice.push(String(row[(c - 1) + j] || ''));
            out.push(slice);
          }
          return out;
        },
        setValues: function(data) {
          writtenRows[r] = data[0];
          // Validate: no undefined values
          for (var i = 0; i < data[0].length; i++) {
            if (data[0][i] === undefined) throw new Error('undefined value at column ' + i);
          }
        },
        clearFormat: function() { clearFormatCalls.push(r); },
        getValue: function() {
          return allData[r - 1] ? allData[r - 1][c - 1] : '';
        }
      };
    },
    appendRow: function(data) {
      appendedRows.push(data);
      allData.push(data.map(String));
    }
  };
}

// Build eval context
var evalContext = function(extraGlobals) {
  var globals = {
    PropertiesService: mockProps,
    LockService: { getScriptLock: function() { return { waitLock: function(){}, releaseLock: function(){} }; } },
    SpreadsheetApp: { openById: function() { return null; }, flush: function(){} },
    Session: { getActiveUser: function() { return { getEmail: function() { return 'test@test.com'; } }; } },
    Logger: { log: function(){} },
    GmailApp: { sendEmail: function(){} },
    Utilities: { base64Decode: function(){ return []; }, newBlob: function(){ return {}; } }
  };
  for (var k in extraGlobals) globals[k] = extraGlobals[k];
  return globals;
};

// Extract core functions
var getNextIdSrc = extractFn('getNextId_');
var extractMaxIdSrc = extractFn('_extractMaxId_');
var getFirstEmptyRowSrc = extractFn('getFirstEmptyRow_');
var getColumnMapSrc = extractFn('getColumnMap_');

// Create executable versions
function buildFunctions(globals) {
  var src = [
    getColumnMapSrc, extractMaxIdSrc, getNextIdSrc, getFirstEmptyRowSrc,
    'return { getNextId_: getNextId_, _extractMaxId_: _extractMaxId_, getFirstEmptyRow_: getFirstEmptyRow_, getColumnMap_: getColumnMap_ };'
  ].join('\n');

  var paramNames = Object.keys(globals);
  var paramValues = paramNames.map(function(k) { return globals[k]; });
  var factory = new Function(paramNames.join(','), src);
  return factory.apply(null, paramValues);
}

console.log('=== EDGE CASE TESTS: CRM SWAT Squad ===\n');

// ══════════════════════════════════════════
// GROUP H: Type coercion edge cases
// ══════════════════════════════════════════
console.log('--- Group H: Type Coercion Edge Cases ---');

(function() {
  var g = evalContext({});
  var fns = buildFunctions(g);

  // H1: IDs stored as floats (1.0, 2.0) — common in Google Sheets
  var sheet = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['1.0','Juan'],['2.0','Maria'],['3.0','Pedro'],['25.5','Float']]
  );
  var nextId = fns.getNextId_(sheet, 'id_contacto');
  assert('H1', 'Float IDs (1.0, 2.0, 25.5) → next is 26', nextId === 26, 'got ' + nextId);

  // H2: IDs with leading/trailing whitespace
  var sheet2 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [[' 1 ','Juan'],['  2','Maria'],['3  ','Pedro']]
  );
  var nextId2 = fns.getNextId_(sheet2, 'id_contacto');
  assert('H2', 'IDs with whitespace → still finds max correctly', nextId2 === 4, 'got ' + nextId2);

  // H3: Mixed valid/invalid IDs (some text in ID column)
  var sheet3 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['1','Juan'],['abc','Corrupted'],['3','Pedro'],['','Empty'],['5','Last']]
  );
  var nextId3 = fns.getNextId_(sheet3, 'id_contacto');
  assert('H3', 'Mixed valid/invalid IDs → skips non-numeric, returns 6', nextId3 === 6, 'got ' + nextId3);

  // H4: All IDs are non-numeric (total corruption)
  var sheet4 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['abc','Juan'],['def','Maria'],['','Empty']]
  );
  var nextId4 = fns.getNextId_(sheet4, 'id_contacto');
  assert('H4', 'All non-numeric IDs → returns 1', nextId4 === 1, 'got ' + nextId4);

  // H5: Negative IDs
  var sheet5 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['-1','Juan'],['0','Maria'],['5','Pedro']]
  );
  var nextId5 = fns.getNextId_(sheet5, 'id_contacto');
  assert('H5', 'Negative IDs → max is 5, next is 6', nextId5 === 6, 'got ' + nextId5);

  // H6: Very large IDs
  var sheet6 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['999999','Juan'],['1000000','Maria']]
  );
  var nextId6 = fns.getNextId_(sheet6, 'id_contacto');
  assert('H6', 'Large IDs (1000000) → returns 1000001', nextId6 === 1000001, 'got ' + nextId6);
})();

// ══════════════════════════════════════════
// GROUP I: Phantom row scenarios
// ══════════════════════════════════════════
console.log('\n--- Group I: Phantom Row Scenarios ---');

(function() {
  var g = evalContext({});
  var fns = buildFunctions(g);

  // I1: 999 phantom rows after 5 data rows
  var sheet = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['1','Juan'],['2','Maria'],['3','Pedro'],['4','Ana'],['5','Luis']],
    { phantomRows: 994 }
  );
  var row = fns.getFirstEmptyRow_(sheet, 'id_contacto');
  assert('I1', '5 data + 994 phantom → insert at row 7', row === 7, 'got ' + row);

  // I2: Phantom rows with some having stray content
  var dataRows = [['1','Juan'],['2','Maria'],['3','Pedro']];
  // Add 10 empty rows then a "stray" row with text in name but NOT in ID
  for (var p = 0; p < 10; p++) dataRows.push(['','']);
  dataRows.push(['','StrayName']); // Row with name but no ID
  var sheet2 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    dataRows
  );
  var row2 = fns.getFirstEmptyRow_(sheet2, 'id_contacto');
  assert('I2', 'Stray content in non-ID column → insert after last ID row (5)', row2 === 5, 'got ' + row2);

  // I3: getDataRange throws → fallback
  var sheet3 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['1','Juan'],['2','Maria']],
    { getDataRangeThrows: 'Simulated format error' }
  );
  var row3 = fns.getFirstEmptyRow_(sheet3, 'id_contacto');
  assert('I3', 'getDataRange throws → fallback returns valid row', row3 >= 2, 'got ' + row3);
})();

// ══════════════════════════════════════════
// GROUP J: PropertiesService fallback chain
// ══════════════════════════════════════════
console.log('\n--- Group J: PropertiesService Fallback ---');

(function() {
  var g = evalContext({});
  var fns = buildFunctions(g);

  // J1: getDataRange fails, PropertiesService has stored value
  propsStore = { 'seq_dim_contactos_id_contacto': '42' };
  var sheet = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['1','Juan']],
    { getDataRangeThrows: 'Column format error' }
  );
  var nextId = fns.getNextId_(sheet, 'id_contacto');
  assert('J1', 'getDataRange fails + PropertiesService has 42 → returns 43', nextId === 43, 'got ' + nextId);

  // J2: Successful read syncs to PropertiesService
  propsStore = {};
  var sheet2 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['1','Juan'],['2','Maria'],['10','Max']]
  );
  fns.getNextId_(sheet2, 'id_contacto');
  var stored = propsStore['seq_dim_contactos_id_contacto'];
  assert('J2', 'Successful read syncs ID 11 to PropertiesService', stored === '11', 'got ' + stored);

  // J3: PropertiesService counter prevents ID regression
  propsStore = { 'seq_dim_contactos_id_contacto': '50' };
  var sheet3 = makeMockSheet('dim_contactos',
    ['id_contacto','nombre'],
    [['1','Juan']],
    { getDataRangeThrows: 'Error' }
  );
  // lastRow is 2 (header + 1 data), PropertiesService has 50
  var nextId3 = fns.getNextId_(sheet3, 'id_contacto');
  assert('J3', 'PropertiesService 50 > lastRow 2 → returns 51', nextId3 === 51, 'got ' + nextId3);
})();

// ══════════════════════════════════════════
// GROUP K: clearFormat and setValues integration
// ══════════════════════════════════════════
console.log('\n--- Group K: clearFormat + setValues Integration ---');

(function() {
  // K1: Verify clearFormat is called before setValues in source code
  var createFnSrc = extractFn('createNewLeadOrDeal');

  // Check contact insert path
  var cTargetIdx = createFnSrc.indexOf('cTarget.clearFormat()');
  var cSetValIdx = createFnSrc.indexOf('cTarget.setValues([cRow])');
  assert('K1', 'clearFormat() called BEFORE setValues() for contacts', cTargetIdx > 0 && cSetValIdx > cTargetIdx,
    'clearFormat at ' + cTargetIdx + ', setValues at ' + cSetValIdx);

  // Check lead insert path
  var lTargetIdx = createFnSrc.indexOf('lTarget.clearFormat()');
  var lSetValIdx = createFnSrc.indexOf('lTarget.setValues([lRow])');
  assert('K2', 'clearFormat() called BEFORE setValues() for leads', lTargetIdx > 0 && lSetValIdx > lTargetIdx,
    'clearFormat at ' + lTargetIdx + ', setValues at ' + lSetValIdx);

  // Check deal insert path
  var dealCfIdx = createFnSrc.indexOf('dealTarget.clearFormat()');
  var dealSvIdx = createFnSrc.indexOf('dealTarget.setValues([newRow])');
  assert('K3', 'clearFormat() called BEFORE setValues() for deals', dealCfIdx > 0 && dealSvIdx > dealCfIdx,
    'clearFormat at ' + dealCfIdx + ', setValues at ' + dealSvIdx);

  // K4: Verify LockService is acquired
  var lockIdx = createFnSrc.indexOf('LockService.getScriptLock()');
  assert('K4', 'LockService.getScriptLock() present in createNewLeadOrDeal', lockIdx > 0 && lockIdx < 200);

  // K5: Verify lock is released in finally block
  var finallyIdx = createFnSrc.indexOf('finally');
  var releaseIdx = createFnSrc.indexOf('lock.releaseLock()', finallyIdx);
  assert('K5', 'lock.releaseLock() in finally block', finallyIdx > 0 && releaseIdx > finallyIdx);
})();

// ══════════════════════════════════════════
// GROUP L: Column name correctness
// ══════════════════════════════════════════
console.log('\n--- Group L: Column Name Correctness ---');

(function() {
  // L1: Verify sendDirectEmail uses id_registro_toque
  var sendEmailSrc = extractFn('sendDirectEmail');
  assert('L1', 'sendDirectEmail uses id_registro_toque for getNextId_',
    sendEmailSrc.indexOf("getNextId_(toquesSheet, 'id_registro_toque')") > -1);

  // L2: Verify switch case uses id_registro_toque
  assert('L2', 'sendDirectEmail switch maps id_registro_toque',
    sendEmailSrc.indexOf("case 'id_registro_toque':") > -1);

  // L3: Verify NO reference to 'id_toque' in sendDirectEmail (it was the bug)
  var idToqueCount = 0;
  var searchStr = sendEmailSrc;
  var idx = 0;
  while ((idx = searchStr.indexOf("'id_toque'", idx)) !== -1) { idToqueCount++; idx++; }
  assert('L3', 'No remaining references to id_toque in sendDirectEmail', idToqueCount === 0,
    'found ' + idToqueCount + ' references');

  // L4: registrarToque uses id_registro_toque
  var regToqueSrc = extractFn('registrarToque');
  assert('L4', 'registrarToque uses id_registro_toque',
    regToqueSrc.indexOf("getNextId_(sheet, 'id_registro_toque')") > -1);

  // L5: createNewLeadOrDeal writes to 'licencias' not 'licencias_promedio'
  var createSrc = extractFn('createNewLeadOrDeal');
  var hasLicencias = createSrc.indexOf("lSet('licencias',") > -1;
  var hasLicenciasPromedio = createSrc.indexOf("lSet('licencias_promedio',") > -1;
  assert('L5', 'Uses licencias (not licencias_promedio)', hasLicencias && !hasLicenciasPromedio);

  // L6: fact_toques appendRow has 9 elements in registrarToque
  var appendIdx = regToqueSrc.indexOf('sheet.appendRow([');
  var appendEnd = regToqueSrc.indexOf(']);', appendIdx);
  var appendContent = regToqueSrc.substring(appendIdx, appendEnd + 2);
  // Count commas to determine element count (elements = commas + 1)
  var commas = (appendContent.match(/,/g) || []).length;
  assert('L6', 'registrarToque appendRow has 9 elements', commas + 1 === 9,
    'found ' + (commas + 1) + ' elements');
})();

// ══════════════════════════════════════════
// GROUP M: copyLeadToDeals_ clearFormat
// ══════════════════════════════════════════
console.log('\n--- Group M: copyLeadToDeals_ Safety ---');

(function() {
  var copyDealsSrc = extractFn('copyLeadToDeals_');
  assert('M1', 'copyLeadToDeals_ has clearFormat before setValues',
    copyDealsSrc.indexOf('dealInsertTarget.clearFormat()') > -1);

  var cfIdx = copyDealsSrc.indexOf('dealInsertTarget.clearFormat()');
  var svIdx = copyDealsSrc.indexOf('dealInsertTarget.setValues([newRow])');
  assert('M2', 'clearFormat is before setValues in copyLeadToDeals_',
    cfIdx > 0 && svIdx > cfIdx);
})();

// ══════════════════════════════════════════
// GROUP N: No remaining getValues() calls
// ══════════════════════════════════════════
console.log('\n--- Group N: No Dangerous getValues() Remaining ---');

(function() {
  // Search for .getValues() (NOT getDisplayValues) in the entire file
  var regex = /\.getValues\(\)/g;
  var matches = [];
  var match;
  while ((match = regex.exec(codigo)) !== null) {
    // Get line number
    var lineNum = codigo.substring(0, match.index).split('\n').length;
    // Check it's not getDisplayValues
    var preceding = codigo.substring(Math.max(0, match.index - 10), match.index);
    if (preceding.indexOf('Display') === -1) {
      matches.push('line ' + lineNum);
    }
  }
  assert('N1', 'No .getValues() calls remaining in Código.js', matches.length === 0,
    'found at: ' + matches.join(', '));
})();

// ══════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════
console.log('\n=== EDGE CASE RESULTS: ' + passed + '/' + total + ' passed ===');
if (failed > 0) {
  console.log('WARNING: ' + failed + ' tests FAILED');
  process.exit(1);
}
