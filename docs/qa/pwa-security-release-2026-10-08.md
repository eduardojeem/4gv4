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
- `npm run build` terminó con código 0: compilación, TypeScript, 284 páginas generadas, service worker y 14/14 controles post-build aprobados, sin advertencias post-build. Esto no acredita un despliegue remoto ni instalación física.
- La suite completa sigue pendiente. Una ejecución concurrente con el build se detuvo por tiempos de espera en dos inspecciones de archivos; su repetición focalizada aprobó 13/13 pruebas. La comprobación de servicios con código PostgreSQL 42703 aprobó 8/8.
- Otra ejecución sin el build también tuvo tiempos de espera. Con `--pool=forks --maxWorkers=2`, el intento completo llegó a 72 archivos y 783 pruebas aprobadas, pero se detuvo por un mock desactualizado de «Mi turno» y dos workers que no arrancaron. El mock se corrigió sin modificar la protección contra cancelar turnos cobrados ni la duración acordada: 9/9 pruebas focalizadas aprobadas. Los dos archivos de los workers aprobaron 58/58 al ejecutarse aparte con un solo proceso. Estos resultados parciales NO equivalen a suite completa aprobada.
- La comprobación de Vercel sigue bloqueada por HTTP 403 para el equipo del proyecto; no se confirmó un despliegue remoto.
- No hay aprobación de producción ni prueba de instalación física.
