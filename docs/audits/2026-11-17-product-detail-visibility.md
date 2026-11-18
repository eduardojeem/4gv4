# Visibilidad desde el detalle del producto

Se agrega Publicación en tienda en la ficha de Productos y en el detalle del POS. Reutiliza las cuatro opciones del editor: público con precio, público sin precio (precio para mayoristas autorizados), solo mayoristas y oculto. No confunde publicación con producto activo.

El guardado explícito envía únicamente id, visibility y hide_price al PUT existente de productos. Conserva sus validaciones, permisos y revalidación de la tienda/marketplace. El cliente comprueba products.update y acceso a Inventario o Servicios. Evita solicitudes duplicadas y descarta confirmaciones al cerrar/cambiar de empresa, producto o sucursal. Conserva el borrador si falla; comprueba la respuesta y advierte si el servidor no pudo ocultar el precio.

Se detectó que el mapeo del catálogo POS descartaba la visibilidad, el precio oculto y otros metadatos. Ahora los conserva. La actualización local de publicación modifica solo esos dos campos sobre el estado actual, manteniendo stock/precios y la caché al reabrir el detalle.

Verificación: pruebas enfocadas de guardado, permisos, fallo/reintento, ámbito, guardado parcial y sincronización del catálogo; TypeScript raíz y ESLint de lo tocado aprobados. Chrome con API simulada: las cuatro opciones en ficha/POS, 375/1280 px y claro/oscuro (8 escenarios), sin errores JavaScript ni desbordes. No se probó publicación con datos reales ni se escribieron datos de producción.

No requiere migración nueva. Sin push, merge ni deploy.
