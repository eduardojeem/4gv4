-- ───────────────────────────────────────────────────────────────────────────
-- Publicar un producto sin mostrar el precio
--
-- Una tienda de repuestos quiere que el catálogo se vea —el cliente busca su
-- modelo, ve la foto y el stock— pero no quiere publicar el precio, porque lo
-- negocia por WhatsApp y porque la competencia lo lee igual que el cliente.
-- Hasta ahora la única forma de no mostrarlo era ocultar el producto entero.
--
-- `hide_price` no cambia la visibilidad: el producto sigue siendo `public`, se
-- lista y se filtra como cualquier otro. Sólo reemplaza el precio por un botón
-- que abre el WhatsApp de la empresa con el producto ya escrito.
--
-- Los productos que ya estaban cargados **siguen mostrando el precio** (la
-- columna nace en `false`), pero los que se carguen de ahora en más nacen
-- ocultos: por eso el default se cambia a `true` después de crear la columna.
-- Esa es la decisión del negocio que pidió la función; una tienda que quiera
-- lo contrario lo destilda en el formulario del producto.
--
-- La aplicación funciona antes de aplicar esta migración: detecta si la
-- columna existe y, si no, guarda el producto sin este dato y muestra el
-- precio como siempre.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.products
  add column if not exists hide_price boolean not null default false;

comment on column public.products.hide_price is
  'El producto se publica sin precio: la tienda muestra «Preguntar» y abre WhatsApp. No afecta la visibilidad ni el precio de venta real.';

-- Los nuevos nacen ocultos; los existentes conservan el false de arriba.
alter table public.products
  alter column hide_price set default true;
