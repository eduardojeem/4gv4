# Pagos de técnicos: aplicación

Aplicar los SQL en este orden, revisando el proyecto de destino y realizando una copia de seguridad:

1. `supabase/migrations/20261013011152_technician_payments_atomic.sql`
2. `supabase/migrations/20261013114806_technician_compensation_versions.sql`
3. `supabase/migrations/20261013123506_technician_canonical_commissions.sql`

No se ejecutaron en Supabase remoto durante esta implementación. Si ya se aplicaron manualmente, comparar objetos y definiciones antes de reparar el historial; la existencia de una tabla no basta.

Coordinar SQL y despliegue en una ventana sin pagos de técnicos. No mantener el circuito anterior de escrituras financieras mientras se habilita el nuevo. Comprobar después `supabase migration list --linked`.

## Funcionamiento

- Con Finanzas y permiso de lectura, el perfil dirige a Nómina; sin el módulo conserva el pago básico autorizado.
- Pendiente no significa desembolsado. Confirmación, salida de caja y anulación son transaccionales.
- Los reintentos conservan solicitud y clave en la sesión del navegador, incluso al desmontarse la pestaña. Borrar almacenamiento o cambiar de navegador elimina esa recuperación.
- Los pagos históricos sin sucursal siguen visibles, pero no se atribuyen a cada sucursal. No se permiten devoluciones de caja sin un movimiento verificable.
- Nómina y pagos básicos bloquean períodos superpuestos sin reconciliar; no importan ni duplican pagos automáticamente.
- Las condiciones iniciales capturan el estado actual, no reconstruyen cambios históricos nunca guardados. Una versión posterior necesita una fecha posterior a la última; reglas utilizadas en nómina aprobada requieren fecha futura.
- Las reglas manuales de Finanzas en conflicto se conservan y requieren revisión explícita.
- El resumen diferencia estimación y liquidación aprobada, y advierte sobre información incompleta.

## Verificación y recuperación

Validar permisos, organización/sucursal, mes y zona horaria, navegación a Nómina, pago pendiente, confirmación con caja abierta, reintento y anulación usando registros de prueba. Las pruebas SQL locales con PGlite y funciones reales no sustituyen verificación remota, concurrencia PostgreSQL ni revisión visual autenticada en escritorio y móvil.

Ante una incidencia, deshabilitar nuevos desembolsos y corregir hacia adelante. No borrar pagos, versiones, solicitudes ni movimientos de caja. Revertir a la API anterior puede restaurar escrituras no atómicas y requiere una revisión específica.

## Verificación del 14 de octubre de 2026

La revisión remota de solo lectura confirmó los cuerpos de las funciones de las tres migraciones, sus permisos de invocación, las columnas nuevas, tablas privadas con RLS, restricciones y triggers de solapamiento. Las versiones `20261013011152`, `20261013114806` y `20261013123506` todavía no figuraban en el historial consultado. No se ejecutaron nuevamente sus SQL ni se modificaron pagos. Registrar el historial requiere autorización explícita, sin volver a aplicar las migraciones.
