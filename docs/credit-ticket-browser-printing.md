# Impresión de créditos en ticket: recorte lateral en Chrome

El usuario confirmó papel de 80 mm con un costado correcto y el otro incompleto. El generador creaba una página PDF de 80 mm con contenido centrado dentro del papel nominal. Chrome puede imprimir PDF con escala real y recortar al área útil; un driver con 72 o 64 mm imprimibles puede perder el costado derecho. El comportamiento de escala predeterminada de PDF se describe en [Chromium 402056134](https://issues.chromium.org/issues/402056134).

Los comprobantes de pago, abonos y estados de cuenta en rollo ahora registran una vista HTML de impresión junto al PDF. Usa las mismas filas e importes del documento, ancho `100%` con un máximo seguro, tablas de ancho flexible y salto de línea incluso para referencias sin espacios. No fija el ancho de página ni una altura que recorte el contenido: el navegador distribuye el documento según el papel y área disponibles del driver.

`printPdfDocument` usa esa vista para tickets, con un único llamado a imprimir en un iframe, sin abrir ventanas emergentes. Los textos se escapan y el documento bloquea scripts y recursos externos. A4, descarga y compartir conservan el PDF. El selector de ancho Normal/Más angosto/Muy angosto sigue aplicándose.

## Verificación

- 86 pruebas en 8 archivos aprobadas: recibos, abonos, cuotas, PDF, anchos e impresión.
- TypeScript `--noEmit --skipLibCheck` y ESLint enfocado: salida 0.
- Chrome 155.0.8059.79 y Edge 155.0.4283.45, ejecutables instalados en este equipo, generaron impresiones PDF con anchos de 80, 72, 64 y 58 mm. Se comprobaron las coordenadas de todos los textos dentro de cada página, las 50 observaciones, las 12 descripciones de producto, la referencia larga completa, el saldo y el pie final.
- Se usó un comprobante sintético deliberadamente largo, que ocupa 3–4 páginas al simular una longitud de papel de 200 mm. La vista permite la paginación del driver en vez de descartar contenido.
- Artefactos de prueba: `credit-print-chrome` y `credit-print-edge` en la carpeta de visualizaciones de este chat. Ningún pago real se registró para probar.

Para repetir: definir `CREDIT_PRINT_ARTIFACT_DIR`, ejecutar `thermal-print.test.ts` para exportar el comprobante real de prueba, y ejecutar `node scripts/verify-credit-thermal-print.cjs` con `CREDIT_PRINT_BROWSER_PATH` y `CREDIT_PRINT_PDFJS_PATH` (build `legacy` de PDF.js para Node).

No se cambió la base de datos y no hace falta otra migración. La prueba física con el driver y la impresora del usuario queda pendiente de publicar. El navegador no permite seleccionar ni cambiar silenciosamente el papel configurado en una impresora; debe mantenerse el rollo de 80 mm elegido en el puesto.
