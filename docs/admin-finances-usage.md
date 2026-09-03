# Finanzas: guía de uso y alcance del rediseño

## Uso diario

1. Entrá a `/admin/finances`, elegí sucursal y período.
2. Consultá resultado económico y flujo por separado. El flujo no representa el saldo disponible en caja o banco.
3. Usá **Nuevo gasto** para registrar una obligación. Registrar no implica pagar.
4. **Ver gastos vencidos** abre saldos actuales de todos los períodos; **Volver al período seleccionado** regresa a la consulta contable.
5. En Gastos buscá por concepto o proveedor. La búsqueda consulta el servidor antes de paginar (50 por página), no solo los registros visibles. El selector de categoría es independiente.
6. Configuración comienza con Personal y Sueldos Base; las reglas siguen en su propia pestaña. Nómina conserva preparación, aprobación y pago; **Verificar saldos** es una indicación, no un cierre contable nuevo.
7. **Actualizar** recarga el resumen y la sección montada sin desmontarla. Cambiar organización/sucursal sí descarta el estado operativo anterior para no reutilizar registros fuera de su alcance.
8. **Cómo funciona** ofrece ejemplos de venta a crédito, gasto parcial, nómina y rentabilidad.

## Ejemplos

- Alquiler de Gs. 500.000, abono de Gs. 200.000: vencimientos muestra Gs. 300.000 pendientes. La fecha contable y la fecha del pago afectan vistas distintas.
- Venta a crédito de Gs. 1.000.000, cobro inicial de Gs. 200.000: ingresos de venta y cobros no son iguales. Cobros de créditos antiguos pueden hacer que la relación cobros/ingresos supere 100%; no es una tasa de recuperación de cartera.
- Aprobar una nómina no registra un pago. Se conserva el flujo de autorización y las operaciones atómicas existentes.

## Errores de conexión

Ante un resultado de pago incierto, verificá el estado antes de crear otro. Reintentar dentro del mismo diálogo conserva la clave idempotente. Tras confirmación del servidor, **Actualizar estado** solo recarga; no repite el pago. La identidad no se conserva al cerrar/reabrir o recargar el navegador: no se implementó un nuevo registro persistente de intentos.

## Contrato y límites

- La ruta existente `GET /api/admin/finances/obligations` acepta `search` (hasta 120 caracteres) y `dueView=overdue|upcoming`. `dueView` omite el rango contable, conserva organización/sucursal y selecciona obligaciones pendientes según su vencimiento.
- La búsqueda entre concepto/proveedor utiliza valores entrecomillados en PostgREST; caracteres de comodín se sustituyen por espacios. No permite construir filtros desde texto arbitrario. Referencia: [Supabase, or](https://supabase.com/docs/reference/javascript/using-filters-or).
- Resumen carga obligaciones del período comparado más obligaciones pendientes históricas; mantiene los límites de consulta existentes. Si se superan, falla explícitamente en vez de mostrar un total truncado.
- El resultado económico conserva su período; vencimientos usa saldo actual (`amount - paid_amount`), no una reconstrucción histórica a la fecha de corte.
- No se modificaron migraciones, RLS, funciones SQL de pago, reglas de activación ni variables de entorno. No requiere SQL nuevo.
- Se mantiene Finanzas separado de Reportes. Los ejemplos son de gestión, no asesoramiento tributario ni certificación contable.

## Verificación pendiente de operación

Revisión con sesión administrativa realizada el 02/09/2026: apertura/cierre de ayuda y Nuevo gasto, carga de categorías, acceso a vencidos, búsqueda por proveedor, coincidencia de saldos entre resumen/lista/modal y carga de Personal y Nómina. En una ventana de 691 × 618 se reprodujo una superposición del campo Referencia con el pie de pago; se corrigió usando un contenedor de desplazamiento externo al fieldset y se comprobó que el campo queda por encima de los botones. No se ejecutaron escrituras. Queda pendiente la matriz completa de tamaños móvil/escritorio.

Las pruebas automatizadas usan fixtures/mocks. Verificar con sesión administrativa en móvil y escritorio: nuevo gasto, vencidos antiguos, búsqueda en más de 50 registros, pago parcial, nómina, cambio de organización y reconexión. No se ejecutaron pagos reales ni modificaciones de la base de producción durante este trabajo.
