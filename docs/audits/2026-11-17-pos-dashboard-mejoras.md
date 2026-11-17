# Dashboard POS: mejoras locales

## Alcance

Detalle de venta, cartera de créditos y actualización de estadísticas. Implementación original en `codex/pos-dashboard-mejoras`, desde `b997c9d0`. Preparada para publicación en `feat/pos-dashboard-mejoras` desde `origin/main` (`de41114c`), aplicando las diferencias con merge de tres vías, sin conflictos y conservando el checkout compartido. Otro proceso cambió la rama del checkout compartido durante la ejecución; el detalle y la opción de carga condicional se recuperaron del commit local `b84d0f95`. Ese commit no se incorpora completo: solo se recuperaron los archivos POS correspondientes.

## Cambios

- El detalle se desmonta al cambiar de venta, usuario, organización o sucursal. Descarta respuestas tardías y ofrece reintentar.
- Encabezado adaptable, acciones en Más según permisos, bloques de cliente, artículos, pagos y notas. Sucursal y cajero se identifican con los datos disponibles, sin inventar nombres.
- Los importes distinguen total, pagos al emitir y financiación registrada. No se presenta el crédito original como deuda actual: las cobranzas posteriores se consultan en Créditos.
- La reimpresión conserva saldo a favor, cantidades fraccionarias y contactos propios del comercio. Métodos no identificados producen un aviso; no se sustituyen por efectivo. La copia de ventas anuladas queda deshabilitada en este detalle.
- Anular actualiza las métricas y avisa que tarjetas y transferencias no se reintegran automáticamente. No se ampliaron permisos del servidor.
- La cartera incluye ámbito y sucursal en su carga y descarta recargas obsoletas. Una recarga fallida ya no se confirma como exitosa.
- Posventa maneja el error de un comprobante con medio desconocido. Saldo a favor aparece en español.

## Verificación

- 133 pruebas del dashboard, detalle, comprobantes y posventa: aprobadas.
- 19 pruebas de traducciones: aprobadas.
- ESLint de los archivos modificados: sin errores; las dos advertencias iniciales se corrigieron y se verificaron nuevamente.
- Chrome con componentes y CSS reales, proveedores simulados: 375/768/1440 px, claro y oscuro. Sin desbordamiento horizontal ni errores JavaScript. Impresión, anulación y actualización comprobadas con fixtures.
- No se ejecutaron transacciones reales, migraciones, push ni deploy. La revisión visual no equivale a una sesión autenticada en producción o a una prueba de impresora física.

- TypeScript global: `tsc --noEmit --skipLibCheck`, código de salida 0. `skipLibCheck` ya es la configuración del proyecto.
- `git diff --check`: aprobado.
