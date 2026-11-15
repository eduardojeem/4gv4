# Política de falta de renovación: 90 / 180 días

Decisión aprobada: suspensión al vencer, archivo al completar 90 días (inicio del día 91) y baja definitiva después de 180 días, con eliminación o anonimización y conservación exclusiva de registros legalmente exigibles.

## Implementado localmente

- Cálculo común para web/API/móvil, sin inventar fechas.
- Migración 20261112233822_organization_nonrenewal_retention.sql: ciclo por organización, fecha vencida, aviso aceptado por proveedor, archivo y baja prevista. No inicia ciclos retroactivamente al instalarse.
- Tarea diaria runNonrenewalRetention: correo al dueño mediante su email verificado de Auth; primer aviso y recordatorios desde siete días antes del archivo y de la baja. Un envío omitido o fallido no inicia el plazo.
- Se utiliza el mayor entre vencimiento y aviso. Cuentas previamente vencidas disponen de 180 días completos desde el nuevo aviso.
- El archivo quita storefront_public y marketplace_public; otro endpoint no puede republicar una empresa aún archivada. No se eliminan los datos ni la membresía ni la cuenta personal.
- La renovación cancela el ciclo mediante trigger. Recupera la operación y el historial; la publicación se vuelve a habilitar expresamente en configuración para evitar publicar una tienda privada automáticamente.
- API de acceso devuelve fechas solo de un ciclo vigente correspondiente a ese vencimiento. App muestra fechas y renovación. Propuesta de términos actualizada a 180 días, reemplazando la sección anterior de 90 sin modificar las demás secciones.

## Activación pendiente

No se aplicó la migración, no se publicó el documento legal y no se activó el proceso. SUBSCRIPTION_RETENTION_ENABLED debe permanecer ausente o false hasta aplicar/verificar la migración y publicar/notificar la política. No se ejecutaron tareas ni mutaciones en producción.

## Limitación explícita: baja definitiva y exportación

La tarea de retención marca pending_deletion_review al cumplir 180 días. Un motor separado de baja revisada fue agregado después: exige clasificación completa por empresa y aprobación de un superadministrador activo. También se agregó descarga de datos comerciales (no una copia restaurable integral). Ver 2026-11-12-organization-data-erasure.md para el estado actualizado.

El envío aceptado por proveedor registra un intento de notificación; no prueba lectura ni entrega final. Falta procesar rebotes y confirmar el mecanismo requerido de notificación antes de automatizar cualquier baja irreversible.

Las páginas públicas pueden conservar caché hasta su invalidación/TTL. Debe verificarse la invalidación integral antes de activar el archivo remoto. Los avisos de la tarea son correo; la aplicación muestra el aviso al entrar, sin nueva promesa de push.

## Validación local

Pruebas con PGlite (PostgreSQL embebido), datos ficticios y roles aislados: plazos completos, avisos repetidos, cancelación al renovar, no publicación automática, aislamiento entre empresas, rechazo de republicación y privilegios de servicio. No se borran datos financieros ni usuarios.


## Continuación: baja revisada y copia comercial

Se agregó un motor transaccional para planes de baja clasificados y descarga de datos comerciales. El alcance, las limitaciones y los requisitos de activación están en 2026-11-12-organization-data-erasure.md. El proceso continúa desactivado y no hay reglas ni empresas aprobadas en una base real.
