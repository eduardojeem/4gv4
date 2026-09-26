# Validación del modal de nueva reparación

## Objetivo

Comprobar con una sesión autenticada que el alta de reparación es comprensible, conserva los datos ante fallos recuperables y utiliza el catálogo central de la sucursal actual.

## Perfiles y datos mínimos

- Administrador con permiso para crear productos y servicios.
- Operador sin permiso para modificar el catálogo.
- Cliente minorista y cliente mayorista existentes.
- Una sucursal con al menos un servicio, un repuesto con stock y un repuesto sin stock.

No utilizar datos personales reales. Ejecutar en un entorno de prueba y eliminar las órdenes creadas según el procedimiento habitual del entorno.

## Escenarios

### Flujo principal

1. Abrir `Dashboard > Reparaciones > Nueva reparación`.
2. Recorrer Cliente, Equipo, Diagnóstico, Catálogo y Costos desde la navegación superior.
3. Seleccionar un cliente mayorista y verificar que el precio aplicado corresponda a su condición.
4. Seleccionar un servicio del catálogo y confirmar que no se trate como stock físico.
5. Seleccionar un repuesto disponible y confirmar precio, cantidad y sucursal.
6. Pulsar `Revisar reparación`.
7. Comparar cliente, equipo, diagnóstico, técnico, repuestos, mano de obra, descuento, adelanto, garantía y total final con el formulario.
8. Volver a corregir un dato y abrir nuevamente la revisión.
9. Confirmar una sola vez y verificar que se cree una única orden.

Resultado esperado: la revisión coincide con el formulario y el total confirmado; volver no borra datos; un doble intento con la misma clave no duplica la reparación.

### Catálogo faltante

1. Buscar un servicio inexistente y pulsar `Agregar servicio`.
2. Crearlo, comprobar que queda seleccionado y volver a buscarlo en otra reparación.
3. Repetir con `Agregar repuesto`, indicando stock de la sucursal.
4. Repetir como operador sin permiso.

Resultado esperado: los artículos creados quedan en el catálogo principal; el operador sin permiso recibe una explicación y no puede confirmar la creación.

### Fallos de conexión

1. Interrumpir temporalmente la respuesta de `/api/products` y buscar un artículo.
2. Verificar el mensaje contextual y pulsar `Reintentar` después de restaurar la conexión.
3. Interrumpir el POST final después de abrir la revisión y reintentar sin recargar.

Resultado esperado: no se bloquea el modal ni se pierden los datos; la recuperación vuelve a consultar la sucursal actual; el reintento final no genera duplicados.

### Responsive y accesibilidad

Ejecutar el flujo principal en 1440×900, 768×1024 y 390×844.

- No debe existir desplazamiento horizontal de la página ni acciones fuera del viewport.
- La navegación debe ser utilizable con teclado y mostrar la sección activa y sus errores.
- El foco debe quedar dentro del diálogo y volver al control anterior al cerrarlo.
- Tooltips, botones y campos deben tener nombres accesibles.
- El total final y las acciones de revisión deben permanecer visibles sin superposiciones.

## Registro de resultados

Anotar por escenario: perfil, tamaño de pantalla, navegador, resultado, tiempo aproximado, bloqueo observado y evidencia. Una evaluación con usuarios finales se considera realizada únicamente cuando al menos tres operadores completan el flujo principal sin ayuda y se registran sus hallazgos aquí o en el sistema de seguimiento del equipo.
