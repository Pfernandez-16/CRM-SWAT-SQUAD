# CRM SWAT Squad v7 — Resumen de Actualizaciones y Arquitectura

Este documento sirve como "walkthrough" o resumen completo de todas las implementaciones y cambios estructurales realizados recientemente en el CRM SWAT Squad. Su propósito es brindar contexto detallado a cualquier otro desarrollador que vaya a continuar con la optimización del sistema.

## 1. Cambios Arquitectónicos (Frontend & UI/UX)

Se refactorizó la interfaz de usuario en `App.html` y `Index.html` (Vue 3 + Tailwind CSS) para dividir claramente los flujos de trabajo según el rol del usuario (SDR vs. Account Executive).

### Módulo SDR: "Prospectos"
- **Nomenclatura**: Se renombró la vista "Leads" a "Prospectos".
- **Visualización Dual**: Se implementó la capacidad de alternar (toggle) entre "Vista de Tabla" y "Vista de Tablero (Kanban)" mediante el estado `viewMode`.
- **Datos**: Este entorno se alimenta **exclusivamente** de la tabla `fact_leads`.
- **Kanban SDR**: Las columnas del Kanban corresponden al catálogo `Status` (Status tradicional del Lead).
- **Restricciones de Rol**: Los usuarios con rol `SDR` no pueden ver la pestaña "Deal" dentro del modal de detalle de contacto.

### Módulo AE: "Negociaciones"
- **Nueva Vista**: Se creó un apartado completamente nuevo en el menú lateral llamado "Negociaciones".
- **Visualización Dual**: Al igual que los SDR, los AE pueden alternar entre Tabla y Kanban en su vista.
- **Datos**: Este entorno se alimenta **exclusivamente** de la tabla `fact_deals`.
- **Kanban AE**: Las columnas del Kanban corresponden al catálogo `Status de Venta` (Mapeando el pipeline comercial).
- **Acceso**: Sólo los roles `AE` y `ADMIN` tienen acceso a esta vista y a la pestaña "Deal" dentro del modal.

### Flujo de Traspaso (SDR a AE) y Ficha de Negociación
- **Gatillo**: Se intercepta el evento *onEnd* (drag and drop) de SortableJS. Cuando un SDR mueve un Lead a la columna **"Paso a Ventas"**, en lugar de actualizarse inmediatamente en backend, se dispara un modal de confirmación llamado **"Ficha de Negociación"** (`showHandoffModal`).
- **Data recolectada (BANT)**:
  1. Historial de contacto (extraído de `fact_interacciones`).
  2. ¿Cuál es la necesidad puntual? (Obligatorio).
  3. ¿Necesita consultarlo con alguien? / Autoridad (Obligatorio).
  4. ¿Tiene presupuesto asignado? (Obligatorio).
  5. ¿De cuánto es el presupuesto?
  6. Notas para el AE o "Bandeja de Plata".
- **Proceso Backend**: Al confirmar (`submitHandoff()`), se envía la data al backend (`updateLeadMultiple`) donde se aplican los triggers: se cambia el status a "Paso a Ventas" en `fact_leads` y esto desencadena la creación (clonación) del registro hacia la tabla de rentabilidad (`fact_deals`).

## 2. Módulo de Administración y Configuración

El apartado de configuración (solo visible para rol `ADMIN`) se extendió para manejar variables globales y control de acceso.

- **Variables Globales (HMN)**: Se creó un panel para administrar variables que dictan reglas de negocio:
  - `HMN_SLA_Respuesta_SDR` (SLA de atención de un Lead nuevo).
  - `HMN_SLA_Traspaso_AE` (SLA para ejecutar una reunión de ventas).
  - `HMN_Toques_Maximos_Automatizados`.
  - `HMN_Meta_Facturacion_Mensual`.
  - `HMN_Meta_Leads_Calificados_SDR`.
  - *Data Store*: Estos registros se guardan en la hoja `cat_opciones`, utilizando el prefijo `HMN_` en la columna *categoría*.

- **Gestión de Usuarios (CRUD)**:
  - Panel nativo para agregar usuarios e indicar correo, nombre y rol (`SDR`, `AE`, `ADMIN`, `GUEST`).
  - Capacidad de activar/desactivar el acceso de un usuario.
  - Capacidad de cambiar roles dinámicamente.
  - *Data Store*: Estos registros operan directamente sobre la hoja `config_users`.

## 3. Resumen de Funciones Integradas en Google Apps Script (`Código.js`)

Se inyectaron 6 funciones nuevas al backend siguiendo los patrones existentes (`readTable_`, `getColumnMap_`, `LockService` y `logChange_` para auditoría).

1. `getHMNConfig()`: Filtra `cat_opciones` leyendo todas las filas cuya categoría empiece con `HMN_`.
2. `saveHMNConfig(variables)`: Insume un objeto y realiza inserciones/actualizaciones atómicas (LockService) en `cat_opciones`.
3. `getAllUsers()`: Obtiene la lista completa de usuarios desde `config_users`.
4. `createUser(email, nombre, rol)`: Registra un usuario nuevo validando que el correo no esté duplicado.
5. `toggleUserActive(email)`: Cambia el booleano de la columna *activo*.
6. `updateUserRole(email, newRole)`: Cambia el rol de un usuario.

## 4. Estructura de Base de Datos Subyacente
El backend sigue respondiendo a la estructura tipo Star Schema (Modelo de Estrella v6):
- **Hechos**: `fact_leads`, `fact_deals`, `fact_interacciones`, `fact_calificacion`.
- **Dimensiones compartidas**: `dim_contactos`, `dim_campanas`, `dim_vendedores`, `dim_productos`.
- **Configuración**: `cat_opciones`, `config_users`, `log_transacciones`.

## 5. Bugs Identificados Recientemente (y Solución Pendida)
⚠️ **Vue Compilation Error**: Durante las pruebas posteriores a la refactorización de UI, se detectó un pequeño bug tipográfico en `Index.html`, donde una expresión de Vue que maneja cadenas de texto (`deal['Notas Vendedor']`) estaba partida en dos líneas en la vista de *Negociaciones (Modo Tabla)*:

```html
<!-- Esto rompe el renderizador de Vue por un "Uncaught SyntaxError" -->
<td class="col-notes">{{ (deal['Notas Vendedor'] || '').substring(0, 40) }}{{ (deal['Notas
    Vendedor'] || '').length > 40 ? '...' : '' }}</td>
```

*Solución en trámite por el usuario*: Pegar el string para que esté contenido en una sola línea `{{ (deal['Notas Vendedor'] ... }}`.
