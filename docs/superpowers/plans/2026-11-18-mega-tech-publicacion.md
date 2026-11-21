# Mega Tienda Tech: publicación y portada

**Objetivo:** implementar las recomendaciones aprobadas de la auditoría de Dirac Store, sin cambiar su configuración ni publicar en producción.

**Diseño:** conservar la plantilla y el color de marca; mostrar un producto real en portada y respetar textos y visibilidad del editor. La publicación requiere módulo efectivo y sección pública habilitada. Servicios y reservas usan componentes y agenda existentes; reparaciones usa un bloque compacto sin garantías inventadas. Los medios informados salen del checkout y de los controles públicos de pago.

**Tecnologías:** Next.js, React, SWR, Tailwind y Vitest existentes. Sin dependencias nuevas ni migraciones.

1. Agregar reglas compartidas de publicación de Mega Tech y medios de pago, con regresiones para módulos desactivados, publicación oculta y controles de pago.
2. Aplicar reglas a la portada, ofertas, servicios, agenda, galería y proceso. Mantener categorías y precios reales; reducir duplicación con un solo departamento.
3. Propagar módulos al encabezado y navegación móvil; eliminar ofertas fijas y accesos incompatibles. Respetar el modo WhatsApp frente al carrito.
4. Sustituir publicidad fija de pagos en el pie por métodos configurados y autorizados.
5. Verificar tests relacionados, tipos, lint y Chrome con fixtures locales en celular/escritorio y claro/oscuro. No realizar compras, reservas ni escrituras en producción.
