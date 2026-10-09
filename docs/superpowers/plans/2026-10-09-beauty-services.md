# Belleza y páginas de servicios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar especialidades y cuatro variantes de página de servicios sin modificar reservas ni precios existentes.

**Architecture:** Extender el perfil actual y reutilizar el sitio de servicios. Generar propuestas sin escrituras y aplicarlas con confirmación, autorización y control atómico de concurrencia.

**Tech Stack:** Next.js, React, TypeScript, Zod, Supabase/PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-beauty-services-design.md`

## Global Constraints

- Mantener el identificador `barbershop` y su comportamiento para cuentas existentes; agregar `beauty_services` para el rubro amplio.
- No convertir cuentas automáticamente.
- No inferir especialidades de una plantilla.
- Mantener `settings.manage`, aislamiento por organización y restricciones de plan.
- Preparar o previsualizar no modifica la página pública.
- No aplicar SQL remoto ni desplegar producción como parte de esta aprobación.
- No se eliminarán ni regenerarán servicios, profesionales, tarifas, citas o productos al cambiar de perfil o diseño.
- Usar las dependencias instaladas; sin proveedor de IA, generación de imágenes ni nuevas pasarelas.

## Review Focus

1. Clientes anteriores que omiten campos nuevos: conservar lo guardado, no reemplazar por valores por defecto.
2. Cambio concurrente mientras una propuesta está abierta: conflicto sin sobrescrituras ni auditoría de éxito.
3. Negocio sin servicios publicados o sin módulo: no ofrecer reservas ficticias aunque seleccione una plantilla.
4. Negocio mixto con pagos configurados: cambiar estilo no modifica carrito, cobro ni cuentas bancarias.
5. Cambio de especialidad o rubro y regreso: preservar datos y no guardar recomendaciones sin confirmación.

## Task 1: Contrato de perfil y migración compatible

**Files:** Modify `src/lib/organization/business-profile.ts`; create `src/lib/organization/service-specialties.ts`, `src/lib/organization/service-specialties.test.ts`; create una migración con `npx supabase migration new beauty_services_profile`; extend `src/test/organization-business-profile-migration.test.ts`.

**Interfaces:** `SERVICE_SPECIALTIES = ['barbering','hair','nails','lashes','brows','makeup','aesthetics','other'] as const`; `ServiceSpecialty` derivado de esa lista. `ServiceBusinessDetailsSchema`: `serviceSpecialties?: ServiceSpecialty[]` (máximo 8, sin duplicados), `attentionMode?: 'local'|'home'|'both'`, `appointmentMode?: 'booking'|'walk_in'|'both'`. Campos persistidos: `service_specialties`, `attention_mode`, `appointment_mode`. Lectura de cuentas anteriores: `[]`, `local`, `booking`; la normalización de escritura no rellena campos omitidos.

- [ ] Escribir pruebas: `safeParse({serviceSpecialties:['nails','lashes']}).success === true`; duplicados, desconocidos y modalidad inválida devuelven false; objeto vacío conserva propiedades ausentes. Aceptar `beauty_services` y seguir aceptando `barbershop` y `cosmetics`.
- [ ] Ejecutar `npx vitest run src/lib/organization/service-specialties.test.ts src/test/organization-business-profile-migration.test.ts`; confirmar fallo por contrato ausente.
- [ ] Implementar contrato y migración aditiva: ampliar restricción de rubros sin perder valores actuales, defaults anteriores, CHECK equivalente para listas/modalidades. No actualizar filas de servicios o citas. Incluir SQL de comparación/aplicación de propuestas del Task 4 en una migración separada al llegar a ese task.
- [ ] Ejecutar las pruebas anteriores y verificar la migración en base local de pruebas si está disponible; si no, registrar que SQL remoto no fue ejecutado.
- [ ] Revisar diff y guardar commit `feat: add compatible service business classification`.

## Task 2: Persistencia y formulario de perfil/alta

**Files:** Modify `src/lib/saas/subscription-service.ts`, `src/contexts/SubscriptionStatusContext.tsx`, `src/app/api/admin/organization-profile/route.ts`, `src/app/api/onboarding/complete/route.ts`, `src/components/dashboard/onboarding/OnboardingClient.tsx`, `src/components/admin/settings/BusinessProfileCard.tsx`; create `src/components/admin/settings/ServiceBusinessFields.tsx`; extend `BusinessProfileCard.test.tsx` y `src/test/admin-onboarding-route.test.ts`; create `src/test/organization-service-profile-route.test.ts`.

**Interfaces:** Extender respuesta/contexto con los tres campos del Task 1. `ServiceBusinessFields({value,onChange,disabled})` consume `ServiceBusinessDetails`, muestra etiquetas españolas y controles accesibles. PATCH conserva campos omitidos; lista vacía explícita borra selección. Alta utiliza defaults solo para organizaciones nuevas.

- [ ] Escribir pruebas de PATCH: omitir campos conserva valores, enviar `[]` vacía especialidades, fallo de auditoría no informa éxito, otra organización/no `settings.manage` no escribe. Formulario permite uñas y pestañas simultáneas y muestra rubro guardado hasta guardar.
- [ ] Ejecutar `npx vitest run src/test/organization-service-profile-route.test.ts src/components/admin/settings/BusinessProfileCard.test.tsx src/test/admin-onboarding-route.test.ts`; confirmar fallos nuevos.
- [ ] Integrar lectura/escritura, alta y formulario; actualizar los mapas exhaustivos de `BusinessVertical` detectados por TypeScript con etiquetas y capacidades del nuevo rubro. `beauty_services` propone `service`; módulos se limitan al plan y su cambio sigue siendo revisable. Conservar rubros existentes y campos al cambiar de rubro.
- [ ] Ejecutar pruebas y `npm run typecheck`; corregir consumidores exhaustivos dentro del alcance, sin refactorizar módulos ajenos.
- [ ] Revisar diff y commit `feat: configure beauty service specialties and attention modes`.

## Task 3: Propuesta pura y variantes públicas

**Files:** Create `src/lib/website/service-website-proposal.ts`, `src/lib/website/service-website-proposal.test.ts`; modify `src/types/website-settings.ts`, `src/lib/website/vertical-website-preset.ts`, `src/lib/website/storefront-style.ts`, `src/lib/website/default-settings.ts`, `src/lib/website/storefront-capabilities.ts`, `src/lib/website/vertical-guidance.ts`, `src/components/public/inicio/ServicesHome.tsx`; create `src/test/service-website-variants.test.tsx`.

**Interfaces:** `ServiceWebsiteVariant = 'barber'|'salon'|'studio'|'professional'`. `ServiceWebsiteProposalInput` contiene `variant`, `specialties`, `accentColor` (#RRGGBB), `title` (1–120), `subtitle` (0–400), `current: Partial<WebsiteSettings>`, `capabilities: StorefrontCapabilities`. `buildServiceWebsiteProposal(input): {values: Partial<Pick<WebsiteSettings,'company_info'|'hero_content'|'trust_bar'|'process_flows'|'booking_section'>>,summary:string[]}`. Persistir variante visual como `company_info.serviceWebsiteVariant`, sin ampliar la plantilla comercial `beauty`.

- [ ] Escribir pruebas: las cuatro variantes usan servicios reales; plantilla `beauty` comercial conserva comportamiento; `buildServiceWebsiteProposal` no muta input ni incluye `services`, `checkout` o datos de agenda; nombre/contacto/logo conservados; sin módulo de servicios no habilita reservas.
- [ ] Ejecutar `npx vitest run src/lib/website/service-website-proposal.test.ts src/test/service-website-variants.test.tsx`; confirmar fallos nuevos.
- [ ] Implementar variantes sobre renderer de servicios. Barbería sobria, salón cálido, estudio marfil/rosa/malva y profesional neutral; colores editables con contraste legible. Mostrar modalidades como información, sin prometer gestión de domicilio. No introducir fotos, cifras o tarifas de ejemplo.
- [ ] Ejecutar pruebas anteriores y regresiones `src/test/services-template-availability.test.tsx`, `src/test/beauty-template.test.tsx`, `src/test/vertical-website-preset.test.ts`.
- [ ] Revisar diff y commit `feat: add real-data service website variants`.

## Task 4: Vista previa y aplicación atómica autorizada

**Files:** Create `src/app/api/admin/website/service-proposal/route.ts`, `src/lib/website/service-website-proposal-server.ts`, `src/test/service-website-proposal-route.test.ts`; crear migración mediante `npx supabase migration new apply_service_website_proposal`; modify `src/app/api/admin/organization-profile/route.ts`.

**Interfaces:** POST `/api/admin/website/service-proposal` recibe opciones del Task 3 y devuelve `{success:true,proposal:{values,summary},revision:string}` sin escribir. PATCH recibe opciones y `revision`, confirma y regenera valores en servidor. Organización viene de contexto autenticado, nunca del cliente. RPC `apply_service_website_proposal(p_organization_id uuid,p_actor_user_id uuid,p_expected_revision text,p_values jsonb)` solo service-role, claves permitidas del Task 3, auditoría y escritura en la misma transacción. Revisión calculada sobre valores ordenados de esas claves y perfil/módulos relevantes.

- [ ] Escribir pruebas: POST no hace upsert; PATCH no autorizado/otra organización no escribe; revisión desactualizada retorna HTTP 409 `PROPOSAL_STALE`; checkout/servicios inyectados se rechazan; fallo de auditoría revierte escritura; invocaciones concurrentes con misma revisión permiten solo una aplicación.
- [ ] Ejecutar `npx vitest run src/test/service-website-proposal-route.test.ts`; confirmar fallos nuevos. Agregar prueba SQL de concurrencia/rollback, ejecutar si base de prueba está disponible.
- [ ] Implementar endpoint y RPC con bloqueo transaccional por organización coordinado con escritores existentes de configuración/perfil: integrar esos escritores en el mismo protocolo o comparar/bloquear sus filas dentro de la transacción. No basta verificar revisión antes de un upsert separado. Leer capacidades actuales, validar datos y regenerar propuesta antes de aplicar. Auditoría `website.service_proposal.applied`; revalidar después de éxito. `prepareWebsite` del PATCH de perfil para servicios ya no publica automáticamente: devuelve que requiere vista previa/confirmación y guarda únicamente perfil.
- [ ] Ejecutar pruebas de rutas y SQL; validar explícitamente intento de modificación mediante endpoints de settings existentes mientras la propuesta está abierta. Registrar pruebas remotas pendientes.
- [ ] Revisar diff y commit `feat: confirm service website proposals with conflict protection`.

## Task 5: Asistente, sugerencias y preview editable

**Files:** Create `src/components/admin/website/ServiceWebsitePreparationDialog.tsx` y `.test.tsx`, `src/components/admin/website/ServiceWebsiteProposalPreview.tsx`; modify `src/components/admin/settings/BusinessProfileCard.tsx`, `src/components/admin/website/ServicesManager.tsx`, `src/components/dashboard/agenda/SuggestedServicesCard.tsx`; create `src/lib/website/service-specialty-suggestions.ts` y `.test.ts`.

**Interfaces:** Dialog `{open,onOpenChange,onApplied}` consulta POST y confirma PATCH del Task 4. Mantener opciones/propuesta solo en estado del diálogo. `getServiceSpecialtySuggestions(specialties: readonly ServiceSpecialty[]): Array<{title:string,category:string}>` devuelve ejemplos sin precio/duración obligatorios ni escritura automática.

- [ ] Escribir pruebas: preparar/editar/cancelar no envía PATCH; aplicar requiere botón «Confirmar y aplicar» y muestra resumen; tras editar opciones se invalida preview anterior; 409 conserva edición y ofrece regenerar; guardar perfil no publica; sin servicios muestra guía de configuración. Sugerencias no crean servicios hasta selección explícita.
- [ ] Ejecutar `npx vitest run src/components/admin/website/ServiceWebsitePreparationDialog.test.tsx src/lib/website/service-specialty-suggestions.test.ts`; confirmar fallos nuevos.
- [ ] Implementar asistente: especialidades, variante, color y textos; preview reutiliza presentación pública con datos actuales. Separar botón guardar perfil de «Preparar mi página de servicios». Bloquear confirmación durante requests; no doble publicación. Permitir categorías/servicios personalizados existentes.
- [ ] Ejecutar pruebas y comprobar teclado, carga/error/vacío y 320/768/1024/1440 px con navegador real si disponible; no confundir pruebas de componente con prueba autenticada.
- [ ] Revisar diff y commit `feat: preview and confirm service website preparation`.

## Task 6: Verificación integral y entrega de SQL

**Files:** Create `docs/qa/beauty-services.md`; extend `src/test/services-store-by-vertical.test.tsx` y pruebas focalizadas de tareas anteriores.

**Interfaces:** Mantener contratos actuales de reserva/cobro. Entregar nombres exactos de las migraciones creadas, no marcar historial remoto ni afirmar que están aplicadas.

- [ ] Agregar regresiones: nueva variante no cambia precio/duración/buffer ni selección de profesional; negocio mixto conserva cobro; volver de estudio a barbería conserva servicios y reservas.
- [ ] Ejecutar `npx vitest run src/test/agenda-service-terms.test.ts src/test/public-agenda-quote.test.ts src/test/public-agenda-reservation.test.ts src/test/services-store-by-vertical.test.tsx` y suites de Tasks 1–5; resultado esperado PASS.
- [ ] Ejecutar `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`; documentar bloqueos ajenos con evidencia, no declararlos éxito.
- [ ] Revisar rama completa mediante revisión independiente autorizada por el método de ejecución elegido; corregir observaciones dentro del alcance y repetir pruebas afectadas.
- [ ] Documentar SQL a ejecutar por usuario, orden, compatibilidad, comprobación posterior y pendientes de entorno autenticado. Commit `test: verify beauty service compatibility and document rollout`.

## Handoff

Plan pendiente de revisión del usuario y selección del método de ejecución. No iniciar código funcional, instalar dependencias, aplicar migraciones remotas ni publicar antes de completar esa revisión.
