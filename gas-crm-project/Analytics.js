/*************************************************************
 *  Analytics.js — SDR Report Analytics Module
 *  Deployed alongside Código.js via clasp
 *
 *  Main function: getSDRReport(dateIn, dateOut)
 *  Returns: JSON string with metadata + 8 report sections
 *************************************************************/

// ============ HELPER FUNCTIONS (Private) ============

/**
 * Filter leads by fecha_ingreso within date range (inclusive).
 * @param {Array} leads - Array of lead objects
 * @param {string} dateIn - Start date (YYYY-MM-DD)
 * @param {string} dateOut - End date (YYYY-MM-DD)
 * @return {Array} Filtered leads
 */
function filterByDateRange_(leads, dateIn, dateOut) {
  var dateInMs = new Date(dateIn).getTime();
  var dateOutMs = new Date(dateOut).getTime();

  var filtered = [];
  for (var i = 0; i < leads.length; i++) {
    var lead = leads[i];
    var fechaIngreso = new Date(lead.fecha_ingreso || '').getTime();

    // Exclude NaN dates
    if (isNaN(fechaIngreso)) continue;

    // Inclusive range check
    if (fechaIngreso >= dateInMs && fechaIngreso <= dateOutMs) {
      filtered.push(lead);
    }
  }

  return filtered;
}

/**
 * Build one-to-many index for lead interactions.
 * @param {Array} interacciones - Array of interaction objects
 * @return {Object} Map of { id_lead: [interaction1, interaction2, ...] }
 */
function buildLeadInteractionsIdx_(interacciones) {
  var idx = {};
  for (var i = 0; i < interacciones.length; i++) {
    var interaccion = interacciones[i];
    var idLead = String(interaccion.id_lead || '');
    if (!idLead) continue;

    if (!idx[idLead]) {
      idx[idLead] = [];
    }
    idx[idLead].push(interaccion);
  }
  return idx;
}

/**
 * Determine segment for a lead based on tipo_membresia from fact_calificacion.
 * LOCKED DECISION: Uses tipo_membresia field (not servicio_interes).
 *
 * @param {Object} lead - Lead object
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @return {string} 'manufacturers' | 'individuals' | 'other' | 'unknown'
 */
function getSegment_(lead, calificacionIdx) {
  var idLead = String(lead.id_lead || '');
  var calificacion = calificacionIdx[idLead];

  if (!calificacion) return 'unknown';

  var tipoMembresia = String(calificacion.tipo_membresia || '').trim();

  if (!tipoMembresia) return 'unknown';

  if (tipoMembresia === 'Manufacturers') return 'manufacturers';
  if (tipoMembresia === 'Individuals') return 'individuals';

  // 'Attraction' or other values go to 'other'
  return 'other';
}

/**
 * Calculate percentage as string.
 * @param {number} part - Numerator
 * @param {number} total - Denominator
 * @return {string} Percentage with 1 decimal (e.g., "45.3")
 */
function calcPercentage_(part, total) {
  if (total === 0) return '0.0';
  return ((part / total) * 100).toFixed(1);
}

/**
 * Calculate delta percentage between current and previous values.
 * @param {number} currentVal - Current period value
 * @param {number} previousVal - Previous period value
 * @return {string} Delta percentage with 1 decimal
 */
function calcDelta_(currentVal, previousVal) {
  if (previousVal === 0 && currentVal > 0) return '100.0';
  if (previousVal === 0 && currentVal === 0) return '0.0';
  return (((currentVal - previousVal) / previousVal) * 100).toFixed(1);
}

/**
 * Build segmented metric (total, manufacturers, individuals) with counts and percentages.
 * @param {Array} leads - Filtered leads
 * @param {Object} calificacionIdx - Calificacion index
 * @param {Function} metricFn - Function that filters leads (returns true/false or count)
 * @return {Object} { total: {count, pct}, manufacturers: {count, pct}, individuals: {count, pct} }
 */
function buildSegmentedMetric_(leads, calificacionIdx, metricFn) {
  var totalCount = 0;
  var manufacturersCount = 0;
  var individualsCount = 0;

  for (var i = 0; i < leads.length; i++) {
    var lead = leads[i];
    var matches = metricFn(lead);

    if (matches) {
      totalCount++;

      var segment = getSegment_(lead, calificacionIdx);
      if (segment === 'manufacturers') {
        manufacturersCount++;
      } else if (segment === 'individuals') {
        individualsCount++;
      }
    }
  }

  return {
    total: { count: totalCount, pct: '100.0' },
    manufacturers: { count: manufacturersCount, pct: calcPercentage_(manufacturersCount, totalCount) },
    individuals: { count: individualsCount, pct: calcPercentage_(individualsCount, totalCount) }
  };
}

/**
 * Build segmented metric with delta vs previous period.
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Calificacion index
 * @param {Function} metricFn - Metric filter function
 * @return {Object} Segmented metrics with delta fields
 */
function buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, metricFn) {
  var current = buildSegmentedMetric_(currentLeads, calificacionIdx, metricFn);
  var previous = buildSegmentedMetric_(previousLeads, calificacionIdx, metricFn);

  return {
    total: {
      count: current.total.count,
      pct: current.total.pct,
      delta: calcDelta_(current.total.count, previous.total.count)
    },
    manufacturers: {
      count: current.manufacturers.count,
      pct: current.manufacturers.pct,
      delta: calcDelta_(current.manufacturers.count, previous.manufacturers.count)
    },
    individuals: {
      count: current.individuals.count,
      pct: current.individuals.pct,
      delta: calcDelta_(current.individuals.count, previous.individuals.count)
    }
  };
}

/**
 * Build segmented amount metric with delta (no percentages for amounts).
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Calificacion index
 * @param {Function} amountFn - Function that returns numeric amount for a lead
 * @return {Object} { total: {amount, delta}, manufacturers: {amount, delta}, individuals: {amount, delta} }
 */
function buildSegmentedAmountWithDelta_(currentLeads, previousLeads, calificacionIdx, amountFn) {
  var currentTotal = 0;
  var currentManufacturers = 0;
  var currentIndividuals = 0;

  for (var i = 0; i < currentLeads.length; i++) {
    var lead = currentLeads[i];
    var amount = amountFn(lead) || 0;
    currentTotal += amount;

    var segment = getSegment_(lead, calificacionIdx);
    if (segment === 'manufacturers') {
      currentManufacturers += amount;
    } else if (segment === 'individuals') {
      currentIndividuals += amount;
    }
  }

  var previousTotal = 0;
  var previousManufacturers = 0;
  var previousIndividuals = 0;

  for (var j = 0; j < previousLeads.length; j++) {
    var prevLead = previousLeads[j];
    var prevAmount = amountFn(prevLead) || 0;
    previousTotal += prevAmount;

    var prevSegment = getSegment_(prevLead, calificacionIdx);
    if (prevSegment === 'manufacturers') {
      previousManufacturers += prevAmount;
    } else if (prevSegment === 'individuals') {
      previousIndividuals += prevAmount;
    }
  }

  return {
    total: {
      amount: currentTotal,
      delta: calcDelta_(currentTotal, previousTotal)
    },
    manufacturers: {
      amount: currentManufacturers,
      delta: calcDelta_(currentManufacturers, previousManufacturers)
    },
    individuals: {
      amount: currentIndividuals,
      delta: calcDelta_(currentIndividuals, previousIndividuals)
    }
  };
}

// ============ SECTION CALCULATORS (Stubs - to be implemented in Plans 02-04) ============

/**
 * Calculate Embudo General (Sales Funnel) with all 13 metrics.
 * Each metric is segmented by tipo_membresia and includes delta vs previous period.
 *
 * @param {Array} currentLeads - Leads in current date range
 * @param {Array} previousLeads - Leads in previous date range
 * @param {Array} allLeads - ALL leads (unfiltered) for carryOver calculation
 * @param {Object} contactosIdx - Index of { id_contacto: contacto_row }
 * @param {Object} interaccionesIdx - Index of { id_lead: [interactions] }
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @param {Array} deals - All deal records
 * @param {string} dateIn - Current period start (YYYY-MM-DD)
 * @param {string} dateOut - Current period end (YYYY-MM-DD)
 * @param {string} prevDateIn - Previous period start (YYYY-MM-DD)
 * @param {string} prevDateOut - Previous period end (YYYY-MM-DD)
 * @return {Object} 13 funnel metrics with segmentation + delta
 */
function calculateEmbudoGeneral_(currentLeads, previousLeads, allLeads, contactosIdx, interaccionesIdx, calificacionIdx, deals, dateIn, dateOut, prevDateIn, prevDateOut) {

  // --- Helper: check if lead has consecutive Contesto toques ---
  var hasConsecutiveContesto_ = function(leadId) {
    var interactions = interaccionesIdx[String(leadId)] || [];
    var contestoToques = [];
    for (var i = 0; i < interactions.length; i++) {
      if (String(interactions[i].resultado || '').trim() === 'Contesto') {
        var toque = Number(interactions[i].numero_toque);
        if (!isNaN(toque)) {
          contestoToques.push(toque);
        }
      }
    }
    if (contestoToques.length < 2) return false;
    contestoToques.sort(function(a, b) { return a - b; });
    for (var j = 1; j < contestoToques.length; j++) {
      if (contestoToques[j] - contestoToques[j - 1] === 1) return true;
    }
    return false;
  };

  // --- Helper: check if lead has at least one Contesto ---
  var hasAnyContesto_ = function(leadId) {
    var interactions = interaccionesIdx[String(leadId)] || [];
    for (var i = 0; i < interactions.length; i++) {
      if (String(interactions[i].resultado || '').trim() === 'Contesto') return true;
    }
    return false;
  };

  // --- Build deal indexes for current and previous period leads ---
  var currentLeadIds = {};
  for (var i = 0; i < currentLeads.length; i++) {
    currentLeadIds[String(currentLeads[i].id_lead)] = true;
  }
  var previousLeadIds = {};
  for (var j = 0; j < previousLeads.length; j++) {
    previousLeadIds[String(previousLeads[j].id_lead)] = true;
  }

  var currentDeals = [];
  var previousDeals = [];
  for (var d = 0; d < deals.length; d++) {
    var dealLeadId = String(deals[d].id_lead || '');
    if (currentLeadIds[dealLeadId]) currentDeals.push(deals[d]);
    if (previousLeadIds[dealLeadId]) previousDeals.push(deals[d]);
  }

  // --- 1. totalLeads ---
  var totalLeads = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    return true;
  });

  // --- 2. contactables ---
  var contactables = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    var idContacto = String(lead.id_contacto || '');
    var contacto = contactosIdx[idContacto];
    if (!contacto) return false;
    var tel = String(contacto.telefono_1 || '').trim();
    var email = String(contacto.email || '').trim();
    return tel !== '' || email !== '';
  });

  // --- 3. contactados ---
  var contactados = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    var idLead = String(lead.id_lead || '');
    var interactions = interaccionesIdx[idLead] || [];
    return interactions.length > 0;
  });

  // --- 4. conRespuesta ---
  var conRespuesta = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    return hasAnyContesto_(lead.id_lead);
  });

  // --- 5. dialogoCompleto ---
  var dialogoCompleto = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    return hasConsecutiveContesto_(lead.id_lead);
  });

  // --- 6. dialogoIntermitente ---
  var dialogoIntermitente = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    return hasAnyContesto_(lead.id_lead) && !hasConsecutiveContesto_(lead.id_lead);
  });

  // --- 7. interes ---
  var interes = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    var idLead = String(lead.id_lead || '');
    var cal = calificacionIdx[idLead];
    if (!cal) return false;
    return String(cal.mostro_interes_genuino || '').trim() === 'Si';
  });

  // --- 8. descartados ---
  var descartados = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    return String(lead.status || '').trim() === 'Perdido';
  });

  // --- 9. asignadosVentas ---
  var asignadosVentas = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function(lead) {
    return String(lead.status || '').trim() === 'Paso a Ventas';
  });

  // --- 10. carryOver ---
  // Leads from BEFORE the period that got assigned to sales DURING the period
  var dateInMs = new Date(dateIn).getTime();
  var dateOutMs = new Date(dateOut).getTime();
  var prevDateInMs = new Date(prevDateIn).getTime();
  var prevDateOutMs = new Date(prevDateOut).getTime();

  var currentCarryLeads = [];
  var previousCarryLeads = [];
  for (var c = 0; c < allLeads.length; c++) {
    var aLead = allLeads[c];
    var fechaIngreso = new Date(aLead.fecha_ingreso || '').getTime();
    var fechaAsignacion = new Date(aLead.fecha_asignacion || '').getTime();
    var leadStatus = String(aLead.status || '').trim();

    if (leadStatus === 'Paso a Ventas' && !isNaN(fechaIngreso) && !isNaN(fechaAsignacion)) {
      // Current carry-over: ingreso before dateIn, assigned during current period
      if (fechaIngreso < dateInMs && fechaAsignacion >= dateInMs && fechaAsignacion <= dateOutMs) {
        currentCarryLeads.push(aLead);
      }
      // Previous carry-over: ingreso before prevDateIn, assigned during previous period
      if (fechaIngreso < prevDateInMs && fechaAsignacion >= prevDateInMs && fechaAsignacion <= prevDateOutMs) {
        previousCarryLeads.push(aLead);
      }
    }
  }
  var carryOver = buildSegmentedMetricWithDelta_(currentCarryLeads, previousCarryLeads, calificacionIdx, function(lead) {
    return true;
  });

  // --- 11. montosInversion ---
  // Build deal-as-lead proxy arrays for amount helpers
  // We need to pass deals through amount helpers but segmentation uses lead's segment
  // So we create proxy objects that carry both deal data and lead id for segment lookup
  var buildDealProxies_ = function(dealSubset) {
    var proxies = [];
    for (var i = 0; i < dealSubset.length; i++) {
      var deal = dealSubset[i];
      // Proxy carries id_lead for segment lookup + deal fields for amount calculation
      proxies.push({
        id_lead: deal.id_lead,
        _deal: deal
      });
    }
    return proxies;
  };

  var currentDealProxies = buildDealProxies_(currentDeals);
  var previousDealProxies = buildDealProxies_(previousDeals);

  var montosInversion = buildSegmentedAmountWithDelta_(currentDealProxies, previousDealProxies, calificacionIdx, function(proxy) {
    return Number(proxy._deal.monto_proyeccion) || 0;
  });

  // --- 12. dealsCerrados ---
  var currentVendidos = [];
  var previousVendidos = [];
  for (var v = 0; v < currentDeals.length; v++) {
    if (String(currentDeals[v].status_venta || '').trim() === 'Vendido') {
      currentVendidos.push({ id_lead: currentDeals[v].id_lead, _deal: currentDeals[v] });
    }
  }
  for (var w = 0; w < previousDeals.length; w++) {
    if (String(previousDeals[w].status_venta || '').trim() === 'Vendido') {
      previousVendidos.push({ id_lead: previousDeals[w].id_lead, _deal: previousDeals[w] });
    }
  }

  var dealsCerrados = buildSegmentedMetricWithDelta_(currentVendidos, previousVendidos, calificacionIdx, function(proxy) {
    return true;
  });

  // --- 13. montoCierres ---
  var montoCierres = buildSegmentedAmountWithDelta_(currentVendidos, previousVendidos, calificacionIdx, function(proxy) {
    return Number(proxy._deal.monto_cierre) || 0;
  });

  return {
    totalLeads: totalLeads,
    contactables: contactables,
    contactados: contactados,
    conRespuesta: conRespuesta,
    dialogoCompleto: dialogoCompleto,
    dialogoIntermitente: dialogoIntermitente,
    interes: interes,
    descartados: descartados,
    asignadosVentas: asignadosVentas,
    carryOver: carryOver,
    montosInversion: montosInversion,
    dealsCerrados: dealsCerrados,
    montoCierres: montoCierres
  };
}

function calculateIncontactables_() {
  return {};
}

function calculateCrossSelling_() {
  return {};
}

function calculateSemaforoContesto_() {
  return {};
}

function calculateSemaforoNoContesto_() {
  return {};
}

function calculateSinRespuesta6toToque_() {
  return {};
}

function calculateRazonesNoPasoVentas_() {
  return {};
}

function calculateRazonesPerdioVenta_() {
  return {};
}

// ============ MAIN ORCHESTRATOR ============

/**
 * Generate SDR Report for a date range.
 * @param {string} dateIn - Start date (YYYY-MM-DD)
 * @param {string} dateOut - End date (YYYY-MM-DD)
 * @return {string} JSON string with report data
 */
function getSDRReport(dateIn, dateOut) {
  try {
    // Parse dates for current period
    var dateInMs = new Date(dateIn).getTime();
    var dateOutMs = new Date(dateOut).getTime();

    if (isNaN(dateInMs) || isNaN(dateOutMs)) {
      return JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Load all tables once
    var allLeads = readTable_(T_LEADS);
    var allInteracciones = readTable_(T_INTERACCIONES);
    var allCalificacion = readTable_(T_CALIFICACION);
    var allContactos = readTable_(T_CONTACTOS);
    var allDeals = readTable_(T_DEALS);

    // Build indexes
    var contactosIdx = indexBy_(allContactos, 'id_contacto');
    var interaccionesIdx = buildLeadInteractionsIdx_(allInteracciones);
    var calificacionIdx = indexBy_(allCalificacion, 'id_lead');
    var dealsIdx = indexBy_(allDeals, 'id_lead');

    // Filter current period leads
    var currentLeads = filterByDateRange_(allLeads, dateIn, dateOut);

    // Calculate previous period dates (same duration, shifted back)
    var durationMs = dateOutMs - dateInMs;
    var prevDateInMs = dateInMs - durationMs;
    var prevDateOutMs = dateOutMs - durationMs;
    var prevDateIn = new Date(prevDateInMs).toISOString().split('T')[0];
    var prevDateOut = new Date(prevDateOutMs).toISOString().split('T')[0];

    // Filter previous period leads
    var previousLeads = filterByDateRange_(allLeads, prevDateIn, prevDateOut);

    // Call section calculators
    var embudoGeneral = calculateEmbudoGeneral_(currentLeads, previousLeads, allLeads, contactosIdx, interaccionesIdx, calificacionIdx, allDeals, dateIn, dateOut, prevDateIn, prevDateOut);
    var incontactables = calculateIncontactables_();
    var crossSelling = calculateCrossSelling_();
    var semaforoContesto = calculateSemaforoContesto_();
    var semaforoNoContesto = calculateSemaforoNoContesto_();
    var sinRespuesta6toToque = calculateSinRespuesta6toToque_();
    var razonesNoPasoVentas = calculateRazonesNoPasoVentas_();
    var razonesPerdioVenta = calculateRazonesPerdioVenta_();

    // Build result
    var result = {
      metadata: {
        dateIn: dateIn,
        dateOut: dateOut,
        previousDateIn: prevDateIn,
        previousDateOut: prevDateOut,
        generatedAt: new Date().toISOString(),
        totalLeads: currentLeads.length,
        previousTotalLeads: previousLeads.length
      },
      embudoGeneral: embudoGeneral,
      incontactables: incontactables,
      crossSelling: crossSelling,
      semaforoContesto: semaforoContesto,
      semaforoNoContesto: semaforoNoContesto,
      sinRespuesta6toToque: sinRespuesta6toToque,
      razonesNoPasoVentas: razonesNoPasoVentas,
      razonesPerdioVenta: razonesPerdioVenta
    };

    return JSON.stringify(result);

  } catch (err) {
    Logger.log('ERROR in getSDRReport: ' + err.message);
    Logger.log('Stack: ' + err.stack);
    return JSON.stringify({ error: err.message, stack: err.stack });
  }
}

// ============ TEST FUNCTIONS (Development Only) ============

/**
 * Smoke test: Validates getSDRReport structure without needing real data.
 * Runnable from GAS Script Editor via Run menu.
 */
function testSDRReport_() {
  Logger.log('=== testSDRReport_ START ===');

  var start = new Date();

  // Call with broad date range
  var resultJson = getSDRReport('2024-01-01', '2025-12-31');
  var result = JSON.parse(resultJson);

  var duration = new Date() - start;
  Logger.log('Duration: ' + duration + 'ms');

  // Validate structure
  var isValid = true;
  var errors = [];

  // Check metadata
  if (!result.metadata) {
    errors.push('Missing metadata');
    isValid = false;
  } else {
    if (!result.metadata.dateIn) errors.push('Missing metadata.dateIn');
    if (!result.metadata.dateOut) errors.push('Missing metadata.dateOut');
    if (!result.metadata.generatedAt) errors.push('Missing metadata.generatedAt');
    if (result.metadata.totalLeads === undefined) errors.push('Missing metadata.totalLeads');
  }

  // Check all 8 section keys
  var sections = [
    'embudoGeneral',
    'incontactables',
    'crossSelling',
    'semaforoContesto',
    'semaforoNoContesto',
    'sinRespuesta6toToque',
    'razonesNoPasoVentas',
    'razonesPerdioVenta'
  ];

  for (var i = 0; i < sections.length; i++) {
    if (result[sections[i]] === undefined) {
      errors.push('Missing section: ' + sections[i]);
      isValid = false;
    }
  }

  // Count non-empty sections
  var nonEmptySections = 0;
  for (var j = 0; j < sections.length; j++) {
    var section = result[sections[j]];
    if (section && typeof section === 'object' && Object.keys(section).length > 0) {
      nonEmptySections++;
    }
  }

  // Log summary
  Logger.log('Total leads: ' + (result.metadata ? result.metadata.totalLeads : 'N/A'));
  Logger.log('Non-empty sections: ' + nonEmptySections + '/' + sections.length);

  if (errors.length > 0) {
    Logger.log('VALIDATION ERRORS:');
    for (var k = 0; k < errors.length; k++) {
      Logger.log('  - ' + errors[k]);
    }
  }

  if (isValid) {
    Logger.log('INFRASTRUCTURE OK');
  } else {
    Logger.log('INFRASTRUCTURE FAILED');
  }

  Logger.log('=== testSDRReport_ END ===');
}

/**
 * Performance benchmark: Runs getSDRReport 3 times and reports timing.
 * Runnable from GAS Script Editor via Run menu.
 */
function testPerformance_() {
  Logger.log('=== testPerformance_ START ===');

  var dateIn = '2024-01-01';
  var dateOut = '2025-12-31';
  var runs = 3;
  var times = [];

  for (var i = 0; i < runs; i++) {
    var start = new Date();
    getSDRReport(dateIn, dateOut);
    var duration = new Date() - start;
    times.push(duration);
    Logger.log('Run ' + (i + 1) + ': ' + duration + 'ms');
  }

  // Calculate average
  var sum = 0;
  for (var j = 0; j < times.length; j++) {
    sum += times[j];
  }
  var average = sum / times.length;

  Logger.log('Average execution time: ' + average.toFixed(0) + 'ms');

  // Determine status
  var status;
  if (average < 30000) {
    status = 'PASS';
  } else if (average < 60000) {
    status = 'WARNING';
  } else {
    status = 'FAIL';
  }

  Logger.log('Performance status: ' + status);
  Logger.log('Thresholds: <30s PASS, <60s WARNING, >=60s FAIL');

  Logger.log('=== testPerformance_ END ===');
}
