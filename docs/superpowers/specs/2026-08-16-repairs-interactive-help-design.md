# Guia interactiva y manual visual de Reparaciones

## Objetivo

Convertir el boton actual de ayuda de Reparaciones en un centro de orientacion contextual que permita a operadores, tecnicos y administradores completar tareas reales sin abandonar la pantalla. La misma fuente de contenido generara un manual visual descargable en PDF, evitando contradicciones entre la ayuda interna y el documento.

## Alcance

La primera entrega cubre exclusivamente `/dashboard/repairs` y los flujos relacionados que se abren desde esa pantalla:

- crear y localizar una reparacion;
- registrar diagnostico, servicio, mano de obra y repuestos;
- comprender el precio total, adelantos y saldo pendiente;
- abrir caja y registrar efectivo, tarjeta o transferencia;
- financiar el saldo mediante credito;
- entregar un equipo reparado;
- retirar sin reparar o cerrar como imposible de reparar;
- consultar historial, pagos, inventario y trazabilidad.

No se implementara reconocimiento visual por inteligencia artificial ni deteccion automatica de cambios semanticos. La adaptacion se basara en identificadores estables, capacidades declaradas y contenido centralizado.

## Experiencia principal

El boton del encabezado mostrara icono y texto `Guia y ayuda` cuando exista espacio. En pantallas estrechas conservara un boton compacto con nombre accesible.

Al abrirlo, un panel mostrara:

1. un buscador con la pregunta `¿Que queres hacer?`;
2. dos rutas principales: `Trabajo diario` y `Administracion y cobros`;
3. accesos rapidos a las tareas mas frecuentes;
4. respuestas breves para dudas puntuales;
5. acciones `Iniciar recorrido` y `Descargar manual PDF`;
6. progreso del recorrido y opcion para reiniciarlo.

La ayuda no sera una lista extensa de acordeones como unica interfaz. Primero priorizara acciones; las explicaciones detalladas quedaran como segundo nivel.

## Recorridos contextuales

Cada paso tendra:

- titulo y explicacion breve;
- una accion esperada;
- una ruta opcional;
- un `anchorId` estable;
- una alternativa textual cuando el elemento no este disponible;
- una categoria de rol o permiso.

Los elementos importantes de Reparaciones expondran atributos como `data-help-id="repair-new"`, `data-help-id="repair-filters"` y `data-help-id="repair-payment"`. El recorrido buscara el ancla cuando se muestre cada paso, desplazara la pantalla de forma suave, movera el foco cuando sea apropiado y resaltara el elemento sin bloquear la operacion normal.

Si un ancla no existe porque cambio el layout, el usuario no quedara atrapado: el paso se omitira, se mostrara su alternativa textual o se ofrecera navegar a su ruta. En desarrollo, una prueba de contrato detectara anclas declaradas que ya no aparecen en los componentes esperados.

El sistema no intentara adivinar automaticamente el significado de un boton nuevo. Los cambios de contenido se realizaran en una unica definicion tipada, mientras que la deteccion de presencia evitara recorridos rotos.

## Contenido por ruta

### Trabajo diario

- crear orden y seleccionar o crear cliente;
- identificar equipo, falla, prioridad y tecnico;
- avanzar por diagnostico, reparacion y listo para entregar;
- agregar servicio, mano de obra y repuestos;
- registrar notas y revisar historial;
- cobrar un adelanto o saldo;
- entregar reparado, retirar sin reparar o declarar imposible de reparar.

### Administracion y cobros

- diferencia entre costo interno, precio de repuesto, mano de obra y total del cliente;
- precio automatico, presupuesto acordado y ajuste manual autorizado;
- saldo pendiente, adelantos, devoluciones y cierre sin reparacion;
- caja abierta, medios de pago y referencias obligatorias;
- credito, cuotas e impacto en el saldo de la reparacion;
- retorno de repuestos al inventario;
- pagos, movimientos de caja, notas internas y auditoria.

Las explicaciones financieras incluiran ejemplos en PYG y advertencias claras sobre operaciones que crean movimientos auditables.

## Fuente unica de contenido

Se ampliara el modelo actual de `guides.ts` hacia una estructura tipada que contenga rutas, tareas, pasos, enlaces, roles, ilustraciones y texto para PDF. El panel interactivo y el generador del manual consumiran esta misma estructura.

Las ilustraciones seran diagramas y miniaturas mantenibles basadas en componentes o SVG propios. Las capturas de pantalla se usaran solo cuando aporten informacion que no pueda expresarse con una ilustracion estable. Esto reduce el deterioro visual cuando cambian colores, espacios o posiciones.

## Manual PDF

El PDF sera una salida versionada y descargable, no una copia independiente redactada a mano. Incluira:

- portada, version y fecha de generacion;
- mapa completo del proceso;
- capitulos de trabajo diario y administracion;
- ejemplos visuales de costos, pagos, caja, credito y entrega;
- decisiones para equipos no reparados;
- lista de controles de auditoria;
- indice y referencias a las rutas del sistema.

El archivo se generara durante el desarrollo o lanzamiento desde la definicion compartida, se renderizara a imagenes para control visual y se publicara como recurso estatico descargable. Un cambio de contenido requerira regenerar el PDF; una prueba verificara que la version del PDF coincida con la version de la guia.

## Estado y preferencias

El progreso y la preferencia `No volver a mostrar` se guardaran por usuario y version de guia. Si aumenta la version por un cambio importante, el sistema podra ofrecer `Ver novedades` sin borrar el historial anterior. La ausencia o fallo de persistencia no impedira abrir la ayuda.

## Accesibilidad y responsive

- navegacion completa por teclado;
- foco visible y retorno de foco al cerrar;
- dialogos y resaltados anunciados correctamente;
- contraste WCAG AA;
- texto util sin depender solamente de color o iconos;
- panel util a 320, 768, 1024 y 1440 px;
- recorrido con alternativa no superpuesta en pantallas pequenas;
- respeto por `prefers-reduced-motion`.

## Manejo de errores

- ancla ausente: omitir o mostrar alternativa y registrar diagnostico solo en desarrollo;
- ruta sin permiso: ocultar la accion y explicar el requisito si corresponde;
- PDF ausente o desactualizado: deshabilitar descarga con mensaje claro, sin romper la ayuda interna;
- contenido invalido: fallar pruebas de esquema antes del despliegue.

## Verificacion

- pruebas unitarias del esquema, filtrado por rol, busqueda y resolucion de anclas;
- pruebas de interaccion del panel y recorrido;
- prueba de contrato entre pasos y `data-help-id` esperados;
- prueba de version compartida entre guia y PDF;
- verificacion de teclado y accesibilidad;
- prueba real en navegador en 320, 768, 1024 y 1440 px;
- renderizado del PDF a PNG e inspeccion visual de todas sus paginas.

## Criterios de aceptacion

- un usuario puede encontrar una tarea frecuente en menos de tres acciones;
- puede iniciar, avanzar, omitir, finalizar y reiniciar un recorrido;
- ningun paso lo bloquea si cambia o desaparece un elemento del layout;
- operador y administrador ven contenido pertinente a sus permisos;
- ayuda interactiva y PDF comparten contenido y version;
- los flujos financieros describen correctamente caja, pagos, credito, saldo e inventario;
- la experiencia funciona sin errores de consola y cumple los controles responsive y de accesibilidad definidos.
