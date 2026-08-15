# Payment Modal Cash-Opening Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar la apertura de caja como primer paso comprensible de todo modal de pago cuando la sucursal no tenga una sesión abierta.

**Architecture:** El componente compartido `PaymentCashSessionGuard` evolucionará a una pantalla de requisito previo reutilizable con contexto de sucursal/caja, permisos y cancelación. Cada modal conservará su propio borrador y mostrará el formulario únicamente cuando el hook compartido confirme una sesión abierta.

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind CSS, Vitest y Testing Library.

## Global Constraints

- No abrir caja automáticamente ni inventar un fondo inicial.
- No borrar datos del formulario ante apertura o error tardío.
- El servidor continúa siendo la autoridad mediante `OPEN_CASH_SESSION_REQUIRED`.
- Ventas completamente a crédito sin adelanto permanecen excluidas.
- Preservar cambios concurrentes existentes de Finanzas y pruebas compartidas.

---

### Task 1: Turn the shared guard into a first-step payment gate

**Files:**
- Modify: `src/components/payments/PaymentCashSessionGuard.tsx`
- Modify: `src/components/payments/PaymentCashSessionGuard.test.tsx`
- Modify: `src/hooks/use-payment-cash-session.ts`
- Modify: `src/hooks/use-payment-cash-session.test.tsx`

**Interfaces:**
- Extend props with `branchName?: string`, `registerName?: string`, `onCancel?: () => void` and `variant?: 'inline' | 'gate'`.
- Preserve `state`, `onOpenCashRegister` and `canOpenRegister`.

- [ ] **Step 1: Write failing gate tests**

Assert `variant="gate"` and `closed` render **Abrí la caja para continuar**, the audit explanation, branch/register labels, **Abrir caja** and **Cancelar**; assert no payment-form child is rendered by the consuming test until state is `open`. Cover the no-permission message and **Ir a Caja**.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/components/payments/PaymentCashSessionGuard.test.tsx src/hooks/use-payment-cash-session.test.tsx`

- [ ] **Step 3: Implement the accessible gate**

Use a centered lock/banknote treatment, concise copy, clear primary/secondary hierarchy and `role="alert"`. Keep `inline` compatible for section banners. Add `markClosed()` coverage proving the hook returns from `open` to `closed` without touching consumer data.

- [ ] **Step 4: Run GREEN and commit**

Commit with `feat: add guided cash-opening payment gate` after focused tests and `git diff --check` pass.

### Task 2: Integrate the gate in repair payment flows

**Files:**
- Modify: `src/components/dashboard/repairs/RepairPaymentDialog.tsx`
- Modify: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`
- Modify: `src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx`
- Modify: `src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx`

**Interfaces:**
- Consume the shared gate and existing `OpenCashRegisterDialog`.
- Preserve existing payment/delivery props and server contracts.

- [ ] **Step 1: Write failing interaction tests**

With caja closed, assert payment fields are absent and the gate is visible. Open caja and assert the fields appear with the previously selected repair/delivery context. Simulate `OPEN_CASH_SESSION_REQUIRED` after submission and assert the gate returns while amount, outcome, part dispositions and notes survive.

- [ ] **Step 2: Run RED, implement minimal conditional rendering, then run GREEN**

Render `checking/closed` gate before payment-form contents. Keep the guided opening dialog mounted by the parent and call `refresh()` after success. Do not reset form state from cash-session effects.

- [ ] **Step 3: Commit**

Commit with `feat: guide cash opening before repair payments`.

### Task 3: Integrate credits and POS

**Files:**
- Modify: `src/components/dashboard/credits/CreditPaymentDialog.tsx`
- Modify: `src/app/dashboard/credits/page.tsx`
- Modify: `src/app/dashboard/pos/components/CheckoutModal.tsx`
- Modify/create focused tests for both modals.

**Interfaces:**
- Credits always require caja for a positive collection.
- POS skips the gate only for a fully financed credit sale with no immediate payment.

- [ ] **Step 1: Write failing tests for closed, opened and credit-only states**

For credits, mock `checkOpenSession` as `null`, render the dialog and assert:

```ts
expect(await screen.findByRole('heading', { name: 'Abrí la caja para continuar' })).toBeVisible()
expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
```

After the opening callback resolves and `checkOpenSession` returns `{ id: 'session-1' }`, assert the amount field appears with its prior value. For POS, repeat the closed positive-payment case and add a literal fixture whose total is fully financed with no positive split; that fixture must render the credit confirmation without the gate.

- [ ] **Step 2: Run RED, integrate the shared gate and guided opening dialog, then run GREEN**

Run the exact credit dialog test plus the closest existing checkout interaction suite discovered with `rg --files src | rg "CreditPaymentDialog.*test|CheckoutModal.*test"`. Conditional rendering must be based on `requiresImmediatePayment && cashState !== 'open'`, not on the selected payment method.

- [ ] **Step 3: Commit**

Commit with `feat: guide cash opening before credit and POS payments`.

### Task 4: Integrate outgoing Finance, payroll and technician payments

**Files:**
- Modify only after checking ownership: `src/components/admin/finances/PaymentDialog.tsx`
- Modify only after checking ownership: `src/components/admin/finances/FinanceOperations.test.tsx`
- Modify: `src/components/dashboard/technicians/detail/TechnicianPaymentsTab.tsx`
- Create/modify focused technician payment tests.

- [ ] **Step 1: Recheck dirty-file ownership**

Run `git status --short` and inspect overlapping diffs. Stop and request coordination if concurrent edits overlap the same modal sections.

- [ ] **Step 2: Write failing gate tests**

All paid methods show the gate first; a technician record with status `pendiente` does not because it is not a payment yet.

```ts
expect(await screen.findByText('Abrí la caja para continuar')).toBeVisible()
expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument()
```

For `status: pendiente`, assert the payment gate is absent and the save action remains available because no money movement is created.

- [ ] **Step 3: Integrate without replacing concurrent work, verify and commit scoped hunks**

Run `npx vitest run src/components/admin/finances/FinanceOperations.test.tsx <technician-test-path>`, then direct ESLint for the touched modal and test files. Stage only explicit paths after reviewing `git diff --cached`.

Commit with `feat: guide cash opening before operational disbursements`.

### Task 5: Verify, visually inspect and synchronize

- [ ] **Step 1: Run focused suites, typecheck, touched-file ESLint and `git diff --check`**

- [ ] **Step 2: Run full `npm test` and report unrelated baseline failures separately**

- [ ] **Step 3: In an authenticated browser, inspect repair, credit, POS and one outgoing payment at desktop and mobile widths**

- [ ] **Step 4: Confirm only scoped commits are ahead, then push `update-nextjs-16.3`**
