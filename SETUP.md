# Configuración del Proyecto 4GV4

## Variables de Entorno

Para configurar el proyecto correctamente, necesitas crear un archivo `.env.local` basado en `.env.example`:

```bash
cp .env.example .env.local
```

Luego edita `.env.local` con tus valores reales:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
NEXT_PUBLIC_LOCALE=es-PY
NEXT_PUBLIC_CURRENCY=PYG
NEXT_PUBLIC_TAX_RATE=0.10
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM="SERVIX 360 <onboarding@resend.dev>"
EMAIL_REPLY_TO=soporte@tudominio.com
```

## Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Obtén tu URL del proyecto y la clave anónima desde el dashboard
3. Ejecuta las migraciones de la base de datos:

```bash
# Opción 1: Usando Supabase CLI
supabase link --project-ref TU_PROJECT_ID
supabase db push

# Opción 2: Desde el Dashboard
# Ve a https://supabase.com/dashboard/project/TU_PROJECT_ID/sql
# Ejecuta los archivos SQL en orden desde supabase/migrations/
```

## Instalación

```bash
npm install
npm run dev
```

## Resend

La integracion base ya esta preparada en:
- [src/lib/email/resend.ts](/F:/4g/4gv4/src/lib/email/resend.ts)
- [src/app/api/admin/email/test/route.ts](/F:/4g/4gv4/src/app/api/admin/email/test/route.ts)

Checklist:
1. Crear una API key en Resend.
2. Cargar `RESEND_API_KEY` en `.env.local`.
3. Definir `EMAIL_FROM`.
4. Opcional: definir `EMAIL_REPLY_TO`.
5. Levantar la app y probar `POST /api/admin/email/test` con una sesion admin.

Comportamiento actual:
- Sin `RESEND_API_KEY`, el envio se omite sin romper el flujo.
- Con clave valida, ya podes reutilizar `sendEmail()` y `renderBrandedEmail()` en eventos reales.

## Seguridad

⚠️ **IMPORTANTE**: Nunca subas archivos `.env.local` o `.env` a GitHub. Solo `.env.example` debe estar en el repositorio con valores de ejemplo.

Los archivos sensibles ya están excluidos en `.gitignore`:
- `.env*` (excepto `.env.example`)
- `supabase/.temp/`
- `.supabase/`
