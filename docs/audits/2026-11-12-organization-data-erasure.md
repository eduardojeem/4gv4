# Baja de organizaciones y copia de datos — Paraguay

## Alcance confirmado

Suspender al vencer, archivar al completar 90 días y permitir recuperar el historial al renovar antes de la baja definitiva. A los 180 días, eliminar o anonimizar lo que no deba conservarse legalmente. La cuenta personal y otras empresas del usuario no se eliminan.

## Implementación local

- Descarga en Administración → Suscripción, web y móvil, solo para el titular. JSON paginado por clave; se rechaza el cambio de organización, los errores de lectura y los límites de tamaño antes de entregar un archivo.
- Incluye sucursales, categorías, productos, clientes, proveedores, ventas y líneas, pedidos y líneas, reparaciones, créditos, cuotas y pagos, agenda (turnos, profesionales y ausencias), obligaciones, pagos financieros, movimientos de caja y compras. Excluye la configuración completa de herramientas, nómina, archivos binarios, contraseñas de equipos, tokens y claves de integraciones. NO es una copia integral ni una restauración automática; el archivo indica su alcance. Las cuotas y pagos de crédito se filtran mediante su crédito padre y las piezas mediante la reparación padre.
- Migración nueva: 20261112235456_organization_data_erasure.sql, posterior a 20261112233822_organization_nonrenewal_retention.sql. Ambas están preparadas, no aplicadas remotamente.
- Motor transaccional complete_nonrenewal_erasure: exige 180 días, archivo previo, aviso final de al menos siete días, revisión legal y de archivos. Bloquea periodos diferentes, renovación confirmada, pagos pendientes de conciliación, tablas sin clasificar y cascadas hacia registros retenidos.
- Inventario mediante catálogos PostgreSQL: tablas con organization_id y sus relaciones descendientes. Toda tabla necesita una regla por empresa, con delete o retain; retain exige fundamento y plazo futuro. No se generan reglas ni aprobaciones por defecto.
- Relaciones indirectas que requieran borrado específico bloquean la baja; no se infiere su propietario ni se improvisan cascadas. El motor funciona para planes de borrado compatibles y revisados; no existe una clasificación completa validada del esquema real.
- Cambiar la clasificación invalida la aprobación. La empresa se anonimiza, se revocan sus membresías y se guarda separadamente la identidad mínima del emisor necesaria para los registros contables retenidos. Las tablas legales y del proceso son de acceso exclusivo de servicio.
- Los archivos se revisan por bucket y ruta. Los que deban conservarse requieren bucket privado y plazo vigente. Los que deban eliminarse pasan a una cola solo después de confirmar la baja SQL. Se borran mediante Storage API, nunca eliminando filas de storage.objects. Los fallos quedan pendientes para reintentar.
- Después de la baja no se puede renovar la misma organización. Una contratación nueva debe crear otra empresa; no hay restauración del historial eliminado.

## Conservación en Paraguay

La Ley 1034/83, artículo 85, establece conservación de libros y registros por cinco años desde la última anotación y de comprobantes desde su emisión. La DNIT exige conservar documentación tributaria y DE/DTE por el plazo de prescripción aplicable. Esto no autoriza a aplicar cinco años desde la baja a todos los datos ni a ignorar interrupciones de prescripción, litigios u obligaciones particulares. El sistema exige fundamento y fecha por clasificación; no calcula automáticamente una conclusión jurídica universal.

Fuentes oficiales consultadas:
- https://www.bacn.gov.py/leyes-paraguayas/2538/del-
- https://www.dnit.gov.py/en/web/portal-institucional/preguntas-frecuentes
- https://www.dnit.gov.py/en/web/e-kuatia/preguntas-frecuentes/-/categories/2705870
- Storage: https://supabase.com/docs/guides/storage/management/delete-objects

## Antes de activar

1. Publicar la versión de términos por el flujo existente y comunicar la política. Los plazos nuevos no deben aplicarse retroactivamente.
2. Aplicar y verificar las migraciones en una base de prueba representativa. No se ejecutó ninguna migración en producción.
3. Clasificar TODOS los conjuntos reales de tablas y archivos, y revisar los permisos RLS de los registros legales retenidos. Completar tratamientos específicos de relaciones indirectas. Ninguna regla o revisión real está cargada.
4. Verificar la invalidación de cachés públicas al archivar y dar de baja. Aún falta validar el esquema completo, los enlaces de archivos sin UUID de empresa en la ruta y las políticas de buckets reales.
5. Habilitar SUBSCRIPTION_RETENTION_ENABLED solo después de lo anterior. SUBSCRIPTION_ERASURE_ENABLED es independiente y permanece false/ausente. La aprobación legal de cada organización es adicional: no basta habilitar la variable.
6. Verificar que no haya pagos en tránsito o reclamos/obligaciones que requieran conservar registros. Revisar conciliación de pagos tardíos; el trigger rechaza reactivar una organización eliminada.
7. Probar la descarga/compartir en iPhone y Android y el flujo en navegador con fixtures. Las pruebas automatizadas no equivalen a una prueba física.

No se eliminó ninguna empresa real, no se aplicaron migraciones remotas, no se hizo push ni deploy. El borrado posterior al vencimiento de la conservación legal requiere revisión específica; no hay una tarea que borre automáticamente los registros contables al llegar retain_until.