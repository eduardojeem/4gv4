# Repairs Actionable Help Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que los recorridos de Reparaciones abran de forma segura el formulario, detalle, pago y entrega, manteniendo el paso activo hasta encontrar el siguiente anclaje.

**Architecture:** Un contexto cliente, montado por la página de Reparaciones, publicará acciones declarativas y devolverá resultados tipados. `RepairHelpTour` solicitará esas acciones y esperará el anclaje siguiente; nunca simulará clics ni duplicará validaciones financieras.

**Tech Stack:** Next.js 16, React 19, TypeScript, Radix UI, Testing Library, Vitest.

## Global Constraints

- No simular clics mediante selectores DOM.
- No alterar la lógica financiera, de permisos ni de persistencia.
- No completar campos ni confirmar operaciones en nombre del usuario.
- El usuario siempre puede volver, omitir o cerrar el recorrido.
- Conservar los recorridos textuales cuando no exista ejecutor.

---

## File Structure

- Create `src/components/help/repair-help-actions.tsx`: tipos, contexto y hook de ejecución.
- Modify `src/components/help/repairs-guide.ts`: contrato tipado de acciones por paso.
- Modify `src/components/help/repairs-guide-content.json`: acciones declarativas de cada transición.
- Modify `src/components/help/RepairHelpTour.tsx`: CTA, estado de transición, espera de anclajes y errores recuperables.
- Modify `src/components/help/RepairHelpTour.test.tsx`: pruebas RED/GREEN de ejecución y compatibilidad textual.
- Modify `src/app/dashboard/repairs/page.tsx`: proveedor y acciones que controlan los modales reales.
- Create `src/app/dashboard/repairs/repair-help-actions.test.tsx`: pruebas del controlador de página sin ejecutar operaciones financieras.

### Task 1: Contrato declarativo de acciones

**Files:**
- Create: `src/components/help/repair-help-actions.tsx`
- Modify: `src/components/help/repairs-guide.ts`
- Modify: `src/components/help/repairs-guide-content.json`
- Test: `src/components/help/repairs-guide.test.ts`

**Interfaces:**
- Produces: `RepairHelpActionId`, `RepairHelpActionResult`, `RepairHelpActionExecutor`, `RepairHelpActionsProvider`, `useRepairHelpActions()`.
- Produces: `RepairGuideStep.navigationAction?: { id: RepairHelpActionId; label: string; successAnchorId?: string }`.

- [ ] **Step 1: Write the failing contract tests**

Add assertions that `create-repair` starts with `open-new-repair`, its target is `repair-form-device`, and every declared action has a non-empty label.

```ts
const createTask = repairsGuide.tracks.flatMap(track => track.tasks)
  .find(task => task.id === 'create-repair')
expect(createTask?.steps[0].navigationAction).toEqual({
  id: 'open-new-repair',
  label: 'Abrir nueva reparación',
  successAnchorId: 'repair-form-device',
})
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `cmd /c npx vitest run src/components/help/repairs-guide.test.ts --no-file-parallelism`

Expected: FAIL because `navigationAction` is absent.

- [ ] **Step 3: Implement the typed context and guide metadata**

Use this closed action set:

```ts
export type RepairHelpActionId =
  | 'open-new-repair'
  | 'select-repair'
  | 'open-repair-detail'
  | 'open-repair-payment'
  | 'open-repair-delivery'
  | 'open-cash-register'

export type RepairHelpActionResult =
  | { status: 'completed' }
  | { status: 'unavailable'; message: string }

export type RepairHelpActionExecutor =
  (actionId: RepairHelpActionId) => Promise<RepairHelpActionResult> | RepairHelpActionResult
```

The provider accepts `execute?: RepairHelpActionExecutor`; the hook returns it without inventing a default success.

- [ ] **Step 4: Run guide tests and verify GREEN**

Run: `cmd /c npx vitest run src/components/help/repairs-guide.test.ts --no-file-parallelism`

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add src/components/help/repair-help-actions.tsx src/components/help/repairs-guide.ts src/components/help/repairs-guide-content.json src/components/help/repairs-guide.test.ts
git commit -m "feat(repairs): define executable help actions"
```

### Task 2: Recorrido con acciones y espera de anclaje

**Files:**
- Modify: `src/components/help/RepairHelpTour.tsx`
- Modify: `src/components/help/RepairHelpTour.test.tsx`

**Interfaces:**
- Consumes: `useRepairHelpActions()` and `RepairGuideStep.navigationAction` from Task 1.
- Produces: an action CTA that advances only after `successAnchorId` exists.

- [ ] **Step 1: Write failing interaction tests**

Cover these behaviors:

```ts
it('opens a surface, waits for its anchor and advances', async () => {
  const execute = vi.fn(async () => {
    const anchor = document.createElement('div')
    anchor.dataset.helpId = 'repair-form-device'
    document.body.append(anchor)
    return { status: 'completed' as const }
  })
  // render with provider, click “Abrir nueva reparación”
  await waitFor(() => expect(screen.getByText('Completá el equipo')).toBeVisible())
})

it('keeps the current step and announces an unavailable action', async () => {
  // executor returns { status: 'unavailable', message: 'Elegí una reparación primero.' }
  // assert role=alert and same step title
})
```

Also assert that two rapid clicks call the executor once, and that a tour without a provider still shows the existing fallback.

- [ ] **Step 2: Run the tour test and verify RED**

Run: `cmd /c npx vitest run src/components/help/RepairHelpTour.test.tsx --no-file-parallelism`

Expected: FAIL because the action CTA and executor integration do not exist.

- [ ] **Step 3: Implement minimal action execution**

Add `isExecuting` and `actionError`. On success, poll `successAnchorId` with `requestAnimationFrame` for at most 2 seconds. Advance only when found. Render:

```tsx
<Button onClick={handleAction} disabled={isExecuting}>
  {isExecuting ? 'Abriendo…' : step.navigationAction.label}
</Button>
```

Use `role="alert"` for failures, preserve the textual fallback, cancel pending animation frames on unmount, and focus the action button after a recoverable error.

- [ ] **Step 4: Run tour tests and verify GREEN**

Run: `cmd /c npx vitest run src/components/help/RepairHelpTour.test.tsx --no-file-parallelism`

Expected: PASS with no console errors.

- [ ] **Step 5: Commit the interactive tour**

```bash
git add src/components/help/RepairHelpTour.tsx src/components/help/RepairHelpTour.test.tsx
git commit -m "feat(repairs): let help tours open required views"
```

### Task 3: Conectar acciones con los modales reales

**Files:**
- Modify: `src/app/dashboard/repairs/page.tsx`
- Create: `src/app/dashboard/repairs/repair-help-actions.test.tsx`
- Modify: `src/components/dashboard/repairs/RepairHeader.tsx` only if the provider cannot wrap the existing help button without changing its public props.

**Interfaces:**
- Consumes: `RepairHelpActionsProvider` and `RepairHelpActionExecutor` from Task 1.
- Produces: page executor that changes only existing modal state.

- [ ] **Step 1: Extract and test the decision function RED**

Define a pure resolver in the test’s target module:

```ts
export function resolveRepairHelpAction(
  actionId: RepairHelpActionId,
  context: { detailRepair: Repair | null; canDeliver: boolean; balance: number; hasPrice: boolean },
): { command?: 'new' | 'detail' | 'payment' | 'delivery'; message?: string }
```

Assert:

- `open-new-repair` returns `new`.
- payment without selected detail returns “Elegí una reparación primero.”
- payment with zero balance returns “Esta reparación ya está pagada.”
- payment without price returns “Definí el precio antes de cobrar.”
- valid payment returns `payment`.
- invalid delivery returns a specific state message.

- [ ] **Step 2: Run the page action test and verify RED**

Run: `cmd /c npx vitest run src/app/dashboard/repairs/repair-help-actions.test.tsx --no-file-parallelism`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the pure resolver and page executor**

The executor maps commands onto existing callbacks/state:

```ts
case 'new':
  handleNewRepair()
  return { status: 'completed' }
case 'payment':
  setIsDetailOpen(false)
  setPayTarget(activeDetailRepair)
  return { status: 'completed' }
case 'delivery':
  setIsDetailOpen(false)
  setDeliverTarget(activeDetailRepair)
  return { status: 'completed' }
```

Wrap the page content in `RepairHelpActionsProvider`. Do not submit forms, payments, deliveries, or cash opening from the executor. `select-repair` returns an explanatory unavailable result in this iteration so the user explicitly chooses the order.

- [ ] **Step 4: Run action and existing repair modal tests**

Run:

```bash
cmd /c npx vitest run src/app/dashboard/repairs/repair-help-actions.test.tsx src/components/help/RepairHelpTour.test.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx --no-file-parallelism
```

Expected: PASS.

- [ ] **Step 5: Commit page integration carefully**

Because `page.tsx` and repair components may contain unrelated work, inspect the staged diff and stage only the help-action hunks.

```bash
git diff -- src/app/dashboard/repairs/page.tsx
git add src/app/dashboard/repairs/repair-help-actions.test.tsx
git add -p src/app/dashboard/repairs/page.tsx
git diff --cached --check
git commit -m "feat(repairs): connect help actions to repair dialogs"
```

### Task 4: Integrated verification and adaptive contract

**Files:**
- Test: `src/components/help/repairs-guide-anchors.test.ts`
- Test: all files changed above.

**Interfaces:**
- Consumes: complete feature from Tasks 1–3.
- Produces: verification evidence only.

- [ ] **Step 1: Run focused behavior suite**

```bash
cmd /c npx vitest run src/components/help src/app/dashboard/repairs/repair-help-actions.test.tsx src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx --no-file-parallelism
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run static validation**

```bash
cmd /c npx eslint src/components/help/repair-help-actions.tsx src/components/help/RepairHelpTour.tsx src/components/help/RepairHelpTour.test.tsx src/components/help/repairs-guide.ts src/components/help/repairs-guide.test.ts src/app/dashboard/repairs/repair-help-actions.test.tsx
cmd /c npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Inspect scoped changes**

```bash
git diff --check -- src/components/help src/app/dashboard/repairs/page.tsx
git status --short
```

Record unrelated pre-existing changes without modifying or committing them.

- [ ] **Step 4: Review accessibility and failure states**

Confirm from tests and code that action buttons are keyboard reachable, loading prevents duplicates, errors use `role="alert"`, the textual fallback remains, and no action confirms a financial operation.

- [ ] **Step 5: Commit any verification-only test adjustment**

Only if Task 4 required a test correction:

```bash
git add <exact-test-files>
git commit -m "test(repairs): verify actionable help transitions"
```
