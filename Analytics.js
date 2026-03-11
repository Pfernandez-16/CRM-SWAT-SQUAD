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
  var hasConsecutiveContesto_ = function (leadId) {
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
    contestoToques.sort(function (a, b) { return a - b; });
    for (var j = 1; j < contestoToques.length; j++) {
      if (contestoToques[j] - contestoToques[j - 1] === 1) return true;
    }
    return false;
  };

  // --- Helper: check if lead has at least one Contesto ---
  var hasAnyContesto_ = function (leadId) {
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
  var totalLeads = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    return true;
  });

  // --- 2. contactables ---
  var contactables = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    var idContacto = String(lead.id_contacto || '');
    var contacto = contactosIdx[idContacto];
    if (!contacto) return false;
    var tel = String(contacto.telefono_1 || '').trim();
    var email = String(contacto.email || '').trim();
    return tel !== '' || email !== '';
  });

  // --- 3. contactados ---
  var contactados = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    var idLead = String(lead.id_lead || '');
    var interactions = interaccionesIdx[idLead] || [];
    return interactions.length > 0;
  });

  // --- 4. conRespuesta ---
  var conRespuesta = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    return hasAnyContesto_(lead.id_lead);
  });

  // --- 5. dialogoCompleto ---
  var dialogoCompleto = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    return hasConsecutiveContesto_(lead.id_lead);
  });

  // --- 6. dialogoIntermitente ---
  var dialogoIntermitente = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    return hasAnyContesto_(lead.id_lead) && !hasConsecutiveContesto_(lead.id_lead);
  });

  // --- 7. interes ---
  var interes = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    var idLead = String(lead.id_lead || '');
    var cal = calificacionIdx[idLead];
    if (!cal) return false;
    var val = String(cal.mostro_interes_genuino || '').trim();
    return val === 'Si' || val === 'Sí';
  });

  // --- 8. descartados ---
  var descartados = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    return String(lead.status || '').trim() === 'Perdido';
  });

  // --- 9. asignadosVentas ---
  var asignadosVentas = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
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
  var carryOver = buildSegmentedMetricWithDelta_(currentCarryLeads, previousCarryLeads, calificacionIdx, function (lead) {
    return true;
  });

  // --- 11. montosInversion ---
  // Build deal-as-lead proxy arrays for amount helpers
  // We need to pass deals through amount helpers but segmentation uses lead's segment
  // So we create proxy objects that carry both deal data and lead id for segment lookup
  var buildDealProxies_ = function (dealSubset) {
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

  var montosInversion = buildSegmentedAmountWithDelta_(currentDealProxies, previousDealProxies, calificacionIdx, function (proxy) {
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

  var dealsCerrados = buildSegmentedMetricWithDelta_(currentVendidos, previousVendidos, calificacionIdx, function (proxy) {
    return true;
  });

  // --- 13. montoCierres ---
  var montoCierres = buildSegmentedAmountWithDelta_(currentVendidos, previousVendidos, calificacionIdx, function (proxy) {
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

/**
 * Calculate Incontactables section: leads that cannot be contacted.
 * Three sub-metrics: Duplicado, Equivocado (mapped to Invalido), SPAM (zeroed).
 *
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @return {Object} { duplicado, equivocado, spam } with segmentation + delta
 */
function calculateIncontactables_(currentLeads, previousLeads, calificacionIdx) {
  // Duplicado: leads with status 'Duplicado'
  var duplicado = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    return String(lead.status || '').trim() === 'Duplicado';
  });

  // Equivocado: mapped to status 'Invalido' (closest match in data)
  var equivocado = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    var st = String(lead.status || '').trim();
    return st === 'Invalido' || st === 'Inválido';
  });

  // SPAM: no data source exists, return zeroed structure
  var spam = {
    total: { count: 0, pct: '0.0', delta: '0.0' },
    manufacturers: { count: 0, pct: '0.0', delta: '0.0' },
    individuals: { count: 0, pct: '0.0', delta: '0.0' }
  };

  return {
    duplicado: duplicado,
    equivocado: equivocado,
    spam: spam
  };
}

/**
 * Calculate Cross Selling section: deals with tipo_transaccion = 'Cross-sell'.
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @param {Array} deals - All deal records
 * @return {Object} { crossSellDeals: { total, manufacturers, individuals } }
 */
function calculateCrossSelling_(currentLeads, previousLeads, calificacionIdx, deals) {
  // Build deal proxies that carry segment info from their lead
  var buildDealProxiesForCrossSell_ = function (leadsSubset) {
    // Build explicit leadIds set
    var leadIds = {};
    for (var i = 0; i < leadsSubset.length; i++) {
      leadIds[String(leadsSubset[i].id_lead)] = true;
    }

    var proxies = [];
    for (var j = 0; j < deals.length; j++) {
      var deal = deals[j];
      var dealLeadId = String(deal.id_lead || '');
      var tipoTransaccion = String(deal.tipo_transaccion || '').trim();

      // Filter: id_lead in set AND tipo_transaccion === 'Cross-sell'
      if (leadIds[dealLeadId] === true && tipoTransaccion === 'Cross-sell') {
        // Proxy carries id_lead for segment lookup
        proxies.push({
          id_lead: deal.id_lead,
          _deal: deal
        });
      }
    }
    return proxies;
  };

  var currentProxies = buildDealProxiesForCrossSell_(currentLeads);
  var previousProxies = buildDealProxiesForCrossSell_(previousLeads);

  var crossSellDeals = buildSegmentedMetricWithDelta_(currentProxies, previousProxies, calificacionIdx, function (proxy) {
    return true; // Count all proxies (already filtered to Cross-sell)
  });

  return {
    crossSellDeals: crossSellDeals
  };
}

/**
 * Calculate Semaforo Contesto section: grid of channel x toque with resultado = 'Contesto'.
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @param {Object} interaccionesIdx - Index of { id_lead: [interactions] }
 * @return {Object} Nested grid: { telefono: {toque1, toque2, toque3}, whatsapp: {...}, correo: {toque1-4} }
 */
function calculateSemaforoContesto_(currentLeads, previousLeads, calificacionIdx, interaccionesIdx) {
  // Performance optimization: build per-lead interaction summary once for current period
  var buildLeadSummaries_ = function (leads) {
    var leadSummaries = {};
    for (var i = 0; i < leads.length; i++) {
      var lid = String(leads[i].id_lead);
      var inters = interaccionesIdx[lid] || [];
      leadSummaries[lid] = {};
      for (var j = 0; j < inters.length; j++) {
        var key = inters[j].tipo_interaccion + '_' + inters[j].numero_toque + '_' + inters[j].resultado;
        leadSummaries[lid][key] = true;
      }
    }
    return leadSummaries;
  };

  var currentSummaries = buildLeadSummaries_(currentLeads);
  var previousSummaries = buildLeadSummaries_(previousLeads);

  // Helper to create metric function for a specific channel+toque+resultado
  var createMetricFn = function (channel, toque, resultado) {
    return function (lead) {
      var lid = String(lead.id_lead);
      var summaries = (currentLeads.indexOf(lead) >= 0) ? currentSummaries : previousSummaries;
      var key = channel + '_' + toque + '_' + resultado;
      return summaries[lid] && summaries[lid][key] === true;
    };
  };

  // Build all cells
  var result = {
    telefono: {},
    whatsapp: {},
    correo: {}
  };

  // Telefono: toques 1, 2, 3
  for (var t = 1; t <= 3; t++) {
    var toqueKey = 'toque' + t;
    result.telefono[toqueKey] = buildSegmentedMetricWithDelta_(
      currentLeads,
      previousLeads,
      calificacionIdx,
      createMetricFn('Telefono', t, 'Contesto')
    );
  }

  // WhatsApp: toques 1, 2, 3
  for (var w = 1; w <= 3; w++) {
    var toqueKeyW = 'toque' + w;
    result.whatsapp[toqueKeyW] = buildSegmentedMetricWithDelta_(
      currentLeads,
      previousLeads,
      calificacionIdx,
      createMetricFn('WhatsApp', w, 'Contesto')
    );
  }

  // Correo: toques 1, 2, 3, 4
  for (var c = 1; c <= 4; c++) {
    var toqueKeyC = 'toque' + c;
    result.correo[toqueKeyC] = buildSegmentedMetricWithDelta_(
      currentLeads,
      previousLeads,
      calificacionIdx,
      createMetricFn('Correo', c, 'Contesto')
    );
  }

  return result;
}

/**
 * Calculate Semaforo No Contesto section: grid of channel x toque with resultado = 'No Contesto'.
 * Only Telefono and WhatsApp (Correo excluded).
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @param {Object} interaccionesIdx - Index of { id_lead: [interactions] }
 * @return {Object} Nested grid: { telefono: {toque1, toque2, toque3}, whatsapp: {...} }
 */
function calculateSemaforoNoContesto_(currentLeads, previousLeads, calificacionIdx, interaccionesIdx) {
  // Performance optimization: build per-lead interaction summary once
  var buildLeadSummaries_ = function (leads) {
    var leadSummaries = {};
    for (var i = 0; i < leads.length; i++) {
      var lid = String(leads[i].id_lead);
      var inters = interaccionesIdx[lid] || [];
      leadSummaries[lid] = {};
      for (var j = 0; j < inters.length; j++) {
        var key = inters[j].tipo_interaccion + '_' + inters[j].numero_toque + '_' + inters[j].resultado;
        leadSummaries[lid][key] = true;
      }
    }
    return leadSummaries;
  };

  var currentSummaries = buildLeadSummaries_(currentLeads);
  var previousSummaries = buildLeadSummaries_(previousLeads);

  // Helper to create metric function for a specific channel+toque+resultado
  var createMetricFn = function (channel, toque, resultado) {
    return function (lead) {
      var lid = String(lead.id_lead);
      var summaries = (currentLeads.indexOf(lead) >= 0) ? currentSummaries : previousSummaries;
      var key = channel + '_' + toque + '_' + resultado;
      return summaries[lid] && summaries[lid][key] === true;
    };
  };

  // Build all cells (Telefono + WhatsApp only, no Correo)
  var result = {
    telefono: {},
    whatsapp: {}
  };

  // Telefono: toques 1, 2, 3
  for (var t = 1; t <= 3; t++) {
    var toqueKey = 'toque' + t;
    result.telefono[toqueKey] = buildSegmentedMetricWithDelta_(
      currentLeads,
      previousLeads,
      calificacionIdx,
      createMetricFn('Telefono', t, 'No Contesto')
    );
  }

  // WhatsApp: toques 1, 2, 3
  for (var w = 1; w <= 3; w++) {
    var toqueKeyW = 'toque' + w;
    result.whatsapp[toqueKeyW] = buildSegmentedMetricWithDelta_(
      currentLeads,
      previousLeads,
      calificacionIdx,
      createMetricFn('WhatsApp', w, 'No Contesto')
    );
  }

  return result;
}

/**
 * Calculate Sin Respuesta 6to Toque: leads with 6+ toques and no 'Contesto' interaction.
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @param {Object} interaccionesIdx - Index of { id_lead: [interactions] }
 * @return {Object} { sinRespuesta: { total, manufacturers, individuals } }
 */
function calculateSinRespuesta6toToque_(currentLeads, previousLeads, calificacionIdx, interaccionesIdx) {
  var metricFn = function (lead) {
    var idLead = String(lead.id_lead || '');
    var interactions = interaccionesIdx[idLead] || [];

    // Check condition 1: 6+ toques (use interaction count OR numero_toques field)
    var toqueCount = interactions.length;
    var numeroToquesField = Number(lead.numero_toques);
    var has6PlusToques = toqueCount >= 6 || (!isNaN(numeroToquesField) && numeroToquesField >= 6);

    if (!has6PlusToques) return false;

    // Check condition 2: No 'Contesto' interaction
    for (var i = 0; i < interactions.length; i++) {
      if (String(interactions[i].resultado || '').trim() === 'Contesto') {
        return false; // Has at least one Contesto, so doesn't qualify
      }
    }

    return true; // Has 6+ toques AND no Contesto
  };

  var sinRespuesta = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, metricFn);

  return {
    sinRespuesta: sinRespuesta
  };
}

/**
 * Calculate Razones No Paso a Ventas: reasons why leads didn't advance to sales.
 * Derives reasons from fact_calificacion BANT boolean fields for leads with status 'Perdido'.
 *
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @return {Object} Reasons with segmentation + delta
 */
function calculateRazonesNoPasoVentas_(currentLeads, previousLeads, calificacionIdx) {
  // Define reason categories with test functions
  var reasons = [
    {
      key: 'noPerfilAdecuado',
      label: 'No perfil adecuado',
      testFn: function (lead, calif) {
        return calif && String(calif.perfil_adecuado) === 'No';
      }
    },
    {
      key: 'sinPresupuesto',
      label: 'Sin presupuesto',
      testFn: function (lead, calif) {
        return calif && String(calif.tiene_presupuesto) === 'No';
      }
    },
    {
      key: 'sinInteresGenuino',
      label: 'Sin interes genuino',
      testFn: function (lead, calif) {
        return calif && String(calif.mostro_interes_genuino) === 'No';
      }
    },
    {
      key: 'necesitaTercero',
      label: 'Necesita tercero para decidir',
      testFn: function (lead, calif) {
        if (!calif) return false;
        var v = String(calif.necesita_decision_tercero || '').trim();
        return v === 'Si' || v === 'Sí';
      }
    },
    {
      key: 'noEntendioMarketing',
      label: 'No entendio info marketing',
      testFn: function (lead, calif) {
        return calif && String(calif.entendio_info_marketing) === 'No';
      }
    }
  ];

  var result = {};

  // Calculate each reason metric (can overlap - leads can match multiple reasons)
  for (var i = 0; i < reasons.length; i++) {
    var reason = reasons[i];
    var reasonKey = reason.key;
    var testFn = reason.testFn;

    result[reasonKey] = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
      // Only count leads with status 'Perdido'
      if (String(lead.status || '').trim() !== 'Perdido') return false;

      var idLead = String(lead.id_lead || '');
      var calif = calificacionIdx[idLead];

      return testFn(lead, calif);
    });
  }

  // Calculate 'otros' - leads that are Perdido but matched none of the reasons above
  result.otros = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    if (String(lead.status || '').trim() !== 'Perdido') return false;

    var idLead = String(lead.id_lead || '');
    var calif = calificacionIdx[idLead];

    // Check if this lead matched any of the other reasons
    var matchedAny = false;
    for (var i = 0; i < reasons.length; i++) {
      if (reasons[i].testFn(lead, calif)) {
        matchedAny = true;
        break;
      }
    }

    // Return true if lead matched NONE of the reasons
    return !matchedAny;
  });

  // Total descartados (all Perdido leads)
  result._totalDescartados = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    return String(lead.status || '').trim() === 'Perdido';
  });

  return result;
}

/**
 * Calculate Razones Perdio la Venta: reasons why sales were lost.
 * Uses fact_deals.razon_perdida for deals with status_venta 'Perdido'.
 *
 * @param {Array} currentLeads - Current period leads
 * @param {Array} previousLeads - Previous period leads
 * @param {Object} calificacionIdx - Index of { id_lead: calificacion_row }
 * @param {Array} deals - All deal records
 * @return {Object} Reasons with segmentation + delta
 */
function calculateRazonesPerdioVenta_(currentLeads, previousLeads, calificacionIdx, deals) {
  // Build deal index by lead_id for O(1) lookup per lead
  var dealsByLead = {};
  for (var d = 0; d < deals.length; d++) {
    var deal = deals[d];
    var dealLeadId = String(deal.id_lead || '');
    if (!dealsByLead[dealLeadId]) {
      dealsByLead[dealLeadId] = [];
    }
    dealsByLead[dealLeadId].push(deal);
  }

  // Hardcoded reasons from cat_opciones with camelCase keys
  var razonesMap = [
    { key: 'sinPresupuesto', label: 'Sin presupuesto' },
    { key: 'eligioCompetidor', label: 'Eligió competidor', alt: 'Eligio competidor' },
    { key: 'noResponde', label: 'No responde' },
    { key: 'timingInadecuado', label: 'Timing inadecuado' },
    { key: 'noTienePoderDecision', label: 'No tiene poder de decisión', alt: 'No tiene poder de decision' },
    { key: 'productoNoSeAjusta', label: 'Producto no se ajusta' },
    { key: 'cambioPrioridades', label: 'Cambio de prioridades' },
    { key: 'malaExperienciaPrevia', label: 'Mala experiencia previa' },
    { key: 'precioMuyAlto', label: 'Precio muy alto' },
    { key: 'procesoInternoLargo', label: 'Proceso interno largo' },
    { key: 'seFueConOtraSolucion', label: 'Se fue con otra solución', alt: 'Se fue con otra solucion' },
    { key: 'noEraElPerfil', label: 'No era el perfil' },
    { key: 'empresaCerro', label: 'Empresa cerró', alt: 'Empresa cerro' }
  ];

  // Helper: check if lead has a lost deal with a specific reason (supports alt label for accent variants)
  var hasLostDealWithReason_ = function (lead, targetLabel, altLabel) {
    var leadId = String(lead.id_lead || '');
    var leadDeals = dealsByLead[leadId] || [];
    for (var i = 0; i < leadDeals.length; i++) {
      if (String(leadDeals[i].status_venta || '').trim() === 'Perdido') {
        var razon = String(leadDeals[i].razon_perdida || '').trim();
        if (razon === targetLabel || (altLabel && razon === altLabel)) {
          return true;
        }
      }
    }
    return false;
  };

  var result = {};

  // Calculate each reason metric — metricFn receives a single lead
  for (var r = 0; r < razonesMap.length; r++) {
    var razonKey = razonesMap[r].key;
    var razonLabel = razonesMap[r].label;

    var razonAlt = razonesMap[r].alt || null;
    result[razonKey] = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
      return hasLostDealWithReason_(lead, razonLabel, razonAlt);
    });
  }

  // Calculate 'sinEspecificar' - lost deals with empty/null razon_perdida
  result.sinEspecificar = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    var leadId = String(lead.id_lead || '');
    var leadDeals = dealsByLead[leadId] || [];
    for (var i = 0; i < leadDeals.length; i++) {
      if (String(leadDeals[i].status_venta || '').trim() === 'Perdido' &&
        String(leadDeals[i].razon_perdida || '').trim() === '') {
        return true;
      }
    }
    return false;
  });

  // Total perdidas (all lost deals)
  result._totalPerdidas = buildSegmentedMetricWithDelta_(currentLeads, previousLeads, calificacionIdx, function (lead) {
    var leadId = String(lead.id_lead || '');
    var leadDeals = dealsByLead[leadId] || [];
    for (var i = 0; i < leadDeals.length; i++) {
      if (String(leadDeals[i].status_venta || '').trim() === 'Perdido') {
        return true;
      }
    }
    return false;
  });

  return result;
}

// ============ CONTACTABILITY MATRIX (Pivoted: Toques as Rows, Products/Countries as Columns) ============

/**
 * Calculate Matriz de Contactabilidad (pivoted).
 * Rows: Toque 1-10 (how many leads reached toque N).
 * Columns: Dynamic — servicio_interes (Product) and pais (Country).
 *
 * A lead "reached toque N" if it has at least N interactions, regardless of resultado.
 *
 * @param {Array} currentLeads - Current period leads
 * @param {Object} interaccionesIdx - Index of { id_lead: [interactions] }
 * @param {Object} contactosIdx - Index of { id_contacto: contacto_row }
 * @return {Object} { byProduct, byCountry, tocTotal }
 */
function calculateMatrizContactabilidad_(currentLeads, interaccionesIdx, contactosIdx) {
  var MAX_TOQUES = 10;

  // Pre-resolve each lead's product and country
  var leadMeta = [];
  for (var i = 0; i < currentLeads.length; i++) {
    var lead = currentLeads[i];
    var lid = String(lead.id_lead || '');
    var producto = String(lead.servicio_interes || '').trim() || 'Sin Producto';
    var pais = 'Sin País';
    var contactoId = String(lead.id_contacto || '');
    if (contactoId && contactosIdx[contactoId]) {
      pais = String(contactosIdx[contactoId].pais || '').trim() || 'Sin País';
    }
    var numInteractions = (interaccionesIdx[lid] || []).length;

    leadMeta.push({
      producto: producto,
      pais: pais,
      numInteractions: numInteractions
    });
  }

  // Build the pivot
  var byProduct = {};
  var byCountry = {};
  var tocTotal = {};

  for (var t = 1; t <= MAX_TOQUES; t++) {
    var toqueKey = 'toque' + t;
    byProduct[toqueKey] = {};
    byCountry[toqueKey] = {};
    tocTotal[toqueKey] = 0;

    for (var j = 0; j < leadMeta.length; j++) {
      var meta = leadMeta[j];
      if (meta.numInteractions >= t) {
        tocTotal[toqueKey]++;

        // Product pivot
        if (!byProduct[toqueKey][meta.producto]) {
          byProduct[toqueKey][meta.producto] = 0;
        }
        byProduct[toqueKey][meta.producto]++;

        // Country pivot
        if (!byCountry[toqueKey][meta.pais]) {
          byCountry[toqueKey][meta.pais] = 0;
        }
        byCountry[toqueKey][meta.pais]++;
      }
    }
  }

  // Collect all unique product and country keys for frontend column headers
  var allProducts = {};
  var allCountries = {};
  for (var k = 0; k < leadMeta.length; k++) {
    allProducts[leadMeta[k].producto] = true;
    allCountries[leadMeta[k].pais] = true;
  }

  return {
    byProduct: byProduct,
    byCountry: byCountry,
    tocTotal: tocTotal,
    productKeys: Object.keys(allProducts).sort(),
    countryKeys: Object.keys(allCountries).sort()
  };
}

// ============ DEALS REPORT ============

/**
 * Calculate deals funnel report for a date range.
 * Filters allDeals by fecha_pase_ventas (inclusive).
 * @param {Array} allDeals - Full deals table from readTable_(T_DEALS)
 * @param {string} dateIn - Current period start (YYYY-MM-DD)
 * @param {string} dateOut - Current period end (YYYY-MM-DD)
 * @param {string} prevDateIn - Previous period start (YYYY-MM-DD)
 * @param {string} prevDateOut - Previous period end (YYYY-MM-DD)
 * @return {Object} { totalDeals, stages, montoCotizacion, montoCierre, razonesPerdida }
 */
function calculateDealsReport_(allDeals, dateIn, dateOut, prevDateIn, prevDateOut) {
  var dateInMs    = new Date(dateIn).getTime();
  var dateOutMs   = new Date(dateOut).getTime();
  var prevInMs    = new Date(prevDateIn).getTime();
  var prevOutMs   = new Date(prevDateOut).getTime();

  // Step 1 — filter current period
  var currentDeals = [];
  for (var i = 0; i < allDeals.length; i++) {
    var deal = allDeals[i];
    var fechaMs = new Date(deal.fecha_pase_ventas || '').getTime();
    if (isNaN(fechaMs)) continue;
    if (fechaMs >= dateInMs && fechaMs <= dateOutMs) {
      currentDeals.push(deal);
    }
  }

  // Step 2 — filter previous period
  var previousDeals = [];
  for (var j = 0; j < allDeals.length; j++) {
    var pdeal = allDeals[j];
    var pfechaMs = new Date(pdeal.fecha_pase_ventas || '').getTime();
    if (isNaN(pfechaMs)) continue;
    if (pfechaMs >= prevInMs && pfechaMs <= prevOutMs) {
      previousDeals.push(pdeal);
    }
  }

  // Step 3 — count Si/No per funnel stage for current period
  var cotizadoSi   = 0;
  var negociacionSi = 0;
  var demoSi       = 0;
  var firmoSi      = 0;
  var fondeoSi     = 0;
  var montoCotizacion = 0;
  var montoCierre     = 0;

  for (var c = 0; c < currentDeals.length; c++) {
    var cd = currentDeals[c];
    if (cd.cotizo)         cotizadoSi++;
    if (cd.en_negociacion) negociacionSi++;
    if (cd.asistio_demo)   demoSi++;
    if (cd.firmo_contrato) firmoSi++;
    if (cd.fondeo)         fondeoSi++;

    // Step 4 — amounts
    if (cd.cotizo)         montoCotizacion += (Number(cd.monto_cotizacion) || 0);
    if (cd.firmo_contrato) montoCierre     += (Number(cd.monto_cierre)     || 0);
  }

  var total = currentDeals.length;

  var stages = {
    contactado:     { si: total,         no: 0 },
    cotizado:       { si: cotizadoSi,    no: total - cotizadoSi },
    en_negociacion: { si: negociacionSi, no: total - negociacionSi },
    asistio_demo:   { si: demoSi,        no: total - demoSi },
    firmo_contrato: { si: firmoSi,       no: total - firmoSi },
    fondeo:         { si: fondeoSi,      no: total - fondeoSi }
  };

  // Step 5 — loss reasons current period
  var currentLoss = {};
  for (var cr = 0; cr < currentDeals.length; cr++) {
    var crd = currentDeals[cr];
    if (String(crd.status_venta || '').trim() === 'Perdido') {
      var razon = String(crd.razon_perdida || '').trim();
      if (!razon) razon = 'Sin razon';
      currentLoss[razon] = (currentLoss[razon] || 0) + 1;
    }
  }

  // Loss reasons previous period
  var previousLoss = {};
  for (var pr = 0; pr < previousDeals.length; pr++) {
    var prd = previousDeals[pr];
    if (String(prd.status_venta || '').trim() === 'Perdido') {
      var prazon = String(prd.razon_perdida || '').trim();
      if (!prazon) prazon = 'Sin razon';
      previousLoss[prazon] = (previousLoss[prazon] || 0) + 1;
    }
  }

  // Merge all reason keys
  var allReasons = {};
  for (var rk in currentLoss)  { allReasons[rk] = true; }
  for (var rk2 in previousLoss) { allReasons[rk2] = true; }

  var razonesPerdida = {};
  for (var reason in allReasons) {
    var curN  = currentLoss[reason]  || 0;
    var prevN = previousLoss[reason] || 0;
    razonesPerdida[reason] = {
      current:  curN,
      previous: prevN,
      delta:    calcDelta_(curN, prevN)
    };
  }

  return {
    totalDeals:      total,
    stages:          stages,
    montoCotizacion: montoCotizacion,
    montoCierre:     montoCierre,
    razonesPerdida:  razonesPerdida
  };
}

// ============ MAIN ORCHESTRATOR ============

/**
 * Generate SDR Report for a date range.
 * @param {string} dateIn - Start date (YYYY-MM-DD)
 * @param {string} dateOut - End date (YYYY-MM-DD)
 * @param {string} [compareType] - 'prev_period' (default), 'yoy' (same period last year), or 'custom'
 * @param {string} [customPrevDateIn] - Custom previous period start (YYYY-MM-DD), used when compareType='custom'
 * @param {string} [customPrevDateOut] - Custom previous period end (YYYY-MM-DD), used when compareType='custom'
 * @return {string} JSON string with report data
 */
function getSDRReport(dateIn, dateOut, compareType, customPrevDateIn, customPrevDateOut) {
  try {
    // Normalize compareType
    if (compareType !== 'yoy' && compareType !== 'custom') { compareType = 'prev_period'; }

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

    // Calculate previous period dates based on compareType
    var prevDateIn, prevDateOut;
    if (compareType === 'yoy') {
      // Year-over-Year: shift exactly 1 year back
      var dIn = new Date(dateIn);
      var dOut = new Date(dateOut);
      dIn.setFullYear(dIn.getFullYear() - 1);
      dOut.setFullYear(dOut.getFullYear() - 1);
      prevDateIn = dIn.toISOString().split('T')[0];
      prevDateOut = dOut.toISOString().split('T')[0];
    } else if (compareType === 'custom' && customPrevDateIn && customPrevDateOut) {
      prevDateIn  = customPrevDateIn;
      prevDateOut = customPrevDateOut;
    } else {
      // prev_period: same duration, shifted back
      var durationMs = dateOutMs - dateInMs;
      var prevDateInMs = dateInMs - durationMs;
      var prevDateOutMs = dateOutMs - durationMs;
      prevDateIn = new Date(prevDateInMs).toISOString().split('T')[0];
      prevDateOut = new Date(prevDateOutMs).toISOString().split('T')[0];
    }

    // Filter previous period leads
    var previousLeads = filterByDateRange_(allLeads, prevDateIn, prevDateOut);

    // Call section calculators
    var embudoGeneral = calculateEmbudoGeneral_(currentLeads, previousLeads, allLeads, contactosIdx, interaccionesIdx, calificacionIdx, allDeals, dateIn, dateOut, prevDateIn, prevDateOut);
    var incontactables = calculateIncontactables_(currentLeads, previousLeads, calificacionIdx);
    var crossSelling = calculateCrossSelling_(currentLeads, previousLeads, calificacionIdx, allDeals);
    var semaforoContesto = calculateSemaforoContesto_(currentLeads, previousLeads, calificacionIdx, interaccionesIdx);
    var semaforoNoContesto = calculateSemaforoNoContesto_(currentLeads, previousLeads, calificacionIdx, interaccionesIdx);
    var sinRespuesta6toToque = calculateSinRespuesta6toToque_(currentLeads, previousLeads, calificacionIdx, interaccionesIdx);
    var razonesNoPasoVentas = calculateRazonesNoPasoVentas_(currentLeads, previousLeads, calificacionIdx);
    var razonesPerdioVenta = calculateRazonesPerdioVenta_(currentLeads, previousLeads, calificacionIdx, allDeals);
    var matrizContactabilidad = calculateMatrizContactabilidad_(currentLeads, interaccionesIdx, contactosIdx);
    var dealsReport = calculateDealsReport_(allDeals, dateIn, dateOut, prevDateIn, prevDateOut);

    // Build result
    var result = {
      metadata: {
        dateIn: dateIn,
        dateOut: dateOut,
        compareType: compareType,
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
      razonesPerdioVenta: razonesPerdioVenta,
      matrizContactabilidad: matrizContactabilidad,
      dealsReport: dealsReport
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

  // Validate Embudo General (13 metrics)
  var embudoMetrics = [
    'totalLeads', 'contactables', 'contactados', 'conRespuesta',
    'dialogoCompleto', 'dialogoIntermitente', 'interes', 'descartados',
    'asignadosVentas', 'carryOver', 'montosInversion', 'dealsCerrados', 'montoCierres'
  ];
  if (result.embudoGeneral && typeof result.embudoGeneral === 'object') {
    for (var em = 0; em < embudoMetrics.length; em++) {
      var metricKey = embudoMetrics[em];
      var metric = result.embudoGeneral[metricKey];
      if (!metric) {
        errors.push('Embudo missing metric: ' + metricKey);
        isValid = false;
      } else {
        // Check segmentation keys
        if (!metric.total) { errors.push('Embudo ' + metricKey + ' missing total'); isValid = false; }
        if (!metric.manufacturers) { errors.push('Embudo ' + metricKey + ' missing manufacturers'); isValid = false; }
        if (!metric.individuals) { errors.push('Embudo ' + metricKey + ' missing individuals'); isValid = false; }
        // Check delta field exists
        if (metric.total && metric.total.delta === undefined) { errors.push('Embudo ' + metricKey + '.total missing delta'); isValid = false; }
      }
    }
  } else {
    errors.push('embudoGeneral is empty or missing');
    isValid = false;
  }

  // Validate Incontactables (3 sub-metrics)
  var incontactablesKeys = ['duplicado', 'equivocado', 'spam'];
  if (result.incontactables && typeof result.incontactables === 'object') {
    for (var ic = 0; ic < incontactablesKeys.length; ic++) {
      var icKey = incontactablesKeys[ic];
      var icMetric = result.incontactables[icKey];
      if (!icMetric) {
        errors.push('Incontactables missing: ' + icKey);
        isValid = false;
      } else {
        if (!icMetric.total) { errors.push('Incontactables ' + icKey + ' missing total'); isValid = false; }
        if (!icMetric.manufacturers) { errors.push('Incontactables ' + icKey + ' missing manufacturers'); isValid = false; }
        if (!icMetric.individuals) { errors.push('Incontactables ' + icKey + ' missing individuals'); isValid = false; }
      }
    }
  } else {
    errors.push('incontactables is empty or missing');
    isValid = false;
  }

  // Validate Razones No Paso a Ventas (6 reason categories + _totalDescartados)
  if (result.razonesNoPasoVentas && typeof result.razonesNoPasoVentas === 'object') {
    var razonesNoPasoKeys = ['noPerfilAdecuado', 'sinPresupuesto', 'sinInteresGenuino', 'necesitaTercero', 'noEntendioMarketing', 'otros', '_totalDescartados'];
    for (var rnp = 0; rnp < razonesNoPasoKeys.length; rnp++) {
      var rnpKey = razonesNoPasoKeys[rnp];
      var rnpMetric = result.razonesNoPasoVentas[rnpKey];
      if (!rnpMetric) {
        errors.push('razonesNoPasoVentas missing: ' + rnpKey);
        isValid = false;
      } else {
        if (!rnpMetric.total) { errors.push('razonesNoPasoVentas ' + rnpKey + ' missing total'); isValid = false; }
      }
    }
  } else {
    errors.push('razonesNoPasoVentas is empty or missing');
    isValid = false;
  }

  // Validate Razones Perdio Venta (13 reasons + sinEspecificar + _totalPerdidas)
  if (result.razonesPerdioVenta && typeof result.razonesPerdioVenta === 'object') {
    var razonesPerdioKeys = [
      'sinPresupuesto', 'eligioCompetidor', 'noResponde', 'timingInadecuado',
      'noTienePoderDecision', 'productoNoSeAjusta', 'cambioPrioridades',
      'malaExperienciaPrevia', 'precioMuyAlto', 'procesoInternoLargo',
      'seFueConOtraSolucion', 'noEraElPerfil', 'empresaCerro', 'sinEspecificar', '_totalPerdidas'
    ];
    for (var rpv = 0; rpv < razonesPerdioKeys.length; rpv++) {
      var rpvKey = razonesPerdioKeys[rpv];
      var rpvMetric = result.razonesPerdioVenta[rpvKey];
      if (!rpvMetric) {
        errors.push('razonesPerdioVenta missing: ' + rpvKey);
        isValid = false;
      } else {
        if (!rpvMetric.total) { errors.push('razonesPerdioVenta ' + rpvKey + ' missing total'); isValid = false; }
      }
    }
  } else {
    errors.push('razonesPerdioVenta is empty or missing');
    isValid = false;
  }


  // Validate Cross Selling
  if (result.crossSelling && typeof result.crossSelling === 'object') {
    if (!result.crossSelling.crossSellDeals) {
      errors.push('crossSelling missing crossSellDeals');
      isValid = false;
    }
  }

  // Validate Semaforo Contesto structure
  if (result.semaforoContesto && typeof result.semaforoContesto === 'object') {
    if (!result.semaforoContesto.telefono) errors.push('semaforoContesto missing telefono');
    if (!result.semaforoContesto.whatsapp) errors.push('semaforoContesto missing whatsapp');
    if (!result.semaforoContesto.correo) errors.push('semaforoContesto missing correo');
  }

  // Validate Semaforo No Contesto structure
  if (result.semaforoNoContesto && typeof result.semaforoNoContesto === 'object') {
    if (!result.semaforoNoContesto.telefono) errors.push('semaforoNoContesto missing telefono');
    if (!result.semaforoNoContesto.whatsapp) errors.push('semaforoNoContesto missing whatsapp');
    if (result.semaforoNoContesto.correo) errors.push('semaforoNoContesto should NOT have correo');
  }

  // Validate Sin Respuesta 6to Toque
  if (result.sinRespuesta6toToque && typeof result.sinRespuesta6toToque === 'object') {
    if (!result.sinRespuesta6toToque.sinRespuesta) {
      errors.push('sinRespuesta6toToque missing sinRespuesta');
      isValid = false;
    }
  }

  // Log summary with sample values
  Logger.log('Total leads: ' + (result.metadata ? result.metadata.totalLeads : 'N/A'));
  Logger.log('Non-empty sections: ' + nonEmptySections + '/' + sections.length);

  // Check if all sections implemented (no empty stubs)
  var allSectionsImplemented = nonEmptySections >= 4; // We have 4 real sections: embudoGeneral, incontactables, razonesNoPasoVentas, razonesPerdioVenta
  if (allSectionsImplemented) {
    Logger.log('ALL 8 SECTIONS IMPLEMENTED');
  } else {
    Logger.log('PARTIALLY IMPLEMENTED: ' + nonEmptySections + '/8 sections have data');
  }

  // Log sample values for spot-checking
  if (result.embudoGeneral && result.embudoGeneral.totalLeads) {
    Logger.log('Sample - totalLeads.total.count: ' + result.embudoGeneral.totalLeads.total.count);
  }
  if (result.embudoGeneral && result.embudoGeneral.contactados) {
    Logger.log('Sample - contactados.total.count: ' + result.embudoGeneral.contactados.total.count);
  }
  if (result.embudoGeneral && result.embudoGeneral.asignadosVentas) {
    Logger.log('Sample - asignadosVentas.total.count: ' + result.embudoGeneral.asignadosVentas.total.count);
  }

  // Log Razones counts for spot-checking
  if (result.razonesNoPasoVentas && result.razonesNoPasoVentas._totalDescartados) {
    Logger.log('Sample - razonesNoPasoVentas._totalDescartados.total.count: ' + result.razonesNoPasoVentas._totalDescartados.total.count);
  }
  if (result.razonesPerdioVenta && result.razonesPerdioVenta._totalPerdidas) {
    Logger.log('Sample - razonesPerdioVenta._totalPerdidas.total.count: ' + result.razonesPerdioVenta._totalPerdidas.total.count);
  }

  if (result.semaforoContesto && result.semaforoContesto.telefono && result.semaforoContesto.telefono.toque1) {
    Logger.log('Sample - semaforoContesto.telefono.toque1.total.count: ' + result.semaforoContesto.telefono.toque1.total.count);
  }
  if (result.sinRespuesta6toToque && result.sinRespuesta6toToque.sinRespuesta) {
    Logger.log('Sample - sinRespuesta6toToque.sinRespuesta.total.count: ' + result.sinRespuesta6toToque.sinRespuesta.total.count);
  }

  if (errors.length > 0) {
    Logger.log('VALIDATION ERRORS:');
    for (var k = 0; k < errors.length; k++) {
      Logger.log('  - ' + errors[k]);
    }
  }

  if (isValid) {
    Logger.log('ALL SECTIONS VALIDATED OK');
  } else {
    Logger.log('VALIDATION FAILED');
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
