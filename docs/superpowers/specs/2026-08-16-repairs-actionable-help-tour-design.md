# Recorridos ejecutables de ayuda en Reparaciones

## Objetivo

Convertir los mensajes de “Elemento no disponible en esta vista” en acciones seguras que lleven al usuario al contexto correcto sin cerrar ni reiniciar el recorrido. El caso principal es abrir “Nueva reparación” y continuar dentro del formulario; el mismo contrato debe permitir llegar al detalle, pago, entrega y apertura de caja.

## Alcance

- El recorrido podrá solicitar acciones declarativas a la página de Reparaciones.
- La página conservará la autoridad para abrir sus propios modales y validar el contexto.
- El recorrido esperará a que aparezca el siguiente anclaje antes de continuar.
- No se simularán clics mediante selectores DOM.
- No se alterará la lógica financiera, de permisos ni de persistencia.

## Arquitectura

`RepairHelpTour` recibirá un ejecutor opcional para acciones contextuales. Cada paso podrá declarar una acción de navegación conocida, separada del texto que se muestra al usuario. `HelpButton` comunicará esas solicitudes mediante un evento tipado y la página de Reparaciones resolverá únicamente las acciones que controla.

Acciones iniciales:

- `open-new-repair`: abre el formulario en modo alta.
- `select-repair`: cierra superficies de ayuda que bloqueen la lista y dirige al usuario a elegir una orden.
- `open-repair-detail`: abre el detalle de la reparación seleccionada.
- `open-repair-payment`: abre el cobro desde el detalle cuando existe saldo y precio.
- `open-repair-delivery`: abre la entrega cuando el estado lo permite.
- `open-cash-register`: inicia la apertura de caja desde el flujo de pago.

La disponibilidad y el rótulo de cada acción se resolverán desde el estado real. Una acción no disponible devolverá una razón entendible y, cuando exista, una alternativa.

## Flujo de nueva reparación

1. El paso resalta “Nueva reparación”.
2. El usuario pulsa “Abrir nueva reparación” dentro de la guía.
3. La página abre `RepairFormDialogV2` en modo `add`.
4. El recorrido espera el anclaje `repair-form-device`.
5. Cuando el anclaje está montado, el recorrido avanza y lo resalta.
6. Si el modal no aparece dentro del tiempo límite, la guía conserva el paso y muestra una explicación recuperable.

## Flujo de cobro y entrega

Si todavía no hay una reparación seleccionada, la guía ofrece “Elegir reparación” y orienta hacia la lista. Una vez abierto el detalle, puede solicitar pago o entrega. La página valida saldo, precio, estado, caja y permisos usando los mismos controles existentes; la guía nunca evita esas validaciones.

## Interfaz y accesibilidad

- El fallback tendrá título explicativo, causa y botón principal.
- Durante una transición mostrará “Abriendo…” y deshabilitará acciones repetidas.
- Los errores usarán `role="alert"`; los cambios de paso usarán una región viva.
- El foco volverá a la tarjeta del recorrido cuando una acción no pueda completarse.
- El usuario siempre podrá volver, omitir o cerrar el recorrido.

## Contrato adaptable

Los pasos usarán identificadores semánticos de acción y anclaje. Los cambios visuales podrán mover un elemento sin romper el recorrido mientras conserve el mismo anclaje y el controlador de página. Si desaparece una función, el ejecutor informará que no está disponible en lugar de producir un clic silencioso.

## Pruebas

- El recorrido solicita `open-new-repair`, espera el anclaje y avanza.
- No avanza si la acción falla o el anclaje no aparece.
- Impide solicitudes duplicadas mientras abre una superficie.
- Mantiene el recorrido activo durante el cambio de modal.
- Pago y entrega respetan estados no válidos y muestran su razón.
- El comportamiento textual anterior continúa disponible cuando no existe ejecutor.

## Fuera de alcance

- Completar campos o confirmar operaciones en nombre del usuario.
- Elegir automáticamente una reparación cuando hay varias.
- Saltar controles de caja, precio, saldo, permisos o estado.
- Navegar hacia módulos externos a Reparaciones en esta iteración.
