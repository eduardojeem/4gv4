# Control global de pagos mediante caja abierta

**Fecha:** 2026-08-15  
**Estado:** aprobado para planificación

## Objetivo

Impedir que el personal registre un pago operativo cuando no exista una sesión de caja abierta para la misma organización y sucursal. Cada pago aceptado debe quedar relacionado con la caja, el usuario, la sucursal, el método, la fecha y la operación de origen para facilitar conciliación y auditoría.

## Alcance

La regla se aplica a todos los pagos iniciados por personal dentro del dashboard:

- ventas POS, incluidos pagos mixtos;
- cobros de reparaciones, adelantos, entregas y cierres sin reparación;
- cuotas y cancelaciones de créditos;
- pagos de obligaciones, gastos y proveedores;
- pagos de nómina y a técnicos;
- cualquier otro formulario interno que cree un pago o movimiento financiero.

Efectivo, tarjeta, transferencia y métodos clasificados como `other` requieren una caja abierta. Una venta enteramente a crédito y sin adelanto crea una obligación, no un pago, por lo que no requiere caja en ese momento. El cobro posterior de esa obligación sí la requiere.

Quedan fuera los pagos que no son procesados por un usuario del dashboard: webhooks de pasarelas, cobros automáticos de suscripciones y pedidos públicos que únicamente declaran el método previsto para pagar después. Si un pedido público se cobra posteriormente desde el dashboard, ese cobro entra en la regla.

## Regla de dominio

Todo comando interno que persista un pago positivo debe recibir o resolver una sesión de caja abierta que cumpla:

1. pertenece a la misma organización;
2. pertenece a la misma sucursal de la operación;
3. está abierta al momento del registro;
4. el usuario tiene acceso a esa sucursal;
5. el pago queda vinculado de forma inmutable a esa sesión.

El cliente nunca será la fuente de verdad de la apertura. La API o RPC vuelve a consultar y bloquear la sesión dentro de la misma transacción que registra el pago. Si la sesión se cerró entre la verificación visual y la confirmación, toda la operación falla sin cambios parciales con el código estable `OPEN_CASH_SESSION_REQUIRED`.

## Arquitectura

### Contrato compartido

Se incorporará un contrato reutilizable para representar el estado `checking | open | closed`, reconocer el error estable del servidor y decidir si una operación es un pago. Los componentes conservarán sus contratos de negocio, pero usarán una presentación común para caja cerrada y apertura.

### Servidor y base de datos

Las rutas y RPC que registran pagos se auditarán por familia. La protección principal vivirá en las operaciones transaccionales de Supabase: resolverán una sesión abierta por organización y sucursal, bloquearán la fila y almacenarán su identificador en el pago. Las APIs validarán temprano para devolver un error claro, pero esa validación no sustituirá el control transaccional.

Los contratos existentes que solo exigen caja para efectivo se ampliarán a todos los métodos internos. Cuando una tabla todavía no tenga `cash_session_id`, se agregará mediante migración compatible y nullable para datos históricos; los pagos nuevos quedarán obligados por la RPC o trigger correspondiente. No se reescribirán registros históricos.

### Interfaz

Cada modal o pantalla de cobro:

- consulta la caja al abrirse y cuando cambia la sucursal;
- muestra estado de consulta, caja abierta o caja cerrada;
- deshabilita la confirmación mientras esté consultando o cerrada;
- muestra una explicación breve y el botón **Abrir caja** cuando esté cerrada;
- reutiliza el diálogo guiado de apertura existente;
- conserva monto, método, referencia, notas y selección actual durante la apertura;
- vuelve a verificar el estado y habilita la confirmación cuando la apertura termina;
- si el servidor responde `OPEN_CASH_SESSION_REQUIRED`, vuelve al estado de caja cerrada sin borrar el formulario.

Los botones de apertura respetarán los permisos existentes. Si el usuario puede cobrar pero no abrir caja, se mostrará un mensaje para solicitar la apertura a un responsable y un acceso a la sección de Caja, sin prometer una acción que no puede ejecutar.

## Auditoría

Cada pago nuevo almacenará, directa o indirectamente mediante su movimiento asociado:

- organización y sucursal;
- sesión y caja;
- usuario que registró el pago;
- fecha efectiva y fecha de creación;
- método, monto y referencia;
- tipo e identificador de la operación de origen;
- clave de idempotencia cuando el flujo ya la utilice.

La asociación pago-sesión no podrá modificarse desde el cliente. Los pagos y movimientos financieros conservarán sus reglas actuales de inmutabilidad o corrección auditable.

## Manejo de errores

- `OPEN_CASH_SESSION_REQUIRED`: mostrar caja cerrada y ofrecer apertura.
- Caja cerrada durante el envío: conservar el borrador y no registrar pagos parciales.
- Apertura fallida: mantener el modal de pago abierto y mostrar el error recibido.
- Sucursal sin caja configurada: dirigir a Caja para crear/configurar una, según permisos.
- Conflicto de idempotencia: devolver el resultado previamente registrado sin duplicar pago ni movimiento.

## Pruebas y verificación

La implementación seguirá ciclos TDD por familia:

1. prueba de servidor que rechaza cada método sin caja y no crea efectos parciales;
2. prueba que acepta el pago con una sesión válida de la misma sucursal;
3. prueba que rechaza una sesión ajena, cerrada o de otra sucursal;
4. prueba de interfaz que bloquea confirmar y muestra **Abrir caja**;
5. prueba que conserva el formulario y continúa después de abrir;
6. prueba de carrera donde el servidor informa caja cerrada tras una verificación visual positiva;
7. regresión de venta totalmente a crédito sin adelanto y de integraciones externas excluidas.

Se ejecutarán las suites enfocadas, `typecheck`, ESLint de archivos tocados y `git diff --check`. La migración deberá validarse y aplicarse en el proyecto Supabase enlazado antes de afirmar que el control está desplegado.

## Estrategia de entrega

El cambio se implementará incrementalmente: primero contrato y protección de servidor, luego POS y reparaciones, después créditos y egresos, y finalmente consolidación visual. Cada incremento mantendrá compatibilidad con datos históricos y quedará cubierto por pruebas antes de avanzar.

