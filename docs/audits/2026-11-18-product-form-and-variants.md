# Formulario de productos y variantes por rubro

## Cambios

- Cambio y devolución son plazos independientes: el valor predeterminado de ropa (15/7 días) ya no impide el alta.
- Cosmética admite características comunes sin generar variantes: línea, tono, tipo de piel, contenido, presentación, composición, uso, conservación y PAO. Los demás rubros muestran sus campos pertinentes. No se inventan valores ni condiciones de garantía.
- Un atributo que genera variantes no se duplica como característica común. La API también filtra esa duplicación al consultar o editar.
- Vencimiento distingue sin dato, control por lote y no corresponde. PAO se explica como meses desde la apertura de cada envase, sin convertirlo en una fecha de lote.
- Fechas de calendario validadas en formulario y APIs. Un código de lote sin fecha y un lote inicial sin stock impiden guardar con un mensaje.
- Servicios limpian el inventario del borrador antes de validarse. No se permite convertir un producto persistido en servicio y borrar su inventario inadvertidamente. Belleza/cuidado personal ya no hereda garantía de electrónica.
- Borradores separados por usuario/empresa/producto; los antiguos sin ámbito no se recuperan en el formulario.
- Variantes: ejemplos por rubro, atributos inicialmente vacíos para ingresar valores reales, búsqueda/filtros desde dos variantes, validación de SKU/combinaciones duplicadas y al menos una variante activa.
- Lotes iniciales por variante, carga común opcional y exclusión de variantes inactivas/sin stock. Quitar una variante elimina su lote pendiente del borrador. Los lotes posteriores permiten elegir la variante existente.
- La creación con características o lotes por variante usa una transacción nueva que delega en las funciones actuales de producto/stock. Si falla cualquier lote, se revierte la creación completa.
- Las características de productos existentes se editan con su propio botón y aviso explícito de guardado separado. Las lecturas mantienen ámbito y cancelan respuestas obsoletas.

## Migración pendiente

`supabase/migrations/20261118010000_product_catalog_details_and_initial_batches.sql` crea `product_catalog_details` y `create_product_catalog_atomic`. RLS para lectura; escrituras de tabla y ejecución RPC reservadas a service_role. La API conserva autorización por empresa y permiso de productos, y valida el origen de las ediciones de características.

No se aplicó a producción. Sin activarla, los campos nuevos informan su indisponibilidad y el guardado que los necesite falla de forma explícita; no continúa descartando datos. Las altas básicas conservan el camino existente.

## Verificación local

- 368 pruebas aprobadas en 46 archivos de productos, variantes, formularios y rutas. Las pruebas posteriores de transacción/migración pendiente y campos comunes también aprobaron (29 casos en cuatro archivos, con solapamiento; no sumar como casos únicos).
- TypeScript raíz y ESLint de archivos nuevos/modificados aprobados; diff sin errores de formato.
- Chrome con fixtures: siete flujos completos de creación (cosmética simple/con variantes, ropa y servicio), en móvil/escritorio y claro/oscuro. Verificado el payload final: lotes por variante, cantidades, metadatos y cierre tras guardar. Sin errores JavaScript ni desbordes.
- Migración ejecutada solo en base local vacía `codex_catalog_isolated_20261117`, con fixtures SQL en `src/test/fixtures/product-catalog-*`. Prueba real de Postgres para lotes, rollback por fecha/SKU inválido, aislamiento por empresa y privilegios/RLS. Las funciones preexistentes delegadas usan dobles de prueba en ese fixture; no es una prueba de producción ni de toda la base.
- Sin migraciones remotas, push, merge, deploy ni cambios a la app instalada.
