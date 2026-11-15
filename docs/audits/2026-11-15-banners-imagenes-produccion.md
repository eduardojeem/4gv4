# Banners de producción: recursos ausentes y optimización — 2026-11-15

## Causa observada

La página pública https://mitiendapy.com/juanbarber/inicio responde 200 y referencia archivos /images/promotional-carousel/hero-barberia-*.jpg. Las cuatro rutas comprobadas (turnos, combo, insumos y barba) respondieron 404 y content-type text/html. Los JPG existen localmente, pero los cinco originales de barbería aparecen sin seguimiento en Git. No se atribuye el fallo a CSP ni a la cuota del optimizador: el recurso fuente ya falta.

La subida propia de imágenes ya utiliza optimizeServerImage con perfil banner y salida WebP. El defecto de esta captura corresponde a recursos de plantilla, no a la ausencia de un optimizador de subidas.

## Corrección local

- Ocho plantillas convertidas con el optimizador existente, conservando los originales sin cambios. Suma de originales 5.514.626 bytes; WebP 788.492 bytes: aproximadamente 86% menos. Sin ampliación artificial de resolución.
- Nuevas referencias WebP en las plantillas. PROMOTIONAL_TEMPLATE_ALIASES mantiene compatibles los JPG guardados. Next configura redirects 307 para esos ocho archivos; no requiere modificar registros de Supabase.
- PromotionalImage sirve los WebP ya comprimidos directamente, muestra aviso y reintento en el editor y evita el icono roto en la tienda pública. Miniaturas pequeñas usan un estado compacto y controles utilizables.
- No se modifica el comportamiento global de AppImage ni la política existente de optimización de fotos subidas.

## Archivos necesarios al publicar

Además del código de compatibilidad y los componentes, deben incluirse todos estos archivos de public/images/promotional-carousel:

- hero-barberia-turnos.webp
- hero-barberia-combo.webp
- hero-barberia-insumos.webp
- hero-barberia-barba.webp
- hero-barberia-spa.webp
- hero-linea-corporativa.webp
- hero-moda-esenciales.webp
- hero-moda-urbana.webp

La prueba promotional-template-assets.test.ts verifica existencia, formato, dimensiones máximas y peso de cada destino. Dejar los recursos fuera del commit provocaría un fallo en CI al ejecutar esta prueba.

## Verificación

52 pruebas de regresión aprobadas en nueve archivos: editor, carrusel público, ofertas, almacenamiento, recursos y optimizador. Reejecución enfocada de los cinco casos de recurso/fallback después del ajuste compacto. TypeScript con salida 0; ESLint sin errores; diff --check sin errores.

Servidor Next del proyecto en puerto 3002, únicamente para verificar archivos: las ocho rutas JPG respondieron 307 al WebP correspondiente y los ocho WebP devolvieron 200 con image/webp y tamaño correcto. Servidor de prueba detenido al terminar.

Chrome 390 y 1280 px, con componentes reales, Next Image y datos/red simulados: miniaturas y carrusel cargados, sin desbordamiento ni errores de página; un 404 externo simulado mostró el aviso y el reintento recuperó la imagen. Capturas banner-images-390.png y banner-images-1280.png en la carpeta de visualizaciones de la sesión.

## Límites y estado

Cambios en C:/proyecto/mitiendapy. El puerto 3000 corresponde a otra carpeta de Claude, scratchpad/sync-codex-gemini; no se reinició ni modificó esa carpeta. Sin push, commit, merge, deploy, migraciones ni escrituras en producción. La solución NO está publicada todavía: hay que llevar código y recursos juntos al despliegue. No aplicar solamente cambios de base ni solamente referencias a WebP.