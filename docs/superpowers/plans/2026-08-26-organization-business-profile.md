# Organization Business Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cada organización elija su rubro, modelo operativo y módulos visibles sin perder datos ni el control comercial del plan contratado.

**Architecture:** Crear un perfil canónico en `organizations`, resolver módulos efectivos en una función compartida y aplicar el resultado tanto en cliente como en servidor. La habilitación será una intersección entre derecho comercial, prueba temporal y preferencia de la organización; permisos de usuario y aislamiento tenant seguirán siendo controles independientes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Zod 4, Supabase/PostgreSQL con RLS, Vitest y Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-26-organization-business-profile-design.md`

## Restricciones globales

- No eliminar datos al desactivar módulos.
- No usar metadatos editables del usuario para autorizar acceso.
- Toda lectura y escritura debe quedar limitada a la organización activa.
- La API debe aplicar los controles aunque el usuario escriba una URL manualmente.
- El campo legado `company_info.businessType` se mantiene durante la transición.
- No modificar el significado comercial de `plans.modules` ni de las pruebas de módulos.
- Cada fase debe poder desplegarse y revertirse sin dejar el sistema inutilizable.

## Mapa de responsabilidades

| Archivo | Responsabilidad prevista |
|---|---|
| `src/lib/organization/business-profile.ts` | Tipos, esquemas, presets y normalización |
| `src/lib/saas/effective-modules.ts` | Cálculo puro de módulos efectivos y motivo de bloqueo |
| `src/contexts/SubscriptionStatusContext.tsx` | Exponer derecho, selección y disponibilidad efectiva |
| `src/lib/api/withTenantAuth.ts` | Aplicar módulo efectivo en APIs tenant-aware |
| `src/components/admin/OrganizationModuleGate.tsx` | Diferenciar plan bloqueado, módulo desactivado y permiso denegado |
| `src/components/admin/settings/BusinessProfileCard.tsx` | Editar rubro, modelo, preset y módulos |
| `src/components/dashboard/onboarding/BusinessProfileStep.tsx` | Configuración inicial guiada |
| `src/components/dashboard/sidebar.tsx` | Navegación desktop basada en módulos efectivos |
| `src/components/dashboard/mobile-nav.tsx` | Navegación móvil basada en módulos efectivos |
| `src/app/api/admin/organization-profile/route.ts` | GET/PATCH validado y auditable |
| Migración Supabase nueva | Columnas, restricciones, backfill y función auditada |

## Fase 0 — Línea base y decisiones verificables

### Tarea 1: Inventariar módulos, rutas y controles existentes

**Archivos:**
- Crear: `docs/qa/organization-module-route-matrix.md`
- Consultar: `src/lib/saas/plan-modules.ts`
- Consultar: `src/lib/auth/section-access.ts`
- Consultar: `src/components/dashboard/sidebar.tsx`
- Consultar: `src/lib/api/withTenantAuth.ts`

**Produce:** Matriz por sección con código de módulo, ruta, permiso, API, tabla y comportamiento público.

- [ ] Enumerar todas las entradas desktop y móvil y asignar un módulo técnico a cada una.
- [ ] Enumerar APIs de reparaciones, servicios, POS, inventario, créditos, ecommerce y reportes.
- [ ] Marcar consultas transversales que deben degradar a cero en vez de fallar, por ejemplo estadísticas de reparación en el dashboard general.
- [ ] Definir módulos base obligatorios y justificar cada uno; no asumir que `inventory`, `pos` o `crm` son siempre obligatorios.
- [ ] Ejecutar `npm run typecheck` y registrar fallos preexistentes sin corregir trabajo ajeno.

**Criterios de aceptación:** La matriz permite encontrar el control servidor y cliente de cada sección; ninguna ruta de reparaciones queda sin clasificar.

**Verificación:** `rg -n "dashboard/repairs|api/repairs|PlanGate|usePlanModule" src` y revisión manual de la matriz.

**Dependencias:** Ninguna.

## Fase 1 — Contrato y persistencia

### Tarea 2: Crear el dominio tipado del perfil de negocio

**Archivos:**
- Crear: `src/lib/organization/business-profile.ts`
- Crear: `src/lib/organization/business-profile.test.ts`

**Interfaces:**
- Produce: `BusinessVertical`, `OperatingModel`, `OrganizationModule`, `OrganizationBusinessProfile`.
- Produce: `BusinessProfileInputSchema`, `normalizeBusinessProfile()`, `getSuggestedModules()`.

- [ ] Escribir pruebas fallidas para valores válidos, valores heredados, entradas desconocidas y presets de ropa, cosmética, mayorista, taller, servicios y mixto.
- [ ] Ejecutar `npm test -- src/lib/organization/business-profile.test.ts` y confirmar que falla por módulo inexistente.
- [ ] Implementar enums constantes, esquema Zod, normalización conservadora y presets inmutables.
- [ ] Garantizar que un preset nunca contenga un código fuera de `OrganizationModule`.
- [ ] Ejecutar la prueba enfocada hasta obtener PASS.

**Criterios de aceptación:** Entradas antiguas nunca rompen el render; valores no reconocidos terminan en `general` y `retail` con una selección conservadora.

**Dependencias:** Tarea 1.

### Tarea 3: Definir el cálculo central de módulos efectivos

**Archivos:**
- Crear: `src/lib/saas/effective-modules.ts`
- Crear: `src/lib/saas/effective-modules.test.ts`
- Modificar: `src/lib/saas/plan-modules.ts`

**Interfaces:**
- Consume: `OrganizationModule`.
- Produce: `resolveEffectiveModules({ entitledModules, trialModules, enabledModules })`.
- Produce: `getModuleAvailability(module, input): 'available' | 'disabled_by_org' | 'not_in_plan'`.

- [ ] Probar intersección, prueba temporal, configuración vacía heredada, duplicados y códigos desconocidos.
- [ ] Establecer compatibilidad: `enabledModules = null` significa “mantener módulos con derecho” durante migración; lista vacía significa “ningún módulo opcional”.
- [ ] Implementar el cálculo como función pura, sin consultas ni estado React.
- [ ] Ejecutar `npm test -- src/lib/saas/effective-modules.test.ts src/test/plan-modules.test.ts`.

**Criterios de aceptación:** Un módulo jamás aparece disponible si no está en el plan/prueba; desactivarlo no altera `plans.modules`.

**Dependencias:** Tarea 2.

### Tarea 4: Crear migración aditiva y backfill seguro

**Archivos:**
- Crear mediante `supabase migration new add_organization_business_profile`: `supabase/migrations/<timestamp>_add_organization_business_profile.sql`
- Regenerar después de aplicar: `src/lib/supabase/types.ts`
- Crear: `src/test/organization-business-profile-migration.test.ts`

**Esquema propuesto:**

```sql
alter table public.organizations
  add column if not exists business_vertical text,
  add column if not exists operating_model text,
  add column if not exists enabled_modules text[];
```

- [ ] Añadir `CHECK` explícitos con los valores definidos en el spec.
- [ ] Hacer backfill sin reducir acceso: `business_vertical='general'`, modelo inferido del valor legado y `enabled_modules=null` durante transición.
- [ ] Añadir índices solo si los planes de consulta demuestran que son necesarios; estos campos no requieren índice para lecturas por `id`.
- [ ] Crear función o ruta de actualización que compruebe `settings.manage`, limite al tenant y escriba `tenant_audit_log` con valores anteriores/nuevos.
- [ ] Revisar que cualquier `SECURITY DEFINER` tenga `search_path` fijo, comprobación de `auth.uid()` y `REVOKE EXECUTE FROM PUBLIC`.
- [ ] Aplicar primero en Supabase local, ejecutar prueba de dos organizaciones y confirmar que una no puede actualizar la otra.
- [ ] Ejecutar advisors y regenerar tipos solo después de validar SQL.

**Criterios de aceptación:** Migrar dos veces no falla; ninguna organización pierde módulos; RLS impide lectura/escritura cruzada; rollback documentado revierte aplicación antes de retirar columnas.

**Verificación:** `supabase migration list --local`, prueba SQL tenant A/B, `supabase db advisors` y `npm test -- src/test/organization-business-profile-migration.test.ts`.

**Dependencias:** Tareas 2 y 3.

### Checkpoint A

- [ ] Pruebas puras y de migración pasan.
- [ ] Tipos generados reflejan exactamente las tres columnas.
- [ ] Revisión manual de seguridad multi-tenant aprobada.
- [ ] No se modificó ni eliminó `company_info.businessType`.

## Fase 2 — API y estado compartido

### Tarea 5: Crear API de perfil de organización

**Archivos:**
- Crear: `src/app/api/admin/organization-profile/route.ts`
- Crear: `src/app/api/admin/organization-profile/route.test.ts`
- Modificar: `src/lib/api/withTenantAuth.ts` solo si falta un helper reutilizable de `settings.manage`.

**Contrato:**
- `GET` devuelve `{ data: OrganizationBusinessProfile }`.
- `PATCH` recibe `{ businessVertical, operatingModel, enabledModules }` completo y devuelve el perfil normalizado.
- Errores: `401` sin sesión, `403` sin permiso, `422` validación, `500` error interno con mensaje no sensible.

- [ ] Escribir pruebas para GET, PATCH válido, enum inválido, módulo fuera del plan, usuario de otra organización y auditoría.
- [ ] Validar cuerpo con `BusinessProfileInputSchema` en el límite HTTP.
- [ ] Recalcular siempre módulos efectivos en servidor; ignorar cualquier `effectiveModules` enviado por el cliente.
- [ ] Evitar actualización parcial accidental: preservar valores actuales solo cuando el contrato indique omisión permitida.
- [ ] Ejecutar `npm test -- src/app/api/admin/organization-profile/route.test.ts`.

**Criterios de aceptación:** El cliente no puede habilitar por sí mismo un módulo no contratado ni editar otra organización.

**Dependencias:** Tarea 4.

### Tarea 6: Ampliar el contexto de suscripción sin romper consumidores

**Archivos:**
- Modificar: `src/contexts/SubscriptionStatusContext.tsx`
- Modificar: layout servidor que construye `SubscriptionStatusData` (ubicar mediante `rg "SubscriptionStatusProvider" src/app`).
- Crear: `src/contexts/SubscriptionStatusContext.test.tsx`

**Interfaces:**
- Mantener `modules` temporalmente como alias de `effectiveModules` para compatibilidad.
- Añadir `entitledModules`, `enabledModules`, `effectiveModules`, `businessVertical`, `operatingModel`.
- Añadir `useEffectiveModule()` y `useModuleAvailability()`.

- [ ] Probar organización heredada, módulo desactivado, prueba activa y plan sin derecho.
- [ ] Resolver el perfil en servidor para evitar parpadeo/hidratación inconsistente.
- [ ] Migrar consumidores nuevos al hook semántico; no cambiar todos los consumidores en una sola tarea.
- [ ] Ejecutar pruebas del contexto y `npm run typecheck`.

**Criterios de aceptación:** El primer render ya conoce los módulos; código existente que lee `modules` continúa funcionando durante la transición.

**Dependencias:** Tareas 3 y 5.

## Fase 3 — Configuración y onboarding

### Tarea 7: Construir editor de perfil en Configuración

**Archivos:**
- Crear: `src/components/admin/settings/BusinessProfileCard.tsx`
- Crear: `src/components/admin/settings/BusinessProfileCard.test.tsx`
- Modificar: `src/app/admin/settings/page.tsx`
- Deprecar visualmente: `src/components/admin/settings/BusinessTypeCard.tsx`

- [ ] Mostrar dos selectores separados: “Rubro” y “Forma de trabajo”.
- [ ] Al elegir un preset, mostrar vista previa de módulos sugeridos antes de aplicar.
- [ ] Mostrar cada módulo en uno de tres estados: activo, disponible pero desactivado, no incluido en plan.
- [ ] Solicitar confirmación cuando se desactiva un módulo con datos existentes; explicar que los datos se conservan.
- [ ] Guardar una vez mediante PATCH, bloquear doble envío, anunciar éxito/error y restaurar estado ante fallo.
- [ ] Probar teclado, lector de pantalla, loading, error 422/403/500 y viewport de 360 px.

**Criterios de aceptación:** Un administrador entiende qué cambia, qué conserva y por qué una opción está bloqueada.

**Dependencias:** Tareas 5 y 6.

### Tarea 8: Integrar el perfil en onboarding y registro

**Archivos:**
- Crear: `src/components/dashboard/onboarding/BusinessProfileStep.tsx`
- Crear: `src/components/dashboard/onboarding/BusinessProfileStep.test.tsx`
- Modificar: `src/components/dashboard/onboarding/OnboardingClient.tsx`
- Modificar: `src/app/api/onboarding/complete/route.ts`
- Modificar: `src/app/api/auth/register-company/route.ts`
- Modificar: `src/app/dashboard/onboarding/page.tsx`

- [ ] Reemplazar el único `businessType` por una selección guiada de rubro y modelo.
- [ ] Preseleccionar módulos mediante preset, dejando personalización antes de confirmar.
- [ ] Mantener escritura del campo legado durante una versión para consumidores públicos existentes.
- [ ] Garantizar atomicidad: si falla perfil/settings, onboarding no se marca completado.
- [ ] Probar registro nuevo, reanudación, doble submit, error de conexión y organización ya existente.

**Criterios de aceptación:** Una tienda de ropa no recibe Reparaciones por defecto; un taller sí; un negocio mixto puede conservar ambos.

**Dependencias:** Tareas 5 a 7.

### Checkpoint B

- [ ] Flujo nuevo de organización completo en local.
- [ ] Flujo de organización antigua conserva comportamiento.
- [ ] Settings y onboarding muestran el mismo perfil después de recargar.
- [ ] No hay escrituras parciales ante fallos simulados.

## Fase 4 — Navegación, páginas y consultas

### Tarea 9: Filtrar navegación desktop y móvil desde una sola definición

**Archivos:**
- Crear: `src/lib/navigation/dashboard-navigation.ts`
- Crear: `src/lib/navigation/dashboard-navigation.test.ts`
- Modificar: `src/components/dashboard/sidebar.tsx`
- Modificar: `src/components/dashboard/mobile-nav.tsx`
- Modificar: `src/components/dashboard/quick-nav.tsx`

**Interfaces:** Cada entrada declara `requiredModule?: OrganizationModule`, además de rol/permiso actual.

- [ ] Extraer el catálogo común sin cambiar etiquetas ni rutas.
- [ ] Filtrar en orden: módulo efectivo, acceso de sección y permiso granular.
- [ ] No consultar el conteo de reparaciones cuando `repairs` está desactivado.
- [ ] Garantizar cinco accesos útiles en móvil según el negocio, más “Menú”.
- [ ] Probar retail, mayorista, servicio, taller, mixto y rol técnico.

**Criterios de aceptación:** No quedan enlaces huérfanos y desktop/móvil concuerdan.

**Dependencias:** Tarea 6.

### Tarea 10: Proteger rutas directas y diferenciar motivos de bloqueo

**Archivos:**
- Crear: `src/components/admin/OrganizationModuleGate.tsx`
- Crear: `src/components/admin/OrganizationModuleGate.test.tsx`
- Modificar: layouts o páginas raíz de reparaciones, servicios, créditos, ecommerce, promociones, inventario avanzado, analytics y seguridad según la matriz de Tarea 1.
- Mantener: `src/components/admin/PlanGate.tsx` como presentación comercial del plan.

- [ ] Mostrar upgrade/prueba solo cuando el plan no incluye el módulo.
- [ ] Mostrar “Módulo desactivado para esta organización” con enlace a configuración solo a owner/admin.
- [ ] No montar componentes pesados ni iniciar fetches cuando está bloqueado.
- [ ] Responder con not-found o bloqueo controlado en rutas servidor según el patrón del proyecto.
- [ ] Probar URL escrita manualmente, navegación atrás y actualización de configuración.

**Criterios de aceptación:** Ocultar un enlace no es el único control y el mensaje nunca confunde desactivación con falta de plan.

**Dependencias:** Tareas 6 y 9.

### Tarea 11: Adaptar dashboard, reportes y búsquedas transversales

**Archivos probables:**
- Modificar: `src/app/dashboard/page.tsx`
- Modificar: `src/app/admin/page.tsx`
- Modificar: `src/components/dashboard/stats-overview.tsx`
- Modificar: `src/components/ui/global-search.tsx`
- Modificar: `src/app/dashboard/reports/page.tsx`
- Añadir pruebas enfocadas junto a cada consumidor.

- [ ] Ocultar tarjetas y pestañas de reparación cuando el módulo no está efectivo.
- [ ] Evitar consultas a tablas de módulos desactivados; usar bloques condicionales servidor/cliente.
- [ ] Mantener totales financieros consolidados cuando corresponda, sin mostrar categorías operativas desactivadas.
- [ ] Ajustar estados vacíos al perfil: productos para retail, agenda/servicios para servicios, reparaciones para taller.
- [ ] Probar que desactivar reparaciones reduce consultas y no causa errores en reportes.

**Criterios de aceptación:** El dashboard de ropa no parece un taller y el dashboard de taller conserva su operación actual.

**Dependencias:** Tareas 9 y 10.

## Fase 5 — Enforcement servidor y seguridad

### Tarea 12: Aplicar módulos efectivos en APIs tenant-aware

**Archivos:**
- Modificar: `src/lib/api/withTenantAuth.ts`
- Crear: `src/lib/api/withTenantAuth.modules.test.ts`
- Modificar las rutas agrupadas en la matriz de Tarea 1.

**Contrato propuesto:**

```ts
withTenantAuth(handler, {
  permission: 'repairs.read',
  module: 'repairs',
})
```

- [ ] Resolver perfil y derecho en servidor con la organización autenticada.
- [ ] Devolver `403 MODULE_DISABLED` cuando la organización lo desactivó y `402 MODULE_NOT_ENTITLED` cuando falta en el plan.
- [ ] No revelar si existen registros de otra organización.
- [ ] Mantener consultas transversales de solo lectura con degradación explícita cuando sea requisito de la matriz.
- [ ] Añadir tests de contrato para cada familia de APIs, incluyendo tenant A/B.

**Criterios de aceptación:** Una petición manual no puede crear ni modificar datos de un módulo desactivado; los errores son consistentes y utilizables por la UI.

**Dependencias:** Tareas 3, 5 y 10.

### Tarea 13: Auditar cambios de perfil y habilitación

**Archivos:**
- Modificar: `src/app/api/admin/organization-profile/route.ts`
- Crear: `src/lib/organization/business-profile-audit.test.ts`
- Modificar UI de auditoría existente solo si la matriz confirma un visor apropiado.

- [ ] Registrar actor, organización, timestamp, perfil anterior, perfil nuevo y módulos agregados/quitados.
- [ ] No guardar tokens, cookies ni datos sensibles en `metadata`.
- [ ] Mostrar etiqueta humana y códigos técnicos en el detalle de auditoría.
- [ ] Probar que un PATCH fallido no deja evento de éxito.

**Criterios de aceptación:** Un administrador puede saber quién desactivó Reparaciones y cuándo.

**Dependencias:** Tareas 5 y 12.

### Checkpoint C

- [ ] Todas las rutas de la matriz tienen control cliente y servidor.
- [ ] Pruebas tenant A/B pasan.
- [ ] No hay `SECURITY DEFINER` públicamente ejecutable sin justificación.
- [ ] Advisors no reportan problemas nuevos de seguridad.

## Fase 6 — Compatibilidad pública y migración gradual

### Tarea 14: Separar módulo operativo de visibilidad del sitio público

**Archivos:**
- Modificar: `src/lib/website/services.ts`
- Modificar: `src/components/admin/website/ServicesManager.tsx`
- Modificar: `src/components/public/PublicHeader.tsx`
- Modificar: `src/app/[organizationSlug]/servicios/page.tsx`
- Crear o ampliar pruebas de disponibilidad pública.

- [ ] Mantener `servicesPageEnabled` como control editorial público.
- [ ] Explicar en settings que “Servicios internos” y “Página pública de servicios” son decisiones distintas.
- [ ] Evitar publicar una ruta vacía si no hay servicios configurados y la página está desactivada.
- [ ] Probar combinaciones 2x2 de módulo operativo y página pública.

**Criterios de aceptación:** Desactivar operación interna no borra ni cambia silenciosamente el sitio público.

**Dependencias:** Tareas 8 y 10.

### Tarea 15: Migrar organizaciones existentes con observabilidad

**Archivos:**
- Crear: `scripts/audit-organization-business-profiles.ts`
- Crear: `docs/qa/organization-profile-rollout.md`
- Modificar migración solo antes de aplicarla; después, crear una migración correctiva separada.

- [ ] Generar informe de organizaciones, valor legado, uso de reparaciones/servicios y módulos resultantes sin escribir cambios.
- [ ] Revisar manualmente casos ambiguos antes de aplicar backfill definitivo.
- [ ] Desplegar primero lectura con fallback, luego escritura dual, luego enforcement y finalmente retirar fallback en una versión posterior.
- [ ] Definir métricas: errores `MODULE_DISABLED`, accesos directos bloqueados, cambios de configuración y consultas evitadas.
- [ ] Documentar rollback: deshabilitar enforcement mediante feature flag y volver a `entitledModules` sin tocar datos.

**Criterios de aceptación:** El rollout puede pausarse o revertirse sin editar datos operativos.

**Dependencias:** Tareas 4, 12 y 14.

## Fase 7 — Especialización por rubro (segunda entrega)

### Tarea 16: Diseñar atributos extensibles de producto

**Archivos:**
- Crear spec independiente: `docs/superpowers/specs/<fecha>-product-variants-by-vertical-design.md`
- No modificar productos hasta aprobar ese spec.

- [ ] Diseñar variantes SKU para talla/color/tono sin duplicar la lógica de stock.
- [ ] Diseñar atributos de lote y vencimiento para cosméticos/alimentos con validaciones propias.
- [ ] Diseñar serie/IMEI para electrónica como identificadores unitarios.
- [ ] Definir importación/exportación y compatibilidad con POS, ecommerce y comprobantes.

**Criterios de aceptación:** La segunda entrega no agrega columnas ad hoc por rubro y mantiene un único cálculo de inventario.

**Dependencias:** Estabilización de Fases 1 a 6.

## Fase 8 — Verificación final y documentación operativa

### Tarea 17: Ejecutar matriz funcional y responsive

**Archivos:**
- Crear: `src/test/integration/organization-business-profile.test.tsx`
- Crear: `docs/qa/organization-business-profile-results.md`

- [ ] Ejecutar perfiles retail, wholesale, service, repair y mixed con roles owner, admin, vendedor, técnico y cajero.
- [ ] Verificar desktop 1440/1024 px y móvil 390/360 px.
- [ ] Simular pérdida de conexión durante guardado y confirmar reintento seguro sin estado optimista incorrecto.
- [ ] Verificar teclado, foco, textos de ayuda, contraste y mensajes anunciados.
- [ ] Ejecutar pruebas enfocadas, typecheck, lint de archivos modificados, build y `git diff --check`.

**Comandos mínimos:**

```powershell
npm test -- src/lib/organization src/lib/saas/effective-modules.test.ts src/contexts/SubscriptionStatusContext.test.tsx src/app/api/admin/organization-profile/route.test.ts
npm run typecheck
npx eslint src/lib/organization src/lib/saas/effective-modules.ts src/contexts/SubscriptionStatusContext.tsx src/components/admin/settings/BusinessProfileCard.tsx
npm run build
git diff --check
```

**Criterios de aceptación:** Todos los perfiles ven una experiencia coherente; los controles servidor resisten acceso manual; los fallos preexistentes quedan separados de regresiones nuevas.

**Dependencias:** Tareas 1 a 15.

### Tarea 18: Documentar adopción y decisión arquitectónica

**Archivos:**
- Crear: `docs/decisions/ADR-organization-business-profile.md`
- Crear: `docs/GUIA_CONFIGURACION_TIPO_NEGOCIO.md`
- Modificar: ayuda contextual/onboarding según patrones existentes.

- [ ] Documentar por qué plan, perfil y permisos son capas distintas.
- [ ] Incluir ejemplos para ropa, cosméticos, mayorista, taller y servicios.
- [ ] Explicar desactivación, conservación de datos y reactivación.
- [ ] Añadir diagnóstico de “no veo un módulo” según el motivo de bloqueo.

**Criterios de aceptación:** Operaciones puede configurar una organización sin asistencia técnica y desarrollo puede rastrear la decisión original.

**Dependencias:** Tarea 17.

## Orden de despliegue recomendado

1. Dominio puro y migración aditiva.
2. Lectura con fallback compatible, sin ocultar módulos.
3. Editor de settings y onboarding con escritura dual.
4. Navegación y dashboards condicionados detrás de feature flag.
5. Enforcement de APIs y rutas en staging.
6. Backfill auditado de organizaciones existentes.
7. Activación gradual en producción por organización.
8. Retiro del campo legado solo tras una versión estable y medición sin regresiones.

## Estimación orientativa

| Bloque | Esfuerzo |
|---|---:|
| Inventario y contrato | 1–2 jornadas |
| Migración, API y contexto | 2–3 jornadas |
| Settings y onboarding | 2–3 jornadas |
| Navegación, rutas y dashboards | 3–5 jornadas |
| Enforcement, auditoría y rollout | 3–4 jornadas |
| QA, accesibilidad y documentación | 2–3 jornadas |
| Total primera entrega | 13–20 jornadas de desarrollo/revisión |

La especialización de variantes por rubro debe estimarse en un proyecto separado luego de conocer el modelo actual de stock, importación y venta.

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Confundir módulo desactivado con plan insuficiente | Alto | Estados de disponibilidad tipados y mensajes distintos |
| Bloquear organizaciones antiguas | Alto | `enabled_modules=null` como fallback temporal y backfill auditado |
| Ocultar UI sin bloquear API | Alto | Matriz de rutas y enforcement en `withTenantAuth` |
| Consultas de reparaciones desde pantallas generales | Medio | Condicionar fetches y probar conteo de solicitudes |
| Divergencia desktop/móvil | Medio | Catálogo único de navegación |
| Mezclar servicios públicos con operación interna | Medio | Controles y copy separados |
| RLS o función privilegiada insegura | Alto | Test tenant A/B, grants explícitos y advisors |
| Conflicto con cambios locales actuales | Alto | Ejecutar en rama/worktree aislado y no tocar el worktree sucio |

## Definición de terminado

- [ ] Organización nueva recibe preset correcto y puede personalizarlo.
- [ ] Organización existente conserva acceso hasta elegir configuración.
- [ ] Navegación, dashboard, rutas y APIs usan la misma resolución efectiva.
- [ ] Plan, prueba, preferencia organizacional y permiso de usuario conservan responsabilidades separadas.
- [ ] Desactivar/reactivar un módulo no elimina ni altera datos.
- [ ] Auditoría identifica actor, fecha y cambio.
- [ ] QA multi-tenant, responsive, accesibilidad, typecheck y build quedan documentados con evidencia.
- [ ] No se hizo push automático; integración y despliegue requieren aprobación explícita.

