# Novedades y actualización móvil

## Cómo usar
En la app: campana → Novedades del sistema. Muestra avisos publicados desde /superadmin/communications para todas las organizaciones o únicamente las elegidas. Borradores y programados no publicados no aparecen. Permite lectura individual y paginación.
En Preferencias de notificaciones: Novedades del sistema habilita push opcional. Empieza OFF y no altera avisos críticos. El historial permanece disponible.

## Push preparado
El worker POST /api/cron/communications procesa novedades publicadas de los últimos siete días, para usuarios con opt-in anterior a la publicación y membresía activa. Conserva la audiencia y vuelve a comprobar preferencias al despachar. Usa el motor existente, con marca idempotente por anuncio/organización/usuario. Sin marca persistida no envía. Un reintento no vuelve a enviar el mismo push; la aceptación por Expo no prueba entrega física.
El worker todavía necesita conectarse a un scheduler y desplegarse; no se activó aquí. No se consulta ni despacha desde un GET móvil. Avisos antiguos no se envían retroactivamente al activar una preferencia. Durante QA no se invocaron endpoints reales de publicación ni de despacho.

## Actualización de tienda
El usuario confirmó que la app sigue en desarrollo y aún no tiene enlaces públicos. El banner queda oculto en desarrollo, Expo Go, web y cuando no hay versión/enlace válidos. En app publicada compara Application.nativeApplicationVersion con la versión publicada declarada en el servidor. No bloquea el uso y permite Más tarde.
Variables preparadas en .env.example: MOBILE_IOS_RELEASE_VERSION, MOBILE_IOS_STORE_URL, MOBILE_ANDROID_RELEASE_VERSION, MOBILE_ANDROID_STORE_URL. Dejar vacías hasta que cada versión esté disponible. Solo URLs HTTPS de App Store o Google Play, con ID Android com.mitiendapy.app. Sin claves ni URLs inventadas. No es un sistema OTA ni instala actualizaciones: abre la tienda.
Fuente API nativa: https://docs.expo.dev/versions/v57.0.0/sdk/application/ y enlaces: https://reactnative.dev/docs/linking . expo-application ~57.0.3 se declaró con Expo install offline, usando el paquete ya presente.

## Seguridad y pruebas
Consultas y lecturas autenticadas por contexto de tenant; lectura requiere aviso publicado y visible para la organización. IDs y cursor validados. Respuestas privadas sin caché. Texto renderizado como texto nativo, sin HTML. Datos de pantalla se limpian al cambiar de contexto y descartan respuestas antiguas.
87 tests del alcance pasan, incluyendo opt-in, audiencia, API tenant, idempotencia y regresiones de notificaciones existentes. TypeScript y lint del alcance pasan en raíz y mobile. Sin migración nueva ni aplicación de SQL. Sin acceso ni escritura a producción, push real, commit, merge o deploy. Prueba física/visual en iOS y Android pendiente.
