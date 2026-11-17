# Mis turnos en la aplicación móvil — 2026-11-15

## Alcance
Accesos desde Mi perfil, Mi cuenta y menú rápido. Pantallas nativas de próximos turnos, historial y detalle, con paginación, reintento y actualización al regresar o reactivar la app. Los horarios usan la zona de cada tienda; se respeta el precio oculto y el importe cero.

La gestión de cambios y cancelación abre el flujo web existente de la tienda, conservando sus reglas. No se ofrece para turnos cobrados, terminados o cancelados. Las reservas sin ficha de cliente vinculada a la cuenta no se asocian por coincidencia de nombre, teléfono o correo.

## Seguridad y datos
API personal autenticada; la identidad proviene de la sesión, nunca de parámetros del cliente. La consulta limita por customers.profile_id y valida la organización de cada relación. Un identificador ajeno devuelve 404. Respuestas private/no-store, sin notas internas ni datos personales de otros clientes. Los fallos no se representan como listas vacías. El cambio de identidad o acceso descarta el contenido anterior y evita reintentos automáticos continuos ante revocación.

## Verificación
- 67 pruebas aprobadas, cero fallidas: API propia, modelos y cliente móvil, índice, navegación y regresiones de agenda/perfil.
- TypeScript raíz y mobile: aprobados.
- ESLint de nuevos archivos y navegación modificada: aprobado; revisión de diferencias sin errores.
- React Native Web con datos simulados: 375 y 768 px, sin desborde ni errores de página. Reintento, paginación sin duplicados, detalle, gestión y recarga, pago sin edición, cambio de cuenta y cierre de sesión.
- Bundle completo iOS de Metro: HTTP 200, incluye ambas pantallas.
- No se realizó prueba física en iPhone/Expo Go ni verificación con datos de producción.

## Base y publicación
Índice opcional de rendimiento preparado en supabase/migrations/20261115210719_customer_appointments_lookup_index.sql; probado con PGlite, no aplicado remotamente. No cambia datos ni permisos y no es requisito funcional para abrir la vista.

Cambios locales en C:\proyecto\mitiendapy. Sin commit, push, merge ni deploy. No se modificó producción.
