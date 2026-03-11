"""
Generate realistic CRM test data for Jan-Mar 2026.
Pattern: Month-over-month growth (Jan weak → Feb better → Mar strongest).

Outputs TSV files per table that can be pasted directly into Google Sheets.
Reference tables (dim_vendedores, dim_campanas, dim_productos, cat_opciones, config_users) are NOT modified.

Usage: python data/generate_test_data.py
Output: data/output/*.tsv
"""

import random
import csv
import os
from datetime import datetime, timedelta

random.seed(42)  # Reproducible

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============ CONSTANTS ============

NOMBRES = [
    "Santiago", "Valentina", "Mateo", "Isabella", "Sebastián", "Camila", "Alejandro",
    "Sofía", "Daniel", "Mariana", "Andrés", "Luciana", "Diego", "Gabriela", "Nicolás",
    "Carolina", "Fernando", "Paula", "Ricardo", "Andrea", "Miguel", "Laura", "Carlos",
    "María", "Eduardo", "Ana", "Roberto", "Claudia", "Francisco", "Diana", "Jorge",
    "Mónica", "Luis", "Patricia", "Rafael", "Natalia", "Javier", "Catalina", "Tomás",
    "Fernanda", "Emilio", "Daniela", "Hugo", "Jimena", "Pablo", "Lorena", "Martín",
    "Adriana", "Gabriel", "Verónica", "Manuel", "Beatriz", "Oscar", "Rosa", "Alberto",
    "Carmen", "Raúl", "Gloria", "Alfredo", "Teresa", "Esteban", "Silvia", "Iván",
    "Marta", "Germán", "Alicia", "Joaquín", "Elena", "Ramón", "Cecilia"
]

APELLIDOS = [
    "García", "Rodríguez", "Martínez", "López", "González", "Hernández", "Pérez",
    "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz",
    "Morales", "Reyes", "Gutiérrez", "Ortiz", "Ramos", "Vargas", "Castillo", "Jiménez",
    "Rojas", "Aguilar", "Mendoza", "Medina", "Castro", "Herrera", "Vega", "Ruiz",
    "Navarro", "Delgado", "Ponce", "Salazar", "Guerrero", "Campos", "Ríos", "Figueroa",
    "Acosta", "Molina", "Silva", "Domínguez", "Cortés", "Paredes", "Estrada", "Valenzuela",
    "León", "Espinoza", "Montes", "Sandoval", "Ochoa", "Miranda", "Fuentes", "Contreras"
]

EMPRESAS = [
    "Grupo Industrial MX", "TechLatam Solutions", "Fabricaciones del Sur", "Innovación Digital",
    "Metal Works SA", "Textiles Modernos", "Consultoría Integral", "Alimentos del Pacífico",
    "Construcciones Unidas", "Logística Express", "Corporativo Norte", "Manufactura Premium",
    "Green Energy LATAM", "BioFarma Continental", "Automotriz Central", "Electrónica Global",
    "Minera del Valle", "Agroindustrias Real", "Plásticos Avanzados", "Química Especializada",
    "TransCargo SA", "Aceros Industriales", "Papel y Cartón MX", "Maquinaria Pesada",
    "Cemento del Golfo", "Vidrio y Cristal", "Aluminios del Norte", "Empaques Sustentables",
    "Textil Orgánico", "Pinturas Internacionales", "Caucho y Derivados", "Envases PET",
    "Productos Lácteos", "Bebidas del Valle", "Snacks Premium", "Fertilizantes del Campo",
    "Software Empresarial", "Cloud Services MX", "Cybersecurity Corp", "Fintech Soluciones",
    "EdTech Innovación", "HealthTech Partners", "PropTech Desarrollo", "AgriTech Solutions",
    "RetailTech Global", "MediaTech Creative", "Industrias Omega", "Corporativo Atlas",
    "Grupo Vanguardia", "Soluciones Integradas"
]

AREAS = [None, "Ventas", "Marketing", "RRHH", "Operaciones", "TI", "Finanzas", "Dirección", "Compras", "Producción"]
PAISES_CIUDADES = [
    ("México", ["CDMX", "Monterrey", "Guadalajara", "Puebla", "Querétaro", "Tijuana", "León"]),
    ("Colombia", ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"]),
    ("Argentina", ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"]),
    ("Chile", ["Santiago", "Valparaíso", "Concepción"]),
    ("Perú", ["Lima", "Arequipa", "Trujillo"]),
    ("Costa Rica", ["San José"]),
    ("Uruguay", ["Montevideo"]),
    ("Panamá", ["Ciudad de Panamá"]),
    ("Ecuador", ["Quito", "Guayaquil"]),
]
EMPLEADOS_OPTS = [None, "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]
NIVELES = ["CEO", "VP", "Director", "Gerente", "Coordinador", "Analista", "Especialista", "Jefe de Área"]

# Lead statuses with monthly weights (growth pattern)
STATUS_WEIGHTS = {
    "jan": {
        "Nuevo": 5, "Contactado": 10, "En Seguimiento": 18, "Calificado": 12,
        "No Calificado": 10, "Contactado sin Respuesta": 5, "Paso a Ventas": 8,
        "Perdido": 25, "Duplicado": 4, "Inválido": 3
    },
    "feb": {
        "Nuevo": 4, "Contactado": 9, "En Seguimiento": 20, "Calificado": 16,
        "No Calificado": 8, "Contactado sin Respuesta": 4, "Paso a Ventas": 12,
        "Perdido": 20, "Duplicado": 4, "Inválido": 3
    },
    "mar": {
        "Nuevo": 6, "Contactado": 8, "En Seguimiento": 18, "Calificado": 20,
        "No Calificado": 6, "Contactado sin Respuesta": 3, "Paso a Ventas": 16,
        "Perdido": 16, "Duplicado": 4, "Inválido": 3
    }
}

CALIDAD_WEIGHTS = {
    "jan": {"Excelente": 10, "Bueno": 20, "Regular": 30, "Malo": 25, "Sin Calificar": 15},
    "feb": {"Excelente": 15, "Bueno": 25, "Regular": 25, "Malo": 20, "Sin Calificar": 15},
    "mar": {"Excelente": 20, "Bueno": 30, "Regular": 25, "Malo": 15, "Sin Calificar": 10},
}

SERVICIO_INTERES = [None, "Membresía Básica", "Membresía Premium", "Membresía Enterprise", "Consultoría", "Capacitación", "Software CRM"]
TIPO_SEGUIMIENTO = ["Llamada", "WhatsApp", "Email", "Reunión presencial", "Videollamada"]
STATUS_SEGUIMIENTO = ["Activo", "Pausado", "Cerrado", "Cancelado", "Esperando respuesta"]
TIPO_INTERACCION = ["Telefono", "WhatsApp", "Correo"]  # Sin accents to match Analytics.js
RESULTADO_INTERACCION = ["Contesto", "No Contesto"]  # Sin accents to match Analytics.js
NOTAS_LEAD = [
    "Agenda reunión próxima semana", "Sin interés en este momento", "Pidió propuesta formal",
    "Muy interesado, buen perfil", "Quiere demo del producto", "Presupuesto limitado",
    "Necesita aprobación de directivos", "Comparando con competidores", "Pide más información",
    "Callback la próxima semana", "Interesado en membership premium", "No contesta llamadas",
    "Respondió por WhatsApp, positivo", "Quiere reunión presencial", "Esperando presupuesto Q2",
    "Excelente prospecto", "Referido por cliente actual", "Necesita cotización personalizada",
    None, None, None, None  # Some nulls
]

# Calificacion
NECESIDAD_OPTS = ["Necesita CRM", "Busca membresía", "Quiere capacitación", "Busca networking",
                  "Necesita certificación", "Quiere expandir mercado", "Busca proveedores"]
MONTO_PRESUPUESTO_OPTS = ["< $5,000", "$5,000-$20,000", "$20,000-$50,000", "> $50,000"]
SI_NO_PARCIAL = ["Sí", "No", "Parcialmente"]
REGIONES = ["Norteamérica", "Latinoamérica", "Europa", "Asia-Pacífico"]
TIPO_MEMBRESIA = ["Manufacturers", "Individuals", "Attraction"]
MEMBRESIA_WEIGHTS = [55, 30, 15]  # Distribution for segmentation

# Deals
STATUS_VENTA = ["Recien llegado", "Contactado", "En negociación", "Propuesta enviada",
                "Apartado", "Vendido", "Perdido", "Stand-by", "Reagendado",
                "No contesta", "Número equivocado", "No interesado", "Duplicado", "Inválido"]
DEAL_STATUS_WEIGHTS = {
    "jan": {"Vendido": 8, "Perdido": 20, "En negociación": 15, "Propuesta enviada": 12,
            "Apartado": 10, "Stand-by": 10, "Contactado": 8, "Recien llegado": 5,
            "Reagendado": 5, "No contesta": 4, "No interesado": 3},
    "feb": {"Vendido": 12, "Perdido": 16, "En negociación": 18, "Propuesta enviada": 14,
            "Apartado": 12, "Stand-by": 8, "Contactado": 6, "Recien llegado": 4,
            "Reagendado": 4, "No contesta": 3, "No interesado": 3},
    "mar": {"Vendido": 18, "Perdido": 14, "En negociación": 20, "Propuesta enviada": 15,
            "Apartado": 14, "Stand-by": 6, "Contactado": 4, "Recien llegado": 3,
            "Reagendado": 3, "No contesta": 2, "No interesado": 1},
}
PROYECCION_OPTS = ["Alta", "Media", "Baja"]
RAZON_PERDIDA = [
    "Sin presupuesto", "Eligió competidor", "No responde", "Timing inadecuado",
    "No tiene poder de decisión", "Producto no se ajusta", "Cambio de prioridades",
    "Mala experiencia previa", "Precio muy alto", "Proceso interno largo",
    "Se fue con otra solución", "No era el perfil", "Empresa cerró"
]
RAZON_PERDIDA_WEIGHTS = [15, 12, 10, 8, 7, 8, 6, 3, 10, 5, 8, 5, 3]
PRODUCTO_CIERRE = ["1 Year Membership", "2 Year Membership", "Premium Package", "Enterprise Bundle"]
FUENTE_ORIGEN = ["Inbound", "Outbound", "Referido", "Evento", "Partner", "Webinar"]
FUENTE_WEIGHTS = [30, 25, 15, 12, 10, 8]
TIPO_TRANSACCION = ["Nueva venta", "Renovación", "Upgrade", "Cross-sell", "Re-compra"]
TIPO_TRANSACCION_WEIGHTS = [40, 20, 15, 15, 10]
NOTAS_VENDEDOR = [
    "Muy interesado, buen perfil", "Compara con 2 competidores", "Presupuesto limitado este trimestre",
    "Quiere cerrar antes de fin de mes", "Necesita aprobación de junta", "En proceso de evaluación interna",
    "Pidió descuento adicional", "Interesado en paquete premium", "Referido de cliente satisfecho",
    "Empresa en crecimiento, buen momento", "Tiene urgencia por certificación", "Esperando respuesta de dirección",
    None, None
]


# ============ HELPERS ============

def weighted_choice(options_weights):
    """Pick from dict of {option: weight}."""
    options = list(options_weights.keys())
    weights = list(options_weights.values())
    return random.choices(options, weights=weights, k=1)[0]

def weighted_choice_list(options, weights):
    """Pick from parallel lists."""
    return random.choices(options, weights=weights, k=1)[0]

def random_date(start, end):
    """Random datetime between start and end."""
    delta = end - start
    random_seconds = random.randint(0, max(int(delta.total_seconds()), 1))
    return start + timedelta(seconds=random_seconds)

def format_dt(dt):
    """Format datetime as 'YYYY-MM-DD HH:MM:SS'."""
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def format_date(dt):
    """Format date as 'YYYY-MM-DD'."""
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d")

def random_phone():
    """Generate random LATAM phone number."""
    prefix = random.choice(["+52", "+57", "+54", "+56", "+51", "+506", "+598", "+507", "+593"])
    n1 = random.randint(100, 999)
    n2 = random.randint(100, 999)
    n3 = random.randint(1000, 9999)
    return f"{prefix} {n1} {n2} {n3}"

def month_key(dt):
    """Return 'jan', 'feb', or 'mar'."""
    return {1: "jan", 2: "feb", 3: "mar"}[dt.month]


def write_tsv(filename, headers, rows):
    """Write TSV file."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(headers)
        for row in rows:
            writer.writerow(["" if v is None else v for v in row])
    print(f"  {filename}: {len(rows)} rows")


# ============ GENERATORS ============

def generate_contactos(count):
    """Generate dim_contactos rows."""
    rows = []
    used_emails = set()

    for i in range(1, count + 1):
        nombre = random.choice(NOMBRES)
        apellido = random.choice(APELLIDOS)

        # Unique email
        base_email = f"{nombre.lower().replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')}.{apellido.lower().replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')}"
        email = f"{base_email}@{'corporativo' if random.random() < 0.4 else 'empresa'}.{'mx' if random.random() < 0.5 else 'com'}"
        suffix = 1
        while email in used_emails:
            email = f"{base_email}{suffix}@empresa.com"
            suffix += 1
        used_emails.add(email)

        tel1 = random_phone()
        tel2 = random_phone() if random.random() < 0.15 else None
        empresa = random.choice(EMPRESAS)
        area = random.choice(AREAS)
        pais, ciudades = random.choice(PAISES_CIUDADES)
        ciudad = random.choice(ciudades)
        empleados = random.choice(EMPLEADOS_OPTS)
        nivel = random.choice(NIVELES)

        # fecha_creacion: Dec 2025 - Mar 2026
        fecha_creacion = random_date(
            datetime(2025, 12, 1),
            datetime(2026, 3, 4)
        )

        rows.append([
            i, nombre, apellido, email, tel1, tel2, empresa, area,
            pais, ciudad, empleados, nivel, format_dt(fecha_creacion)
        ])

    return rows


def generate_leads(count_per_month, contacto_ids):
    """Generate fact_leads rows with growth pattern."""
    rows = []
    lead_id = 0
    leads_meta = []  # Store metadata for other generators

    month_ranges = {
        "jan": (datetime(2026, 1, 1), datetime(2026, 1, 31, 23, 59, 59)),
        "feb": (datetime(2026, 2, 1), datetime(2026, 2, 28, 23, 59, 59)),
        "mar": (datetime(2026, 3, 1), datetime(2026, 3, 4, 23, 59, 59)),
    }

    contacto_idx = 0

    for month, count in count_per_month.items():
        start, end = month_ranges[month]

        for _ in range(count):
            lead_id += 1
            contacto_idx += 1
            id_contacto = contacto_ids[contacto_idx - 1] if contacto_idx <= len(contacto_ids) else contacto_idx

            id_campana = random.randint(1, 30)
            id_vendedor_sdr = random.randint(1, 5)  # SDRs are IDs 1-5

            status = weighted_choice(STATUS_WEIGHTS[month])
            calidad = weighted_choice(CALIDAD_WEIGHTS[month])
            servicio = random.choice(SERVICIO_INTERES)

            fecha_ingreso = random_date(start, end)
            fecha_asignacion = fecha_ingreso + timedelta(hours=random.randint(6, 72))

            # numero_toques depends on status
            if status in ("Nuevo",):
                numero_toques = 0
            elif status in ("Contactado", "Duplicado", "Inválido"):
                numero_toques = random.randint(1, 2)
            elif status in ("En Seguimiento", "Contactado sin Respuesta"):
                numero_toques = random.randint(2, 5)
            elif status in ("Calificado", "No Calificado"):
                numero_toques = random.randint(3, 6)
            elif status in ("Paso a Ventas",):
                numero_toques = random.randint(3, 7)
            elif status in ("Perdido",):
                numero_toques = random.randint(1, 8)
            else:
                numero_toques = random.randint(1, 4)

            fecha_ultimo = fecha_ingreso + timedelta(days=random.randint(1, 30)) if numero_toques > 0 else None

            tipo_seg = random.choice(TIPO_SEGUIMIENTO) if numero_toques > 0 else None
            status_seg = random.choice(STATUS_SEGUIMIENTO) if numero_toques > 0 else None
            notas = random.choice(NOTAS_LEAD)

            rows.append([
                lead_id, id_contacto, id_campana, id_vendedor_sdr, status, calidad,
                servicio, format_dt(fecha_ingreso), format_dt(fecha_asignacion),
                format_dt(fecha_ultimo) if fecha_ultimo else "",
                numero_toques, tipo_seg, status_seg, notas
            ])

            leads_meta.append({
                "id_lead": lead_id,
                "id_contacto": id_contacto,
                "status": status,
                "calidad": calidad,
                "fecha_ingreso": fecha_ingreso,
                "fecha_asignacion": fecha_asignacion,
                "fecha_ultimo": fecha_ultimo,
                "numero_toques": numero_toques,
                "month": month,
            })

    return rows, leads_meta


def generate_interacciones(leads_meta):
    """Generate fact_interacciones from lead metadata."""
    rows = []
    inter_id = 0

    # Channel weights: more WhatsApp, then Telefono, then Correo
    channel_weights = [35, 45, 20]  # Telefono, WhatsApp, Correo

    for lead in leads_meta:
        if lead["numero_toques"] == 0:
            continue

        fecha_base = lead["fecha_ingreso"]
        id_lead = lead["id_lead"]
        # Assign vendedor for interactions (same SDR from the lead)
        id_vendedor = random.randint(1, 5)

        for toque in range(1, lead["numero_toques"] + 1):
            inter_id += 1

            tipo = weighted_choice_list(TIPO_INTERACCION, channel_weights)

            # Contesto probability increases for earlier toques and better leads
            contesto_base = 0.40
            if lead["status"] in ("Calificado", "Paso a Ventas"):
                contesto_base = 0.55
            elif lead["status"] in ("Perdido", "No Calificado"):
                contesto_base = 0.30
            elif lead["status"] in ("Contactado sin Respuesta",):
                contesto_base = 0.10

            # Later toques slightly less likely to get Contesto
            contesto_prob = contesto_base - (toque - 1) * 0.04
            contesto_prob = max(contesto_prob, 0.08)

            resultado = "Contesto" if random.random() < contesto_prob else "No Contesto"

            # Timestamp: spread across the lead's contact period
            if lead["fecha_ultimo"]:
                ts = random_date(fecha_base + timedelta(hours=toque * 12),
                                 lead["fecha_ultimo"] + timedelta(days=1))
            else:
                ts = fecha_base + timedelta(hours=toque * random.randint(12, 48))

            duracion = random.randint(30, 600) if tipo == "Telefono" and resultado == "Contesto" else None

            nota = None
            if resultado == "Contesto" and random.random() < 0.3:
                nota = random.choice([
                    "Buena conversación, agenda demo", "Interesado, pide más info",
                    "Confirmó interés", "Quiere cotización", "Disponible siguiente semana",
                    "Positivo, agenda follow-up", "Respondió bien, buen perfil"
                ])
            elif resultado == "No Contesto" and random.random() < 0.15:
                nota = random.choice([
                    "Buzón de voz", "No disponible", "Línea ocupada",
                    "Llamada breve, pide callback", "Sin respuesta"
                ])

            rows.append([
                inter_id, id_lead, None, id_vendedor, tipo, resultado,
                toque, format_dt(ts), duracion, nota
            ])

    return rows


def generate_calificacion(leads_meta):
    """Generate fact_calificacion for qualified/progressed leads."""
    rows = []
    cal_id = 0

    # Generate calificacion for leads with certain statuses
    eligible_statuses = {"Calificado", "Paso a Ventas", "Perdido", "En Seguimiento", "No Calificado"}

    for lead in leads_meta:
        if lead["status"] not in eligible_statuses:
            continue
        if random.random() < 0.15:  # Skip ~15% even if eligible
            continue

        cal_id += 1

        # BANT fields - vary by lead quality
        if lead["status"] in ("Calificado", "Paso a Ventas"):
            # Good leads - mostly positive BANT
            entendio = random.choice(["Sí", "Sí", "Sí", "Parcialmente"])
            interes = random.choice(["Sí", "Sí", "Sí", "Parcialmente"])
            perfil = random.choice(["Sí", "Sí", "Sí", "No"])
            tercero = random.choice(["No", "No", "Parcialmente", "Sí"])
            presupuesto = random.choice(["Sí", "Sí", "Parcialmente", "No"])
        elif lead["status"] == "Perdido":
            # Lost leads - mixed/negative BANT (these feed razones no paso)
            entendio = random.choice(["No", "Parcialmente", "Sí", "No"])
            interes = random.choice(["No", "No", "Parcialmente", "Sí"])
            perfil = random.choice(["No", "No", "Sí", "Parcialmente"])
            tercero = random.choice(["Sí", "Sí", "No", "Parcialmente"])
            presupuesto = random.choice(["No", "No", "Parcialmente", "Sí"])
        else:
            # Other - random
            entendio = random.choice(SI_NO_PARCIAL)
            interes = random.choice(SI_NO_PARCIAL)
            perfil = random.choice(["Sí", "No"])
            tercero = random.choice(SI_NO_PARCIAL)
            presupuesto = random.choice(SI_NO_PARCIAL)

        necesidad = random.choice(NECESIDAD_OPTS)
        monto = random.choice(MONTO_PRESUPUESTO_OPTS) if presupuesto != "No" else random.choice(["< $5,000", "< $5,000", "$5,000-$20,000"])
        asociacion = random.choice(SI_NO_PARCIAL + [None])
        region = random.choice(REGIONES)
        tipo_mem = weighted_choice_list(TIPO_MEMBRESIA, MEMBRESIA_WEIGHTS)

        fecha_cal = lead["fecha_ingreso"] + timedelta(days=random.randint(3, 14))

        rows.append([
            cal_id, lead["id_lead"], entendio, interes, necesidad, perfil,
            tercero, presupuesto, monto, asociacion, region, tipo_mem,
            format_dt(fecha_cal)
        ])

    return rows


def generate_deals(leads_meta):
    """Generate fact_deals for leads that passed to sales."""
    rows = []
    deal_id = 0

    # Leads eligible for deals: Paso a Ventas + some Calificado
    for lead in leads_meta:
        make_deal = False
        if lead["status"] == "Paso a Ventas":
            make_deal = True
        elif lead["status"] == "Calificado" and random.random() < 0.25:
            make_deal = True

        if not make_deal:
            continue

        deal_id += 1
        month = lead["month"]

        id_vendedor_ae = random.choice([6, 7])  # AE vendedores
        id_producto = random.randint(1, 60)

        status_venta = weighted_choice(DEAL_STATUS_WEIGHTS[month])
        proyeccion = random.choice(PROYECCION_OPTS)

        monto_proyeccion = random.randint(2000, 50000)
        monto_apartado = int(monto_proyeccion * random.choice([0, 0, 0.1, 0.2, 0.3])) if status_venta in ("Apartado", "Vendido") else 0
        monto_cierre = int(monto_proyeccion * random.uniform(0.7, 1.0)) if status_venta == "Vendido" else 0

        fecha_pase = lead["fecha_asignacion"] + timedelta(days=random.randint(0, 5))
        fecha_primer_ae = fecha_pase + timedelta(hours=random.randint(4, 48))
        fecha_cierre = fecha_pase + timedelta(days=random.randint(7, 30)) if status_venta in ("Vendido", "Perdido") else None

        razon = None
        if status_venta == "Perdido":
            razon = weighted_choice_list(RAZON_PERDIDA, RAZON_PERDIDA_WEIGHTS)

        descuento = random.choice([0, 0, 0, 5, 10, 15, 20])
        es_recompra = random.random() < 0.08
        es_cliente_activo = random.random() < 0.05

        producto_cierre = random.choice(PRODUCTO_CIERRE) if status_venta == "Vendido" else None
        fuente = weighted_choice_list(FUENTE_ORIGEN, FUENTE_WEIGHTS)
        tipo_trans = weighted_choice_list(TIPO_TRANSACCION, TIPO_TRANSACCION_WEIGHTS)
        notas_v = random.choice(NOTAS_VENDEDOR)

        rows.append([
            deal_id, lead["id_lead"], lead["id_contacto"], id_vendedor_ae, id_producto,
            status_venta, proyeccion, monto_proyeccion, monto_apartado, monto_cierre,
            format_dt(fecha_pase), format_dt(fecha_primer_ae),
            format_dt(fecha_cierre) if fecha_cierre else "",
            razon, descuento, es_recompra, es_cliente_activo,
            producto_cierre, fuente, tipo_trans, notas_v
        ])

    return rows


def generate_log_transacciones(leads_meta, deals_rows):
    """Generate log_transacciones tracking status changes."""
    rows = []
    log_id = 0
    vendedor_emails = [
        "pedro.mendez@swatsquad.com", "ana.garcia@swatsquad.com",
        "carlos.lopez@swatsquad.com", "sofia.martinez@swatsquad.com",
        "maria.torres@swatsquad.com", "roberto.silva@swatsquad.com",
        "lucia.herrera@swatsquad.com"
    ]

    # Lead status changes
    for lead in leads_meta:
        # Simulate 1-3 status transitions per lead
        transitions = []
        status = lead["status"]

        if status in ("Contactado", "En Seguimiento", "Calificado", "Paso a Ventas"):
            transitions.append(("Status", "Nuevo", "Contactado"))
            if status in ("En Seguimiento", "Calificado", "Paso a Ventas"):
                transitions.append(("Status", "Contactado", "En Seguimiento"))
            if status in ("Calificado", "Paso a Ventas"):
                transitions.append(("Status", "En Seguimiento", "Calificado"))
            if status == "Paso a Ventas":
                transitions.append(("Status", "Calificado", "Paso a Ventas"))
        elif status == "Perdido":
            transitions.append(("Status", "Nuevo", "Contactado"))
            transitions.append(("Status", "Contactado", "Perdido"))
        elif status in ("Duplicado", "Inválido"):
            transitions.append(("Status", "Nuevo", status))
        elif status == "No Calificado":
            transitions.append(("Status", "Nuevo", "Contactado"))
            transitions.append(("Status", "Contactado", "No Calificado"))
        elif status == "Contactado sin Respuesta":
            transitions.append(("Status", "Nuevo", "Contactado sin Respuesta"))

        base_time = lead["fecha_ingreso"]
        for j, (campo, anterior, nuevo) in enumerate(transitions):
            log_id += 1
            ts = base_time + timedelta(hours=random.randint(12, 72) * (j + 1))
            usuario = random.choice(vendedor_emails)
            rows.append([
                log_id, format_dt(ts), "Lead", lead["id_lead"],
                usuario, campo, anterior, nuevo
            ])

        # Calidad changes (sometimes)
        if random.random() < 0.3 and lead["calidad"] != "Sin Calificar":
            log_id += 1
            ts = base_time + timedelta(days=random.randint(2, 10))
            rows.append([
                log_id, format_dt(ts), "Lead", lead["id_lead"],
                random.choice(vendedor_emails), "Calidad de Contacto",
                "Sin Calificar", lead["calidad"]
            ])

    # Deal status changes
    for deal in deals_rows:
        log_id += 1
        ts_str = deal[10]  # fecha_pase_ventas
        rows.append([
            log_id, ts_str, "Deal", deal[0],
            random.choice(vendedor_emails), "Status Venta",
            "Recien llegado", deal[5]  # status_venta
        ])

    return rows


# ============ MAIN ============

def main():
    print("Generating CRM test data (Jan-Mar 2026)...\n")

    # 1. Leads per month (growth: 80 → 100 → 120)
    count_per_month = {"jan": 80, "feb": 100, "mar": 120}
    total_leads = sum(count_per_month.values())

    # 2. Generate contactos (1:1 with leads)
    print("Generating tables:")
    contactos = generate_contactos(total_leads)
    contacto_ids = [row[0] for row in contactos]

    # 3. Generate leads
    leads_rows, leads_meta = generate_leads(count_per_month, contacto_ids)

    # 4. Generate interacciones
    interacciones = generate_interacciones(leads_meta)

    # 5. Generate calificacion
    calificacion = generate_calificacion(leads_meta)

    # 6. Generate deals
    deals = generate_deals(leads_meta)

    # 7. Generate log
    log_trans = generate_log_transacciones(leads_meta, deals)

    # Write TSV files
    print("\nWriting TSV files:")

    write_tsv("dim_contactos.tsv",
              ["id_contacto", "nombre", "apellido", "email", "telefono_1", "telefono_2",
               "empresa", "area", "pais", "ciudad", "empleados", "nivel", "fecha_creacion"],
              contactos)

    write_tsv("fact_leads.tsv",
              ["id_lead", "id_contacto", "id_campana", "id_vendedor_sdr", "status",
               "calidad_contacto", "servicio_interes", "fecha_ingreso", "fecha_asignacion",
               "fecha_ultimo_contacto", "numero_toques", "tipo_seguimiento",
               "status_seguimiento", "notas"],
              leads_rows)

    write_tsv("fact_interacciones.tsv",
              ["id_interaccion", "id_lead", "id_deal", "id_vendedor", "tipo_interaccion",
               "resultado", "numero_toque", "timestamp", "duracion_seg", "notas"],
              interacciones)

    write_tsv("fact_calificacion.tsv",
              ["id_calificacion", "id_lead", "entendio_info_marketing", "mostro_interes_genuino",
               "necesidad_puntual", "perfil_adecuado", "necesita_decision_tercero",
               "tiene_presupuesto", "monto_presupuesto", "asociacion_industria",
               "region", "tipo_membresia", "fecha_calificacion"],
              calificacion)

    write_tsv("fact_deals.tsv",
              ["id_deal", "id_lead", "id_contacto", "id_vendedor_ae", "id_producto",
               "status_venta", "proyeccion", "monto_proyeccion", "monto_apartado",
               "monto_cierre", "fecha_pase_ventas", "fecha_primer_contacto_ae",
               "fecha_cierre", "razon_perdida", "descuento_pct", "es_recompra",
               "es_cliente_activo", "producto_cierre", "fuente_origen",
               "tipo_transaccion", "notas_vendedor"],
              deals)

    write_tsv("log_transacciones.tsv",
              ["id_log", "timestamp", "entidad", "id_entidad", "usuario",
               "campo_modificado", "valor_anterior", "valor_nuevo"],
              log_trans)

    # Print summary stats
    print(f"\n{'='*50}")
    print(f"SUMMARY")
    print(f"{'='*50}")
    print(f"  dim_contactos:      {len(contactos)} contacts")
    print(f"  fact_leads:         {len(leads_rows)} leads (Jan:{count_per_month['jan']}, Feb:{count_per_month['feb']}, Mar:{count_per_month['mar']})")
    print(f"  fact_interacciones: {len(interacciones)} interactions")
    print(f"  fact_calificacion:  {len(calificacion)} qualifications")
    print(f"  fact_deals:         {len(deals)} deals")
    print(f"  log_transacciones:  {len(log_trans)} log entries")

    # Status distribution
    print(f"\nLead status distribution:")
    status_counts = {}
    for lead in leads_meta:
        s = lead["status"]
        status_counts[s] = status_counts.get(s, 0) + 1
    for s, c in sorted(status_counts.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c} ({c/len(leads_meta)*100:.0f}%)")

    # Deal status distribution
    print(f"\nDeal status distribution:")
    deal_status_counts = {}
    for deal in deals:
        s = deal[5]
        deal_status_counts[s] = deal_status_counts.get(s, 0) + 1
    for s, c in sorted(deal_status_counts.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c} ({c/len(deals)*100:.0f}%)")

    print(f"\nFiles saved to: {os.path.abspath(OUTPUT_DIR)}")
    print("\nInstructions:")
    print("  1. Open each .tsv file in a text editor")
    print("  2. Select ALL content (Ctrl+A), Copy (Ctrl+C)")
    print("  3. In Google Sheets, go to the matching tab")
    print("  4. Select cell A1, paste (Ctrl+V)")
    print("  5. Delete any extra old rows below the new data")


if __name__ == "__main__":
    main()
