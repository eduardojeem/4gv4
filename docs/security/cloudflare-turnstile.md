# Cloudflare Turnstile en autenticacion

MiTiendaPy protege los inicios de sesion, registros y solicitudes de recuperacion de contrasena con Cloudflare Turnstile. La verificacion del token la realiza Supabase Auth; la aplicacion nunca recibe ni registra la Secret Key.

## Produccion

1. En Cloudflare Turnstile, crea o edita el widget y autoriza `mitiendapy.com` y cada hostname real desde el que se muestran los formularios.
2. En Supabase abre **Authentication > Bot and Abuse Protection**, habilita CAPTCHA, selecciona Cloudflare Turnstile y guarda la Secret Key.
3. En Vercel agrega `NEXT_PUBLIC_TURNSTILE_SITE_KEY` para Production y Preview si corresponde.
4. Vuelve a desplegar. Las variables `NEXT_PUBLIC_*` se incorporan al bundle durante el build.

`TURNSTILE_SECRET_KEY` no es necesaria en Vercel para esta arquitectura. Si ya fue agregada, no se utiliza desde el codigo; puede retirarse de Vercel despues de confirmar que la Secret Key esta guardada en Supabase.

## Desarrollo local

La aplicacion no habilita un bypass cuando falta Turnstile. Agrega a `.env.local`:

```dotenv
NEXT_PUBLIC_TURNSTILE_SITE_KEY=tu_site_key
```

Si el desarrollo local usa el mismo proyecto Supabase que produccion, la Site Key debe pertenecer al mismo widget cuya Secret Key esta configurada en Supabase y el widget debe aceptar temporalmente `localhost`. Reinicia `npm run dev` despues de cambiar `.env.local`.

Las claves ficticias oficiales de Cloudflare sirven solamente cuando el backend validador tambien usa la Secret Key ficticia. Un token ficticio es rechazado por la Secret Key real configurada en Supabase; por eso MiTiendaPy no aplica una clave ficticia automaticamente en desarrollo.

## Flujo y recuperacion ante errores

- El boton permanece deshabilitado hasta obtener un token.
- El token se entrega una sola vez a `signInWithPassword`, `signUp` o `resetPasswordForEmail` mediante `captchaToken`.
- Tras cada intento se limpia el token y se reinicia el widget, porque los tokens son de un solo uso.
- Si el desafio vence, falla la red o el navegador no es compatible, se muestra un mensaje contextual y se exige una nueva verificacion.
- Nunca deben registrarse tokens CAPTCHA ni Secret Keys en consola, logs o herramientas de analitica.

## Diagnostico rapido

- **La proteccion anti-bots no esta configurada:** falta `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en el entorno del build.
- **Invalid CAPTCHA / captcha verification process failed:** revisa que Supabase tenga la Secret Key correspondiente a la Site Key visible.
- **Domain not authorized:** agrega el hostname exacto en la configuracion del widget de Cloudflare.
- **Timeout or duplicate:** completa el desafio otra vez; el token vencio o ya fue consumido.

Fuentes oficiales:

- https://supabase.com/docs/guides/auth/auth-captcha
- https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/
- https://developers.cloudflare.com/turnstile/troubleshooting/testing/
