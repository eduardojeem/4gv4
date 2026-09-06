# Perfil del cliente en Marketplace

## Qué reúne

`/marketplace/perfil` concentra la actividad personal del comprador en todas las tiendas: favoritos, carritos pendientes, pedidos, reparaciones, créditos y datos de la cuenta. La administración de una empresa continúa en su panel y no comparte estas preferencias personales.

## Carritos sincronizados

- Un visitante conserva cada carrito en el navegador y separado por tienda.
- Al iniciar sesión, la aplicación combina el carrito local con el guardado en la cuenta sin duplicar cantidades.
- Antes de guardar, el servidor vuelve a consultar producto, variante, precio y stock en la tienda correspondiente.
- Si el stock disminuyó, ajusta la cantidad e informa el conflicto. Los artículos inactivos o agotados no se guardan como disponibles.
- Sin conexión, el carrito local se mantiene y la pantalla ofrece reintentar. También reintenta cuando el navegador vuelve a estar online.

Ejemplo: si la cuenta tenía dos remeras y el navegador también tenía esas mismas dos, el resultado continúa siendo dos, no cuatro. Si sólo queda una disponible, se conserva una y se muestra el ajuste.

## Historial de pedidos

Los filtros permiten buscar por tienda, estado del pedido, estado del pago y rango de fechas. Se pueden combinar y limpiar. La primera página contiene hasta 20 pedidos y el botón **Cargar pedidos anteriores** continúa mediante cursor, evitando saltos cuando entran pedidos nuevos.

La API nunca recibe ni confía en un identificador de cliente elegido por la pantalla. Primero identifica al usuario de la sesión y luego obtiene únicamente sus fichas de cliente asociadas.

## Avisos y privacidad

Cada control se guarda de forma independiente:

- avisos de pedidos, reparaciones y créditos comienzan activados;
- promociones, novedades comerciales y perfil público comienzan desactivados;
- si un guardado falla, el interruptor vuelve al valor anterior y la pantalla lo anuncia.

Estas opciones pertenecen a la persona. La visibilidad, pagos, entregas y configuración comercial de una tienda se administran desde el panel empresarial.

## Recuperación ante problemas

1. Si aparece **Se conserva en este dispositivo**, comprobar la conexión y presionar **Reintentar**.
2. Si hubo un ajuste de catálogo, abrir el carrito de esa tienda y revisar las cantidades antes de pedir.
3. Si los filtros no devuelven pedidos, presionar **Limpiar** y volver a aplicar un criterio por vez.
4. Si una preferencia no se guarda, mantener la sesión abierta y reintentar; la pantalla conserva el último valor confirmado.

## Lista de control operativa

- Probar una cuenta con actividad en dos tiendas.
- Confirmar que cada enlace abre el slug de la tienda correspondiente.
- Confirmar un carrito desde otro navegador y revisar que aparezca al iniciar sesión.
- Probar pérdida y recuperación de conexión.
- Revisar el perfil a 320, 768, 1024 y 1440 píxeles.
- Navegar con teclado por filtros, interruptores, diálogos y botones de continuación.
