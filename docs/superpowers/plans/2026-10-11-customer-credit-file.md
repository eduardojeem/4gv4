# Ficha privada para crédito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gestionar desde Clientes un expediente privado para crédito y consultar su resumen al conceder crédito sin alterar deudas existentes.

**Architecture:** Tablas separadas por organización y cliente, APIs server-only con validación de permisos y documentos en bucket privado. Una decisión manual actualiza el límite existente y auditoría de forma atómica. La protección final de nuevas concesiones está en la transacción de base, no solo en el POS.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Supabase Postgres/Storage, Vitest, Testing Library y Docker local existente. Sin nuevos servicios externos.

**Spec:** `docs/superpowers/specs/2026-10-11-customer-credit-file-design.md`

## Global Constraints

- Entregar en la rama actual; preservar cambios ajenos. No ejecutar SQL remoto, publicar ni otorgar créditos reales.
- `customers.credit_limit` sigue siendo la única fuente operativa de límite.
- Una ficha por cliente y organización; una referencia no es un garante.
- Hasta cinco referencias; JPEG, PNG y WebP; máximo 5 MB por archivo y 10 archivos activos por ficha. PDF fuera de esta versión.
- Modos informativo/advertir/exigir, predeterminado informativo. No aprobar clientes existentes automáticamente.
- Propietario/administrador/gerente con permiso CRM y módulo créditos gestionan expediente. Vendedor ve solo resumen operativo.
- Actor, fecha, organización y path de archivos se derivan en servidor. Sin URLs públicas, logs con contenido sensible, scoring ni llamadas a referencias.
- Datos esenciales modificados después de aprobación dejan revisión pendiente, sin borrar deuda ni impedir cobros de cuotas.
- Versionado optimista: conflicto HTTP 409. Créditos simultáneos no pueden exceder el cupo.
- Generar migraciones con la CLI; probar solo en base local. Validar documentación actual antes de implementar Supabase.

## Review Focus

1. Dos concesiones simultáneas o aprobación concurrente: cupo y decisión consistentes bajo el mismo bloqueo de cliente; Task 2.
2. Cambiar requisitos después de aprobar: el checklist actual debe reevaluarse, sin conservar una aprobación suficiente por caché; Task 2.
3. Archivo borrado o upload interrumpido: nunca presentar un documento incompleto como verificado; Task 4.
4. Vendedor usa API/exportación directa: no obtiene ingreso, referencias ni documentos aunque pueda ver crédito disponible; Tasks 3 y 5.
5. Ficha ausente/migración faltante al cobrar una cuota: no bloquear cobros ni mostrar falsamente crédito aprobado; Tasks 3 y 6.

## Mapa de archivos y rutas

- Crear `src/lib/credits/credit-file-contract.ts`: tipos, esquemas y checklist puro.
- Crear `src/lib/credits/credit-file-server.ts`: contexto autorizado y operaciones de expediente/decisión/resumen.
- Crear `src/lib/credits/credit-file-documents.ts`: validación binaria y ciclo de archivo privado.
- Crear rutas bajo `src/app/api/customers/[id]/credit-file/`: `route.ts`, `decision/route.ts`, `summary/route.ts`, `documents/route.ts`, `documents/[documentId]/route.ts`.
- Crear `src/app/api/credits/file-policy/route.ts`: configuración de organización.
- Crear `src/components/dashboard/customers/credit-file/CustomerCreditFile.tsx`, `CreditFileReferences.tsx`, `CreditFileDocuments.tsx`, `CreditFileDecision.tsx`, `CreditFilePolicy.tsx` y `src/hooks/use-customer-credit-file.ts`.
- Modificar `src/components/dashboard/customers/CustomerDetail.tsx`, `src/app/api/customers/route.ts` y el consumidor POS `src/app/dashboard/pos/components/checkout/PaymentMethods.tsx`.
- Crear SQL mediante `npx supabase migration new customer_credit_files` y posteriormente `npx supabase migration new customer_credit_file_enforcement`. Usar los nombres generados, no inventar timestamps.
- Crear pruebas `src/test/customer-credit-file-{contract,sql,routes,documents}.test.ts` y `src/test/customer-credit-file-ui.test.tsx`; fixtures SQL en `supabase/tests/customer_credit_file.test.sql`.

## Task 1: Contrato de ficha y requisitos

**Files:** Crear contrato y `src/test/customer-credit-file-contract.test.ts`.

**Interfaces:** Producir `CreditFileStatus = 'draft'|'pending'|'approved'|'rejected'|'suspended'`, `CreditFileMode = 'informational'|'warning'|'required'`, `CreditDocumentType = 'identity'|'address'|'income'|'other'`. Exportar `CreditFileInputSchema`, `CreditFileDecisionSchema`, `CreditFilePolicySchema`, `CreditFileDTO`, `CreditFilePolicy`, `CreditFileSummary` y `evaluateCreditFile(file: CreditFileDTO|null, policy: CreditFilePolicy): { eligible: boolean; missing: string[] }`.

DTO: version, status, identity {type,number}, occupation, company, position, declaredMonthlyIncome|null, informedCustomerAt|null, referencias, documentos (sin path), lastDecision {actorId,at,reason}|null. Resumen: status|null, mode, missing, limit, outstanding, available, overdueCount, eligible. Referencia: id, name, relationship, phone, verificationStatus, verifiedAt/By|null, comment. Documento: id, type, filename, lifecycle pending/ready/deleted, reviewStatus pending/verified/rejected, reviewerAt/By|null, comment. Configuración: mode, requireIdentity, minVerifiedReferences 0..5, requiredDocuments sin duplicados. Límite propuesto aparece en la solicitud de decisión, no en un segundo saldo operativo.

- [ ] Escribir tests que rechacen seis referencias, ingreso negativo/no finito, documento desconocido, versión no entera y referencias sin nombre/teléfono. `evaluateCreditFile(null, requiredPolicy)` devuelve `eligible:false`; archivo pending nunca satisface documento verificado.
- [ ] Ejecutar `npx vitest run src/test/customer-credit-file-contract.test.ts --maxWorkers=1 --no-file-parallelism`; comprobar RED por contrato ausente.
- [ ] Implementar esquemas estrictos; trim/límites: nombre 200, teléfono 50, número de documento 50, comentarios 1000; números monetarios 0..1e12. Ingreso vacío normalizado a null. Actor/organización ausentes del input editable.
- [ ] Reejecutar tests: PASS. Revisar tipos y guardar commit local `feat: define customer credit file contracts`.

## Task 2: Persistencia y garantías financieras

**Files:** Migraciones CLI, fixture SQL, test SQL, `src/lib/credits/create-credit-account.ts`, sus consumidores `src/app/api/credits/sale/route.ts` y `src/app/api/repairs/[id]/payment/route.ts`; pruebas existentes de estos consumidores.

**Interfaces:** Tablas `customer_credit_files`, `customer_credit_references`, `customer_credit_documents`, `customer_credit_file_events`, `organization_credit_file_policies`. RPC service-role-only `save_customer_credit_file(p_organization_id uuid,p_customer_id uuid,p_actor_id uuid,p_expected_version integer,p_payload jsonb) returns jsonb` y `decide_customer_credit_file(...,p_status text,p_limit numeric,p_reason text) returns jsonb`. El plan debe fijar firmas en la migración antes de adaptar consumidores. Núcleo `createCreditAccount(input: CreateCreditAccountInput): Promise<CreateCreditAccountResult>` conserva el contrato público y añade actorId validado para auditoría al input.

- [ ] Escribir fixture transaccional con organizaciones/clientes ficticios y assertions: FK cruzada rechazada; permisos anon/authenticated denegados; decisión y límite/auditoría rollback juntos; versión antigua falla; edición esencial vuelve pending; límite reducido no altera deuda.
- [ ] Añadir prueba concurrente local con dos conexiones: concesiones serializan por cliente, una excedente se rechaza. Reevaluar documentos/política vigente al crear crédito, aunque la ficha fuera aprobada antes del cambio de requisitos.
- [ ] Ejecutar fixture/pruebas antes del esquema y observar RED. Descubrir CLI con `--help`, generar archivos, aplicar a Docker local únicamente.
- [ ] Implementar RLS y revocar acceso directo anon/authenticated al expediente; grants solo para ruta privilegiada. Relaciones tenant+cliente y actor validado contra membresía/roles. Configuración nueva informativa; bucket privado `customer-credit-documents` con restricciones exactas.
- [ ] Implementar decisión atómica bloqueando cliente; actualización genérica de `credit_limit` no permite bypass en modo required. Guardar y auditar con versión. Generar eventos mínimos, sin documentos/ingresos en logs.
- [ ] Añadir enforcement final en inserciones/transiciones de concesión `customer_credits`, bajo bloqueo de cliente y usando deuda actual/cuotas/reparaciones con semántica existente. Aplicar al núcleo manual/reparaciones y POS v5/v4: confirmar columnas/timing de inserción y conservar cálculo existente de interés, primera cuota y cupo. Si el punto de trigger no representa deuda completa, usar validación transaccional común en las RPC; no introducir un chequeo que cuente dos veces la venta actual.
- [ ] Sustituir inserción cabecera+cuotas con compensación del núcleo por RPC transaccional `create_customer_credit_account_atomic` que recibe plan de cuotas validado, confirma cupo/política y retorna el resultado existente. Revalidar actor/tenant. No depender del creditLimit del caller.
- [ ] Reejecutar fixtures, concurrencia, contratos y pruebas de crédito existentes; PASS, advisors locales sin hallazgos nuevos relevantes; commit `feat: persist private credit files and enforce credit decisions`.

## Task 3: APIs autorizadas y resumen sin datos sensibles

**Files:** `credit-file-server.ts`, rutas de ficha/decision/summary/configuración, `src/test/customer-credit-file-routes.test.ts`, `/api/customers/route.ts`.

**Interfaces:** `loadCreditFile(context,customerId): Promise<CreditFileDTO|null>`, `saveCreditFile(context,customerId,input): Promise<CreditFileDTO>`, `decideCreditFile(context,customerId,input): Promise<CreditFileDTO>`, `loadCreditFileSummary(context,customerId): Promise<CreditFileSummary>`. Contexto server-only derivado de `withTenantAuth`, nunca del body. GET ficha, PUT ficha con versión, POST decisión, GET summary; GET/PUT política.

- [ ] Tests RED: 401 sin sesión, 403 vendedor expediente/decisión, 404 cliente ajeno, 409 conflicto, inputs estrictos; vendedor autorizado recibe solo el resumen; ingreso/referencias/path no aparecen en él ni en exportaciones de clientes.
- [ ] Ejecutar `npx vitest run src/test/customer-credit-file-routes.test.ts --maxWorkers=1 --no-file-parallelism`.
- [ ] Implementar permiso CRM + módulo credits + allowlist owner/admin/manager para expediente. Resumen conserva roles existentes de crédito. Nunca usar OR de permisos como AND. Política solo owner/admin con settings.manage y credits.
- [ ] Devolver errores de migración ausente explícitos (503 `CREDIT_FILE_UNAVAILABLE`) sin falsa aprobación; no cambiar endpoints de cobros/consulta de cuotas. Respuestas privadas `Cache-Control: private, no-store`; validar UUID y pertenencia antes de operar.
- [ ] Adaptar actualización de clientes para impedir bypass de límite en modo required y mantener compatibilidad informativa. Prueba API directa y prueba final DB del Task 2 deben coincidir.
- [ ] Ejecutar pruebas: PASS; commit `feat: expose authorized customer credit file APIs`.

## Task 4: Documentos privados y consistencia de carga

**Files:** `credit-file-documents.ts`, rutas documentos, `customer-credit-file-documents.test.ts` y fixtures SQL del Task 2.

**Interfaces:** `validateCreditDocument(bytes: Uint8Array,declaredType: string): {mimeType:string;extension:string}`, `uploadCreditDocument(context,customerId,file,type,expectedVersion): Promise<CreditFileDTO>`, `downloadCreditDocument(context,customerId,documentId): Promise<{bytes:Uint8Array;mimeType:string;filename:string}>`, `deleteCreditDocument(context,customerId,documentId,expectedVersion): Promise<CreditFileDTO>`. POST upload multipart, GET descarga autenticada, PATCH revisión con versión, DELETE con versión.

- [ ] Tests RED: 0 bytes, 5 MB+1, firma/MIME distintos, SVG/HTML/PDF rechazados, undécimo archivo rechazado concurrentemente, vendedor y tenant ajeno denegados; path generado y nunca recibido del cliente.
- [ ] Test upload interrumpido: metadatos no pasan ready, archivo huérfano se limpia; eliminación retira descarga antes de limpieza, reintento idempotente; documento deleted no satisface checklist. Cambio de documento invalida revisión vigente.
- [ ] Implementar upload server-side con límite de cuerpo/archivo, reservation pending y compensación; no reutilizar `/api/upload` genérico. Guardar eliminación lógica/evento y cleanup idempotente; documentar cómo reintentar cleanup fallido sin exponer el objeto.
- [ ] Descargar por API autorizada con MIME y filename seguros, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`. No persistir signed URL ni token en UI; no caché PWA. Comprobar bucket privado/RLS/grants reales en Docker.
- [ ] Ejecutar `npx vitest run src/test/customer-credit-file-documents.test.ts --maxWorkers=1 --no-file-parallelism` y fixture: PASS; commit `feat: secure customer credit document lifecycle`.

## Task 5: Ficha usable en Clientes

**Files:** Componentes/hooks del mapa, `CustomerDetail.tsx`, `customer-credit-file-ui.test.tsx`.

**Interfaces:** `CustomerCreditFile({customerId,onCustomerUpdated}: {customerId:string;onCustomerUpdated:()=>void})`; hook `useCustomerCreditFile(customerId)` entrega DTO, política, loading/error y operaciones de Tasks 3/4. Subcomponentes reciben datos y callbacks tipados, sin mutar límite desde guardado general.

- [ ] Tests RED con Testing Library: nueva pestaña abre expediente; guardar no aprueba; ingreso vacío null; agregar/verificar referencia manual; texto «Una referencia no es un garante»; upload no verifica automáticamente; confirmación antes de borrar; conflicto conserva inputs y permite recargar.
- [ ] Añadir tests vendedor sin campos sensibles, error 503 con reintento, límites cinco referencias/diez archivos, finalidad informativa sin checkbox preseleccionado, discrepancia CI/RUC sin sobrescritura automática.
- [ ] Implementar bloques apilados, acciones separadas guardar/solicitar revisión/aprobar/rechazar/suspender, y controles de política con explicación antes de modo required. Carga archivo/foto sin abrir cámara automáticamente. Refrescar métricas tras decisión.
- [ ] Ejecutar tests UI y clientes existentes: PASS; verificar teclado/320/768/1024/1440 en navegador sin datos privados reales; commit `feat: add customer credit file management UI`.

## Task 6: Resumen POS y regresiones end-to-end

**Files:** `PaymentMethods.tsx`, crear `src/app/dashboard/pos/components/checkout/CustomerCreditFileSummary.tsx`, `src/test/customer-credit-file-pos.test.tsx`, contratos de `/api/pos/process-sale`, núcleo y reparación; documentos de entrega.

**Interfaces:** `CustomerCreditFileSummary({customerId}: {customerId:string})` consume exclusivamente summary API. UI no autoriza ventas; Task 2 controla la transacción final.

- [ ] Tests RED: resumen estado/límite/deuda/disponible/vencidas y enlace cliente; cuenta al contado no pide ficha; required bloquea creación servidor/DB con motivo, warn informa sin quitar reglas financieras; cobro cuota, devolución y lectura de créditos no quedan bloqueados.
- [ ] Cubrir simultaneidad con POS v5 y fallback v4; crédito manual desde sale y reparación usan regla común. `/api/credits/batch` es consulta, no creación: no añadir bloqueo. `/api/credits` POST registra pago: conservarlo operativo. Inspeccionar cualquier otra inserción de customer_credits antes de declarar cobertura completa.
- [ ] Implementar resumen sin duplicar datos ni mostrar PII; proteger carreras de cambio de cliente al cargar; no reutilizar respuesta stale al confirmar. Migración ausente informa indisponibilidad y no produce falsa aprobación ni bloqueo de cobros.
- [ ] Ejecutar todos los tests nuevos y existentes de customers/credits/POS/repairs de forma serial, ESLint archivos modificados, `npx tsc --noEmit --incremental false`, `npm run build`, `git diff --check`. Documentar fallos preexistentes por separado, sin declarar global PASS si no lo fue.
- [ ] Revisión final independiente del cambio completo conforme al método elegido, resolver hallazgos importantes con RED/GREEN; repetir solo verificaciones afectadas. Guardar commit final y enumerar nombres SQL reales para el usuario. No aplicar remoto ni publicar.

## Handoff

El usuario debe revisar este plan antes de ejecutar. Preferencia anterior: ejecución nativa en rama actual; confirmar que sigue aplicando a este plan. En nativo el agente principal implementa tareas en orden y solicita una única revisión independiente final. No abrir otros chats ni delegar implementación sin elegir esa modalidad.
