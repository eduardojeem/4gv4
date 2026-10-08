# Reservas para barberías y negocios de servicios

Fecha: 2026-10-08. Estado: alcance aprobado; diseño técnico pendiente de revisión del usuario. No implementado.

## Objetivo y alcance

Mejorar la agenda existente, no crear otro sistema paralelo. Cada organización decide cómo ofrece profesionales, tarifas, disponibilidad y reservas. La experiencia debe servir a barberías, peluquerías y otros servicios con citas. Conservar la integración con el catálogo, el módulo `services` y el POS.

Se entrega en tres etapas independientes y verificables. Las migraciones se preparan en el repositorio; las aplica el usuario. No se modifica la base remota ni se publica a producción en esta tarea sin autorización adicional.

## Base comprobada en el repositorio

- `agenda_settings` contiene horario general, confirmación, anticipación y ventana de reserva.
- `agenda_professionals` identifica al profesional; `agenda_professional_services` asigna servicios. Lista vacía significa todos los servicios actualmente.
- `agenda_services` define duración y publicación; el precio proviene del producto de tipo servicio.
- `appointments` conserva precio, inicio, fin, profesional, estado, token público y vínculo `sale_id`.
- `publicSlotsFor()` y `availableSlots()` generan disponibilidad. El trigger de solapamiento serializa escrituras por organización/profesional.
- El cliente puede cancelar o reprogramar desde su enlace; el panel abre WhatsApp manualmente y enlaza el cobro al POS.

Esta evidencia es estática: no prueba migraciones remotas, concurrencia real ni operación autenticada.

## Arquitectura elegida

Ampliar estas tablas y centralizar cotización/disponibilidad en helpers de agenda compartidos por panel, reserva pública y reprogramación. No duplicar reglas en React. Separar interfaces de configuración de la lógica de disponibilidad y persistencia.

Alternativas descartadas: guardar todas las reglas en un JSON opaco dificulta restricciones y concurrencia; crear una agenda independiente duplica catálogo, reservas y cobros.

## Etapa 1: profesionales y disponibilidad

### Elección y visibilidad

- Configuración `professional_selection`: `disabled`, `optional`, `required`; valor inicial `optional` para conservar el comportamiento existente.
- `disabled`: el público no elige; el servidor asigna un profesional elegible disponible. `optional`: permite elegir o pedir cualquiera. `required`: exige una elección explícita y muestra el selector incluso con un único profesional.
- Visibilidad de reservas online independiente de `is_active`: ocultarlo online no lo elimina del panel ni del historial. Un profesional oculto no recibe asignaciones automáticas públicas.
- Con cero profesionales, conservar la agenda única en modo desactivado/opcional. Si la elección es obligatoria, bloquear la reserva y explicar al administrador que debe configurar profesionales.
- Cambiar o desactivar profesionales no cancela ni altera turnos existentes.

### Tarifas y duración

- Cada asociación profesional/servicio puede tener precio y duración particulares, ambos opcionales. `null` hereda el servicio; cero es un precio válido, no un fallback.
- Mantener la semántica de asignación actual: una tarifa particular no debe convertir accidentalmente «hace todos» en «solo este servicio». Separar restricciones de servicios y overrides tarifarios en el modelo, con claves y referencias por organización.
- La tarifa del profesional no modifica el precio del producto general.
- La reserva guarda una instantánea del nombre, precio, duración y margen entre citas. Cambios futuros de configuración no recalculan reservas existentes.
- Un cambio de horario del mismo servicio/profesional conserva precio y duración acordados. Cambiar servicio/profesional exige una nueva cotización y confirmación explícita; queda auditado.
- Para «cualquiera», cotizar la asignación concreta por horario y mostrar profesional, duración y precio final antes de reservar. Si la asignación o tarifa cambia antes de confirmar, devolver conflicto y pedir aceptación de la nueva cotización: no sustituir silenciosamente por alguien más caro.
- Si el negocio oculta el precio, mantenerlo oculto públicamente y mostrar «Precio a consultar», sin filtrar tarifas por respuestas auxiliares.

### Horarios, pausas y ausencias

- Horario semanal por profesional opcional: hereda el general si no está definido; horario vacío explícito significa no atiende. La disponibilidad pública es la intersección del horario del negocio y del profesional.
- Pausas recurrentes mediante varios tramos por día. Vacaciones y bloqueos por fecha mediante intervalos específicos por profesional o por organización.
- Margen posterior configurable por servicio y override por profesional/servicio; inicial cero. Mostrar al cliente duración de atención, no sumar limpieza al tiempo anunciado de servicio.
- Guardar fin de atención y fin ocupado por separado. Usar el intervalo ocupado para conflictos; los turnos antiguos tienen margen cero.
- Aplicar reglas de disponibilidad tanto al generar horarios como al persistir. No confiar en precio, duración o disponibilidad recibidos del navegador.
- Serializar cambios de bloqueos y reservas con un protocolo común de locks por organización/profesional para evitar carreras. Al crear un bloqueo que pisa turnos activos, rechazarlo y listar conflictos; no cancelar citas automáticamente.
- El panel puede conservar carga fuera del horario habitual con advertencia y permiso adecuado, pero nunca ignorar un solapamiento ni un bloqueo sin resolver el conflicto explícitamente.

## Etapa 2: experiencia y operación

- Flujo móvil: servicio → profesional según modo → horario → datos y resumen → confirmación. Mostrar carga/error, permitir retroceder sin perder datos y refrescar disponibilidad ante conflictos.
- Políticas independientes para cancelar y reprogramar, expresadas en minutos de anticipación. Inicial cero conserva el comportamiento anterior: hasta antes del inicio. Mostrar y guardar la política aceptada en la reserva; cambios posteriores no endurecen retroactivamente la condición del cliente.
- Las operaciones públicas se autorizan con el token de la reserva y validan estado, organización y política en el servidor. No exponer contacto ni datos internos al consultar disponibilidad.
- Agenda: próximos turnos, por confirmar, atrasados y ausencias. Distinguir precio previsto, servicios atendidos e importe efectivamente cobrado. Usar cobros vinculados, no sumar `appointments.price` como dinero recibido; contemplar descuentos, devoluciones y anulaciones.
- WhatsApp manual: «Preparar mensaje» no implica enviado. Registrar preparación por separado y permitir «Marcar como enviado» por el operador con fecha/actor. No presentarlo como prueba de entrega del proveedor. Confirmar estado de cita y preparar un mensaje son acciones distintas.
- Recordatorios automáticos por WhatsApp y cualquier contratación quedan fuera hasta que el usuario elija proveedor y autorice integración. Conservar avisos existentes al negocio por email.

## Etapa 3: reservas avanzadas

- Varios servicios consecutivos en una cita con el mismo profesional inicialmente. Guardar líneas con producto, descripción, precio y duración acordados; suma y creación atómicas. El POS consume esas líneas sin perder tarifas particulares ni duplicar cobros. Turnos antiguos siguen funcionando como una línea heredada.
- Cambiar de profesional entre segmentos no está incluido inicialmente: requiere disponibilidad coordinada y un diseño adicional.
- Recursos compartidos concretos (silla/cabina/sala): cada servicio define tipo requerido y se asigna un recurso disponible. Una silla es un recurso, no un contador sin identidad. Controlar concurrencia de profesional y recursos en una transacción con orden estable de locks.
- Lista de espera por servicio, profesional opcional y rango horario. Solicitud expresa del cliente, estado visible y baja disponible. Cuando se libera un horario, mostrar candidatos al operador y permitir ofrecerlo; no reservar automáticamente ni prometer avisos enviados sin proveedor.

## Seguridad, migraciones y compatibilidad

- RLS y permisos por organización en cada tabla nueva; referencias entre profesional, producto, bloqueo, recurso y reserva deben pertenecer al mismo tenant, incluidas escrituras directas.
- Configuración exige `settings.manage` y `services`; operaciones mantienen sus permisos actuales. No cambiar precios ni límites de los planes.
- Operaciones públicas conservan rate limit, validación de esquema y protección anti-spam existentes. Nuevos endpoints equivalentes deben recibir protección igual o superior.
- Persistencia de cotizaciones y reservas transaccional e idempotente ante reintentos. Resolver disponibilidad, precio, snapshot y ocupación conjuntamente; la lectura previa sola no garantiza disponibilidad.
- Añadir restricciones e índices, revisar grants de tablas/funciones y no exponer credenciales privilegiadas al cliente.
- Generar migraciones con la CLI, de forma aditiva y con defaults compatibles. No editar migraciones históricas ni reparar historial para simular aplicación.
- Si falta la migración requerida, conservar lectura de la agenda antigua y mostrar que las nuevas opciones no están habilitadas. No aceptar una opción nueva y descartarla silenciosamente al guardar.
- Antes de desplegar: verificar orden de migraciones, índices, referencias, historial preservado y comportamiento del POS con tarifas distintas del producto.

## Verificación y aceptación

1. Tests de elección desactivada/opcional/obligatoria, cero/un profesional, profesional oculto y elegibilidad por servicio.
2. Tests de overrides nulos/cero, snapshot histórico, tarifas distintas en «cualquiera», precio oculto y rechazo de cotización obsoleta.
3. Tests de intersección de horarios, pausas, ausencias, buffers, límites de día y zona horaria.
4. Pruebas reales de base local: dos reservas simultáneas, reserva contra bloqueo, recursos compartidos y rechazo de referencias entre organizaciones.
5. Tests de cancelación/reprogramación en el borde de la política y de transiciones de estado.
6. Tests de mensaje preparado versus envío declarado, y métricas previstas versus cobros reales.
7. Tests de múltiples servicios, idempotencia y cobro POS sin duplicaciones ni recálculo silencioso del precio acordado.
8. TypeScript, lint, diff check y navegador autenticado/público a 320, 768, 1024 y 1440 px. Informar por separado lo no comprobado en remoto o producción.

## Orden de entrega

Primero preparar y revisar el plan de implementación de la etapa 1. Entregar ese recorrido completo con migración, configuración, reserva pública, reprogramación y POS compatibles; luego avanzar a las etapas 2 y 3 con sus planes y pruebas. Ninguna etapa se declara completa solo porque existe una tabla o un control visual.
