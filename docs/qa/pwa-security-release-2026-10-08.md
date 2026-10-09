# PWA: actualización de seguridad

Se reemplaza `@ducanh2912/next-pwa` por Serwist, compilado mediante esbuild después de Next. El mismo pipeline funciona con webpack y Turbopack, sin cargar un plugin PWA durante desarrollo.

- Se mantiene `/sw.js`, el manifiesto, el registro existente y su interruptor de apagado.
- Solo se cachean bundles y fuentes de `/_next/static/` del mismo origen (120 entradas como máximo, 30 días). No se precachea HTML ni se cachean APIs, RSC, páginas privadas, cotizaciones, imágenes remotas o solicitudes de escritura.
- Al activar se eliminan las cachés antiguas del plugin que podían contener datos de sesión; no se eliminan cachés ajenas.
- No se promete navegación offline a páginas privadas: el POS offline mantiene su almacenamiento y sincronización existentes, independientes de este service worker.
- El service worker se genera en el build; `public/sw.js` continúa ignorado por Git.

Antes de publicar: pruebas, tipos, lint, build, auditoría de producción y validación del artefacto generado. La instalación y actualización en un dispositivo físico siguen pendientes; no deben presentarse como probadas por tests de código.

Rollback: volver al commit anterior del código requiere también comprobar las políticas de caché; no aplicar una reversión SQL automática. Existe el interruptor de apagado del registro si se detecta un problema con el service worker.

## Evidencia local de la preparación

- `npm audit --omit=dev`: 0 vulnerabilidades. La auditoría completa conserva 5 altas y 13 moderadas de herramientas de desarrollo; no se presentan como corregidas.
- Vitest y sus adaptadores se actualizaron juntos a 4.1.11: la auditoría completa ya no informa críticas. No se aplicó `npm audit fix --force`.
- 16 pruebas de PWA/configuración/promociones aprobadas; service worker generado con esbuild. TypeScript y lint focalizado aprobados.
- `idb` se declara como dependencia directa de producción porque el POS lo importa; no depende de una dependencia transitiva del generador PWA.
- El viejo `public/sw.js` se retira del índice de Git, pero sigue en disco y se regenera durante el build; la versión anterior es recuperable desde el historial.
- Suite completa y build aún pendientes de resultado final. No hay aprobación de producción ni prueba de instalación física.
