# Diseño: endurecimiento de catálogos globales del SuperAdmin

Fecha: 2026-10-03

## Objetivo

Conservar las cinco rutas actuales del SuperAdmin y convertirlas en un sistema de datos maestros consistente, transaccional y escalable:

- `/superadmin/catalogs`: centro de control y cola operativa.
- `/superadmin/categories`: taxonomía compartida y agrupación del marketplace.
- `/superadmin/brands`: identidad oficial de marcas.
- `/superadmin/global-products`: fichas reutilizables por GTIN.
- `/superadmin/device-models`: modelos compatibles para productos y reparaciones.

El cambio debe impedir árboles inválidos, evitar éxitos parciales silenciosos, relacionar modelos con marcas por identidad estable y dejar de calcular métricas descargando miles de filas crudas en cada apertura.

## Principios y límites

1. Las tiendas conservan sus entidades locales (`categories`, `brands`, `products` y `repairs`). Los catálogos globales normalizan y enriquecen; no sustituyen la propiedad del tenant.
2. Solo SuperAdmin puede modificar datos maestros. Usuarios autenticados pueden leer únicamente los catálogos necesarios para operar.
3. Ninguna operación masiva responde éxito total cuando hubo errores parciales.
4. Las bajas son lógicas. No se eliminan referencias históricas por una acción editorial.
5. Las migraciones deben ser compatibles con los consumidores actuales durante el despliegue.
6. La primera entrega no incorpora fuentes comerciales externas ni sincronización automática con catálogos de terceros.

## Arquitectura objetivo

### Dependencias

```text
global_categories ───────┐
                         ├── global_products ──> autocompletado por GTIN
global_brands ───────────┘
       │
       └── global_device_models ──> sugerencias en productos y reparaciones

categories.global_category_id ──> agrupación del marketplace
brands.global_brand_id ─────────> nombre y logo oficiales
```

`/superadmin/catalogs` no duplica CRUD. Consume métricas agregadas y presenta acciones pendientes con enlaces a los gestores especializados.

## Fase 1: integridad de categorías

### Reglas

- Una categoría no puede ser su propia madre.
- Una categoría no puede adoptar como madre a uno de sus descendientes.
- La profundidad máxima continúa siendo tres niveles (`0`, `1`, `2`).
- Al mover un nodo, se recalcula `level` para toda su rama.
- No se puede mover una rama si algún descendiente excedería el nivel `2`.
- El recorrido en TypeScript debe tolerar datos históricos inválidos sin recursión infinita.

### Operación de base de datos

Crear una función privada/transaccional invocada solamente por el servidor con `service_role`:

```text
move_global_category(category_id, parent_id, actor_id)
```

La función bloquea las filas afectadas, recorre ancestros/descendientes con un CTE recursivo, valida ciclo y profundidad, y actualiza todos los niveles en una sola transacción. No se concede ejecución a `anon` ni `authenticated`.

La API conserva `PUT /api/superadmin/global-categories`, pero delega el cambio de padre a esa operación. Las demás propiedades pueden actualizarse junto con el movimiento o después, solo si la transacción de jerarquía fue exitosa.

### Protección defensiva

`sortGlobalCategories` mantendrá conjuntos `visiting` y `visited`. Las categorías huérfanas o cíclicas se devuelven una vez al final y se marcan como anomalía para el panel; nunca bloquean la respuesta.

## Fase 2: operaciones masivas transaccionales

### Casos incluidos

- Crear categorías desde nombres usados por tiendas y vincularlas.
- Vincular categorías existentes por coincidencia aprobada.
- Crear marcas desde nombres usados por tiendas y vincularlas.
- Vincular marcas existentes, incluyendo nombre/logo oficiales.
- Importar candidatos de productos por GTIN.
- Importar candidatos de modelos de equipos.
- Asignar categoría o marca en lote a productos globales.

### Contrato común

Cada operación recibe una lista validada y devuelve:

```ts
type BulkCatalogResult = {
  requested: number
  created: number
  updated: number
  linked: number
  skipped: Array<{ key: string; reason: string }>
  failed: Array<{ key: string; reason: string }>
}
```

Para las operaciones que deben ser indivisibles, cualquier error revierte todo. Los conflictos esperados se resuelven con `ON CONFLICT` y se registran como `skipped`, no como excepciones. La API usa `success: false` si `failed` no está vacío.

Los identificadores de filas tenant se validan contra las filas propuestas por el servidor, evitando que el cliente vincule IDs arbitrarios. La auditoría guarda la acción, actor, cantidad solicitada, resultado e identificadores afectados.

## Fase 3: identidad de marca en modelos de equipos

### Esquema

Agregar a `global_device_models`:

```sql
global_brand_id uuid references public.global_brands(id) on delete restrict
```

Durante la transición, `brand text` permanece disponible y se rellena desde la marca oficial para que versiones anteriores sigan funcionando.

### Migración de datos

1. Normalizar `brand` por nombre y alias activos de `global_brands`.
2. Completar `global_brand_id` cuando existe una coincidencia inequívoca.
3. Dejar sin vínculo los casos ambiguos y exponerlos como pendientes.
4. Cambiar la unicidad a `(global_brand_id, lower(model))` cuando el vínculo exista, conservando una restricción temporal para filas no vinculadas.
5. Actualizar API y UI para enviar `global_brand_id`.
6. Mantener lectura compatible mediante el nombre unido de `global_brands` con fallback al texto histórico.

Una renombrada de marca no necesita copiar el nombre a cada modelo para consumidores nuevos. La columna de texto se sincroniza temporalmente mediante la misma operación transaccional hasta retirar la compatibilidad.

## Fase 4: consultas escalables

### Listados

Los gestores de Productos globales y Modelos de equipos pasan a búsqueda, filtro, orden y paginación del lado servidor.

Contrato de consulta:

```text
?q=&status=&brand=&category=&sort=&page=&pageSize=
```

- `pageSize` máximo: 100.
- La respuesta incluye `items`, `page`, `pageSize` y `total`.
- Los filtros y conteos usan consultas SQL; no dependen del arreglo cargado en React.

### Métricas y candidatos

Crear funciones de lectura agregada o vistas `security_invoker` cuando corresponda para obtener:

- Uso por GTIN y cantidad de organizaciones.
- Valores candidatos más frecuentes por GTIN.
- Uso de marca/modelo en productos y reparaciones.
- Categorías y marcas locales vinculadas/no vinculadas.
- Registros activos, incompletos y desactivados aún utilizados.

No se silencian topes. Si existe un límite deliberado para candidatos, la respuesta incluye `truncated: true` y `availableTotal`.

Los índices se agregan solamente tras verificar los planes de consulta y evitar duplicar índices existentes.

## Fase 5: flujo editorial y procedencia

### Estados

Los productos globales y modelos incorporan:

```text
candidate -> review -> published -> inactive
```

Los registros existentes activos se migran a `published`; los inactivos a `inactive`.

### Metadatos mínimos

- `catalog_status`
- `source_type`: manual, tenant_consensus o migration
- `source_summary` JSON sin datos sensibles
- `confidence` entre 0 y 1
- `reviewed_by`
- `reviewed_at`
- `deactivation_reason`

Los candidatos no son visibles en el autocompletado de las tiendas hasta ser publicados. Aprobar requiere una acción explícita de SuperAdmin.

No se guardan descripciones, imágenes o nombres como oficiales únicamente porque sean los más frecuentes. La frecuencia se presenta como evidencia para la revisión.

## Centro de control `/superadmin/catalogs`

El resumen pasa a consumir una única respuesta agregada con:

- Cobertura de vínculos de categorías y marcas.
- Duplicados o coincidencias ambiguas.
- Categorías con ciclos, huérfanas o niveles inválidos.
- Marcas sin logo y marcas desactivadas todavía utilizadas.
- Productos sin marca, categoría o imagen.
- Candidatos pendientes de revisión.
- Modelos sin marca global y modelos usados pero no publicados.
- Última actualización y estado de medición de cada indicador.

Cada alerta incluye una acción concreta y filtros en el destino. `Al día` significa que todas las comprobaciones relevantes fueron ejecutadas y no tienen pendientes; un error de medición se muestra como `No verificable`, nunca como correcto.

## Seguridad

- Las rutas mantienen `getSuperAdminUser()` antes de crear el cliente privilegiado.
- Las funciones privilegiadas revocan `EXECUTE` de `PUBLIC`, `anon` y `authenticated`; solo `service_role` recibe acceso.
- Todas las tablas en `public` mantienen RLS habilitado.
- Las políticas de lectura usan `TO authenticated`; no dependen de `auth.role()`.
- Las vistas expuestas usan `security_invoker = true` o quedan sin permisos para clientes.
- IDs y acciones se validan con Zod antes de llegar a la base.
- Las URLs de imágenes conservan la política de orígenes permitidos.

## Compatibilidad y despliegue

El despliegue se divide en migraciones expand/contract:

1. Agregar columnas, funciones e índices compatibles.
2. Desplegar APIs que escriben formato nuevo y leen nuevo con fallback anterior.
3. Migrar y verificar datos históricos.
4. Desplegar UI paginada y centro de control ampliado.
5. Activar estados editoriales para nuevas importaciones.
6. Retirar columnas o rutas de compatibilidad solamente en una entrega posterior y con evidencia de cero consumidores antiguos.

Las migraciones no se aplican automáticamente al remoto durante la implementación. Se validan localmente y se entregan con comandos explícitos para revisión y aplicación.

## Manejo de errores

- `400`: datos o transición inválida.
- `401`: sesión inexistente.
- `403`: usuario autenticado sin rol SuperAdmin.
- `409`: conflicto de unicidad, ciclo o transición incompatible.
- `422`: operación válida pero no aplicable por dependencias.
- `500`: fallo inesperado; no se devuelve información interna.
- Las operaciones masivas devuelven su resumen estructurado.
- Los errores de sincronización nunca se reducen a un log seguido de éxito normal.

## Pruebas y criterios de aceptación

### Categorías

- Rechaza padre propio y ciclos indirectos.
- Rechaza una mudanza que exceda profundidad máxima.
- Recalcula los niveles de toda la rama.
- El ordenador no entra en recursión infinita con datos corruptos.

### Operaciones masivas

- Una falla inesperada revierte la operación indivisible.
- Los conflictos esperados son idempotentes.
- Los IDs no propuestos no se modifican.
- La respuesta y auditoría distinguen creados, vinculados, omitidos y fallidos.

### Modelos

- Cada modelo publicado referencia una marca global o aparece como pendiente de migración.
- Renombrar una marca se refleja en lecturas de modelos.
- Alias históricos continúan encontrando el modelo correcto.

### Escalabilidad

- Las respuestas nunca superan 100 filas de listado.
- Los totales permanecen correctos con más de 20.000 registros de uso.
- Los filtros y orden funcionan antes de paginar.
- El cliente no necesita cargar el catálogo completo para calcular métricas.

### Editorial y panel

- Los candidatos no aparecen en autocompletado hasta publicarse.
- Toda aprobación registra actor y fecha.
- El hub distingue correcto, pendiente, error y no verificable.
- Cada indicador pendiente conduce a una vista filtrada accionable.

### Verificación mínima antes de completar

- Pruebas unitarias de normalización y árbol.
- Pruebas de contrato de migraciones y permisos.
- Pruebas de rutas para autorización, conflictos y resultados masivos.
- Pruebas de componentes para paginación, filtros y estados editoriales.
- `git diff --check`, TypeScript y conjunto focalizado de Vitest.
- Aplicación en una base local o de desarrollo con consultas de verificación de integridad.
- Prueba autenticada de las cinco rutas en desarrollo.

## Fuera de alcance

- Comprar o integrar bases mundiales de GTIN.
- Moderación automática mediante IA.
- Publicar datos candidatos sin revisión humana.
- Eliminar las categorías, marcas, productos o modelos locales de cada tenant.
- Aplicar migraciones directamente a producción.

