/**
 * ============================================
 * CRM SWAT Squad — Crear Base de Datos
 * ============================================
 * Ejecuta crearBaseDeDatos() desde el editor de Apps Script.
 * Crea un Google Sheet con todas las hojas del Star Schema v6,
 * catálogos pre-poblados, productos, field layout, y un lead de ejemplo.
 *
 * IMPORTANTE: Después de ejecutar, copia el ID del Sheet creado
 * y pégalo en la variable SS_ID de Código.gs
 * ============================================
 */

function crearBaseDeDatos() {
  var ss = SpreadsheetApp.create('CRM SWAT Squad — Base de Datos');
  var ssId = ss.getId();
  var ssUrl = ss.getUrl();

  // Borrar la hoja por defecto ("Hoja 1" / "Sheet1")
  var defaultSheet = ss.getSheets()[0];

  // ── Crear todas las hojas ──
  var sheets = {};

  // DIMENSIONES
  sheets.dim_contactos = ss.insertSheet('dim_contactos');
  sheets.dim_campanas = ss.insertSheet('dim_campanas');
  sheets.dim_vendedores = ss.insertSheet('dim_vendedores');
  sheets.dim_productos = ss.insertSheet('dim_productos');

  // HECHOS
  sheets.fact_leads = ss.insertSheet('fact_leads');
  sheets.fact_deals = ss.insertSheet('fact_deals');
  sheets.fact_calificacion = ss.insertSheet('fact_calificacion');
  sheets.fact_interacciones = ss.insertSheet('fact_interacciones');
  sheets.fact_toques = ss.insertSheet('fact_toques');

  // LOGS
  sheets.log_transacciones = ss.insertSheet('log_transacciones');
  sheets.log_asistencia = ss.insertSheet('log_asistencia');

  // CONFIGURACIÓN
  sheets.cat_opciones = ss.insertSheet('cat_opciones');
  sheets.config_users = ss.insertSheet('config_users');
  sheets.config_plantillas_notas = ss.insertSheet('config_plantillas_notas');
  sheets.config_field_layout = ss.insertSheet('config_field_layout');

  // Borrar la hoja por defecto
  ss.deleteSheet(defaultSheet);

  // ══════════════════════════════════════════
  // HEADERS
  // ══════════════════════════════════════════

  setHeaders_(sheets.dim_contactos, [
    'id_contacto','nombre','apellido','email','telefono_1','telefono_2',
    'empresa','area','pais','ciudad','empleados','nivel','link','ip','fecha_creacion'
  ]);

  setHeaders_(sheets.dim_campanas, [
    'id_campana','source','medium','campaign','term','content','fecha_inicio','activa'
  ]);

  setHeaders_(sheets.dim_vendedores, [
    'id_vendedor','email','nombre','rol','activo','Orden_Round_Robin'
  ]);

  setHeaders_(sheets.dim_productos, [
    'id_producto','region','membership_type','pricing_tier','precio_1_year','precio_2_year','moneda','activo'
  ]);

  setHeaders_(sheets.fact_leads, [
    'id_lead','id_contacto','id_lead_original','id_campana','id_vendedor_sdr',
    'status','calidad_contacto','servicio_interes','fecha_ingreso','fecha_asignacion',
    'fecha_ultimo_contacto','numero_toques','tipo_seguimiento','status_seguimiento',
    'tipo_cliente_pricing','ticket_promedio','licencias','monto_aproximado',
    'es_recompra','razon_perdida','razon_perdida_otra','notas'
  ]);

  setHeaders_(sheets.fact_deals, [
    'id_deal','id_lead','id_contacto','id_vendedor_ae','id_producto',
    'fecha_pase_ventas','ventas_contacto_cliente','numero_toque_ae','toque_ae',
    'fecha_primer_contacto_ae','status_venta','proyeccion','monto_proyeccion',
    'cotizo','monto_cotizacion','fecha_cotizacion','notas_cotizacion',
    'monto_apartado','monto_cierre','fecha_reagenda','hora_reagenda',
    'fecha_cierre','razon_perdida','razon_perdida_otra','descuento_pct',
    'precio_1_year','precio_2_year','cross_selling','renovacion',
    'es_recompra','valor_recompra','fecha_recompra','producto_recompra',
    'es_cliente_activo','producto_cierre','fuente_origen','index_ae',
    'tipo_transaccion','link_pago','soporte_pago','deal_code',
    'notas_vendedor','en_negociacion','asistio_demo','firmo_contrato',
    'fondeo','comprobante_pago_url'
  ]);

  setHeaders_(sheets.fact_calificacion, [
    'id_calificacion','id_lead','id_deal','entendio_info_marketing',
    'mostro_interes_genuino','necesidad_puntual','pricing_tier',
    'perfil_adecuado','necesita_decision_tercero','tiene_presupuesto',
    'monto_presupuesto','modo_presupuesto','presupuesto_rango_alto',
    'asociacion_industria','region','tipo_membresia','fecha_calificacion',
    'respuestas_custom'
  ]);

  setHeaders_(sheets.fact_interacciones, [
    'id_interaccion','id_lead','id_deal','id_vendedor',
    'tipo_interaccion','resultado','numero_toque','timestamp',
    'duracion_seg','notas'
  ]);

  setHeaders_(sheets.fact_toques, [
    'id_registro_toque','id_entidad','tipo_entidad','id_vendedor',
    'rol_vendedor','numero_toque','fecha_toque','canal','detalle'
  ]);

  setHeaders_(sheets.log_transacciones, [
    'id_log','timestamp','entidad','id_entidad','usuario',
    'campo_modificado','valor_anterior','valor_nuevo'
  ]);

  setHeaders_(sheets.log_asistencia, [
    'id_registro','email','nombre','tipo','fecha_hora','duracion_sesion'
  ]);

  setHeaders_(sheets.cat_opciones, [
    'id_opcion','categoria','valor','orden','activo'
  ]);

  setHeaders_(sheets.config_users, [
    'email','nombre','rol','activo','conectado','ultimo_clockin','password'
  ]);

  setHeaders_(sheets.config_plantillas_notas, [
    'id_plantilla','id_vendedor','email_usuario','nombre','contenido',
    'tipo','compartida','fecha_creacion'
  ]);

  setHeaders_(sheets.config_field_layout, [
    'id_field','tipo_ficha','campo_key','campo_label','tipo_input',
    'seccion','seccion_icono','orden_seccion','orden_campo','visible',
    'ancho','requerido','solo_lectura','opciones_catalog','rol_visible'
  ]);

  // ══════════════════════════════════════════
  // DATOS: cat_opciones (catálogos)
  // ══════════════════════════════════════════
  var catData = [
    [11,'Calidad de Contacto','Excelente',1,true],
    [12,'Calidad de Contacto','Bueno',2,true],
    [13,'Calidad de Contacto','Regular',3,true],
    [14,'Calidad de Contacto','Malo',4,true],
    [15,'Calidad de Contacto','Sin Calificar',5,true],
    [16,'Status de Venta','Recien llegado',1,true],
    [17,'Status de Venta','Contactado',2,true],
    [18,'Status de Venta','En negociación',3,true],
    [19,'Status de Venta','Cotización',4,true],
    [20,'Status de Venta','Apartado',5,true],
    [21,'Status de Venta','Vendido',6,true],
    [22,'Status de Venta','Perdido',7,true],
    [23,'Status de Venta','Stand-by',8,true],
    [24,'Status de Venta','Reagendado',9,true],
    [25,'Status de Venta','No contesta',10,true],
    [26,'Status de Venta','Número equivocado',11,true],
    [27,'Status de Venta','No interesado',12,true],
    [28,'Status de Venta','Duplicado',13,true],
    [29,'Status de Venta','Inválido',14,true],
    [43,'Tipo de Seguimiento','Llamada',1,true],
    [44,'Tipo de Seguimiento','WhatsApp',2,true],
    [45,'Tipo de Seguimiento','Email',3,true],
    [46,'Tipo de Seguimiento','Reunión presencial',4,true],
    [47,'Tipo de Seguimiento','Videollamada',5,true],
    [48,'Status Seguimiento','Activo',1,true],
    [49,'Status Seguimiento','Pausado',2,true],
    [50,'Status Seguimiento','Cerrado',3,true],
    [51,'Status Seguimiento','Cancelado',4,true],
    [52,'Status Seguimiento','Esperando respuesta',5,true],
    [53,'Tipo de Interacción','Teléfono',1,true],
    [54,'Tipo de Interacción','WhatsApp',2,true],
    [55,'Tipo de Interacción','Correo',3,true],
    [56,'Resultado Interacción','Contestó',1,true],
    [57,'Resultado Interacción','No Contestó',2,true],
    [58,'Producto Cierre','1 Year Membership',1,true],
    [59,'Producto Cierre','2 Year Membership',2,true],
    [60,'Producto Cierre','Premium Package',3,true],
    [61,'Producto Cierre','Enterprise Bundle',4,true],
    [62,'Fuente de Origen','Inbound',1,true],
    [63,'Fuente de Origen','Outbound',2,true],
    [64,'Fuente de Origen','Referido',3,true],
    [65,'Fuente de Origen','Evento',4,true],
    [66,'Fuente de Origen','Partner',5,true],
    [67,'Fuente de Origen','Webinar',6,true],
    [68,'Tipo de Transacción','Nueva venta',1,true],
    [69,'Tipo de Transacción','Renovación',2,true],
    [70,'Tipo de Transacción','Upgrade',3,true],
    [71,'Tipo de Transacción','Cross-sell',4,true],
    [72,'Tipo de Transacción','Re-compra',5,true],
    [73,'Región','Norteamérica',1,true],
    [74,'Región','Latinoamérica',2,true],
    [75,'Región','Europa',3,true],
    [76,'Región','Asia-Pacífico',4,true],
    [77,'Membership Type','Manufacturers',1,true],
    [78,'Membership Type','Individuals',2,true],
    [79,'Membership Type','Attraction',3,true],
    [80,'Attraction','Theme Parks',1,true],
    [81,'Attraction','Water Parks',2,true],
    [82,'Attraction','Museums',3,true],
    [83,'Attraction','Zoos',4,true],
    [84,'Attraction','Family Entertainment Centers',5,true],
    [85,'Attraction','Resorts',6,true],
    [86,'Attraction','Aquariums',7,true],
    [87,'Pricing Tier','Tier 1 - Basic',1,true],
    [88,'Pricing Tier','Tier 2 - Standard',2,true],
    [89,'Pricing Tier','Tier 3 - Premium',3,true],
    [90,'Pricing Tier','Tier 4 - Enterprise',4,true],
    [91,'Pricing Tier','Tier 5 - Custom',5,true],
    [92,'Servicio','Membresía Básica',1,true],
    [93,'Servicio','Membresía Premium',2,true],
    [94,'Servicio','Membresía Enterprise',3,true],
    [95,'Servicio','Consultoría',4,true],
    [96,'Servicio','Capacitación',5,true],
    [97,'Servicio','Software CRM',6,true],
    [98,'Proyección','Alta',1,true],
    [99,'Proyección','Media',2,true],
    [100,'Proyección','Baja',3,true],
    [101,'Descuento','0%',1,true],
    [102,'Descuento','5%',2,true],
    [103,'Descuento','10%',3,true],
    [104,'Descuento','15%',4,true],
    [105,'Descuento','20%',5,true],
    [106,'Descuento','25%',6,true],
    [117,'Tipo de Cliente','Fichas Mensuales (FEE)',1,true],
    [118,'Tipo de Cliente','Proyectos',2,true],
    [119,'Tipo de Cliente','SaaS',3,true],
    [122,'Preguntas Custom','',1,true],
    [123,'Plantillas de Notas','Plantilla de nota',1,true],
    [124,'Plantillas de Notas','Plantilla de nota 2',2,true],
    [125,'¿Por qué perdimos la venta?','Toque 6',1,true],
    [126,'¿Por qué perdimos la venta?','Dejó de responder',2,true],
    [127,'¿Por qué perdimos la venta?','No tuvo más interés',3,true],
    [128,'¿Por qué perdimos la venta?','Ya resolvió su necesidad',4,true],
    [129,'¿Por qué perdimos la venta?','No se cuenta con el servicio',5,true],
    [130,'¿Por qué perdimos la venta?','Pidió no volver a llamar',6,true],
    [131,'¿Por qué perdimos la venta?','Motivos Personales',7,true],
    [132,'¿Por qué perdimos la venta?','No me llames, yo te llamo',8,true],
    [133,'¿Por qué perdimos la venta?','No califica',9,true],
    [134,'¿Por qué perdimos la venta?','No contaba con el presupuesto',10,true],
    [135,'¿Por qué perdimos la venta?','Otro',11,true],
    [136,'Status Lead','Nuevo',1,true],
    [137,'Status Lead','Contactado sin Respuesta',2,true],
    [138,'Status Lead','Contactado',3,true],
    [139,'Status Lead','No Calificado',4,true],
    [140,'Status Lead','Calificado',5,true],
    [141,'Status Lead','En Seguimiento',6,true],
    [142,'Status Lead','Inválido',7,true],
    [143,'Status Lead','Duplicado',8,true],
    [144,'Status Lead','Perdido',9,true],
    [145,'Status Lead','Paso a Ventas',10,true],
    [146,'Razón de Pérdida','Sin presupuesto',1,true],
    [147,'Razón de Pérdida','Eligió competidor',2,true],
    [148,'Razón de Pérdida','No responde',3,true],
    [149,'Razón de Pérdida','Timing inadecuado',4,true],
    [150,'Razón de Pérdida','No tiene poder de decisión',5,true],
    [151,'Razón de Pérdida','Producto no se ajusta',6,true],
    [152,'Razón de Pérdida','Cambio de prioridades',7,true],
    [153,'Razón de Pérdida','Mala experiencia previa',8,true],
    [154,'Razón de Pérdida','Precio muy alto',9,true],
    [155,'Razón de Pérdida','Proceso interno largo',10,true],
    [156,'Razón de Pérdida','Se fue con otra solución',11,true],
    [157,'Razón de Pérdida','No era el perfil',12,true],
    [158,'Razón de Pérdida','Empresa cerró',13,true],
    [159,'Razón de Pérdida','Prueba perdida',14,true]
  ];
  bulkWrite_(sheets.cat_opciones, catData);

  // ══════════════════════════════════════════
  // DATOS: dim_productos (60 productos)
  // ══════════════════════════════════════════
  var prodData = [
    [1,'Norteamérica','Manufacturers','Tier 1 - Basic',2997,4947,'USD',true],
    [2,'Norteamérica','Manufacturers','Tier 2 - Standard',3364,6004,'USD',true],
    [3,'Norteamérica','Manufacturers','Tier 3 - Premium',4122,7365,'USD',true],
    [4,'Norteamérica','Manufacturers','Tier 4 - Enterprise',4108,6628,'USD',true],
    [5,'Norteamérica','Manufacturers','Tier 5 - Custom',2412,4003,'USD',true],
    [6,'Norteamérica','Individuals','Tier 1 - Basic',3562,5865,'USD',true],
    [7,'Norteamérica','Individuals','Tier 2 - Standard',1202,1963,'USD',true],
    [8,'Norteamérica','Individuals','Tier 3 - Premium',946,1582,'USD',true],
    [9,'Norteamérica','Individuals','Tier 4 - Enterprise',1709,3179,'USD',true],
    [10,'Norteamérica','Individuals','Tier 5 - Custom',2856,4581,'USD',true],
    [11,'Norteamérica','Attraction','Tier 1 - Basic',1411,2386,'USD',true],
    [12,'Norteamérica','Attraction','Tier 2 - Standard',4359,7004,'USD',true],
    [13,'Norteamérica','Attraction','Tier 3 - Premium',2212,4030,'USD',true],
    [14,'Norteamérica','Attraction','Tier 4 - Enterprise',2235,3712,'USD',true],
    [15,'Norteamérica','Attraction','Tier 5 - Custom',4786,8734,'USD',true],
    [16,'Latinoamérica','Manufacturers','Tier 1 - Basic',4995,8715,'USD',true],
    [17,'Latinoamérica','Manufacturers','Tier 2 - Standard',1657,2996,'USD',true],
    [18,'Latinoamérica','Manufacturers','Tier 3 - Premium',650,1113,'USD',true],
    [19,'Latinoamérica','Manufacturers','Tier 4 - Enterprise',4815,7766,'USD',true],
    [20,'Latinoamérica','Manufacturers','Tier 5 - Custom',1895,3066,'USD',true],
    [21,'Latinoamérica','Individuals','Tier 1 - Basic',2144,3938,'USD',true],
    [22,'Latinoamérica','Individuals','Tier 2 - Standard',2722,4398,'USD',true],
    [23,'Latinoamérica','Individuals','Tier 3 - Premium',568,920,'USD',true],
    [24,'Latinoamérica','Individuals','Tier 4 - Enterprise',2722,4896,'USD',true],
    [25,'Latinoamérica','Individuals','Tier 5 - Custom',3450,6414,'USD',true],
    [26,'Latinoamérica','Attraction','Tier 1 - Basic',656,1107,'USD',true],
    [27,'Latinoamérica','Attraction','Tier 2 - Standard',3666,6119,'USD',true],
    [28,'Latinoamérica','Attraction','Tier 3 - Premium',3618,6340,'USD',true],
    [29,'Latinoamérica','Attraction','Tier 4 - Enterprise',1315,2460,'USD',true],
    [30,'Latinoamérica','Attraction','Tier 5 - Custom',4470,8314,'USD',true],
    [31,'Europa','Manufacturers','Tier 1 - Basic',4854,7894,'USD',true],
    [32,'Europa','Manufacturers','Tier 2 - Standard',2129,3726,'USD',true],
    [33,'Europa','Manufacturers','Tier 3 - Premium',4251,7516,'USD',true],
    [34,'Europa','Manufacturers','Tier 4 - Enterprise',676,1089,'USD',true],
    [35,'Europa','Manufacturers','Tier 5 - Custom',4836,8179,'USD',true],
    [36,'Europa','Individuals','Tier 1 - Basic',4513,7753,'USD',true],
    [37,'Europa','Individuals','Tier 2 - Standard',1786,2867,'USD',true],
    [38,'Europa','Individuals','Tier 3 - Premium',3382,5771,'USD',true],
    [39,'Europa','Individuals','Tier 4 - Enterprise',2976,4972,'USD',true],
    [40,'Europa','Individuals','Tier 5 - Custom',4606,7750,'USD',true],
    [41,'Europa','Attraction','Tier 1 - Basic',1007,1800,'USD',true],
    [42,'Europa','Attraction','Tier 2 - Standard',3671,6854,'USD',true],
    [43,'Europa','Attraction','Tier 3 - Premium',741,1395,'USD',true],
    [44,'Europa','Attraction','Tier 4 - Enterprise',2795,4661,'USD',true],
    [45,'Europa','Attraction','Tier 5 - Custom',3299,6166,'USD',true],
    [46,'Asia-Pacífico','Manufacturers','Tier 1 - Basic',1624,2641,'USD',true],
    [47,'Asia-Pacífico','Manufacturers','Tier 2 - Standard',3631,6376,'USD',true],
    [48,'Asia-Pacífico','Manufacturers','Tier 3 - Premium',2363,4076,'USD',true],
    [49,'Asia-Pacífico','Manufacturers','Tier 4 - Enterprise',1751,3025,'USD',true],
    [50,'Asia-Pacífico','Manufacturers','Tier 5 - Custom',3059,5729,'USD',true],
    [51,'Asia-Pacífico','Individuals','Tier 1 - Basic',3197,5545,'USD',true],
    [52,'Asia-Pacífico','Individuals','Tier 2 - Standard',1579,2624,'USD',true],
    [53,'Asia-Pacífico','Individuals','Tier 3 - Premium',1635,2900,'USD',true],
    [54,'Asia-Pacífico','Individuals','Tier 4 - Enterprise',2157,4009,'USD',true],
    [55,'Asia-Pacífico','Individuals','Tier 5 - Custom',3031,5475,'USD',true],
    [56,'Asia-Pacífico','Attraction','Tier 1 - Basic',4791,8972,'USD',true],
    [57,'Asia-Pacífico','Attraction','Tier 2 - Standard',4023,7638,'USD',true],
    [58,'Asia-Pacífico','Attraction','Tier 3 - Premium',1689,3034,'USD',true],
    [59,'Asia-Pacífico','Attraction','Tier 4 - Enterprise',1794,3041,'USD',true],
    [60,'Asia-Pacífico','Attraction','Tier 5 - Custom',4866,9170,'USD',true]
  ];
  bulkWrite_(sheets.dim_productos, prodData);

  // ══════════════════════════════════════════
  // DATOS: config_field_layout (55 campos)
  // ══════════════════════════════════════════
  var fieldData = [
    [1,'lead','Apellido','Apellido','text','Información de Contacto','\ud83d\udcc7',2,1,true,'full',false,false,'','ALL'],
    [2,'lead','Nombre','Nombre','text','Información de Contacto','\ud83d\udcc7',2,1,true,'full',false,false,'','ALL'],
    [3,'lead','Email','Email','text','Información de Contacto','\ud83d\udcc7',2,2,true,'full',false,false,'','ALL'],
    [4,'lead','Teléfono','Teléfono','text','Información de Contacto','\ud83d\udcc7',2,3,true,'full',false,false,'','ALL'],
    [5,'lead','Teléfono 2','Teléfono 2','text','Información de Contacto','\ud83d\udcc7',2,4,true,'half',false,false,'','ALL'],
    [6,'lead','empresa','Empresa','text','Información de Contacto','\ud83d\udcc7',2,5,true,'half',false,false,'','ALL'],
    [7,'lead','Area','Área / Cargo','text','Información de Contacto','\ud83d\udcc7',2,6,true,'half',false,false,'','ALL'],
    [8,'lead','Pais','País','text','Información de Contacto','\ud83d\udcc7',2,7,true,'half',false,false,'','ALL'],
    [9,'lead','City','Ciudad','text','Información de Contacto','\ud83d\udcc7',2,8,true,'half',false,false,'','ALL'],
    [10,'lead','Empleados','Empleados','text','Información de Contacto','\ud83d\udcc7',2,9,true,'half',false,false,'','ALL'],
    [11,'lead','Nivel','Nivel','text','Información de Contacto','\ud83d\udcc7',2,10,true,'half',false,false,'','ALL'],
    [12,'lead','Servicio','Servicio','text','Información de Contacto','\ud83d\udcc7',2,11,true,'half',false,false,'','ALL'],
    [13,'lead','source','Source','text','Información de Campaña','\ud83d\udcca',3,7,true,'half',false,true,'','ALL'],
    [14,'lead','Vendedor asignado (SDR)','Vendedor Asignado (SDR)','sdr_select','Propietario del Lead','\ud83c\udff7\ufe0f',1,13,true,'half',false,false,'','ALL'],
    [15,'lead','Fecha y Hora de asignación','Fecha y Hora de Asignación','date_display','Propietario del Lead','\ud83c\udff7\ufe0f',1,1,true,'half',false,true,'','ALL'],
    [16,'lead','campaign','Campaign','text','Información de Campaña','\ud83d\udcca',3,15,true,'half',false,true,'','ALL'],
    [17,'lead','term','Term','text','Información de Campaña','\ud83d\udcca',3,1,true,'half',false,true,'','ALL'],
    [18,'lead','content','Content','text','Información de Campaña','\ud83d\udcca',3,2,true,'half',false,true,'','ALL'],
    [19,'lead','fbclid','fbclid','text','Información de Campaña','\ud83d\udcca',3,3,true,'half',false,true,'','ALL'],
    [20,'lead','Ip','IP','text','Información de Campaña','\ud83d\udcca',3,4,true,'half',false,true,'','ALL'],
    [21,'lead','Link','Link','text','Información de Campaña','\ud83d\udcca',3,5,true,'half',false,true,'','ALL'],
    [22,'lead','medium','Medium','text','Información de Campaña','\ud83d\udcca',3,6,true,'half',false,true,'','ALL'],
    [23,'lead','Calidad de Contacto','Calidad de Contacto','calidad_badge','Información de Seguimiento','\ud83d\udcde',4,22,true,'half',false,false,'','ALL'],
    [24,'lead','Toques de Contactación','Toque Actual','toque_counter','Información de Seguimiento','\ud83d\udcde',4,1,true,'half',false,false,'','ALL'],
    [25,'lead','Timestamp','Timestamp (Último Toque)','date_display','Información de Seguimiento','\ud83d\udcde',4,2,true,'half',false,true,'','ALL'],
    [26,'lead','Tipo de Seguimiento','Tipo de Seguimiento','select','Información de Seguimiento','\ud83d\udcde',4,3,true,'half',false,false,'Tipo de Seguimiento','ALL'],
    [27,'lead','Status del Seguimiento','Status del Seguimiento','select','Información de Seguimiento','\ud83d\udcde',4,4,true,'half',false,false,'Status del Seguimiento','ALL'],
    [28,'lead','Razón de pérdida','Razón de Pérdida','select','Información de Seguimiento','\ud83d\udcde',4,5,true,'half',false,false,'Razón de pérdida','ALL'],
    [29,'lead','Status','Status','select','Información de Seguimiento','\ud83d\udcde',4,6,true,'half',false,false,'Status','ALL'],
    [30,'lead','¿Mostró Interés genuino?','¿Mostró Interés genuino?','select_yn','Calificación BANT','\ud83c\udfaf',5,29,true,'half',false,false,'','ALL'],
    [31,'lead','¿Cuál es tu necesidad puntual?','¿Cuál es tu necesidad puntual?','textarea','Calificación BANT','\ud83c\udfaf',5,1,true,'full',false,false,'','ALL'],
    [32,'lead','¿El perfil del prospecto es el adecuado?','¿El perfil es adecuado?','select_yn','Calificación BANT','\ud83c\udfaf',5,2,true,'half',false,false,'','ALL'],
    [33,'lead','¿Necesitas tocar base con alguién para decidir la compra?','¿Necesita consultar para decidir?','select_yn','Calificación BANT','\ud83c\udfaf',5,3,true,'half',false,false,'','ALL'],
    [34,'lead','¿han sido parte de alguna asociación de la industria?','¿Asociación de industria?','select_yn','Calificación BANT','\ud83c\udfaf',5,4,true,'half',false,false,'','ALL'],
    [35,'lead','_custom_questions','Preguntas Adicionales','custom_questions','Calificación BANT','\ud83c\udfaf',5,5,true,'full',false,false,'','ALL'],
    [36,'lead','¿Cual es su región?','¿Cuál es su región?','select','Calificación BANT','\ud83c\udfaf',5,6,true,'half',false,false,'¿Cual es su región?','ALL'],
    [37,'lead','¿Que tipo de membresía es?','¿Tipo de membresía?','select','Calificación BANT','\ud83c\udfaf',5,7,true,'half',false,false,'¿Que tipo de membresía es?','ALL'],
    [38,'lead','_pricing_result','Pricing Result','pricing_result','Calificación BANT','\ud83c\udfaf',5,8,true,'full',false,false,'','ALL'],
    [39,'lead','¿Entendió la información de Marketing?','¿Entendió el Marketing?','select_yn','Calificación BANT','\ud83c\udfaf',5,9,true,'half',false,false,'','ALL'],
    [40,'lead','Pricing Tier','Pricing Tier','select','Pricing Global','\ud83c\udfaf',6,39,true,'half',false,false,'Pricing Tier','ALL'],
    [41,'lead','¿Cuánto?','¿Cuánto?','budget_dual','Pricing Global','\ud83c\udfaf',6,1,true,'full',false,false,'','ALL'],
    [42,'lead','Monto Aproximado','Monto Aproximado (Pipeline Value)','pricing_display','Pricing Global','\ud83d\udcb0',6,2,true,'full',false,true,'','ALL'],
    [43,'lead','¿Tienes presupuesto asignado para este proyecto, en este año?','¿Presupuesto asignado?','select_yn','Pricing Global','\ud83c\udfaf',6,3,true,'half',false,false,'','ALL'],
    [44,'lead','Notas','Notas','textarea','Notas del Lead','\ud83d\udcdd',7,43,true,'full',false,false,'','ALL'],
    [45,'lead','_q_respuestas_custom','Respuestas Custom','text','Otros Campos','\ud83d\udccb',99,44,true,'half',false,false,'','ALL'],
    [46,'lead','_camp_source','Source','text','Otros Campos','\ud83d\udccb',99,1,true,'half',false,true,'','ALL'],
    [47,'lead','_camp_medium','Medium','text','Otros Campos','\ud83d\udccb',99,2,true,'half',false,true,'','ALL'],
    [48,'lead','_camp_campaign','Campaign','text','Otros Campos','\ud83d\udccb',99,3,true,'half',false,true,'','ALL'],
    [49,'lead','_camp_term','Term','text','Otros Campos','\ud83d\udccb',99,4,true,'half',false,true,'','ALL'],
    [50,'lead','_camp_content','Content','text','Otros Campos','\ud83d\udccb',99,5,true,'half',false,true,'','ALL'],
    [51,'lead','_camp_fecha_inicio','Fecha Inicio','date','Otros Campos','\ud83d\udccb',99,6,true,'half',false,true,'','ALL'],
    [52,'lead','_camp_activa','Activa','text','Otros Campos','\ud83d\udccb',99,7,false,'half',false,true,'','ALL'],
    [53,'lead','_q_fecha_calificacion','Fecha Calificacion','date','Otros Campos','\ud83d\udccb',99,8,false,'half',false,false,'','ALL'],
    [54,'lead','_c_referido_por','Referido Por','text','Otros Campos','\ud83d\udccb',99,9,false,'half',false,false,'','ALL'],
    [55,'lead','_placeholder_Datos Adicionales','(Mueve campos aquí)','hidden','Otros Campos','\ud83d\udccb',99,54,true,'half',false,true,'','ALL']
  ];
  bulkWrite_(sheets.config_field_layout, fieldData);

  // ══════════════════════════════════════════
  // DATOS DE EJEMPLO: 1 lead completo
  // ══════════════════════════════════════════

  // Vendedor admin de ejemplo
  sheets.dim_vendedores.appendRow([
    1, 'admin@empresa.com', 'Administrador', 'ADMIN', true, ''
  ]);

  // Vendedor SDR de ejemplo
  sheets.dim_vendedores.appendRow([
    2, 'sdr@empresa.com', 'Vendedor SDR Demo', 'SDR', true, 1
  ]);

  // Campaña de ejemplo
  sheets.dim_campanas.appendRow([
    1, 'organic', 'direct', 'demo_campaign', '', '', '2026-01-01', true
  ]);

  // Contacto de ejemplo
  sheets.dim_contactos.appendRow([
    1, 'Juan', 'Pérez', 'juan.perez@ejemplo.com', '+52 55 1234 5678', '',
    'Empresa Demo S.A.', 'Director Comercial', 'México', 'CDMX',
    50, 'Director', '', '', new Date()
  ]);

  // Lead de ejemplo
  sheets.fact_leads.appendRow([
    1, 1, '', 1, 2,
    'Nuevo', 'Sin Calificar', 'Membresía Básica',
    new Date(), new Date(), '', 0,
    'WhatsApp', 'Activo', '', '', '', '',
    false, '', '', 'Lead de ejemplo creado automáticamente'
  ]);

  // Calificación vacía vinculada al lead
  sheets.fact_calificacion.appendRow([
    1, 1, '', '', '', '', '', '', '', '', '', '', '', '', '', '', new Date(), ''
  ]);

  // User admin de ejemplo
  sheets.config_users.appendRow([
    'admin@empresa.com', 'Administrador', 'ADMIN', true, false, '', '123456'
  ]);

  // User SDR de ejemplo
  sheets.config_users.appendRow([
    'sdr@empresa.com', 'Vendedor SDR Demo', 'SDR', true, false, '', '123456'
  ]);

  // ══════════════════════════════════════════
  // FORMATO: Congelar fila 1, negrita headers
  // ══════════════════════════════════════════
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var sh = allSheets[i];
    sh.setFrozenRows(1);
    var lastCol = sh.getLastColumn();
    if (lastCol > 0) {
      sh.getRange(1, 1, 1, lastCol).setFontWeight('bold').setBackground('#1e1e38').setFontColor('#eaeaf0');
    }
  }

  // ══════════════════════════════════════════
  // RESULTADO
  // ══════════════════════════════════════════
  Logger.log('===========================================');
  Logger.log('BASE DE DATOS CREADA EXITOSAMENTE');
  Logger.log('===========================================');
  Logger.log('Sheet ID: ' + ssId);
  Logger.log('URL: ' + ssUrl);
  Logger.log('');
  Logger.log('SIGUIENTE PASO:');
  Logger.log('Copia este ID y pégalo en la variable SS_ID de Código.gs:');
  Logger.log('var SS_ID = "' + ssId + '";');
  Logger.log('===========================================');

  SpreadsheetApp.getUi().alert(
    'Base de Datos Creada',
    'Sheet ID:\n' + ssId + '\n\n' +
    'URL:\n' + ssUrl + '\n\n' +
    'SIGUIENTE PASO:\n' +
    'Copia el ID y pégalo en SS_ID de Código.gs',
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return ssId;
}

// ── Helpers ──

function setHeaders_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function bulkWrite_(sheet, data) {
  if (data.length === 0) return;
  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}
