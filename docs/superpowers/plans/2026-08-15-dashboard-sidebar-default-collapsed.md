# Dashboard Sidebar Default Collapsed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Iniciar el menú lateral del dashboard contraído en cada montaje y destacar el control accesible para expandirlo o contraerlo.

**Architecture:** `DashboardLayoutProvider` mantendrá el estado únicamente durante la vida del layout, con valor inicial `true` y sin restauración persistente. `Sidebar` seguirá consumiendo el mismo contrato, pero presentará un botón de alternancia con mayor contraste, tooltip y etiquetas accesibles coherentes.

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind CSS, Vitest y Testing Library.

## Global Constraints

- Aplicar únicamente al layout principal `/dashboard`.
- Escritorio contraído conserva la barra de iconos; móvil contraído queda fuera de pantalla.
- Cada recarga o entrada nueva comienza contraída.
- La navegación cliente conserva el estado actual mientras el provider siga montado.
- No modificar los cambios concurrentes existentes de Finanzas, productos, POS o pruebas compartidas.

---

### Task 1: Make collapsed the non-persistent initial state

**Files:**
- Modify: `src/contexts/DashboardLayoutContext.tsx`
- Create: `src/contexts/DashboardLayoutContext.test.tsx`

**Interfaces:**
- Preserves: `sidebarCollapsed`, `toggleSidebar()` and `setSidebarCollapsed(boolean)`.
- Changes: initial `sidebarCollapsed` from `false`/persisted preference to `true` per provider mount.

- [ ] **Step 1: Write failing provider interaction tests**

Render a consumer that prints `expanded` or `collapsed` and invokes `toggleSidebar`. Before rendering, store `dashboard-sidebar-collapsed=false` and assert the first observable state is still `collapsed`. Click to expand, verify `expanded`, unmount/remount, and verify `collapsed` again.

- [ ] **Step 2: Run test and verify RED**

Run: `npx vitest run src/contexts/DashboardLayoutContext.test.tsx`

Expected: FAIL because the old persisted `false` value expands the provider after mounting.

- [ ] **Step 3: Implement minimal provider change**

Initialize with `useState(true)` and delete both effects that read/write `dashboard-sidebar-collapsed`. Retain the memoized toggle and setter contract unchanged.

- [ ] **Step 4: Run test and verify GREEN**

Run: `npx vitest run src/contexts/DashboardLayoutContext.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/contexts/DashboardLayoutContext.tsx src/contexts/DashboardLayoutContext.test.tsx
git commit -m "fix: default dashboard sidebar to collapsed"
```

### Task 2: Highlight and clarify the sidebar toggle

**Files:**
- Modify: `src/components/dashboard/sidebar.tsx`
- Create: `src/components/dashboard/sidebar.test.tsx`

**Interfaces:**
- Consumes: existing `useDashboardLayout()` state and toggle.
- Produces: accessible names and `title` values `Expandir menú` / `Contraer menú`, plus high-contrast visual classes.

- [ ] **Step 1: Write failing button tests**

Mock only layout state and external data dependencies required to render the real sidebar. Assert the collapsed button is discoverable as `button` named `Expandir menú`, has `title="Expandir menú"`, and invokes the toggle. Rerender expanded and assert `Contraer menú`.

- [ ] **Step 2: Run test and verify RED**

Run: `npx vitest run src/components/dashboard/sidebar.test.tsx`

Expected: FAIL because the current labels say `sidebar` and there is no tooltip.

- [ ] **Step 3: Implement the visual control**

Use a 40px square button with `border-primary/30 bg-primary/10 text-primary shadow-sm`, stronger hover/focus-visible styles, and `justify-center` for the collapsed logo row. Add matching `aria-label` and `title`; keep chevron direction and mobile overlay behavior unchanged.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npx vitest run src/contexts/DashboardLayoutContext.test.tsx src/components/dashboard/sidebar.test.tsx
npm run typecheck
npx eslint src/contexts/DashboardLayoutContext.tsx src/contexts/DashboardLayoutContext.test.tsx src/components/dashboard/sidebar.tsx src/components/dashboard/sidebar.test.tsx
git diff --check
```

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/sidebar.tsx src/components/dashboard/sidebar.test.tsx
git commit -m "feat: highlight dashboard sidebar toggle"
```

### Task 3: Runtime verification and synchronization

**Files:**
- Verify only: `/dashboard`

- [ ] **Step 1: Verify desktop and mobile behavior**

In an authenticated browser session, confirm at desktop width that reload starts with the icon rail, expansion survives client-side navigation, and another reload contracts it. At mobile width confirm initial hidden state, hamburger opening, overlay closing and no horizontal overflow.

- [ ] **Step 2: Review scope and publish**

Confirm `git status --short` contains only unrelated pre-existing drafts, then push `update-nextjs-16.3` without staging those drafts.
