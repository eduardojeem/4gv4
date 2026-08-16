# Repairs Interactive Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la ayuda estatica de Reparaciones por un centro de ayuda buscable, recorridos contextuales adaptables y un manual PDF visual generado desde el mismo contenido.

**Architecture:** `repairs-guide-content.json` sera la fuente canonica compartida por React y el generador PDF. Un modulo tipado validara, filtrara y buscara el contenido; el recorrido resolvera anclas `data-help-id` en tiempo de ejecucion y degradara a explicaciones textuales cuando falten. El PDF versionado se generara con ReportLab y se comprobara contra la version de la guia.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind CSS, Radix UI, Vitest/Testing Library, JSON, Python ReportLab, Poppler.

## Global Constraints

- La primera entrega cubre exclusivamente `/dashboard/repairs` y sus dialogos directos.
- No usar reconocimiento visual ni deteccion automatica de cambios semanticos.
- Operadores, tecnicos y administradores deben ver contenido pertinente a sus permisos.
- El recorrido nunca debe bloquear al usuario por un ancla ausente.
- La ayuda y el PDF deben compartir contenido y version.
- Conservar los contratos actuales de reparaciones, pagos, caja, credito e inventario.
- Preservar todos los cambios no relacionados del worktree.
- Cumplir WCAG AA y verificar 320, 768, 1024 y 1440 px.

---

### Task 1: Fuente canonica y utilidades de la guia

**Files:**
- Create: `src/components/help/repairs-guide-content.json`
- Create: `src/components/help/repairs-guide.ts`
- Create: `src/components/help/repairs-guide.test.ts`
- Modify: `src/components/help/guides.ts`

**Interfaces:**
- Produces: `REPAIRS_GUIDE_VERSION`, `repairsGuide`, `searchRepairGuide(query, audience)`, `getRepairGuideTracks(audience)` y tipos `RepairGuideAudience`, `RepairGuideTask`, `RepairGuideStep`.
- Consumes: ninguna interfaz nueva.

- [ ] **Step 1: Escribir pruebas fallidas de esquema, busqueda y audiencia**

```ts
expect(REPAIRS_GUIDE_VERSION).toMatch(/^\d+\.\d+$/)
expect(searchRepairGuide('abrir caja', 'operator')[0]?.id).toBe('open-cash-register')
expect(getRepairGuideTracks('technician').flatMap(track => track.tasks))
  .not.toContainEqual(expect.objectContaining({ id: 'audit-payments' }))
expect(getRepairGuideTracks('admin').flatMap(track => track.tasks))
  .toContainEqual(expect.objectContaining({ id: 'audit-payments' }))
```

- [ ] **Step 2: Ejecutar la prueba y comprobar el fallo**

Run: `cmd /c npx vitest run src/components/help/repairs-guide.test.ts`
Expected: FAIL porque los modulos aun no existen.

- [ ] **Step 3: Crear el JSON completo y el adaptador tipado**

El JSON debe incluir version, dos rutas (`daily-work`, `admin-payments`), las tareas aprobadas, palabras clave, audiencia, permisos, pasos, `anchorId`, ruta opcional, alternativa y tipo de ilustracion. `repairs-guide.ts` debe validar campos obligatorios al importar, normalizar busqueda sin acentos y filtrar por audiencia antes de devolver resultados. `guides.ts` conservara la interfaz existente para otras secciones y adaptara Reparaciones desde la fuente nueva.

- [ ] **Step 4: Ejecutar pruebas enfocadas**

Run: `cmd /c npx vitest run src/components/help/repairs-guide.test.ts`
Expected: PASS.

- [ ] **Step 5: Guardar el incremento**

```bash
git add src/components/help/repairs-guide-content.json src/components/help/repairs-guide.ts src/components/help/repairs-guide.test.ts src/components/help/guides.ts
git commit -m "feat(repairs): centralize help guide content"
```

### Task 2: Centro de ayuda orientado a tareas

**Files:**
- Create: `src/components/help/RepairHelpCenter.tsx`
- Create: `src/components/help/RepairHelpCenter.test.tsx`
- Modify: `src/components/help/HelpButton.tsx`
- Modify: `src/components/dashboard/repairs/RepairHeader.tsx`

**Interfaces:**
- Consumes: `searchRepairGuide`, `getRepairGuideTracks`, `RepairGuideTask` de Task 1.
- Produces: `RepairHelpCenter({ open, onOpenChange, audience, onStartTour })` y boton responsive `Guia y ayuda`.

- [ ] **Step 1: Escribir pruebas fallidas del flujo principal**

```tsx
render(<RepairHelpCenter open onOpenChange={vi.fn()} audience="admin" onStartTour={onStartTour} />)
expect(screen.getByRole('searchbox', { name: /que queres hacer/i })).toBeVisible()
await user.type(screen.getByRole('searchbox'), 'saldo pendiente')
expect(screen.getByText(/cobrar saldo/i)).toBeVisible()
await user.click(screen.getByRole('button', { name: /iniciar recorrido/i }))
expect(onStartTour).toHaveBeenCalled()
```

- [ ] **Step 2: Ejecutar la prueba y comprobar el fallo**

Run: `cmd /c npx vitest run src/components/help/RepairHelpCenter.test.tsx`
Expected: FAIL porque el componente no existe.

- [ ] **Step 3: Implementar el panel responsive**

Construir encabezado, buscador, selector de ruta, accesos frecuentes, resultados, detalle breve y acciones. Usar componentes UI existentes, estados vacios explicativos, etiquetas visibles y jerarquia compacta. Resolver audiencia desde `useAuth`: `admin/super_admin` a `admin`, `tecnico/technician` a `technician`, resto a `operator`.

- [ ] **Step 4: Integrar el boton sin romper otras guias**

`HelpButton` debe seguir abriendo `HelpPanel` para claves distintas de `repairs`; para `guideKey="repairs"` abrira `RepairHelpCenter`. `RepairHeader` mostrara `Guia y ayuda` en `sm` o superior y solo el icono con `aria-label` en mobile.

- [ ] **Step 5: Ejecutar pruebas y lint**

Run: `cmd /c npx vitest run src/components/help/RepairHelpCenter.test.tsx`
Run: `cmd /c npx eslint src/components/help/RepairHelpCenter.tsx src/components/help/RepairHelpCenter.test.tsx src/components/help/HelpButton.tsx src/components/dashboard/repairs/RepairHeader.tsx`
Expected: PASS sin errores.

- [ ] **Step 6: Guardar el incremento**

```bash
git add src/components/help/RepairHelpCenter.tsx src/components/help/RepairHelpCenter.test.tsx src/components/help/HelpButton.tsx src/components/dashboard/repairs/RepairHeader.tsx
git commit -m "feat(repairs): add task-oriented help center"
```

### Task 3: Motor de recorrido adaptable y progreso

**Files:**
- Create: `src/components/help/RepairHelpTour.tsx`
- Create: `src/components/help/RepairHelpTour.test.tsx`
- Create: `src/components/help/repair-help-progress.ts`
- Create: `src/components/help/repair-help-progress.test.ts`
- Modify: `src/components/help/RepairHelpCenter.tsx`

**Interfaces:**
- Consumes: `RepairGuideTask`, `RepairGuideStep`, version canonica.
- Produces: `RepairHelpTour({ task, open, onOpenChange })`, `loadRepairHelpProgress(userId, version)` y `saveRepairHelpProgress(...)`.

- [ ] **Step 1: Escribir pruebas fallidas de anclas y persistencia**

```tsx
document.body.innerHTML = '<button data-help-id="repair-new">Nueva reparacion</button>'
render(<RepairHelpTour task={task} open onOpenChange={vi.fn()} />)
expect(screen.getByRole('dialog')).toHaveTextContent(task.steps[0].title)
expect(document.querySelector('[data-help-id="repair-new"]')).toHaveAttribute('data-help-active', 'true')
```

Agregar un segundo caso sin ancla que avance o muestre `fallback` sin lanzar excepcion, y pruebas que aislen `localStorage` por `userId` y version.

- [ ] **Step 2: Ejecutar pruebas y comprobar el fallo**

Run: `cmd /c npx vitest run src/components/help/RepairHelpTour.test.tsx src/components/help/repair-help-progress.test.ts`
Expected: FAIL porque el recorrido no existe.

- [ ] **Step 3: Implementar resolucion de ancla y presentacion**

Resolver con `document.querySelector([data-help-id=...])`, desplazar con respeto a `prefers-reduced-motion`, marcar temporalmente `data-help-active`, posicionar una tarjeta accesible mediante rectangulo del ancla y usar posicion fija inferior en mobile. Proveer `Anterior`, `Siguiente`, `Omitir`, `Finalizar` y contador. Limpiar atributos, listeners y foco al cerrar.

- [ ] **Step 4: Implementar progreso tolerante a fallos**

Guardar `{ version, completedTaskIds, dismissed }` bajo `repairs-help:<userId>:<version>`. Capturar errores de almacenamiento y mantener estado en memoria para que la ayuda siga funcionando.

- [ ] **Step 5: Integrar inicio, reinicio y finalizacion**

El centro debe cerrar su Sheet antes de abrir el recorrido, permitir reiniciar tareas completadas y volver al centro al finalizar. No abrir automaticamente recorridos en esta primera entrega; `No volver a mostrar` se aplicara solo a futuras sugerencias.

- [ ] **Step 6: Ejecutar pruebas y guardar el incremento**

Run: `cmd /c npx vitest run src/components/help/RepairHelpTour.test.tsx src/components/help/repair-help-progress.test.ts src/components/help/RepairHelpCenter.test.tsx`
Expected: PASS.

```bash
git add src/components/help/RepairHelpTour.tsx src/components/help/RepairHelpTour.test.tsx src/components/help/repair-help-progress.ts src/components/help/repair-help-progress.test.ts src/components/help/RepairHelpCenter.tsx
git commit -m "feat(repairs): add resilient contextual help tours"
```

### Task 4: Anclas de contrato en Reparaciones

**Files:**
- Modify: `src/components/dashboard/repairs/RepairHeader.tsx`
- Modify: `src/components/dashboard/repairs/RepairFilters.tsx`
- Modify: `src/components/dashboard/repairs/RepairDetailDialog.tsx`
- Modify: `src/components/dashboard/repairs/RepairPaymentDialog.tsx`
- Modify: `src/components/dashboard/repairs/RepairDeliveryDialog.tsx`
- Modify: `src/components/dashboard/repairs/RepairCostCalculator.tsx`
- Modify: `src/components/dashboard/repairs/QuickAccessNav.tsx`
- Create: `src/components/help/repairs-guide-anchors.test.ts`

**Interfaces:**
- Consumes: `anchorId` declarados en el contenido canonico.
- Produces: anclas DOM estables sin cambiar callbacks ni logica financiera.

- [ ] **Step 1: Escribir una prueba de contrato fallida**

La prueba debe cargar todos los `anchorId` del JSON y comprobar que cada uno aparezca exactamente una vez en el conjunto de componentes autorizado. Debe fallar con una lista legible de anclas faltantes o duplicadas.

- [ ] **Step 2: Ejecutar la prueba y comprobar las anclas faltantes**

Run: `cmd /c npx vitest run src/components/help/repairs-guide-anchors.test.ts`
Expected: FAIL mostrando las anclas aun no agregadas.

- [ ] **Step 3: Agregar atributos estables**

Agregar `data-help-id` al control mas cercano a cada accion: nueva reparacion, filtros, acceso a inventario/servicios, precio, repuestos, detalle/historial, pago, apertura de caja, credito, entrega y cierre no reparado. No cambiar handlers, permisos ni estructura de datos.

- [ ] **Step 4: Ejecutar contrato e interacciones financieras existentes**

Run: `cmd /c npx vitest run src/components/help/repairs-guide-anchors.test.ts src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`
Expected: PASS.

- [ ] **Step 5: Guardar el incremento**

```bash
git add src/components/dashboard/repairs/RepairHeader.tsx src/components/dashboard/repairs/RepairFilters.tsx src/components/dashboard/repairs/RepairDetailDialog.tsx src/components/dashboard/repairs/RepairPaymentDialog.tsx src/components/dashboard/repairs/RepairDeliveryDialog.tsx src/components/dashboard/repairs/RepairCostCalculator.tsx src/components/dashboard/repairs/QuickAccessNav.tsx src/components/help/repairs-guide-anchors.test.ts
git commit -m "feat(repairs): anchor contextual help to live controls"
```

### Task 5: Manual visual PDF sincronizado

**Files:**
- Create: `scripts/generate-repairs-guide-pdf.py`
- Create: `public/guides/assets/repairs-workflow.svg`
- Create: `public/guides/assets/repairs-cost-flow.svg`
- Create: `public/guides/repairs-guide-manifest.json`
- Create: `public/guides/guia-reparaciones-v1.pdf`
- Create: `src/components/help/repairs-guide-pdf.test.ts`
- Modify: `src/components/help/RepairHelpCenter.tsx`

**Interfaces:**
- Consumes: `repairs-guide-content.json` y `REPAIRS_GUIDE_VERSION`.
- Produces: PDF descargable, manifiesto `{ version, generatedAt, file }` y enlace accesible.

- [ ] **Step 1: Marcar la operacion de artefacto PDF**

Run: `node container_tools/mark_artifact_operation_started.mjs --operation-kind create --expected-output-count 1 --output-format pdf`
Expected: exit 0. Ejecutar exactamente una vez antes de generar el PDF.

- [ ] **Step 2: Escribir la prueba fallida de sincronizacion**

```ts
expect(manifest.version).toBe(REPAIRS_GUIDE_VERSION)
expect(manifest.file).toBe('/guides/guia-reparaciones-v1.pdf')
expect(existsSync(resolve('public', manifest.file.slice(1)))).toBe(true)
```

- [ ] **Step 3: Crear ilustraciones mantenibles**

`repairs-workflow.svg` mostrara Ingreso -> Diagnostico -> Reparacion -> Listo -> Entrega, con ramas Retiro sin reparar e Imposible reparar. `repairs-cost-flow.svg` mostrara repuestos + mano de obra - descuento = total, luego adelanto -> saldo -> pago/caja o credito. Usar textos reales, colores semanticos del modulo y `title/desc` accesibles.

- [ ] **Step 4: Implementar el generador ReportLab**

Leer el JSON canonico, renderizar portada, indice, mapa de proceso, rutas, tareas, ejemplos PYG, advertencias de auditoria, ilustraciones, numero de pagina, version y fecha. Escribir primero en `tmp/pdfs/` y copiar la salida final validada a `public/guides/guia-reparaciones-v1.pdf`; actualizar el manifiesto solo si la generacion finaliza correctamente.

- [ ] **Step 5: Generar, inspeccionar y corregir el PDF**

Run: `python scripts/generate-repairs-guide-pdf.py`
Run: `pdfinfo public/guides/guia-reparaciones-v1.pdf`
Run: `pdftoppm -png public/guides/guia-reparaciones-v1.pdf tmp/pdfs/repairs-guide`
Inspeccionar todas las paginas renderizadas y corregir recortes, superposiciones, caracteres rotos, contraste, encabezados y numeracion antes de continuar.

- [ ] **Step 6: Conectar la descarga y verificar version**

El centro debe mostrar `Descargar manual PDF`, abrir el archivo en una nueva pestaña con `rel="noopener noreferrer"` y mostrar la version. Si el manifiesto o archivo no coincide, mostrar `Manual temporalmente no disponible` sin afectar los recorridos.

- [ ] **Step 7: Ejecutar pruebas y guardar el incremento**

Run: `cmd /c npx vitest run src/components/help/repairs-guide-pdf.test.ts src/components/help/RepairHelpCenter.test.tsx`
Expected: PASS.

```bash
git add scripts/generate-repairs-guide-pdf.py public/guides src/components/help/repairs-guide-pdf.test.ts src/components/help/RepairHelpCenter.tsx
git commit -m "feat(repairs): publish synchronized visual help manual"
```

### Task 6: Verificacion integrada y experiencia real

**Files:**
- Verify: todos los archivos de Tasks 1-5.

**Interfaces:**
- Consumes: centro, recorridos, anclas, contenido y PDF terminados.
- Produces: evidencia de calidad y lista explicita de cualquier bloqueo externo.

- [ ] **Step 1: Ejecutar suite enfocada completa**

Run: `cmd /c npx vitest run src/components/help src/components/dashboard/repairs/__tests__/RepairPaymentDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDeliveryDialog.test.tsx src/components/dashboard/repairs/__tests__/RepairDetailDialog.payment.test.tsx`
Expected: todas las pruebas pasan.

- [ ] **Step 2: Ejecutar controles estaticos**

Run: `cmd /c npx eslint src/components/help src/components/dashboard/repairs/RepairHeader.tsx src/components/dashboard/repairs/RepairFilters.tsx src/components/dashboard/repairs/RepairDetailDialog.tsx src/components/dashboard/repairs/RepairPaymentDialog.tsx src/components/dashboard/repairs/RepairDeliveryDialog.tsx src/components/dashboard/repairs/RepairCostCalculator.tsx src/components/dashboard/repairs/QuickAccessNav.tsx`
Run: `cmd /c npm run typecheck`
Run: `git diff --check`
Expected: sin errores en archivos del alcance; documentar por separado cualquier fallo preexistente ajeno.

- [ ] **Step 3: Probar en navegador autenticado**

En 320, 768, 1024 y 1440 px: abrir `Guia y ayuda`, buscar `saldo`, cambiar entre rutas, iniciar y finalizar un recorrido, eliminar temporalmente un ancla en DevTools para confirmar fallback, descargar PDF y navegar solo con teclado. Revisar consola, foco, superposiciones, contraste y `prefers-reduced-motion`.

- [ ] **Step 4: Revisar alcance y estado Git**

Confirmar que los commits contienen solo ayuda de Reparaciones, anclas sin logica de negocio y artefactos del manual. No incluir cambios financieros, clientes, inventario u otros modulos que ya estaban en el worktree.
