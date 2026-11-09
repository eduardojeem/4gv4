# Novedades del sistema y versión móvil

Aprobado: conectar avisos generales de Superadmin con móvil, push opcional y aviso de actualización. El usuario confirmó app en desarrollo sin enlaces de tiendas.

- Pantalla Novedades con consulta y lectura tenant-safe, accesible desde campana y cabecera.
- Tipo SYSTEM_NEWS en motor existente: in-app siempre disponible, push OFF por defecto y opt-in explícito independiente de avisos críticos. Worker procesa anuncios publicados para quienes optaron; idempotencia por anuncio/organización/usuario. No despachar en GET ni enviar durante QA.
- Banner de versión publicado validado por versión nativa/enlace de tienda; oculto en Expo Go y en desarrollo y cuando faltan datos. Sin enlaces reales, queda apagado.
- Tests de versiones, audiencia, opt-in, API tenant, idempotencia y worker; typecheck/lint raíz y móvil. Sin migraciones ni producción, commit, push o deploy.

Implementado y verificado con 87 tests del alcance. Activación remota y publicación en tiendas pendientes por etapa de desarrollo. Ver docs/audits/2026-11-08-mobile-system-news.md.
