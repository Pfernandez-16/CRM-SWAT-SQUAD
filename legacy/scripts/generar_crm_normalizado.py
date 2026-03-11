"""
Generador de Base de Datos CRM Normalizada (Modelo Estrella/Snowflake)
=====================================================================
Reemplaza la estructura plana de 80-101 columnas por un modelo relacional
con dimensiones y tablas de hechos.

Genera datos ficticios realistas para ~200 leads.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

random.seed(42)
np.random.seed(42)

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "CRM_Normalizado_v6.xlsx")

# ============================================================
# DATOS SEMILLA PARA GENERAR FICTICIOS
# ============================================================

NOMBRES = [
    "Carlos", "María", "Pedro", "Ana", "Luis", "Sofía", "Juan", "Valentina",
    "Diego", "Camila", "Andrés", "Isabella", "Roberto", "Daniela", "Miguel",
    "Gabriela", "Fernando", "Lucía", "Javier", "Mariana", "Ricardo", "Paula",
    "Eduardo", "Andrea", "Alejandro", "Natalia", "Sergio", "Carolina",
    "Tomás", "Elena", "Gustavo", "Lorena", "Héctor", "Patricia", "Raúl",
    "Mónica", "Alberto", "Sandra", "Óscar", "Rosa"
]

APELLIDOS = [
    "García", "Rodríguez", "Martínez", "López", "González", "Hernández",
    "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez",
    "Díaz", "Cruz", "Morales", "Reyes", "Gutiérrez", "Ortiz", "Ramos",
    "Vargas", "Castillo", "Jiménez", "Moreno", "Romero", "Alvarez", "Ruiz",
    "Mendoza", "Aguilar", "Medina", "Castro", "Herrera", "Ríos", "Salazar",
    "Vega", "Delgado", "Suárez", "Cortés", "Rojas", "Navarro"
]

EMPRESAS = [
    "TechNova Solutions", "Grupo Alfa Industrial", "Green Energy Corp",
    "Retail Max SA", "Logistics Pro", "DataWave Analytics", "Construcciones MX",
    "Pharma Health Group", "Auto Parts Central", "Alimentos del Valle",
    "Digital Commerce Inc", "Servicios Financieros Norte", "Textiles Modernos",
    "Agro Solutions", "Turismo Premium", "EduTech Academy", "Metal Works SA",
    "Cloud Systems MX", "Transportes Rápidos", "Manufactura Global",
    "BioTech Research", "Inmobiliaria Horizonte", "PackPro Empaques",
    "Consultoría Integral", "Energy Grid Corp", "FoodService Express",
    "Mining Resources", "TeleCom Advanced", "Plastics Innovation",
    "Water Solutions SA", "Security Systems Pro", "ChemLab Industries",
    "Fashion Forward", "AeroSpace MX", "Marine Logistics"
]

PAISES = [
    "México", "Colombia", "Argentina", "Chile", "Perú", "Ecuador",
    "España", "Estados Unidos", "Brasil", "Costa Rica", "Panamá", "Uruguay"
]

CIUDADES = {
    "México": ["CDMX", "Monterrey", "Guadalajara", "Puebla", "Querétaro", "Mérida"],
    "Colombia": ["Bogotá", "Medellín", "Cali", "Barranquilla"],
    "Argentina": ["Buenos Aires", "Córdoba", "Rosario"],
    "Chile": ["Santiago", "Valparaíso", "Concepción"],
    "Perú": ["Lima", "Arequipa", "Cusco"],
    "Ecuador": ["Quito", "Guayaquil"],
    "España": ["Madrid", "Barcelona", "Valencia"],
    "Estados Unidos": ["Miami", "Houston", "Los Angeles", "New York"],
    "Brasil": ["São Paulo", "Río de Janeiro"],
    "Costa Rica": ["San José"],
    "Panamá": ["Ciudad de Panamá"],
    "Uruguay": ["Montevideo"]
}

AREAS = ["Ventas", "Marketing", "Operaciones", "TI", "Finanzas", "RRHH", "Dirección", "Logística", "Producción", "Compras"]

UTM_SOURCES = ["google", "facebook", "instagram", "linkedin", "tiktok", "email", "referral", "organic", "bing"]
UTM_MEDIUMS = ["cpc", "cpm", "social", "email", "organic", "referral", "display"]
UTM_CAMPAIGNS = [
    "brand_awareness_q1", "lead_gen_2025", "retargeting_hot", "webinar_marzo",
    "promo_verano", "membership_launch", "referral_program", "blackfriday_2025",
    "content_blog", "demo_request", "newsletter_weekly"
]

SERVICIOS = ["Membresía Básica", "Membresía Premium", "Membresía Enterprise", "Consultoría", "Capacitación", "Software CRM"]

REGIONES = ["Norteamérica", "Latinoamérica", "Europa", "Asia-Pacífico"]
MEMBERSHIP_TYPES = ["Manufacturers", "Individuals", "Attraction"]
ATTRACTIONS = ["Theme Parks", "Water Parks", "Museums", "Zoos", "Family Entertainment Centers", "Resorts", "Aquariums"]

STATUS_LEAD = [
    "Nuevo", "Contactado", "En Seguimiento", "Calificado",
    "No Calificado", "Contactado sin Respuesta", "Paso a Ventas",
    "Perdido", "Duplicado", "Inválido"
]

CALIDAD_CONTACTO = ["Excelente", "Bueno", "Regular", "Malo", "Sin Calificar"]

STATUS_VENTA = [
    "Recien llegado", "Contactado", "En negociación", "Propuesta enviada",
    "Apartado", "Vendido", "Perdido", "Stand-by", "Reagendado",
    "No contesta", "Número equivocado", "No interesado", "Duplicado", "Inválido"
]

RAZONES_PERDIDA = [
    "Sin presupuesto", "Eligió competidor", "No responde",
    "Timing inadecuado", "No tiene poder de decisión",
    "Producto no se ajusta", "Cambio de prioridades",
    "Mala experiencia previa", "Precio muy alto",
    "Proceso interno largo", "Se fue con otra solución",
    "No era el perfil", "Empresa cerró"
]

TIPO_SEGUIMIENTO = ["Llamada", "WhatsApp", "Email", "Reunión presencial", "Videollamada"]
STATUS_SEGUIMIENTO = ["Activo", "Pausado", "Cerrado", "Cancelado", "Esperando respuesta"]

TIPO_INTERACCION = ["Teléfono", "WhatsApp", "Correo"]
RESULTADO_INTERACCION = ["Contestó", "No Contestó"]

PRODUCTOS_CIERRE = ["1 Year Membership", "2 Year Membership", "Premium Package", "Enterprise Bundle"]
FUENTE_ORIGEN = ["Inbound", "Outbound", "Referido", "Evento", "Partner", "Webinar"]
TIPO_TRANSACCION = ["Nueva venta", "Renovación", "Upgrade", "Cross-sell", "Re-compra"]

VENDEDORES_DATA = [
    ("pedro.mendez@swatsquad.com", "Pedro Méndez", "SDR"),
    ("ana.garcia@swatsquad.com", "Ana García", "SDR"),
    ("carlos.lopez@swatsquad.com", "Carlos López", "SDR"),
    ("maria.torres@swatsquad.com", "María Torres", "AE"),
    ("luis.ramirez@swatsquad.com", "Luis Ramírez", "AE"),
    ("sofia.martinez@swatsquad.com", "Sofía Martínez", "AE"),
    ("admin@swatsquad.com", "Administrador", "ADMIN"),
]

PRICING_TIERS = [
    "Tier 1 - Basic",
    "Tier 2 - Standard",
    "Tier 3 - Premium",
    "Tier 4 - Enterprise",
    "Tier 5 - Custom"
]


# ============================================================
# FUNCIONES GENERADORAS
# ============================================================

def random_date(start, end):
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def random_phone():
    country_codes = ["+52", "+57", "+54", "+56", "+51", "+34", "+1"]
    code = random.choice(country_codes)
    number = "".join([str(random.randint(0, 9)) for _ in range(10)])
    return f"{code} {number[:3]} {number[3:6]} {number[6:]}"


def random_email(nombre, apellido):
    domains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "empresa.com", "corporativo.mx"]
    clean_n = nombre.lower().replace("é", "e").replace("á", "a").replace("í", "i").replace("ó", "o").replace("ú", "u")
    clean_a = apellido.lower().replace("é", "e").replace("á", "a").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    separators = [".", "_", ""]
    sep = random.choice(separators)
    suffix = random.choice(["", str(random.randint(1, 99))])
    return f"{clean_n}{sep}{clean_a}{suffix}@{random.choice(domains)}"


# ============================================================
# GENERACION DE TABLAS
# ============================================================

N_CONTACTOS = 200
N_LEADS = 200
N_DEALS = 80
N_INTERACCIONES = 600

DATE_START = datetime(2024, 1, 1)
DATE_END = datetime(2025, 12, 31)


def gen_dim_vendedores():
    rows = []
    for i, (email, nombre, rol) in enumerate(VENDEDORES_DATA, 1):
        rows.append({
            "id_vendedor": i,
            "email": email,
            "nombre": nombre,
            "rol": rol,
            "activo": True
        })
    return pd.DataFrame(rows)


def gen_dim_contactos():
    rows = []
    for i in range(1, N_CONTACTOS + 1):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)
        pais = random.choice(PAISES)
        ciudad = random.choice(CIUDADES.get(pais, ["Capital"]))
        rows.append({
            "id_contacto": i,
            "nombre": nombre,
            "apellido": apellido,
            "email": random_email(nombre, apellido),
            "telefono_1": random_phone(),
            "telefono_2": random_phone() if random.random() < 0.3 else "",
            "empresa": random.choice(EMPRESAS),
            "area": random.choice(AREAS) if random.random() < 0.7 else "",
            "pais": pais,
            "ciudad": ciudad,
            "empleados": random.choice(["1-10", "11-50", "51-200", "201-500", "500+", ""]),
            "nivel": random.choice(["Director", "Gerente", "Coordinador", "Analista", "CEO", "VP", ""]),
            "fecha_creacion": random_date(DATE_START, DATE_END).strftime("%Y-%m-%d %H:%M:%S")
        })
    return pd.DataFrame(rows)


def gen_dim_campanas():
    rows = []
    for i in range(1, 31):
        rows.append({
            "id_campana": i,
            "source": random.choice(UTM_SOURCES),
            "medium": random.choice(UTM_MEDIUMS),
            "campaign": random.choice(UTM_CAMPAIGNS),
            "term": random.choice(["crm", "membership", "inversión", "lead gen", "software", "consultoría", ""]),
            "content": random.choice(["banner_v1", "video_ad", "carousel", "text_ad", "story", ""]),
            "fecha_inicio": random_date(DATE_START, DATE_END).strftime("%Y-%m-%d"),
            "activa": random.choice([True, True, True, False])
        })
    return pd.DataFrame(rows)


def gen_dim_productos():
    rows = []
    i = 1
    for region in REGIONES:
        for mtype in MEMBERSHIP_TYPES:
            for tier in PRICING_TIERS:
                base_1y = random.randint(500, 5000)
                base_2y = int(base_1y * random.uniform(1.6, 1.9))
                rows.append({
                    "id_producto": i,
                    "region": region,
                    "membership_type": mtype,
                    "pricing_tier": tier,
                    "precio_1_year": base_1y,
                    "precio_2_year": base_2y,
                    "moneda": "USD",
                    "activo": True
                })
                i += 1
    return pd.DataFrame(rows)


def gen_fact_leads(df_contactos, df_campanas, df_vendedores):
    sdrs = df_vendedores[df_vendedores["rol"] == "SDR"]["id_vendedor"].tolist()
    rows = []
    for i in range(1, N_LEADS + 1):
        fecha_ingreso = random_date(DATE_START, DATE_END)
        status = random.choice(STATUS_LEAD)
        has_vendedor = status in ["En Seguimiento", "Calificado", "Paso a Ventas", "Perdido"]
        rows.append({
            "id_lead": i,
            "id_contacto": random.randint(1, N_CONTACTOS),
            "id_campana": random.choice([random.randint(1, 30), None]),
            "id_vendedor_sdr": random.choice(sdrs) if has_vendedor else None,
            "status": status,
            "calidad_contacto": random.choice(CALIDAD_CONTACTO),
            "servicio_interes": random.choice(SERVICIOS) if random.random() < 0.6 else "",
            "fecha_ingreso": fecha_ingreso.strftime("%Y-%m-%d %H:%M:%S"),
            "fecha_asignacion": (fecha_ingreso + timedelta(hours=random.randint(1, 72))).strftime("%Y-%m-%d %H:%M:%S") if has_vendedor else "",
            "fecha_ultimo_contacto": (fecha_ingreso + timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%d %H:%M:%S") if status != "Nuevo" else "",
            "numero_toques": random.randint(0, 12) if status != "Nuevo" else 0,
            "tipo_seguimiento": random.choice(TIPO_SEGUIMIENTO) if status in ["En Seguimiento", "Calificado"] else "",
            "status_seguimiento": random.choice(STATUS_SEGUIMIENTO) if status in ["En Seguimiento", "Calificado"] else "",
            "notas": random.choice([
                "Cliente interesado, pide más info",
                "No contesta en horario laboral",
                "Pidió propuesta formal",
                "Referido por otro cliente",
                "Agenda reunión próxima semana",
                "Sin interés en este momento",
                "Perfil ideal, seguir de cerca",
                ""
            ])
        })
    return pd.DataFrame(rows)


def gen_fact_deals(df_leads, df_vendedores, df_productos):
    aes = df_vendedores[df_vendedores["rol"].isin(["AE", "ADMIN"])]["id_vendedor"].tolist()
    paso_a_ventas = df_leads[df_leads["status"] == "Paso a Ventas"]["id_lead"].tolist()

    # Also add some random leads that progressed
    calificados = df_leads[df_leads["status"] == "Calificado"]["id_lead"].tolist()
    deal_leads = paso_a_ventas + random.sample(calificados, min(len(calificados), N_DEALS - len(paso_a_ventas)))
    deal_leads = deal_leads[:N_DEALS]

    rows = []
    for i, id_lead in enumerate(deal_leads, 1):
        lead = df_leads[df_leads["id_lead"] == id_lead].iloc[0]
        fecha_pase = datetime.strptime(lead["fecha_ingreso"], "%Y-%m-%d %H:%M:%S") + timedelta(days=random.randint(1, 14))
        status = random.choice(STATUS_VENTA)
        is_won = status == "Vendido"
        is_lost = status == "Perdido"

        monto_proj = random.randint(1000, 50000) if status not in ["Recien llegado", "No contesta"] else 0
        monto_cierre = monto_proj * random.uniform(0.7, 1.0) if is_won else 0

        rows.append({
            "id_deal": i,
            "id_lead": id_lead,
            "id_contacto": lead["id_contacto"],
            "id_vendedor_ae": random.choice(aes),
            "id_producto": random.randint(1, 60) if is_won or status in ["En negociación", "Propuesta enviada", "Apartado"] else None,
            "status_venta": status,
            "proyeccion": random.choice(["Alta", "Media", "Baja", ""]) if status not in ["Vendido", "Perdido"] else "",
            "monto_proyeccion": round(monto_proj, 2),
            "monto_apartado": round(monto_proj * 0.2, 2) if status == "Apartado" else 0,
            "monto_cierre": round(monto_cierre, 2),
            "fecha_pase_ventas": fecha_pase.strftime("%Y-%m-%d %H:%M:%S"),
            "fecha_primer_contacto_ae": (fecha_pase + timedelta(hours=random.randint(1, 48))).strftime("%Y-%m-%d %H:%M:%S"),
            "fecha_cierre": (fecha_pase + timedelta(days=random.randint(7, 90))).strftime("%Y-%m-%d %H:%M:%S") if is_won else "",
            "razon_perdida": random.choice(RAZONES_PERDIDA) if is_lost else "",
            "descuento_pct": random.choice([0, 5, 10, 15, 20]) if is_won else 0,
            "es_recompra": random.choice([True, False]) if is_won else False,
            "es_cliente_activo": True if is_won else False,
            "producto_cierre": random.choice(PRODUCTOS_CIERRE) if is_won else "",
            "fuente_origen": random.choice(FUENTE_ORIGEN),
            "tipo_transaccion": random.choice(TIPO_TRANSACCION) if is_won else "",
            "notas_vendedor": random.choice([
                "Muy interesado, buen perfil",
                "Requiere aprobación de dirección",
                "Compara con 2 competidores",
                "Presupuesto limitado este trimestre",
                "Decide en 2 semanas",
                "Excelente cierre, pide referidos",
                ""
            ])
        })
    return pd.DataFrame(rows)


def gen_fact_interacciones(df_leads, df_deals, df_vendedores):
    vendedores = df_vendedores["id_vendedor"].tolist()
    rows = []
    for i in range(1, N_INTERACCIONES + 1):
        is_deal = random.random() < 0.4
        if is_deal and len(df_deals) > 0:
            deal = df_deals.sample(1).iloc[0]
            id_lead = deal["id_lead"]
            id_deal = deal["id_deal"]
            id_vendedor = deal["id_vendedor_ae"]
        else:
            lead = df_leads.sample(1).iloc[0]
            id_lead = lead["id_lead"]
            id_deal = None
            id_vendedor = lead.get("id_vendedor_sdr") or random.choice(vendedores)

        fecha_base = random_date(DATE_START, DATE_END)
        tipo = random.choice(TIPO_INTERACCION)
        resultado = random.choice(RESULTADO_INTERACCION)

        rows.append({
            "id_interaccion": i,
            "id_lead": id_lead,
            "id_deal": id_deal if id_deal and not pd.isna(id_deal) else None,
            "id_vendedor": int(id_vendedor) if id_vendedor and not pd.isna(id_vendedor) else random.choice(vendedores),
            "tipo_interaccion": tipo,
            "resultado": resultado,
            "numero_toque": random.randint(1, 12),
            "timestamp": fecha_base.strftime("%Y-%m-%d %H:%M:%S"),
            "duracion_seg": random.randint(15, 600) if tipo == "Teléfono" and resultado == "Contestó" else None,
            "notas": random.choice([
                "Llamada breve, pide callback",
                "Buena conversación, agenda demo",
                "No contesta, buzón de voz",
                "WhatsApp leído sin respuesta",
                "Confirma interés",
                "Pide más información por correo",
                ""
            ])
        })
    return pd.DataFrame(rows)


def gen_fact_calificacion(df_leads):
    # Only for leads that have been qualified
    qualified = df_leads[df_leads["status"].isin(["Calificado", "Paso a Ventas", "En Seguimiento"])]
    rows = []
    for i, (_, lead) in enumerate(qualified.iterrows(), 1):
        si_no = lambda: random.choice(["Sí", "No", "Parcialmente", ""])
        rows.append({
            "id_calificacion": i,
            "id_lead": lead["id_lead"],
            "entendio_info_marketing": si_no(),
            "mostro_interes_genuino": si_no(),
            "necesidad_puntual": random.choice([
                "Necesita CRM", "Busca membresía", "Quiere capacitación",
                "Necesita software", "Busca consultoría", ""
            ]),
            "perfil_adecuado": si_no(),
            "necesita_decision_tercero": si_no(),
            "tiene_presupuesto": si_no(),
            "monto_presupuesto": random.choice(["< $5,000", "$5,000-$20,000", "$20,000-$50,000", "> $50,000", ""]),
            "asociacion_industria": si_no(),
            "region": random.choice(REGIONES + [""]),
            "tipo_membresia": random.choice(MEMBERSHIP_TYPES + [""]),
            "fecha_calificacion": (datetime.strptime(lead["fecha_ingreso"], "%Y-%m-%d %H:%M:%S") + timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d %H:%M:%S")
        })
    return pd.DataFrame(rows)


def gen_cat_opciones():
    """Catálogo unificado de opciones (reemplaza la hoja Catalogs de 42 columnas)"""
    rows = []
    i = 1

    catalogs = {
        "Status Lead": STATUS_LEAD,
        "Calidad de Contacto": CALIDAD_CONTACTO,
        "Status de Venta": STATUS_VENTA,
        "Razón de Pérdida": RAZONES_PERDIDA,
        "Tipo de Seguimiento": TIPO_SEGUIMIENTO,
        "Status Seguimiento": STATUS_SEGUIMIENTO,
        "Tipo de Interacción": TIPO_INTERACCION,
        "Resultado Interacción": RESULTADO_INTERACCION,
        "Producto Cierre": PRODUCTOS_CIERRE,
        "Fuente de Origen": FUENTE_ORIGEN,
        "Tipo de Transacción": TIPO_TRANSACCION,
        "Región": REGIONES,
        "Membership Type": MEMBERSHIP_TYPES,
        "Attraction": ATTRACTIONS,
        "Pricing Tier": PRICING_TIERS,
        "Servicio": SERVICIOS,
        "Proyección": ["Alta", "Media", "Baja"],
        "Descuento": ["0%", "5%", "10%", "15%", "20%", "25%"],
    }

    for categoria, valores in catalogs.items():
        for orden, valor in enumerate(valores, 1):
            rows.append({
                "id_opcion": i,
                "categoria": categoria,
                "valor": valor,
                "orden": orden,
                "activo": True
            })
            i += 1

    return pd.DataFrame(rows)


def gen_log_transacciones(df_leads, df_deals, df_vendedores):
    """Log unificado de auditoría"""
    rows = []
    vendedor_emails = df_vendedores["email"].tolist()
    campos_lead = ["Status", "Calidad de Contacto", "Vendedor SDR", "Notas", "Tipo de Seguimiento"]
    campos_deal = ["Status de Venta", "Monto Proyección", "Vendedor AE", "Notas Vendedor", "Descuento"]

    i = 1
    # Logs de leads
    for _ in range(150):
        rows.append({
            "id_log": i,
            "timestamp": random_date(DATE_START, DATE_END).strftime("%Y-%m-%d %H:%M:%S"),
            "entidad": "Lead",
            "id_entidad": random.randint(1, N_LEADS),
            "usuario": random.choice(vendedor_emails),
            "campo_modificado": random.choice(campos_lead),
            "valor_anterior": random.choice(STATUS_LEAD + [""]),
            "valor_nuevo": random.choice(STATUS_LEAD)
        })
        i += 1

    # Logs de deals
    for _ in range(100):
        rows.append({
            "id_log": i,
            "timestamp": random_date(DATE_START, DATE_END).strftime("%Y-%m-%d %H:%M:%S"),
            "entidad": "Deal",
            "id_entidad": random.randint(1, N_DEALS),
            "usuario": random.choice(vendedor_emails),
            "campo_modificado": random.choice(campos_deal),
            "valor_anterior": random.choice(STATUS_VENTA + [""]),
            "valor_nuevo": random.choice(STATUS_VENTA)
        })
        i += 1

    return pd.DataFrame(rows)


def gen_config_users():
    rows = []
    for email, nombre, rol in VENDEDORES_DATA:
        rows.append({
            "email": email,
            "nombre": nombre,
            "rol": rol,
            "activo": True,
            "conectado": random.choice([True, False]),
            "ultimo_clockin": random_date(DATE_END - timedelta(days=7), DATE_END).strftime("%Y-%m-%d %H:%M:%S")
        })
    return pd.DataFrame(rows)


# ============================================================
# HOJA DE DOCUMENTACIÓN DEL MODELO
# ============================================================

def gen_documentacion():
    rows = [
        {"Tabla": "dim_contactos", "Tipo": "Dimensión", "Descripción": "Datos de contacto de cada persona/empresa. Un contacto puede tener múltiples leads.",
         "Clave Primaria": "id_contacto", "Relaciones": "→ fact_leads, fact_deals"},
        {"Tabla": "dim_campanas", "Tipo": "Dimensión", "Descripción": "Campañas de marketing (UTM params). Permite analizar ROI por campaña.",
         "Clave Primaria": "id_campana", "Relaciones": "→ fact_leads"},
        {"Tabla": "dim_vendedores", "Tipo": "Dimensión", "Descripción": "Vendedores SDR y AE. Rol define permisos y asignación.",
         "Clave Primaria": "id_vendedor", "Relaciones": "→ fact_leads, fact_deals, fact_interacciones"},
        {"Tabla": "dim_productos", "Tipo": "Dimensión", "Descripción": "Catálogo de productos/membresías con pricing por región y tier.",
         "Clave Primaria": "id_producto", "Relaciones": "→ fact_deals"},
        {"Tabla": "fact_leads", "Tipo": "Hechos", "Descripción": "Cada lead (prospecto) con su ciclo de vida SDR. Tabla central del funnel superior.",
         "Clave Primaria": "id_lead", "Relaciones": "← dim_contactos, dim_campanas, dim_vendedores → fact_deals"},
        {"Tabla": "fact_deals", "Tipo": "Hechos", "Descripción": "Oportunidades de venta (pipeline AE). Cada deal nace de un lead.",
         "Clave Primaria": "id_deal", "Relaciones": "← fact_leads, dim_contactos, dim_vendedores, dim_productos"},
        {"Tabla": "fact_interacciones", "Tipo": "Hechos", "Descripción": "REEMPLAZA las 18+ columnas de 'Contestó/No Contestó'. Cada fila = 1 intento de contacto.",
         "Clave Primaria": "id_interaccion", "Relaciones": "← fact_leads, fact_deals, dim_vendedores"},
        {"Tabla": "fact_calificacion", "Tipo": "Hechos", "Descripción": "Respuestas BANT y calificación del lead. Antes eran columnas dentro de Leads.",
         "Clave Primaria": "id_calificacion", "Relaciones": "← fact_leads"},
        {"Tabla": "cat_opciones", "Tipo": "Catálogo", "Descripción": "REEMPLAZA la hoja Catalogs de 42 columnas. Todas las opciones de dropdown en una tabla vertical.",
         "Clave Primaria": "id_opcion", "Relaciones": "Referenciada por todas las tablas para validación"},
        {"Tabla": "log_transacciones", "Tipo": "Log", "Descripción": "Log unificado de auditoría. REEMPLAZA Transacciones_Log + Transacciones_Log_AE + Log_Leads + Log_Deals.",
         "Clave Primaria": "id_log", "Relaciones": "← fact_leads, fact_deals (por id_entidad)"},
        {"Tabla": "config_users", "Tipo": "Config", "Descripción": "Usuarios del sistema con roles y estado de conexión.",
         "Clave Primaria": "email", "Relaciones": "→ dim_vendedores (por email)"},
    ]
    return pd.DataFrame(rows)


def gen_cambios_vs_original():
    rows = [
        {"#": 1, "Problema Original": "Leads tiene 80 columnas, Deals 101 columnas",
         "Solución": "Normalización: datos de contacto → dim_contactos, UTM → dim_campanas, calificación → fact_calificacion",
         "Impacto": "Leads pasa de 80 a 14 columnas, Deals de 101 a 21 columnas"},

        {"#": 2, "Problema Original": "18 columnas 'Contestó Teléfono 1..6' / 'No Contestó Whatsapp 1..6' POR HOJA",
         "Solución": "Tabla fact_interacciones: 1 fila = 1 intento. Columnas tipo, resultado, número de toque",
         "Impacto": "Elimina 36+ columnas. Soporta toques ILIMITADOS sin agregar columnas"},

        {"#": 3, "Problema Original": "Columnas duplicadas entre Leads y Deals_AE (.1 suffixes)",
         "Solución": "dim_contactos compartida. Deal referencia al Lead por id_lead (FK)",
         "Impacto": "Cero duplicación de datos de contacto"},

        {"#": 4, "Problema Original": "Catalogs: 42 columnas horizontales, difícil de mantener",
         "Solución": "cat_opciones vertical: columnas (categoria, valor, orden, activo)",
         "Impacto": "Agregar un catálogo = 1 INSERT, no una nueva columna"},

        {"#": 5, "Problema Original": "4 hojas de logs separadas (Transacciones_Log, Log_Leads, Log_Deals, Log_AE)",
         "Solución": "log_transacciones unificado con campo 'entidad' (Lead/Deal)",
         "Impacto": "1 sola tabla de auditoría, consultas más simples"},

        {"#": 6, "Problema Original": "Datos de calificación BANT mezclados con datos operativos del lead",
         "Solución": "fact_calificacion como tabla separada, linked por id_lead",
         "Impacto": "Leads más limpio, calificación independiente y reutilizable"},

        {"#": 7, "Problema Original": "Pricing hardcodeado o disperso entre hojas",
         "Solución": "dim_productos: catálogo completo región×tipo×tier con precios",
         "Impacto": "Pricing consultable por FK, cambios en un solo lugar"},

        {"#": 8, "Problema Original": "Índices de columna hardcodeados en Code.js (col 23, 25, 42...)",
         "Solución": "Con tablas normalizadas, cada tabla tiene su propio esquema limpio. El código usa nombres de columna.",
         "Impacto": "Agregar/quitar campos no rompe el código"},

        {"#": 9, "Problema Original": "syncMirrorStatus_ duplica datos entre Leads↔Deals",
         "Solución": "fact_deals tiene FK a fact_leads. El status vive en UN solo lugar.",
         "Impacto": "Elimina sync bidireccional, elimina inconsistencias"},

        {"#": 10, "Problema Original": "No hay modelo dimensional para analytics/dashboards",
         "Solución": "Esquema estrella: dimensiones (contacto, campaña, vendedor, producto) + hechos (leads, deals, interacciones)",
         "Impacto": "Permite pivots, drill-down por campaña, vendedor, región, producto sin transformaciones"},
    ]
    return pd.DataFrame(rows)


# ============================================================
# MAIN: GENERAR Y EXPORTAR
# ============================================================

def main():
    print("Generando dimensiones...")
    df_vendedores = gen_dim_vendedores()
    df_contactos = gen_dim_contactos()
    df_campanas = gen_dim_campanas()
    df_productos = gen_dim_productos()

    print("Generando tablas de hechos...")
    df_leads = gen_fact_leads(df_contactos, df_campanas, df_vendedores)
    df_deals = gen_fact_deals(df_leads, df_vendedores, df_productos)
    df_interacciones = gen_fact_interacciones(df_leads, df_deals, df_vendedores)
    df_calificacion = gen_fact_calificacion(df_leads)

    print("Generando catálogos y logs...")
    df_catalogo = gen_cat_opciones()
    df_log = gen_log_transacciones(df_leads, df_deals, df_vendedores)
    df_config = gen_config_users()

    print("Generando documentación...")
    df_docs = gen_documentacion()
    df_cambios = gen_cambios_vs_original()

    print(f"Escribiendo a {OUTPUT_PATH}...")
    with pd.ExcelWriter(OUTPUT_PATH, engine="openpyxl") as writer:
        # Documentación primero
        df_docs.to_excel(writer, sheet_name="MODELO_DATOS", index=False)
        df_cambios.to_excel(writer, sheet_name="CAMBIOS_VS_ORIGINAL", index=False)

        # Dimensiones
        df_contactos.to_excel(writer, sheet_name="dim_contactos", index=False)
        df_campanas.to_excel(writer, sheet_name="dim_campanas", index=False)
        df_vendedores.to_excel(writer, sheet_name="dim_vendedores", index=False)
        df_productos.to_excel(writer, sheet_name="dim_productos", index=False)

        # Hechos
        df_leads.to_excel(writer, sheet_name="fact_leads", index=False)
        df_deals.to_excel(writer, sheet_name="fact_deals", index=False)
        df_interacciones.to_excel(writer, sheet_name="fact_interacciones", index=False)
        df_calificacion.to_excel(writer, sheet_name="fact_calificacion", index=False)

        # Catálogos y config
        df_catalogo.to_excel(writer, sheet_name="cat_opciones", index=False)
        df_log.to_excel(writer, sheet_name="log_transacciones", index=False)
        df_config.to_excel(writer, sheet_name="config_users", index=False)

    print(f"\n{'='*60}")
    print(f"ARCHIVO GENERADO: {OUTPUT_PATH}")
    print(f"{'='*60}")
    print(f"\nResumen de tablas:")
    print(f"  dim_contactos:      {len(df_contactos):>5} filas x {len(df_contactos.columns)} cols")
    print(f"  dim_campanas:       {len(df_campanas):>5} filas x {len(df_campanas.columns)} cols")
    print(f"  dim_vendedores:     {len(df_vendedores):>5} filas x {len(df_vendedores.columns)} cols")
    print(f"  dim_productos:      {len(df_productos):>5} filas x {len(df_productos.columns)} cols")
    print(f"  fact_leads:         {len(df_leads):>5} filas x {len(df_leads.columns)} cols")
    print(f"  fact_deals:         {len(df_deals):>5} filas x {len(df_deals.columns)} cols")
    print(f"  fact_interacciones: {len(df_interacciones):>5} filas x {len(df_interacciones.columns)} cols")
    print(f"  fact_calificacion:  {len(df_calificacion):>5} filas x {len(df_calificacion.columns)} cols")
    print(f"  cat_opciones:       {len(df_catalogo):>5} filas x {len(df_catalogo.columns)} cols")
    print(f"  log_transacciones:  {len(df_log):>5} filas x {len(df_log.columns)} cols")
    print(f"  config_users:       {len(df_config):>5} filas x {len(df_config.columns)} cols")

    total_cols_antes = 80 + 101 + 42 + 6 + 6 + 6 + 6  # Leads + Deals + Catalogs + 4 logs
    total_cols_ahora = sum(len(df.columns) for df in [
        df_contactos, df_campanas, df_vendedores, df_productos,
        df_leads, df_deals, df_interacciones, df_calificacion,
        df_catalogo, df_log, df_config
    ])
    print(f"\n  Total columnas ANTES:  {total_cols_antes} (distribuidas en hojas gigantes)")
    print(f"  Total columnas AHORA:  {total_cols_ahora} (distribuidas en tablas normalizadas)")
    print(f"  Columna máxima por tabla: {max(len(df.columns) for df in [df_leads, df_deals, df_interacciones])} (vs 101 antes)")


if __name__ == "__main__":
    main()
