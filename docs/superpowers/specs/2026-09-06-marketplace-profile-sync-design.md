# Diseño: perfil Marketplace sincronizado

Fecha: 2026-09-06

## Objetivo

Convertir `/marketplace/perfil` en el centro personal del comprador, con carritos disponibles entre dispositivos, preferencias persistentes, historial de pedidos navegable y una interfaz accesible y responsiva. La configuración personal debe permanecer separada de `/admin/settings`, que administra organizaciones.

## Alcance

- Persistencia de carritos autenticados por usuario y organización.
- Migración no destructiva de carritos existentes en `localStorage`.
- Funcionamiento degradado sin conexión mediante una cola local.
- Revalidación autoritativa de catálogo, variantes, precios y stock.
- Preferencias personales de notificaciones, privacidad y comunicaciones.
- Historial de pedidos paginado y filtrable.
- Fecha y estado de la última verificación de cada carrito.
- Pruebas de aislamiento, sincronización, accesibilidad y diseño responsivo.

No se modifica la administración de tiendas, la lógica financiera de pedidos, los créditos, la autenticación ni los carritos de visitantes anónimos.

## Modelo de datos

### `customer_carts`

Un encabezado por usuario y organización:

- `id uuid primary key`
- `user_id uuid not null references auth.users`
- `organization_id uuid not null references organizations`
- `created_at`, `updated_at`, `last_verified_at`
- restricción única `(user_id, organization_id)`

### `customer_cart_items`

- `id uuid primary key`
- `cart_id uuid not null references customer_carts on delete cascade`
- `product_id uuid not null references products`
- `variant_id uuid null references product_variants`
- `quantity integer not null check (quantity > 0 and quantity <= 999)`
- `observed_unit_price numeric not null check (observed_unit_price >= 0)`
- `created_at`, `updated_at`
- índice único por carrito, producto y variante, tratando la variante nula como una identidad estable

### `marketplace_user_preferences`

Una fila por usuario:

- notificaciones de pedidos, reparaciones y cuotas activadas por defecto
- promociones desactivadas por defecto
- comunicaciones comerciales desactivadas por defecto
- perfil público desactivado por defecto
- `created_at`, `updated_at`

No se almacenan preferencias puramente visuales que ya dependan del sistema o del contexto global existente.

## Seguridad y RLS

- RLS obligatoria en las tres tablas.
- Un usuario autenticado solo puede seleccionar, insertar, actualizar y eliminar filas cuyo `user_id = auth.uid()`.
- Los ítems se autorizan mediante la propiedad del encabezado del carrito.
- La organización y los productos se validan en servidor; no se confía en el `organization_id`, precio o stock enviados por el navegador.
- Las APIs utilizan el cliente autenticado para datos personales y acceso administrativo exclusivamente para revalidar catálogo público, sin exponer costos internos.
- Ninguna consulta global puede devolver carritos o preferencias de otro usuario.

## Sincronización de carritos

### Visitante anónimo

Continúa usando `localStorage`. No se crea una identidad anónima en Supabase.

### Usuario autenticado

1. Se carga el carrito remoto de cada tienda.
2. Se detectan carritos locales pendientes.
3. Se fusionan por producto y variante, tomando la mayor cantidad válida sin superar el stock actual.
4. La operación remota usa `upsert` e índices únicos para ser idempotente.
5. Tras confirmación del servidor se conserva una copia local como caché.
6. Los cambios posteriores se escriben primero en la interfaz y se sincronizan en segundo plano.

### Fallos de conexión

- La UI mantiene el carrito local y marca “Pendiente de sincronizar”.
- Una cola local registra la última intención por producto y variante, no cada pulsación individual.
- Al recuperar conexión se reintenta con límite y retroceso.
- Un error remoto nunca borra el carrito local.
- Los conflictos muestran el valor aceptado por el servidor y la razón: stock, producto inactivo o variante eliminada.

### Revalidación

El servidor devuelve nombre e imagen públicos, precio vigente, oferta vigente, stock, estado del producto, variante y organización. El navegador muestra diferencias, pero el pedido vuelve a validar todo antes de reservar stock. `last_verified_at` solo se actualiza cuando la verificación completa termina correctamente.

## Preferencias personales

La sección “Configuración de mi cuenta” incluye:

- Datos personales y ubicación.
- Cambio de contraseña.
- Notificaciones de pedidos, reparaciones y cuotas.
- Promociones y comunicaciones comerciales con consentimiento explícito.
- Privacidad del perfil.

Cada control guarda de forma independiente, muestra estado de guardado y revierte visualmente si falla. La configuración empresarial permanece enlazada y explicada como una función distinta.

## Historial de pedidos

- API autenticada con paginación por cursor estable (`created_at`, `id`).
- Filtros combinables por organización, estado operativo, estado de pago y rango de fechas.
- Valores permitidos mediante esquemas compartidos; sin filtros SQL libres.
- Primera carga renderizada en servidor y siguientes páginas bajo demanda.
- Los filtros viven en la URL para conservar navegación y poder compartir la vista.
- En móvil se muestran estado, tienda, fecha, total y acción principal; detalles secundarios permanecen desplegables.

## Interfaz

- Barra compacta de navegación por actividad y configuración.
- Avisos diferenciados para sincronizado, pendiente, sin conexión y conflicto.
- Acciones destructivas siempre confirmadas.
- Estados vacíos orientados a una acción real.
- Objetivos táctiles mínimos de 44 px.
- Jerarquía de encabezados y foco visibles.
- Sin depender únicamente del color para comunicar estados.

## Pruebas

### Base de datos y API

- RLS bloquea lecturas y escrituras entre usuarios.
- No se puede asociar un producto de otra organización.
- `upsert` repetido no duplica ítems.
- Cantidades inválidas, variantes eliminadas y productos inactivos se rechazan o ajustan explícitamente.
- Los filtros de pedidos conservan el alcance del usuario.

### Cliente

- Migración local-remota idempotente.
- Fusión de cantidades y variantes.
- Cambios de precio y stock.
- Cola offline, reintento y recuperación.
- Preferencias con éxito y rollback ante error.
- Confirmación antes de vaciar.
- Navegación completa por teclado.

### Visual

Verificación en 320, 768, 1024 y 1440 px con carritos vacíos, múltiples tiendas, pedidos extensos, errores y contenido realista.

## Entrega por etapas

1. Migración, restricciones, índices y RLS.
2. Repositorio/API de carritos y pruebas de aislamiento.
3. Cliente híbrido local-remoto y revalidación.
4. Preferencias personales persistentes.
5. Historial paginado y filtros.
6. QA visual, accesibilidad y documentación operativa.

Cada etapa debe aprobar pruebas antes de conectar la siguiente.

## Rollback

- La migración es aditiva y no modifica carritos locales existentes.
- La UI puede volver temporalmente al adaptador local mediante una bandera interna sin perder los datos remotos.
- Las tablas nuevas pueden dejarse inactivas sin afectar pedidos, créditos ni tiendas.
- No se eliminan tablas hasta confirmar que no existen clientes desplegados usando la versión nueva.

## Criterios de aceptación

- Un usuario autenticado ve el mismo carrito en dos navegadores después de sincronizar.
- Un usuario nunca puede leer o modificar el carrito de otro.
- Un carrito local se migra una sola vez y no duplica cantidades al recargar.
- Los precios, variantes y stock se verifican antes de mostrar el estado sincronizado.
- Las preferencias sobreviven al cambio de navegador.
- El historial puede filtrarse sin mezclar organizaciones o clientes.
- La página funciona con teclado y en los cuatro anchos definidos.
