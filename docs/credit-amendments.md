# Correcciones de créditos

En **Créditos → Créditos → Expediente → Editar e historial**, el propietario o
administrador de la organización puede:

- Recalcular capital, interés total, cantidad/frecuencia de cuotas y primer
  vencimiento, únicamente si nunca hubo pagos ni cuotas marcadas como pagadas.
- Cambiar vencimientos pendientes, también en cuotas parcialmente pagadas.
- Registrar un ajuste explícito del importe total de una cuota pendiente,
  conservando sus cobros. Nunca puede quedar por debajo de lo ya cobrado.
- Corregir la fecha y hora de un pago trazable a un comprobante individual.

Todo cambio exige motivo y conserva instantáneas anteriores/posteriores, actor,
fecha y variación de deuda. El historial visible muestra las últimas 100
correcciones; la tabla conserva todas. La versión del formulario se verifica
dentro de la transacción y un cambio concurrente obliga a recargar.

## Invariantes

- La organización y el actor provienen de la sesión. La pertenencia activa como
  `owner`/`admin` se vuelve a validar en PostgreSQL.
- Los ajustes afectan la cuenta por cobrar. No reescriben ventas originales,
  cobros, recibos originales ni generan ingresos de caja. La suma de las cuotas
  y el encabezado se modifican juntos; se mantienen las reglas existentes de
  cupo y aprobación de ficha para los aumentos.
- Las fechas de vencimiento se guardan al mediodía de la zona de la tienda. Las
  fechas de cobro se ingresan en la hora del dispositivo y se convierten a UTC.
- Una corrección de cobro en efectivo mueve la fecha del pago y de su movimiento
  de caja en la misma transacción. Recalcula la fecha de pago de la cuota sin
  alterar importes cobrados. Bloquea fechas futuras o anteriores al contrato,
  cajas cerradas/suspendidas/bloqueadas y fechas anteriores a su apertura.
- Se rechazan pagos históricos sin comprobante identificable, movimientos de
  efectivo ambiguos, y comprobantes con varias asignaciones o excedente a saldo
  a favor. Estos requieren una operación integral del cobro, fuera de este editor.
- No hay edición directa de saldo pagado, borrado de pagos ni cambio de cliente.
  Se retiran los permisos heredados de escritura directa de `anon` y
  `authenticated` en las tres tablas financieras; los consumidores actuales usan
  operaciones de servidor. Las funciones de enmienda solo pueden ejecutarse con
  `service_role`, que no recibe permiso para modificar o borrar el historial.

## Activación y validación

Aplicar `supabase/migrations/20261017100000_credit_amendments.sql` después de las
migraciones existentes de fichas y cobros atómicos. El código falla con HTTP 503 y
un mensaje legible si la migración todavía no existe. No hay fallback a escrituras
separadas. Para desactivar la interfaz basta retirar el código; conservar las
filas de auditoría. No restaurar escrituras directas para solucionar un error.

Pruebas: contrato/roles, API con organización y actor de sesión, interfaz con
conflictos, y SQL en PGlite usando las tablas originales, el trigger real de pagos
y la validación diferida real de cupo. Cubren rollback conjunto de deuda e
historial, conservación de pagos parciales, fechas, moneda y permisos.

El usuario aplicó la migración en la base conectada. El 14 de octubre de 2026 se
confirmaron mediante consultas de solo lectura la tabla de auditoría, ambas
funciones y sus permisos: el navegador no puede editar pagos ni ejecutar la
enmienda; el servidor puede agregar auditoría y no modificarla ni borrarla.
Docker local no estaba disponible para ejecutar pruebas de concurrencia en el
stack Supabase completo. En navegador se verificaron la pestaña del administrador
y el bloqueo seguro ante migración ausente. La comprobación visual posterior quedó
limitada por el rol de la sesión local; no se modificaron créditos reales.

Referencia: [funciones de base de datos de Supabase](https://supabase.com/docs/guides/database/functions).
