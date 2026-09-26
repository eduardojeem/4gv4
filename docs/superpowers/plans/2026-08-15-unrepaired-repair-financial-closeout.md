# Cierre financiero de reparaciones no realizadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar equipos como `withdrawn` o `unrepairable` conciliando cargo real, adelantos, devolución o saldo a favor y devolviendo repuestos reutilizables al inventario en una transacción idempotente.

**Architecture:** El flujo `repaired` conserva `close_repair_and_register_payment`. Un contrato y RPC separados cierran casos sin reparación; PostgreSQL bloquea y recalcula reparación, pagos, repuestos, inventario y caja. El modal usa un panel guiado y el detalle lee una auditoría persistida.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod 4, Supabase/PostgreSQL, Vitest, Testing Library.

## Global Constraints

- Usar `superpowers:test-driven-development`, `supabase`, `supabase-postgres-best-practices` y `frontend-ui-engineering` al ejecutar.
- No aceptar totales, pagos, costos ni cantidades calculados por el navegador.
- Conservar pagos históricos; registrar conciliación separada y usar `repairs.paid_amount` como neto aplicado.
- Excluir cambios ajenos de `src/components/admin/finances/`.
- No afirmar despliegue remoto sin aplicar y verificar la migración.

---

### Task 1: Contrato de dominio

**Files:**
- Create: `src/lib/repairs/unrepaired-closeout.ts`
- Create: `src/lib/repairs/unrepaired-closeout.test.ts`
- Modify: `src/lib/repairs/financial-closure.ts`

- [ ] Escribir pruebas fallidas para ambos resultados, cuatro modos de cargo, resolución única de repuestos, cobro, pendiente, devolución y saldo a favor. Rechazar campos desconocidos, transferencia sin referencia y excepcional sin motivo.
- [ ] Run: `npx vitest run src/lib/repairs/unrepaired-closeout.test.ts` — Expected: FAIL porque falta el módulo.
- [ ] Implementar esquema Zod estricto y tipos:

```ts
type ChargeMode = 'none' | 'labor' | 'labor_and_consumed_parts' | 'exceptional'
type PartDisposition = 'consumed' | 'restocked'
type Settlement =
  | { kind: 'none' }
  | { kind: 'payment'; method: 'cash' | 'card' | 'transfer'; amount: number; reference?: string }
  | { kind: 'outstanding' }
  | { kind: 'refund'; method: 'cash' | 'transfer'; reference?: string }
  | { kind: 'store_credit' }
```

- [ ] Añadir `getUnrepairedCloseoutPreview` solo para presentación; el servidor sigue siendo autoridad.
- [ ] Run: `npx vitest run src/lib/repairs/unrepaired-closeout.test.ts src/lib/repairs/financial-closure.test.ts` — Expected: PASS.
- [ ] Commit: `git commit -m "feat: define unrepaired closeout contract"` con solo estos archivos.

### Task 2: Persistencia y RPC atómico

**Files:**
- Create: `supabase/migrations/20260815120000_unrepaired_repair_closeouts.sql`
- Create: `src/lib/repairs/unrepaired-closeout-migration.test.ts`

- [ ] Escribir prueba contractual fallida que exija `repair_closeouts`, RLS, índices, `close_unrepaired_repair`, `FOR UPDATE`, idempotencia, movimientos de inventario/caja y saldo a favor.
- [ ] Run: `npx vitest run src/lib/repairs/unrepaired-closeout-migration.test.ts` — Expected: FAIL.
- [ ] Crear auditoría inmutable con tenant, sucursal, reparación única, resultado, modo y composición del cargo, pagado previo, tipo/importe/método/referencia de liquidación, IDs de caja/pago/crédito, motivo, nota, JSON de repuestos, actor, clave idempotente y fecha. Agregar `UNIQUE (organization_id,idempotency_key)`, checks y RLS de lectura.
- [ ] Ampliar `customer_store_credits.source_type` para admitir `repair` y asegurar un crédito por reparación.
- [ ] Implementar `close_unrepaired_repair` como `SECURITY DEFINER SET search_path=''`, ejecutable solo por `service_role`:
  1. bloquear y validar reparación, tenant, sucursal y no entregada;
  2. devolver resultado previo por idempotencia;
  3. bloquear/sumar `repair_payments`;
  4. exigir exactamente una resolución por cada `repair_parts.id`;
  5. calcular repuestos consumidos con `quantity * unit_price` y cargo según modo;
  6. calcular `difference = final_charge - paid_before` y validar liquidación compatible;
  7. reintegrar cada reutilizable con `product_id` a `branch_inventory` y crear `product_movements` tipo `return`, referencia `repair_closeout`; los no vinculados quedan auditados sin inventar stock;
  8. registrar cobro adicional o devolución en caja; efectivo exige caja abierta, transferencia exige referencia;
  9. insertar saldo a favor en `customer_store_credits` cuando corresponda;
  10. actualizar costo final, costo directo consumido, pagado neto, estado financiero y entrega;
  11. insertar auditoría y devolver IDs. Cualquier error revierte todo.
- [ ] Run: prueba contractual y, si existe CLI, `npx supabase db reset` — Expected: migraciones válidas. Reportar explícitamente si no pudo validarse SQL real.
- [ ] Commit: `git commit -m "feat: add atomic unrepaired repair closeout"`.

### Task 3: Adaptador RPC y errores estables

**Files:**
- Create: `src/lib/repairs/unrepaired-closeout-rpc.ts`
- Create: `src/lib/repairs/unrepaired-closeout-rpc.test.ts`

- [ ] Probar en rojo parámetros exactos y errores `REPAIR_PART_RESOLUTION_REQUIRED`, `REPAIR_CLOSEOUT_CONFLICT`, `REPAIR_CASH_REGISTER_NOT_OPEN`, `REPAIR_TRANSFER_REFERENCE_REQUIRED`, `REPAIR_ALREADY_DELIVERED`.
- [ ] Implementar llamada sin totales controlados por cliente:

```ts
await supabase.rpc('close_unrepaired_repair', {
  p_repair_id: input.repairId,
  p_organization_id: input.organizationId,
  p_branch_id: input.branchId,
  p_actor_id: input.actorId,
  p_outcome: input.request.outcome,
  p_charge: input.request.charge,
  p_parts: input.request.parts,
  p_settlement: input.request.settlement,
  p_reason: input.request.reason ?? null,
  p_note: input.request.note ?? null,
  p_cash_session_id: input.cashSessionId,
  p_idempotency_key: input.request.idempotencyKey,
})
```

- [ ] Mapear errores SQL a mensajes/status HTTP sin exponer texto crudo.
- [ ] Run: `npx vitest run src/lib/repairs/unrepaired-closeout-rpc.test.ts` — Expected: PASS.
- [ ] Commit: `git commit -m "feat: add unrepaired closeout rpc adapter"`.

### Task 4: API de entrega

**Files:**
- Modify: `src/app/api/repairs/[id]/delivery/route.ts`
- Modify: `src/app/api/repairs/[id]/delivery/route.test.ts`
- Modify: `src/app/api/repairs/_lib.ts`

- [ ] Probar en rojo que `repaired` conserva el RPC actual, los otros resultados usan el nuevo, caja se exige solo donde corresponde y errores se serializan sin runtime error.
- [ ] Bifurcar parseo y ejecución por resultado. Resolver caja para cobro y devolución en efectivo; transferencia/saldo a favor no requieren caja.
- [ ] Añadir `closeout:repair_closeouts(*)` a `REPAIR_SELECT` y devolver la reparación recargada.
- [ ] Run: `npx vitest run "src/app/api/repairs/[id]/delivery/route.test.ts" "src/app/api/repairs/[id]/payment/route.test.ts"` — Expected: PASS.
- [ ] Commit: `git commit -m "feat: route unrepaired delivery closeouts"`.

### Task 5: Panel guiado dentro del modal

**Files:**
- Create: `src/components/dashboard/repairs/UnrepairedCloseoutPanel.tsx`
- Create: `src/components/dashboard/repairs/__tests__/UnrepairedCloseoutPanel.test.tsx`
- Modify: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`
- Modify: `src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

- [ ] Probar interacciones: modo de cargo, importe/motivo, todos los repuestos clasificados, resumen, tres signos de diferencia, referencia, limpieza de campos incompatibles y etiquetas de acción.
- [ ] Implementar tarjetas accesibles, clasificación `Consumido`/`Volver a inventario`, resumen costo anterior/adelanto/cargo/diferencia, liquidación y alertas `role='alert'`.
- [ ] Explicar que un repuesto reutilizable sin producto vinculado queda auditado pero no suma stock automático.
- [ ] Integrar solo para `withdrawn/unrepairable`; preservar intacto el flujo visual de `repaired`.
- [ ] Reutilizar apertura de caja para cobro adicional y devolución en efectivo, conservando borrador y requiriendo reintento explícito.
- [ ] Etiquetas: `Cerrar y entregar`, `Cobrar y entregar`, `Devolver y entregar`, `Crear saldo a favor y entregar`.
- [ ] Run: `npx vitest run src/components/dashboard/repairs/__tests__/UnrepairedCloseoutPanel.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx` — Expected: PASS.
- [ ] Commit: `git commit -m "feat: guide unrepaired repair settlement"`.

### Task 6: Manejo recuperable de errores

**Files:**
- Modify: `src/app/dashboard/repairs/page.tsx`
- Modify: `src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

- [ ] Probar respuestas 409/422: diálogo abierto, borrador intacto, error dentro del modal y ninguna excepción no controlada.
- [ ] Convertir respuesta API en error tipado `{code,message}` capturado por el diálogo; toast solo en éxito. Código de caja cerrada habilita apertura sin perder datos.
- [ ] Run: tests del diálogo y route — Expected: PASS y ausencia del runtime error reportado.
- [ ] Commit: `git commit -m "fix: keep repair closeout errors inside dialog"`.

### Task 7: Detalle, tipos y mapeo

**Files:**
- Modify: `src/types/repairs.ts`
- Modify: `src/utils/repair-mapping.ts`
- Modify: `src/utils/repair-mapping.test.ts`
- Modify: `src/components/dashboard/repairs/RepairDetailDialog.tsx`
- Modify: `src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`

- [ ] Probar en rojo normalización y vista de resultado, cargo, pagos brutos, devolución/crédito, neto, repuestos, motivo y responsable.
- [ ] Crear `RepairCloseout`/`RepairPartResolution`, agregar `closeout` a `Repair` y normalizar números/JSON sin alterar pagos.
- [ ] Renderizar “Cierre sin reparación” solo con auditoría. Enlazar saldo a favor con su ruta canónica; no usar `customer_credits`, que representa deuda.
- [ ] Run: `npx vitest run src/utils/repair-mapping.test.ts src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx` — Expected: PASS.
- [ ] Commit: `git commit -m "feat: show unrepaired repair closeout details"`.

### Task 8: Verificación, revisión y sincronización

- [ ] Ejecutar toda la suite focalizada de Tasks 1–7.
- [ ] Run: `npm run typecheck`, ESLint sobre archivos tocados y `git diff --check`; separar fallos preexistentes.
- [ ] Revisar tenant/sucursal, permisos, locks ordenados, doble devolución/stock, idempotencia, caja y totales forjados usando `code-review-and-quality`, `security-and-hardening` y `superpowers:requesting-code-review`.
- [ ] Probar en navegador: retiro sin cargo; imposible con repuesto reintegrado; adelanto superior a saldo a favor; devolución en efectivo con caja cerrada/abierta. Revisar consola, red y móvil/escritorio.
- [ ] Comparar migraciones locales/remotas, aplicar la nueva migración con autorización y verificar tabla, función/permisos y transacción. Si faltan CLI/credenciales, reportar base remota no sincronizada.
- [ ] Confirmar `git status --short`, excluir Finanzas, commit de correcciones focalizadas y `git push` solo tras evidencia verde y dentro de la ejecución autorizada.
