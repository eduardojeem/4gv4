# POS — integridad de la venta

**Estado:** `01`, `02` y `03` se aplicaron a mano en producción el 2026-10-26 desde el SQL Editor, después de `dryrun_01.sql` y `dryrun_03.sql` sin errores. La verificación posterior dio v2 con IVA por producto, v5 sin borrado de líneas, snapshot con costo de variante y dashboard con costo histórico. **No figuran en el historial de migraciones de Supabase**: una base nueva (rama o local) no las tiene hasta copiarlas a `supabase/migrations/`. Copiarlas es seguro porque son idempotentes: si ya están aplicadas, avisan y no hacen nada.

Estos archivos están fuera de `supabase/migrations/` a propósito: la integración Supabase/GitHub aplica a producción todo lo que está ahí al fusionar en `main`. No ejecutar en producción sin autorización humana explícita.

| Archivo | Qué corrige |
|---|---|
| `01_pos_variant_lines_and_product_tax.sql` | Ventas con variantes: v5 borraba y reinsertaba líneas, y eso choca con los snapshots de costo (`ON DELETE RESTRICT`, inmutables) y con las atribuciones de comisión (solo agregar). Ahora v2 inserta una línea por (producto, variante) y v5 solo valida y descuenta stock. En mayorista, una variante sin precio mayorista propio hereda el del producto. **IVA por producto** (`products.tax_rate` 0/5/10) cuando los precios incluyen IVA. |
| `02_variant_cost_snapshot.sql` | El snapshot de costo usa el costo de la variante si lo tiene. |
| `03_dashboard_net_and_historical_cost.sql` | «Ventas sin IVA» = total − IVA (no `subtotal_amount`, que es el bruto antes de descuentos y con IVA). Costo de mercadería desde los snapshots (costo histórico), con el costo actual como respaldo. |

Los céntimos del descuento general **no** necesitan SQL: la web ya redondea el descuento general a la moneda y la ruta `/api/pos/process-sale` lo reparte en las líneas (`p_order_discount_rate = 0`). Eso funciona con la base actual y con esta etapa aplicada.

## Cómo aplican

01 y 03 no reescriben las funciones a mano. Toman la definición vigente (`pg_get_functiondef`), reemplazan bloques exactos y **abortan** si alguno no está (`POS_V2_CONTRACT_CHANGED|…`, `DASHBOARD_POS_SUMMARY_CONTRACT_CHANGED|…`). Si abortan, la función de producción no es la del repo: revisar a mano antes de seguir. Son idempotentes: si ya están aplicadas, avisan y no hacen nada.

## Orden

0. `diagnose.sql` (solo lectura) y `dryrun_01.sql` / `dryrun_03.sql`: ejecutan todo, incluida la compilación de la función parchada, y terminan en `ROLLBACK`. Si la prueba en seco no da error, el archivo real aplica.

1. Probar en una rama de Supabase o base local: `01` → `02` → `03`.
2. En esa base, una venta con una variante, otra con dos variantes del mismo producto, una mayorista con variante sin precio mayorista y una con productos de IVA 5% y 10%. Correr `verify.sql`.
3. Con autorización, aplicar en producción en el mismo orden. 01 y 02 pueden ir juntos; 03 es independiente.
4. Recién después, si se quiere dejarlas en el historial, copiarlas a `supabase/migrations/` con el número con el que se aplicaron (ver `src/test/migration-history-alignment.test.ts`).

## Reversión

`rollback_01.sql`, `rollback_02.sql` y `rollback_03.sql` devuelven cada función a la definición anterior. **`rollback_01` vuelve a la v5 que hace fallar las ventas con variantes**: usar solo si 01 causó algo peor.

## Límites conocidos

- Con precios **sin** IVA incluido se mantiene la tasa única: el total depende de la tasa y el POS todavía la calcula así. Cambiar solo la base haría rechazar cobros.
- v2 sigue descontando el stock agregado del producto padre en `branch_inventory` también para variantes (comportamiento previo, no cambia acá).
- Los snapshots ya guardados no cambian (son inmutables): el costo de variante corrige ventas nuevas.
