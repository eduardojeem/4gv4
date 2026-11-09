# Comunicaciones: correcciones aprobadas

Alcance: seis hallazgos de auditoría y claridad de interfaz.
1. Probar respuesta desordenada, publicación masiva, cierre pendiente, fecha pasada, estados y fallo de red.
2. Borrador inicial y revisión obligatoria; bloquear cierres pendientes y conservar errores/borrador.
3. Fecha futura para nuevas programaciones; permitir conservar una fecha existente al editar contenido. Lectura superadmin sin dispatch, worker autenticado separado sin activarlo.
4. Estados explícitos y alcance de muestra; configuración no equivale a entrega comprobada.
5. Pestañas y filtros en URL, controles móviles y verificación con API simulada.

Sin envíos reales, migraciones, cambios de permisos, producción, push ni deploy. Conservar modificaciones ajenas.

Implementación verificada con 14 tests y navegador aislado. Worker preparado pero scheduler no activado. Los detalles de comprobación están en docs/audits/2026-11-08-communications-implementation.md.
