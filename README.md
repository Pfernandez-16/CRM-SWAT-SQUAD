# CRM SWAT Squad

Este repositorio contiene el código fuente, la documentación y el contexto histórico del CRM SWAT Squad, una herramienta web a la medida construida sobre **Google Apps Script**, **Vue 3** y **Google Sheets**.

---

## 📜 Historia y Contexto (Cómo empezó)

El proyecto nació a partir de las necesidades del equipo comercial (documentadas en la **transcripción de la reunión del 02.26** y el **Manual de Proceso de Gestión de Leads**). Los retos y requerimientos iniciales fueron:

1. **Gestión Integral y Omnicanalidad**: Necesidad de capturar leads directamente desde landing pages (sin Zapier), registrar meticulosamente cada "toque" (llamada, WhatsApp, correo) y medir la contactabilidad.
2. **División Estricta de Roles comerciales**: 
   - **SDR (Sales Development Reps)**: Encargados de la prospección, calificación con metodología BANT (Budget, Authority, Need, Timing) y maduración del lead.
   - **AE (Account Executives)**: Encargados de recibir las oportunidades calificadas ("Paso a Ventas") para cotizar, negociar y cerrar.
3. **Reportería Crítica**: Necesidad de tableros de Business Intelligence (BI) para analizar conversiones, contactabilidad vertical e histórica (Mes contra Mes, Año contra Año), y cálculo de proyecciones basadas en modelos de precios complejos (SaaS, igualas mensuales y proyectos).

---

## 🚀 Estado Actual (Dónde estamos ahora)

Actualmente, el proyecto se encuentra en su **Versión 7**, operando con una arquitectura robusta, serverless y "Free-Tier Native" sobre el ecosistema de Google Workspace. 

Toda la documentación técnica se encuentra en el archivo `crm_manual_desarrollador.md` y `CRM_Update_Summary.md`. 

### Arquitectura Técnica
- **Frontend**: Una Single-Page Application (SPA) construida en **Vue 3** + **Tailwind CSS**. Implementa vistas dinámicas (Tabla y Kanban interactivo mediante SortableJS) integradas en un solo archivo `App.html`.
- **Backend API**: Google Apps Script (`Código.js`) maneja la lógica de negocio, validaciones y la comunicación asíncrona mediante `google.script.run`.
- **Base de Datos**: Un modelo "Star Schema" (Esquema de Estrella v6) alojado en Google Sheets, dividiendo la información en hechos (`fact_leads`, `fact_deals`, `fact_interacciones`) y dimensiones (`dim_contactos`, `dim_vendedores`, catálogos).

### Funcionalidades Clave Implementadas
1. **Flujo SDR a AE (Handoff)**: Traspaso inteligente y restrictivo. Cuando un SDR arrastra una tarjeta a "Paso a Ventas", se exige el llenado de un formulario BANT y la creación automática de una oportunidad de venta ligada en `fact_deals`.
2. **Auditoría Continua**: Cada cambio y toque queda registrado en tablas transaccionales (`log_transacciones` y `fact_interacciones`), permitiendo trazabilidad perfecta.
3. **Módulo Administrativo y SLAs**: Herramientas para gestionar usuarios (CRUD), forzar autenticación (Clock-In/Clock-Out) y parametrizar reglas de negocio o SLAs ocultos en la base de datos (HMN Variables).
4. **Vistas Separadas**: Modos de visualización de Pistas (Pipeline y Tabla) que cargan diferentes datos y columnas dependiendo del rol conectado (Prospectos para SDRs, Negociaciones para AEs).

---

## 📁 Documentos de Contexto Relevantes en el Repositorio

Para profundizar en el proyecto, revisa la siguiente documentación adjunta:
- `TRANSCRIPCIÓN _ (CRM _ Pedro _ Chris) _ SWAT SQUAD _ 02.26.md`: Los requerimientos de negocio de voz del cliente.
- `Manual de Proceso CRM_ Gestión de Leads.txt`: El estándar del flujo operativo de ventas.
- `crm_manual_desarrollador.md`: Guía técnica exhaustiva con arquitectura, diagramas de bases de datos y convenciones de código.
- `CRM_Update_Summary.md`: Resumen detallado de las soluciones de UI/UX, Backend y bugs manejados en las últimas actualizaciones.
- Carpeta `.planning/`: Documentos de estado, hoja de ruta y visión del sistema.
