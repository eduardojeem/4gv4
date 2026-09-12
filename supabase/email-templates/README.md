# Plantillas de email de Supabase Auth (MiTiendaPy)

Estas plantillas se pegan en el dashboard de Supabase:
**Authentication → Email Templates** (proyecto de MiTiendaPy).

Para cada plantilla: seleccionar la pestaña correspondiente, pegar el **Subject**
y reemplazar el **Message body** con el contenido del archivo `.html`.

| Pestaña en Supabase      | Archivo               | Subject sugerido                              |
|--------------------------|-----------------------|-----------------------------------------------|
| Reset Password           | `recovery.html`       | Recuperá tu contraseña — MiTiendaPy           |
| Confirm signup           | `confirm-signup.html` | Confirmá tu cuenta en MiTiendaPy              |
| Magic Link               | `magic-link.html`     | Tu enlace de acceso a MiTiendaPy              |
| Invite user              | `invite.html`         | Te invitaron a MiTiendaPy                     |
| Change Email Address     | `email-change.html`   | Confirmá el cambio de email — MiTiendaPy      |

Notas:
- Las variables `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}` las
  completa Supabase automáticamente — no tocarlas.
- HTML con tablas y estilos inline (compatible con Gmail/Outlook).
- Color de marca: `#1668b8` (aprox. de `--primary: oklch(0.48 0.16 240)`).
- Los emails salen vía SMTP de Resend con el remitente configurado en `EMAIL_FROM`
  (configurado en Project Settings → Authentication → SMTP).
