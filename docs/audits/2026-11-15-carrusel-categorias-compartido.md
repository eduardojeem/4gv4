# Carrusel compartido de categorías — 2026-11-15

Web y móvil comparten el contenido editorial y la función de orden en src/lib/public/marketplace-showcase-content.ts. La web conserva su diseño; la app recibe el resultado por /api/mobile/marketplace/catalog y deja de incluir una lista promocional independiente.

El contenido sigue definido en código: no se agregó un editor ni una tabla de configuración. Cambios de textos e imágenes del archivo compartido publicados en el servidor llegan al nuevo cliente móvil al actualizar el catálogo. Cambios de diseño nativo siguen requiriendo actualización móvil. El cliente anterior continúa funcionando porque el contrato agrega un campo opcional.

Las tarjetas disponibles y sus cantidades se calculan con buildCategoryShowcase sobre los productos del país/ciudad seleccionados, antes de paginar. Se conserva el mínimo existente de tres productos por rubro; se ordena por cantidad. Sin rubros disponibles el carrusel se oculta. Los botones filtran todas las categorías del rubro por identificador, sin buscar su título en nombres de productos. El filtro común admite múltiples categorías separadas por coma y mantiene la coincidencia con categoría padre.

Verificaciones: pruebas de contenido compartido, filtros, contrato API y separación geográfica, regresiones del carrusel web; TypeScript raíz y móvil; ESLint (la pantalla principal conserva el aviso anterior de openRegistration sin usar). React Native Web con fixtures en 375 y 768 px: selección, búsqueda, vacío, sin desborde ni errores. Las imágenes y los módulos nativos fueron simulados en esta comprobación; no se probó en un teléfono físico.

No requiere migración. Sin producción, commit, push ni deploy. Para disponibilidad pública se necesitan API publicada y nuevo cliente móvil; no se publicó ninguno en esta tarea.
