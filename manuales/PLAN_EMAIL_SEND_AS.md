# Plan: Envío de emails desde la dirección del usuario logueado

**Estado:** En espera — listo para implementar cuando se decida
**Fecha de análisis:** 2026-04-17
**Opción elegida:** Send As Aliases (Opción 1)

---

## Contexto del problema

El CRM usa `GmailApp.sendEmail()` en `Código.js` (línea ~2735), que siempre envía desde la cuenta Gmail del dueño del script de Google Apps Script. Esto significa que sin importar qué SDR o AE envíe un email desde el CRM, el destinatario ve el remitente como la cuenta del owner del proyecto GAS — no la del usuario logueado.

## Solución: Google Workspace "Send As" Aliases

### Cómo funciona

1. El admin de Google Workspace agrega el email de cada usuario del CRM como alias "Enviar como" en la cuenta Gmail del dueño del script
2. En el código, se agrega `emailOptions.from = callerEmail` y `emailOptions.replyTo = callerEmail`
3. Gmail envía el correo mostrando el email del usuario como remitente
4. Las respuestas del destinatario van directamente al SDR/AE, no al dueño del script

### Resultado para el destinatario

El cliente/prospecto ve:
```
De: Rosario Muñoz <rosario.munoz@swatsquad.com>
Para: cliente@empresa.com
Asunto: Seguimiento a tu interés en iODA
```

Si el dominio tiene SPF/DKIM correctamente configurados (standard en Workspace), NO aparece ningún "vía" ni rastro del dueño del script.

Si el cliente hace "Reply", la respuesta va al SDR/AE directamente.

### Flujo técnico

```
SDR escribe email en CRM
    ↓
Frontend envía: to, subject, body, callerEmail="rosario.munoz@swatsquad.com"
    ↓
Backend: GmailApp.sendEmail(to, subject, body, {
    from: "rosario.munoz@swatsquad.com",     ← alias configurado
    replyTo: "rosario.munoz@swatsquad.com",  ← respuestas van a ella
    htmlBody: "...",
    attachments: [...]
})
    ↓
Gmail envía desde: rosario.munoz@swatsquad.com
    ↓
Cliente recibe email DE la SDR
CRM registra el envío en fact_toques + log_transacciones
```

---

## Implementación: Paso a paso

### Paso 1 — Configuración en Google Workspace (admin, una sola vez por usuario)

El dueño de la cuenta del script (o el admin de Workspace) debe:

1. Ir a Gmail → Settings (engranaje) → "See all settings"
2. Pestaña "Accounts and Import" → sección "Send mail as"
3. Click "Add another email address"
4. Ingresar el nombre y email del usuario del CRM (ej: `rosario.munoz@swatsquad.com`)
5. Como están en el mismo dominio Workspace, se activa al instante sin verificación

Repetir para cada usuario: Rosario, Diana, Erika, Omar, Christian, etc.

**Tiempo estimado:** 2-3 minutos por usuario

**Nota:** Si algún usuario tiene email de otro dominio (no @swatsquad.com), se requerirá verificación via email de confirmación.

### Paso 2 — Cambio de código (2 líneas)

En `Código.js`, función `sendDirectEmail()`, **antes** de la línea `GmailApp.sendEmail(to, subject, body || '', emailOptions);`, agregar:

```javascript
// Send from the logged-in CRM user's email (requires alias configured in owner's Gmail)
if (callerEmail) {
  emailOptions.from = callerEmail;
  emailOptions.replyTo = callerEmail;
}
```

El código quedaría:
```javascript
// [existing code building emailOptions with htmlBody and attachments]

// Send from the logged-in CRM user's email
if (callerEmail) {
  emailOptions.from = callerEmail;
  emailOptions.replyTo = callerEmail;
}

GmailApp.sendEmail(to, subject, body || '', emailOptions);
```

### Paso 3 — Deploy

```bash
clasp push --force
```

### Paso 4 — Verificar SPF/DKIM (opcional pero recomendado)

Para eliminar el texto "vía owner@swatsquad.com" que algunos clientes de email podrían mostrar:

1. Admin de Workspace → Admin Console → Apps → Google Workspace → Gmail → Authenticate email
2. Verificar que DKIM está habilitado para el dominio
3. Verificar registros SPF en DNS del dominio

Si el dominio ya está activo en Workspace con email funcionando, probablemente ya están configurados.

---

## Limitaciones conocidas

| Aspecto | Comportamiento |
|---|---|
| Bandeja de Enviados del SDR | El email NO aparece en el Gmail del SDR. Aparece en el Gmail del dueño del script. El registro queda en el CRM. |
| Firmas de Gmail | NO se usa la firma personal de Gmail del SDR. Se envía lo que escribió en el editor Quill. Solución: usar plantillas de email del CRM. |
| Hilos de conversación | Los hilos en Gmail del SDR no se mantienen automáticamente. En el CRM sí queda registrado. |
| Nuevo usuario del CRM | Cada vez que se agrega un usuario nuevo al CRM, hay que agregar su alias en el Gmail del dueño del script. |
| Emails a @gmail.com | Funcionan sin problema. |
| Adjuntos | Funcionan igual que ahora (Base64 → Blob). |

---

## Alternativa futura: API de email tercero (SendGrid/Mailgun)

Si en el futuro se necesita:
- Más de 10 usuarios
- Enviar desde múltiples dominios
- Tracking de apertura/clicks
- No depender de la cuenta Gmail del dueño

Se puede migrar a SendGrid (gratis hasta 100 emails/día) o Mailgun. Esto requiere:
- Cuenta en el proveedor
- Verificación de dominio via DNS (SPF/DKIM)
- Reemplazar `GmailApp.sendEmail()` con `UrlFetchApp.fetch()` al API del proveedor (~30 líneas de código)
- API key guardada en Script Properties

---

## Opciones descartadas

| Opción | Razón de descarte |
|---|---|
| Gmail API + Service Account | Overkill para 5-10 usuarios. Requiere JWT signing, admin config compleja. |
| OAuth por usuario | Mala UX (doble login), manejo de tokens complejo, tokens expiran. |
| SMTP desde GAS | Imposible — GAS no soporta conexiones TCP/SMTP. |
| MailApp | No soporta parámetro `from`. No resuelve el problema. |
