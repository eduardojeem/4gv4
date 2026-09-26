# Diseño del modal de nueva reparación

Fecha: 2026-08-21

## Objetivo

Reorganizar el alta de reparaciones para que el operador pueda completar y verificar la información con menos errores, usando siempre los datos vigentes de la organización y la sucursal activa. La sincronización se refiere a clientes, técnicos, servicios, repuestos, precios y stock actuales; no incluye autoguardado de borradores.

Cuando un servicio o repuesto no exista, el operador podrá crearlo en el catálogo principal. El nuevo registro se seleccionará automáticamente en la reparación actual y quedará disponible para reparaciones futuras.

## Alcance

El cambio cubre el modal `RepairFormDialogV2`, sus componentes auxiliares, el contrato de creación de artículos del catálogo y las pruebas del flujo de alta. Se conserva la creación definitiva mediante `POST /api/repairs`, la segregación por organización y sucursal, los modos de precios existentes, el tratamiento de clientes mayoristas y el consumo transaccional de inventario.

No se implementará:

- autoguardado de reparaciones incompletas;
- creación de servicios o repuestos exclusivos de una sola reparación;
- reserva de inventario antes de confirmar la reparación;
- cambios generales al catálogo fuera del formulario reducido necesario para crear y seleccionar un artículo.

## Experiencia del usuario

### Estructura principal

El modal será amplio y tendrá una navegación por secciones, manteniendo un único formulario para evitar un asistente rígido:

1. Cliente.
2. Equipo.
3. Diagnóstico inicial.
4. Servicios y repuestos.
5. Costos y plazo.
6. Revisión final.

En escritorio, la navegación y el resumen de la reparación permanecerán visibles mientras se desplaza el contenido. En móvil, las secciones ocuparán una sola columna y el resumen será desplegable. El pie contendrá acciones consistentes: cancelar, volver, revisar y confirmar.

La denominación visible será "Equipo" porque el sistema admite teléfonos, computadoras, tabletas, accesorios y otros dispositivos. No se utilizará "Vehículo" como etiqueta general.

### Jerarquía y orientación

Cada sección tendrá título, descripción breve, estado de completitud y errores pendientes. La interfaz reutilizará los tokens, controles y tonos semánticos existentes. Se evitarán tarjetas decorativas, sombras excesivas y colores que no pertenezcan al diseño actual.

Los campos complejos tendrán ayuda contextual accesible mediante tooltip y teclado: tipo de acceso, cálculo de precios, precio mayorista, garantía, plazo estimado y diferencia entre servicio y repuesto.

### Validaciones

La validación seguirá usando React Hook Form y Zod, pero los mensajes se mostrarán junto al campo y también en el indicador de la sección. Al intentar avanzar o revisar, el foco se moverá al primer campo inválido.

Las reglas del cliente se repetirán en el servidor. El servidor continuará siendo la autoridad para permisos, pertenencia a organización/sucursal, precios permitidos, costo de inventario y stock disponible.

### Revisión final

Antes del envío se mostrará un resumen consolidado con:

- cliente y condición minorista/mayorista;
- equipo, identificación y acceso;
- problema y diagnóstico inicial;
- técnico, prioridad y plazo;
- servicios y repuestos con cantidad, precio y disponibilidad conocida;
- mano de obra, descuentos, total estimado, adelanto y garantía;
- advertencias no bloqueantes y errores que impiden confirmar.

"Confirmar reparación" será la única acción que crea la reparación. El botón se bloqueará durante el envío para impedir duplicados.

## Sincronización con datos actuales

### Lecturas

Al abrir el modal se reiniciará la sesión visual y se cargarán los datos necesarios para el formulario. Los buscadores consultarán las APIs autenticadas existentes con el encabezado de sucursal activa y sin reutilizar resultados de otra sucursal.

Las búsquedas de servicios y repuestos serán remotas, cancelables y con debounce. Cada apertura del buscador hará una consulta nueva. Un cambio de sucursal limpiará selecciones incompatibles y volverá a consultar. Se mostrarán estados diferenciados para cargando, sin resultados, sin permiso y error de red.

Los precios mostrados se derivarán de la condición actual del cliente y del producto. El precio definitivo y el costo interno se volverán a resolver en el servidor al crear la reparación. El stock mostrado es informativo hasta la confirmación; el consumo seguirá realizándose mediante la operación transaccional existente.

### Creación desde el catálogo

Los buscadores tendrán acciones "Crear servicio" y "Crear repuesto", visibles únicamente para usuarios con permiso `products.create`.

El formulario reducido de servicio solicitará nombre, precio minorista, precio mayorista opcional, costo opcional, categoría y datos fiscales que el contrato actual exija. Se enviará como artículo con unidad `servicio`.

El formulario reducido de repuesto solicitará nombre, SKU opcional, precio minorista, precio mayorista opcional, costo, stock inicial y categoría. El stock se asociará a la sucursal activa mediante el flujo existente del catálogo.

Después de una creación exitosa se invalidará la lista local, se realizará una consulta fresca, se seleccionará el artículo retornado y se recalculará el resumen. Una respuesta parcial o ambigua no se considerará éxito.

### Escritura de la reparación

La interfaz no escribirá directamente en Supabase. Mantendrá el límite API actual:

`RepairFormDialogV2 -> RepairsContext.createRepair -> POST /api/repairs -> validación tenant/precios -> inserción y sincronización transaccional de repuestos`.

La petición llevará una clave de idempotencia generada por cada intento lógico de confirmación. La API deberá rechazar o devolver el resultado previo de una repetición de la misma clave, de modo que un timeout seguido de reintento no duplique la reparación.

## Fallos y recuperación

- Si falla una búsqueda, los datos ya escritos en el formulario permanecen intactos y se ofrece "Reintentar".
- Si cambia la sucursal, se eliminan resultados remotos almacenados; cualquier selección que no pertenezca a la nueva sucursal se marca para revisión.
- Si un artículo cambia de precio o se queda sin stock antes de confirmar, el servidor devuelve un error con campo y artículo identificables. El modal vuelve a la sección correspondiente y permite actualizar los datos.
- Si la creación en catálogo falla, no se agrega una fila ficticia a la reparación.
- Si la confirmación falla antes de recibir una respuesta concluyente, el formulario conserva su contenido y reutiliza la misma clave de idempotencia al reintentar.
- La clave cambia solamente después de un éxito confirmado o cuando comienza una reparación nueva.

## Arquitectura de componentes

El archivo actual concentra demasiadas responsabilidades. La modificación extraerá unidades enfocadas sin alterar consumidores externos:

- `RepairFormDialogV2`: orquestación del formulario, apertura, modo rápido/normal y envío.
- `RepairFormSectionNav`: navegación, progreso y errores por sección.
- `RepairCustomerSection`: selección y creación de cliente.
- `RepairDeviceSection`: datos del equipo y estado de recepción.
- `RepairDiagnosisSection`: problema, diagnóstico, notas e imágenes.
- `RepairCatalogSection`: servicios, repuestos, búsquedas y creación en catálogo.
- `RepairEstimateSection`: precios, descuentos, adelanto, garantía y plazo.
- `RepairReview`: resumen previo y advertencias.
- `CatalogQuickCreateDialog`: formulario reducido discriminado por `service | part`.
- `useRepairCatalogSearch`: búsqueda cancelable, alcance por sucursal y actualización después de crear.

Los tipos de datos compartidos y la conversión hacia `RepairFormData` se mantendrán fuera de la presentación. No se duplicará la fórmula de precios: el formulario reutilizará los módulos de cálculo existentes y el servidor seguirá siendo la fuente autoritativa.

## Accesibilidad y diseño responsivo

- Orden de tabulación equivalente al orden visual.
- Títulos y descripciones enlazados al diálogo.
- Etiquetas persistentes; los placeholders no sustituyen etiquetas.
- Errores asociados mediante `aria-describedby` y resumen anunciado con `aria-live`.
- Tooltips operables por foco, puntero y teclado.
- Foco inicial predecible y retorno del foco al botón que abrió el modal.
- Controles táctiles con tamaño suficiente y pie de acciones visible sin cubrir contenido.
- Verificación en anchos de 320, 768, 1024 y 1440 píxeles, además de zoom al 200 %.

## Estrategia de pruebas

### Pruebas automatizadas

El desarrollo seguirá pruebas primero:

- contrato de búsqueda: organización, sucursal, clasificación servicio/repuesto y precios mayoristas;
- creación rápida de servicio y repuesto, actualización de resultados y selección automática;
- validaciones por sección y enfoque del primer error;
- revisión final con totales y datos consolidados;
- error de red que conserva el formulario y permite reintentar;
- timeout y doble clic que no duplican reparaciones;
- precio o stock desactualizado devuelto por el servidor;
- navegación completa por teclado;
- contratos del payload de `POST /api/repairs` y de la idempotencia.

### Pruebas en navegador

Se probará el modal autenticado en los cuatro anchos definidos, con consola y red observadas. Se recorrerán cliente nuevo/existente, cliente mayorista, servicio existente/nuevo, repuesto existente/nuevo, falta de stock, conexión interrumpida y recuperación.

### Evaluación con usuarios finales

La implementación puede preparar un guion de prueba y registrar observaciones, pero una evaluación real requiere participantes designados por el usuario. El criterio sugerido es que al menos tres operadores completen sin asistencia una reparación normal y una con artículo nuevo. Se registrarán tiempo, retrocesos, campos mal interpretados y errores. Los hallazgos bloqueantes se corregirán antes de considerar validada la usabilidad.

## Criterios de aceptación

- El operador puede completar una reparación siguiendo secciones comprensibles y revisar el resultado antes de crearla.
- Los clientes, técnicos, servicios, repuestos, precios y existencias corresponden a la organización y sucursal actuales.
- Un servicio o repuesto inexistente puede crearse en el catálogo principal y seleccionarse inmediatamente.
- Un fallo de red no borra el formulario ni produce duplicados al reintentar.
- El servidor rechaza relaciones, precios o stock inválidos con mensajes accionables.
- El flujo es operable con teclado y utilizable en los anchos definidos.
- Las pruebas enfocadas, TypeScript, ESLint y comprobación de diferencias finalizan sin errores atribuibles al cambio.
- La validación con usuarios finales se reporta como realizada solamente cuando existan participantes y resultados documentados.
