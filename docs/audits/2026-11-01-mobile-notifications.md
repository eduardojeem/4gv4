# Notificaciones móviles — implementación local

Base: origin/main 80f51a94a4ddb94dcb884efc6c29ed49f418bcf7. Sin commit ni publicación.

## Pantallas

- Bandeja: secciones Hoy, Ayer, Esta semana y Anteriores; chips Todas, No leídas y categorías; ícono y color por categoría; punto de no leído; texto relativo; urgencia indicada con texto y color. Deslizar marca la lectura y deja también un botón accesible. Marcar todas conserva el alcance del usuario y comercio en el servidor. Vacíos permiten abrir preferencias y solicitar permiso. Los errores permiten reintentar.
- Preferencias: estado de permiso del sistema, acceso a Ajustes, interruptor general de push y tarjetas de categorías con ejemplos. Cada tarjeta permite expandir tipos y configurar teléfono/bandeja por separado. Los guardados por categoría usan la API vigente por tipo: si falla una parte, se conservan los cambios confirmados y se recarga el estado real.
- Venta: detalle por ID con fecha, monto, medio de pago y productos, consultado mediante el endpoint existente de ventas y su permiso pos.sales.read. Pedidos y reparaciones mantienen sus detalles. Créditos abre la cartera existente. Agenda mantiene su pantalla actual.

## Compatibilidad

La versión móvil sube a 1.1.0. Crea canales por categoría y conserva default. El servidor elige canales nuevos solo cuando push_devices.app_version confirma versión compatible; los anteriores conservan default. notificationId y organizationId son campos opcionales del payload. El cursor compuesto conserva recepción de cursores antiguos por fecha. No hay migraciones ni dependencias nativas nuevas.

- Requiere actualizar/build de app: pantallas, gesto, listeners, prepermiso contextual, permisos, badge, canales, detalle de venta. No se configuró OTA.
- Solo servidor: corrección Push/In-App, metadatos de push, prioridad de transporte, cursor estable y filtro opcional por ID de venta.
- Orden de rollout recomendado: servidor compatible primero; después build 1.1.0. No se desplegó nada.

## Verificación realizada

- TypeScript raíz y mobile: salida 0.
- Vitest relacionado notifications- y mobile-: 44 suites, 423 tests, salida 0. Después se agregaron dos casos de protocolo; reejecución focalizada: 2 suites, 28 tests, salida 0.
- ESLint focalizado móvil: salida 0. Focalizado servidor: salida 0, warnings de any preexistentes en notifications-phase3.test.ts.
- ESLint completo raíz: salida 1; incluye deuda fuera del cambio y test-results generado por Vitest.
- ESLint completo mobile: salida 1; errores en app.config.js, panel/repairs/[id].tsx y pattern-picker.tsx, fuera del cambio. Advertencias en settings/index.tsx y repairs/[id].tsx.
- git diff --check: salida 0.

## Verificación nativa pendiente

No se obtuvieron capturas ni se probó una sesión en un dispositivo. Esta descripción de pantallas no representa evidencia visual. Antes de publicar: comprobar Android 13+ instalación nueva, permiso denegado/otorgado desde Ajustes, un push por categoría, app cerrada/en segundo plano/en primer plano, lectura y badge, cambio de comercio, build anterior con canal default, TalkBack/VoiceOver, tamaños grandes de fuente y ambos temas.