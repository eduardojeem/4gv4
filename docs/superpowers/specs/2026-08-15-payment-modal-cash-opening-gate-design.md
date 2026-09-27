# Paso previo de apertura de caja en pagos

**Fecha:** 2026-08-15
**Estado:** aprobado para planificación

## Objetivo

Hacer evidente cómo continuar cuando un usuario intenta cobrar o registrar un pago sin una caja abierta. En lugar de mostrar un formulario bloqueado junto a una alerta secundaria, el modal presentará primero la apertura de caja como requisito operativo.

## Flujo del modal

Al abrir un flujo de pago, se consulta la caja de la sucursal activa:

- **Consultando:** se muestra un estado breve de carga y no se presenta todavía el formulario.
- **Caja cerrada:** el contenido principal se reemplaza por una pantalla de requisito previo.
- **Caja abierta:** se presenta normalmente el formulario de pago.

La pantalla de caja cerrada contiene:

- título **Abrí la caja para continuar**;
- explicación: **Todos los cobros y pagos deben quedar asociados a un turno de caja para mantener el control y la auditoría**;
- sucursal y caja que se utilizarán;
- acción principal **Abrir caja**;
- acción secundaria **Cancelar**.

El botón no abre una caja silenciosamente: inicia el diálogo guiado existente, donde el usuario informa fondo inicial y referencia del turno. Después de una apertura exitosa, el modal vuelve al formulario de pago sin cerrar el contexto de la operación.

## Preservación del borrador

Si el usuario ya había cargado información o el servidor informa que la caja se cerró entre la consulta y la confirmación, deben conservarse monto, método, referencia, notas, cliente y operación de origen. El modal vuelve a la pantalla previa de caja cerrada y permite abrirla para reintentar.

## Acciones en las secciones

Los botones **Cobrar** o **Registrar pago** permanecerán accionables. Cuando la caja esté cerrada podrán mostrar un indicador secundario **Caja cerrada**, pero al pulsarlos abrirán el requisito previo; no quedarán simplemente deshabilitados sin explicación.

Si el usuario no tiene permiso para abrir caja, la pantalla mostrará **Solicitá a un responsable que abra la caja** y ofrecerá **Ir a Caja** cuando tenga acceso de lectura. No se mostrará una acción que el usuario no puede ejecutar.

## Alcance

Se aplicará al componente compartido y progresivamente a pagos operativos internos: reparaciones, créditos, POS, Finanzas, nómina y técnicos. Webhooks y pagos automáticos externos permanecen fuera del alcance. Una venta totalmente a crédito sin adelanto no activa este paso porque no registra un pago inmediato.

## Pruebas

- Caja cerrada oculta el formulario y presenta primero la explicación y **Abrir caja**.
- Caja abierta muestra el formulario.
- La apertura exitosa cambia al formulario sin perder el borrador.
- Un error tardío `OPEN_CASH_SESSION_REQUIRED` vuelve al requisito previo conservando datos.
- Un usuario sin permiso recibe instrucciones y **Ir a Caja**, no el botón de apertura.
- La operación completamente a crédito sin cobro conserva su excepción.
