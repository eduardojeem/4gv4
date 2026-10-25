# Cobro de planes por transferencia bancaria

## Habilitación

1. Aplicar la migración `supabase/migrations/20261018232327_subscription_bank_transfers.sql` en el entorno que se utilizará. Esta tarea prepara el archivo, no lo ejecuta en producción.
2. Publicar el backend y las pantallas compatibles.
3. Entrar con una cuenta de superadmin en **Facturación → Pagos por transferencia**, ruta `/superadmin/billing/transfers`.
4. Completar banco, titular, número de cuenta o alias e instrucciones. La moneda inicial es PYG. Activar **Habilitar transferencias bancarias** y guardar.

La configuración inicia deshabilitada, sin cuentas o importes de ejemplo. No se contrata una pasarela ni se solicita acceso a la cuenta bancaria.

## Uso por el comercio

En `/admin/subscriptions`, el dueño o administrador del comercio puede generar una solicitud, consultar los datos de la cuenta receptora y la referencia única, efectuar la transferencia y adjuntar el comprobante. El acceso móvil existente a gestionar la suscripción en la web lleva al mismo flujo.

Los planes elegibles, sus importes y el período se obtienen del servidor. La solicitud conserva el nombre del plan, el precio y los datos bancarios como una cotización: una edición posterior no reescribe los datos que ya se mostraron al cliente. Una solicitud abierta por organización evita crear solicitudes duplicadas por doble clic.

Se admiten JPEG, PNG y PDF de hasta **3 MB**. El servidor comprueba tamaño transmitido y firma del formato. Los comprobantes se guardan en el bucket privado `subscription-transfer-receipts`. No tienen URL pública ni acceso directo con las claves del navegador. Las APIs autorizadas generan enlaces de descarga de 60 segundos, sin caché.

Estados: **Esperando comprobante → Pendiente de revisión → Aprobada o Rechazada**. Una solicitud rechazada es terminal y permite generar otra. El superadmin también puede cerrar con motivo una solicitud que aún espera comprobante, si fue abandonada o debe reemplazarse.

## Conciliación y aprobación

El superadmin verifica en su banco la cuenta receptora, la acreditación y el importe. El comprobante enviado por el cliente no acredita por sí solo el pago.

Para aprobar se exige la referencia bancaria verificada, una confirmación explícita de la acreditación y una confirmación final. La referencia completa debe identificar el movimiento de forma única: no usar textos genéricos como “transferencia” o “pago mensual”. Se normalizan espacios y mayúsculas y se impide reutilizar una referencia ya aprobada en cualquier organización. Si los números de operación de un banco se repiten, usar una referencia completa que incluya los datos que lo distinguen, por ejemplo banco y fecha.

La aprobación bloquea la organización y la solicitud y, en una sola transacción, registra `subscription_payments`, renueva `subscriptions`, sincroniza `organizations.plan` y escribe auditoría. Repetir exactamente una aprobación devuelve `applied: false` y no vuelve a cobrar ni extender el período.

- Si el mismo plan sigue activo y su vencimiento está en el futuro, el mes se suma desde ese vencimiento.
- Si hay una prueba vigente del mismo plan, se conserva hasta su vencimiento y el mes pagado empieza después.
- Si está vencido o se activa desde Free, el mes empieza en la aprobación.
- El mes es calendario en `America/Asuncion`, incluyendo el ajuste del último día de meses cortos.
- El rechazo exige motivo y no cambia vigencia ni registra un pago.

Esta primera versión permite renovar el plan pago actual o, para el dueño, activar uno desde Free. Los cambios entre planes pagos se gestionan por separado para conservar las validaciones de capacidades del flujo existente. No hay modalidad anual ni débito automático.

## Seguridad y operación

Las tablas y funciones de escritura sólo son accesibles por `service_role`; las funciones verifican el actor, su estado y su pertenencia/rol en la base. El cliente nunca decide organización, importe, estado aprobado ni fechas. Sólo el superadmin puede configurar la cuenta, revisar solicitudes y consultar comprobantes de otros comercios.

Ante un error ambiguo de transporte al adjuntar un comprobante, el objeto privado se conserva: la transacción podría estar todavía ejecutándose. No se debe borrar por una lectura que aún muestre el estado anterior. Una limpieza futura de objetos huérfanos debe conciliar referencias bajo los mismos bloqueos antes de eliminar. Los rechazos definitivos permiten retirar objetos que no quedaron asociados.

Los datos pendientes de otras tareas del repositorio se mantienen. No se realizaron transferencias reales, aprobaciones de pagos reales, cambios remotos ni publicación en esta tarea.

## Verificación

La migración se ejecuta en pruebas locales con PGlite y fixtures del esquema. Se comprueban permisos, aislamiento de organizaciones, precio fijado por servidor, un solo pedido abierto, rechazo, activación, renovación anticipada, meses cortos, referencias repetidas y reintentos idempotentes. PGlite usa una conexión y no sustituye una prueba multiconexión en PostgreSQL real.

Las pruebas de API cubren el rechazo de importes/organizaciones manipulados, permisos, origen, archivos inválidos, enlaces privados y errores ambiguos después de enviar el comprobante. Las pruebas de componentes ejercitan solicitudes, estados, historial paginado, configuración y decisiones del superadmin.

Antes de habilitar cobros reales falta aplicar la migración, cargar la cuenta receptora y probar el recorrido autenticado en el entorno de destino. Nunca aprobar un pago de prueba como acreditación real.

Verificación local del 18/10/2026: 58 pruebas aprobadas en 10 archivos, incluidos los componentes de cliente/superadmin y regresiones de suscripción y finanzas. TypeScript y ESLint focal sin errores; `git diff --check` correcto. No se verificó un recorrido autenticado contra la base remota ni se publicó esta implementación.
