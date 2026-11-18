# Detalle de venta: diseño y reimpresión

## Hallazgos y cambios

- La reimpresión existía, pero el HTML marcaba REIMPRESIÓN sin la palabra COPIA. Ahora muestra COPIA · REIMPRESIÓN y conserva número y fecha originales.
- `printReceipt` podía clonar un `receipt-content` ajeno a la venta consultada. Las copias ahora se generan exclusivamente con los datos recibidos de la venta persistida.
- La acción secundaria del encabezado tenía poca jerarquía. Reimprimir copia y Cerrar quedan en un pie fijo, separado del contenido desplazable, con explicación de que no generan otra venta/cobro.
- Se aclaran los importes históricos y la consulta de cuotas posteriores en Créditos. Los identificadores internos de cajero/sucursal ya no sustituyen nombres faltantes.
- Se conservan los controles de ámbito, permisos, anulación, errores y reintento. No se habilita reimpresión de ventas anuladas.

## Verificación

- 32 pruebas en cuatro archivos aprobadas: modal, construcción del comprobante, copia impresa y descarga/compartir.
- Dos regresiones nuevas reproducidas antes del arreglo: leyenda COPIA ausente y captura de un ticket ajeno montado en el DOM.
- Chrome con datos simulados: 320, 375, 768 y 1440 px, temas claro/oscuro. Sin desborde horizontal ni errores JavaScript; botón visible, impresión simulada y anulación/actualización comprobadas.
- ESLint de los cuatro archivos de código tocados aprobado.
- Sin operaciones sobre datos reales ni impresión física; sin push ni deploy de esta mejora.
