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

function calculateEmbudoGeneral_() {
  return {};
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

    // Call section calculators (all stubs for now)
    var embudoGeneral = calculateEmbudoGeneral_();
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
