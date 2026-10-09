# Alta segura de servicios desde la agenda

## Objetivo y alcance

Primera entrega de las recomendaciones aprobadas: crear un servicio completo sin sobrescribir la configuración de la agenda, sin altas parciales y sin duplicarlo cuando se reintenta después de perder la respuesta. Mantener los servicios como productos con unidad `servicio`, los límites del plan y los permisos del catálogo y de la agenda.

El formulario continúa permitiendo sugerencias por rubro y nombres propios. Precio y duración son datos explícitos del dueño. No modificar las migraciones `20261014120005` y `20261014120006`, que el usuario ya declaró aplicadas.

## Diseño recomendado

Crear un endpoint de alta específico de servicios de agenda, respaldado por una función PostgreSQL transaccional ejecutable únicamente desde el servidor. La organización y el actor salen del contexto autenticado, nunca del cuerpo enviado por el navegador.

Una confirmación crea el producto y su fila de `agenda_services` en la misma transacción. No recibe ni escribe `agenda_settings`: horarios, avisos, anticipación, días disponibles y selección de profesionales quedan intactos. No debe simular atomicidad creando y luego borrando el producto si falla el segundo paso.

El mismo endpoint se reutiliza en el alta individual y en las sugerencias. Cada servicio es una operación atómica; una carga múltiple no se anuncia como completamente exitosa si solo se creó una parte.

## Contrato funcional

- Entrada: nombre, precio en moneda del negocio, duración entera entre 5 y 600 minutos, visibilidad de catálogo, disponibilidad para reserva online y clave de idempotencia.
- El SKU se genera en servidor; la clave de idempotencia no sustituye al SKU.
- La misma clave y mismos datos devuelven el mismo servicio. La misma clave con datos distintos se rechaza como conflicto. El cliente conserva la clave ante un fallo de red y la reemplaza únicamente al iniciar otra alta.
- Validar nombre y datos monetarios, propiedad de organización, permisos y módulo de servicios. Reutilizar reglas de capacidad y ciclo de suscripción vigentes; además serializar el control del cupo y la inserción para que dos altas simultáneas no lo superen. No aceptar un límite suministrado por el cliente.
- Auditoría y escrituras quedan en la misma transacción. Si falta la nueva migración, devolver un error claro sin recurrir al antiguo alta en dos pasos.
- La respuesta exitosa contiene el identificador creado y los datos necesarios para refrescar la lista sin perder los borradores locales.

## Interfaz

- Duración personalizada en minutos, junto a atajos opcionales, sin valor supuesto.
- Precio con moneda visible; distinguir un precio cero intencional de un campo vacío.
- Controles separados para visibilidad en catálogo y reserva online. Aclarar que la reserva también depende de que el negocio tenga reservas habilitadas.
- Resumen de nombre, precio, duración y publicación antes de confirmar.
- Mientras guarda: impedir cambios, cierre y doble envío. Ante un fallo recuperable: mantener los datos y permitir reintentar con la misma clave.

## Profesionales

No cambiar asociaciones ni tarifas del personal en esta entrega. En el modelo actual, una lista vacía de servicios de un profesional significa «todos», incluidos los nuevos. No presentar una selección como exclusiva si esos profesionales siguen siendo elegibles. Mantener la asignación explícita en «Quién atiende» y explicar ese comportamiento en el formulario. Un selector exclusivo de personal requiere otro diseño que preserve esa regla y sus reservas existentes.

## Compatibilidad y despliegue

Agregar una migración nueva posterior a las dos ya aplicadas, no reparar ni reescribir su historial. Aplicar primero la migración y luego habilitar el nuevo cliente. No alterar productos existentes, tarifas, duraciones, buffers ni reservas. No publicar ni aplicar SQL remoto desde este trabajo; entregar el archivo exacto al usuario.

## Pruebas de aceptación

1. Un fallo de cualquiera de las inserciones o de la auditoría no deja producto ni configuración parcial.
2. Reintentos con la misma clave generan una sola alta; datos distintos con la misma clave se rechazan.
3. Dos altas concurrentes respetan el cupo del plan y las reglas de códigos únicos.
4. Un usuario sin permiso o de otra organización no puede crear ni vincular servicios.
5. Cambiar horarios en otra sesión y crear un servicio no sobrescribe ese cambio.
6. El alta individual y las sugerencias no envían la configuración general de la agenda.
7. El formulario permite minutos personalizados, conserva datos ante errores y representa correctamente visibilidad y reserva online.

## Estado

Diseño pendiente de revisión del usuario. Aprobación de este documento permite escribir el plan de implementación; todavía no autoriza saltar ese paso ni aplicar migraciones o publicar.
