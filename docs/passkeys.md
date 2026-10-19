# Ingreso con passkeys (huella, Face ID, Windows Hello)

El login del panel (`/login`) ofrece **«Ingresar con huella o Face ID»** además de
la contraseña, que sigue funcionando igual. Cada usuario registra sus dispositivos
desde **Perfil → Seguridad → Credenciales de acceso**, donde también los ve y borra.

El portal del cliente (`/[organizationSlug]/cliente/login`) y `AuthModal` todavía
no lo ofrecen.

## Cómo está hecho

Se usa la API **nativa** de Supabase Auth (supabase-js ≥ 2.105, beta):

| Acción | Llamada |
| --- | --- |
| Entrar | `supabase.auth.signInWithPasskey({ options: { captchaToken } })` |
| Registrar el dispositivo actual | `supabase.auth.registerPasskey()` (requiere sesión) |
| Listar / renombrar / borrar | `supabase.auth.passkey.list()` / `.update()` / `.delete()` |

Supabase Auth guarda las credenciales, los challenges y los contadores en su
esquema `auth`, y al verificar crea la sesión directamente. Por eso **no hay
tabla propia, ni rutas de API, ni magic links**: cada usuario sólo puede ver y
borrar sus propias passkeys porque la API trabaja con la sesión actual.

- Los challenges vencen a los 5 minutos (`webauthn_challenge_expired`) y son de
  un solo uso (`webauthn_challenge_not_found`).
- Una credencial que no está registrada da `webauthn_credential_not_found`.
- Firma o contador inválidos dan `webauthn_verification_failed`.
- El botón usa el mismo captcha Turnstile que la contraseña.

Los mensajes en castellano están en `src/lib/auth/passkeys.ts`.

## Habilitarlo en el proyecto hosteado

Hoy está **apagado** en el proyecto (`passkeys_enabled: false`). Mientras siga
así, el botón responde «no está habilitado todavía» y el perfil no deja registrar.

1. Supabase Dashboard → **Authentication → Passkeys** → activar
   **Enable Passkey authentication**.
2. **RP display name**: el nombre de la plataforma (aparece en el diálogo del sistema).
3. **RP ID**: el dominio de producción, sin esquema, puerto ni ruta
   (por ejemplo `mitiendapy.com`).
4. **Origins**: hasta 5, con `https://`, y cada uno debe ser el RP ID o un
   subdominio (por ejemplo `https://mitiendapy.com,https://www.mitiendapy.com`).

> **Fijá el RP ID antes de que alguien registre una passkey.** Cambiarlo después
> invalida todas las passkeys existentes y cada usuario tiene que registrarlas
> de nuevo.

## Limitación: un solo RP ID por proyecto

En la versión nativa el RP ID es una configuración del proyecto, no sale del host
de cada request. Consecuencias:

- **Dominios propios de las tiendas** (ej. `tienda-de-juan.com`) no pueden usar
  passkeys de la plataforma: WebAuthn sólo acepta un origen que sea el RP ID o un
  subdominio de él, y una passkey creada en un dominio no sirve en otro. Los
  subdominios de la plataforma (`*.mitiendapy.com`) sí funcionan si se listan en
  *Origins* (máximo 5).
- El login del panel vive en el dominio de la plataforma, así que el caso
  principal no se ve afectado. Si el portal del cliente se abre a passkeys en
  dominios propios, hará falta una implementación propia (por ejemplo con
  `@simplewebauthn/server`) con un RP ID por dominio y passkeys separadas por
  tienda.
- `localhost` no puede compartir RP ID con producción. Para probar en local se
  usa el stack local (abajo).

## Probar en local

`supabase/config.toml` ya trae las passkeys habilitadas para `localhost`:

```toml
[auth.passkey]
enabled = true

[auth.webauthn]
rp_display_name = "MiTiendaPY"
rp_id = "localhost"
rp_origins = ["http://localhost:3000"]
```

1. `npx supabase start` (necesita Docker) y apuntar `.env.local` a la URL y la
   anon key que imprime.
2. `npm run dev`, entrar a `http://localhost:3000/login` con contraseña.
3. Perfil → Seguridad → **Registrar este dispositivo**.
4. Cerrar sesión y volver a `/login` → **Ingresar con huella o Face ID**.

En Chrome se puede probar sin hardware con DevTools → *More tools* → **WebAuthn**
→ *Enable virtual authenticator environment* (con *resident keys* y *user
verification* activados).
