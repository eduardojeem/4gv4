# Auditoría de Finanzas móvil, web y API — 2026-11-11

## Alcance y estado

Rama local `feat/mobile-finanzas-coherencia`, en la worktree `fin-ux`. Implementación autorizada por el usuario y revisión posterior. Sin operaciones contra producción, migraciones aplicadas, commit, push, merge ni deploy.

## Funciones implementadas

- Navegación nativa: Resumen, Gastos, Por pagar, Equipo y Rentabilidad.
- Períodos: hoy, semana, mes actual, mes anterior, últimos 30 días, año y fechas personalizadas. Las fechas móviles respetan la zona del negocio.
- Gastos: búsqueda, estados, páginas de 25 y alta mediante las APIs existentes. Registrar un gasto no se presenta como haberlo pagado.
- Pagos parciales: validación del pendiente y caja abierta de la sucursal para efectivo. Recuperación de solicitudes inciertas conservando clave y contenido antes de enviar; aislamiento por usuario y organización.
- Vencimientos de todas las fechas, con la sucursal seleccionada; ya no queda la gestión limitada a los primeros registros del resumen.
- Equipo: base, comisiones, liquidado, pagado y pendiente; etiqueta explícita de las últimas 25 liquidaciones y de que un borrador no es un pago. No incorpora generación/aprobación/pago de nómina desde móvil.
- Rentabilidad por producto, venta, reparación, colaborador o sucursal; costos ausentes identificados como información incompleta.
- CSV compartible del resumen: fecha, empresa, sucursal, moneda y valores del informe validado. Los datos faltantes se identifican; no se exporta una ganancia exacta inventada. Protección contra fórmulas en celdas de texto.

## Hallazgos corregidos

| Riesgo | Corrección |
| --- | --- |
| El estado vacío ocultaba deudas sin movimientos en el período | Criterio compartido entre web/móvil que contempla cuentas por cobrar e información incompleta |
| Una consulta de deudas fallida parecía saldo cero | Estado explícito `receivablesStatus: unavailable` y mensaje visible |
| Importes inválidos o ecuaciones inconsistentes recibidos por la UI | Validación compartida de resultados, caja, comparación, vencimientos y cartera |
| Datos anteriores bajo un nuevo filtro | El informe debe coincidir con empresa, sesión, período y sucursal; se comprueban los filtros devueltos |
| Reintento de gasto sin columna de idempotencia podía duplicarlo | Se rechaza con 503; se eliminó el segundo INSERT sin clave |
| Consultas truncadas podían producir totales parciales | Se compara el número descargado con el conteo; paginación del detalle de nómina y validación de cobertura de cartera |
| Gasto nuevo guardado siempre en PYG | Se consulta la moneda configurada; errores de configuración no se ignoran |
| Gasto histórico mostrado con otra moneda | La lista utiliza la moneda del registro y bloquea pagos si no coincide con la empresa |
| Suma de gastos/pagos históricos de distintas monedas | Guard del reporte: se rechaza el agregado incompatible, sin conversión implícita |
| Fallo al consultar la zona horaria se ocultaba | Se propaga el error, sin sustituir una consulta fallida por la zona predeterminada |
| Redondeo visual de fracciones y resultado cero llamado ganancia | Se conservan hasta dos decimales y se identifica el resultado neutro |

## Seguridad, cálculo y persistencia revisados

Se conservaron `withAdminAuth`, resolución de organización activa y validación de sucursal en las rutas existentes. El cliente móvil no decide permisos ni escribe directamente en tablas. Los pagos siguen usando el RPC atómico autenticado; no se agregó un fallback de escritura directa. El contexto privado se verifica antes y después de las consultas y antes de las mutaciones.

La revisión y suite financiera incluyen devengado frente a caja, ventas completadas, cobros parciales, cuotas, devoluciones, reparaciones, costos históricos/faltantes, egresos, nómina, recuperación de pagos y límites de consultas. El resumen de cartera es actual y se explica como independiente del período. Las estimaciones no se comparan como ganancias exactas.

## Verificación y límites

La suite financiera se ejecuta con fixtures y mocks; no certifica la calidad de registros históricos de una empresa ni el estado de un despliegue. TypeScript y ESLint se verifican tanto en raíz como en móvil. No se ejecutó la suite completa de todo el repositorio ni se publicó una compilación.

Queda pendiente la comprobación física en iPhone/Android del teclado, desplazamiento de formularios, reanudación tras cerrar la app y archivo CSV compartido. No se afirma que esas interacciones hayan sido verificadas visualmente en este trabajo.

Para comparar web y móvil, usar idénticas fechas y sucursal: el selector web existente inicializa sus fechas con el calendario del navegador, mientras móvil usa el del negocio; cerca de medianoche pueden proponer fechas diferentes. Ambos muestran el intervalo efectivamente consultado. No se agregó conversión de moneda ni se reescribieron datos históricos.

Resultados finales: 43 archivos de pruebas financieras, 366 pruebas aprobadas (exit 0). TypeScript raíz/mobile: exit 0. ESLint de archivos modificados raíz/mobile: exit 0, sin errores ni advertencias. git diff --check: exit 0. Vitest conserva advertencias previas del setup de mocks y navegación de JSDOM; no son pruebas físicas.
