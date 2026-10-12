# Auditoría de marketplace

Fecha: 2026-10-11. Alcance: portada `/marketplace`, búsqueda, catálogo y detalle público. Sin cambios de aplicación ni base de datos.

## Evidencia y límites

Inspección del código local; los archivos principales auditados no tienen diferencias con `origin/main`. Navegador real en producción, sin sesión: portada, búsqueda de `casio` (27 productos), apertura del detalle de Reloj Casio LTP 1169N 7ARDF, vista móvil de 390 × 844. No se realizaron compras, cambios de favoritos ni mensajes a vendedores. No se verificaron RLS remotas, datos privados, checkout ni rendimiento en un iPhone físico. La lectura inicial del registro de navegador no devolvió errores/advertencias; eso no garantiza ausencia de fallos en otros recorridos. No se ejecutó la suite de tests. Graphify no está disponible ni hay índice; se usó búsqueda directa del código.

## Funcionamiento actual

La portada combina búsqueda, ofertas por empresa, categorías, marcas, productos destacados, vitrina comercial, publicidad SaaS, directorio y carruseles por empresa. Obtiene datos públicos del servidor con caché corta para catálogo. La búsqueda consulta productos y organizaciones; el catálogo completo pagina en servidor y conserva varios filtros en la URL. El modal es una vista previa: permite ir al producto o a la tienda y consultar por WhatsApp. No es un checkout multiempresa.

## Hallazgos

### P1 — Orden por precio no corresponde al precio visible

`src/lib/public/marketplace.ts:695` ordena por `sale_price` antes de aplicar promociones y construir el precio visible. Un producto con precio base alto pero rebajado puede aparecer después de otro más caro en «Menor precio». El cliente no reordena los resultados paginados. Solución: ordenar y paginar por un precio público efectivo calculado de forma consistente, contemplando precios ocultos y variantes. No ordenar solamente la página descargada.

### P1 — Disponibilidad global no usa el mismo criterio de variantes que la tienda

`src/lib/public/marketplace.ts:666` exige stock positivo en el producto padre antes de cargar variantes. La ruta de productos por organización sí calcula stock considerando variantes (`:1168`). Riesgo: un padre con cero y variantes disponibles queda fuera del catálogo global. Reproducir con un producto de prueba y unificar la regla de disponibilidad. No se confirmó un producto afectado en los datos remotos.

### P2 — Marcas incompletas por página

`src/components/public/ProductsClient.tsx:201` obtiene las marcas de `products` y usa el listado del servidor solo cuando no hay marcas en esos productos. En catálogo paginado, el selector representa la página actual, no todo el conjunto filtrado. Una marca puede desaparecer al cambiar de página. Usar facetas del servidor para todo el resultado y mantener visible la selección activa.

### P2 — Filtros de búsqueda que no se aplican

`ProductsClient.tsx:398` escribe `ofertas=1` en la URL, pero `/marketplace/buscar/page.tsx` solo recibe `q` y no pasa `initialOnlyOffers`. También puede escribir `marca`, que esa página no procesa. El botón y el selector existen, pero estos parámetros no filtran los resultados de búsqueda. Unificar el contrato de búsqueda/catálogo y probar cada filtro al recargar la URL.

### P2 — Búsqueda limitada a los primeros 120 resultados

La búsqueda consulta la base completa, pero entrega solo 120 resultados y pagina localmente ese subconjunto. Informa que hay más y pide afinar, sin ofrecer acceso directo al resto. Implementar paginación del servidor o enlazar «Ver todos los resultados» al catálogo con el término conservado. El catálogo completo sí tiene paginación real; reutilizarla.

### P2 — Estado de texto no sigue los cambios de URL

`ProductsClient.tsx:105` inicializa `query` una sola vez; el efecto de debounce compara ese estado con la URL y vuelve a escribirla. No hay sincronización de `query` con cambios posteriores de `initialQuery`. Riesgo al usar atrás/adelante o cambiar la búsqueda desde el encabezado: restaurar el término anterior. Validar navegación histórica y evitar escrituras de URL originadas por una sincronización entrante.

### P2 — Promesas de confianza sin datos que las respalden

`MarketplaceBusinessPromoShowcase.tsx:79`, `:200`, `:230`, `:240` y `:402` muestran negocios verificados, precios oficiales, productos originales y garantía oficial. La elegibilidad de esa sección depende de tener productos; el modelo consultado no aporta verificación ni garantías específicas. Sustituir por «Comercio registrado» y mostrar garantía/originalidad/verificación solo cuando existan datos y criterios comprobables. La publicación de un catálogo no prueba esas condiciones.

### P2 — Fallo de consulta presentado como catálogo vacío

La portada usa varios `.catch(() => [])`; la consulta de productos registra errores pero retorna `{ products: [], total: 0 }`. El comprador no distingue un fallo del servidor de un catálogo realmente vacío. Modelar estados `ok`, `empty`, `unavailable`; ofrecer reintento y registrar el fallo con contexto, sin revelar datos sensibles.

### P2 — Móvil: controles pequeños y modal con desbordamiento

Buscadores usan texto de 12–14 px y controles de 32–36 px en varias rutas. En Safari de iPhone, textos pequeños pueden provocar zoom al enfocar. En el modal real a 390 px se observó barra horizontal; su contenedor medía 346 px de ancho y 350 px de contenido. Aplicar texto de al menos 16 px en entradas móviles, controles táctiles de aproximadamente 44 px, `min-w-0` y ajuste de textos. Revisar a 320/390/768/1440 px y con teclado abierto. Evitar resolverlo ocultando contenido.

## Diseño y contenido

1. Portada larga y repetitiva: el mismo anafe/relojes aparece en ofertas, destacados, vitrina y carrusel de tienda. Reducir a una selección de ofertas, una de descubrimiento y un directorio compacto.
2. El hero dedica mucho espacio a explicar organizaciones y aislamiento de datos, información técnica poco útil para comprar. Propuesta: «Encontrá productos y negocios cerca de vos», búsqueda prominente y botones claros a Productos y Tiendas.
3. El botón «Ver todos» de destacados está oculto en móvil (`hidden sm:flex`). Mantener un acceso visible a todo el catálogo desde el primer bloque, además de la navegación inferior.
4. «Destacados» mezcla productos destacados y no destacados; renombrar a «Descubrí productos» o aplicar un criterio real de destacado y diversidad entre tiendas.
5. Categorías duplicadas y variantes ortográficas observadas: Estética/Estetica, Electrodomésticos/Electrodomesticos, COSINA. La agregación ya soporta categorías globales, pero conserva las tenant sin vínculo global. Corregir y vincular mediante revisión manual; no fusionar categorías solo por similitud textual.
6. Exceso de movimiento: carruseles de productos, marcas y tiendas. Los productos tienen pausa y respetan movimiento reducido, lo cual está bien; falta suspender el autoplay fuera de pantalla y con el documento oculto. Preferir desplazamiento manual en móvil y limitar vitrinas simultáneas. No se midió consumo ni FPS.
7. La identidad no es uniforme: el título de búsqueda/productos conserva «Marketplace MiPOS», mientras la portada usa branding MiTiendaPy.
8. El mensaje comercial favorece comercio/taller aunque el sistema también atiende belleza y reservas. Para ampliar marketplace, agregar navegación explícita Productos / Servicios / Negocios y una búsqueda de servicios/agenda real; no mezclar servicios en un inventario con exigencia de stock.

## Lo que conviene conservar

- Identificación del vendedor y enlaces al producto/tienda.
- Explicación clara del modal: se compra en la tienda del vendedor.
- Paginación de servidor en `/marketplace/productos`.
- Búsqueda de productos en la base, no solo sobre una lista reciente descargada.
- Control de publicación de producto y organización; filtrado de estados de suscripción en código. Esto no sustituye una auditoría de RLS ni verifica la configuración remota.
- Caché breve de catálogo y separación de datos personales.
- Estados de stock, precios rebajados, galería, contactos y soporte para movimiento reducido.

## Orden de implementación recomendado

1. Corregir contrato de filtros, navegación histórica, facetas de marcas y paginación de búsqueda.
2. Unificar precio efectivo y disponibilidad de variantes; agregar pruebas de regresión.
3. Retirar promesas no verificadas y distinguir errores de ausencia de resultados.
4. Simplificar portada: búsqueda → accesos Productos/Tiendas → categorías → ofertas compactas → descubrimiento diverso → negocios → invitación comercial discreta al final.
5. Ajustar controles y modal móvil, limitar animaciones y verificar teclado, foco y desplazamiento.

No hace falta agregar IA para resolver estos problemas: primero conviene corregir datos, reglas y navegación. Filtros por ciudad, tienda y rango de precio son mejoras posteriores útiles; deben operar en servidor sobre todo el resultado, no sobre la página visible.
