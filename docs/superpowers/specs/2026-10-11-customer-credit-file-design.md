# Ficha para crédito desde Clientes

Estado: diseño propuesto; pendiente de revisión del usuario. No implementado.

## Objetivo y alcance aprobado

En `/dashboard/customers`, abrir un cliente y disponer de una pestaña «Ficha para crédito» para registrar identificación, trabajo e ingresos declarados opcionales, referencias, documentos y una evaluación manual. El POS consulta el resumen sin volver a pedir los datos. No confundir crédito otorgado con saldo a favor del cliente.

La solicitud autoriza preparar esta funcionalidad, no migrar producción, otorgar créditos reales, publicar, contactar referencias ni consultar proveedores externos.

## Alternativas y elección recomendada

1. Usar notas y enlaces existentes: menor esfuerzo, pero sin estructura, privacidad específica ni historial de decisiones. No recomendado.
2. Expediente separado, vinculado al cliente, y resumen operativo en POS: recomendado. Preserva el historial financiero y permite controlar acceso a documentos.
3. Motor automático de scoring o proveedor externo: fuera de alcance; agrega costo y decisiones que el usuario no pidió.

## Evidencia del código revisado

- `src/components/dashboard/customers/CustomerDashboard.tsx` usa `CustomerEditFormV2`.
- `CustomerEditFormV2.tsx` y `/api/customers/route.ts` tienen RUC, contacto alternativo, domicilio, empresa, cargo, notas y `credit_limit`, pero no un expediente estructurado de referencias y documentos.
- `CustomerDetail.tsx` contiene una pestaña de créditos con `CustomerCreditInfo`; esta no será sustituida.
- `/api/credits/route.ts` usa `withTenantAuth`, módulo `credits`, permisos CRM y un filtro adicional de roles.
- `withTenantAuth` comprueba membresía de organización, permisos y disponibilidad del módulo. Sus permisos alternativos se combinan con OR; no deben interpretarse como requisitos acumulativos.

Antes del plan se deben enumerar todos los caminos de creación de crédito: POS, venta a crédito, creación manual, lotes y funciones de base. La validación no debe depender únicamente del navegador.

## Experiencia de usuario

Pestaña nueva «Ficha para crédito», junto a «Créditos y pagos»:

1. Resumen: estado de evaluación, límite autorizado actual, deuda, disponible, última revisión y checklist de pendientes.
2. Identificación: tipo de documento CI/RUC/otro y número. Reutilizar datos actuales de contacto/domicilio sin duplicarlos silenciosamente. Advertir discrepancias con el RUC existente; no sobrescribir sin acción expresa.
3. Trabajo: ocupación, empresa, cargo e ingreso mensual declarado opcional. No producir decisiones automáticas a partir de estos datos.
4. Referencias: hasta cinco, con nombre, relación, teléfono y estado pendiente/verificada/no localizada. Verificación manual con fecha, responsable y comentario. No llamar ni enviar mensajes automáticamente. Mostrar «Una referencia no es un garante».
5. Documentos: identificación, domicilio, ingresos u otro. Estado pendiente de revisión/verificado/rechazado, comentario y fecha. La carga no equivale a verificación.
6. Evaluación: borrador/pendiente/aprobado/rechazado/suspendido; motivo, límite propuesto, responsable y fecha. Acciones de aprobación separadas de «Guardar ficha».

En móvil, bloques apilados y acciones accesibles; carga desde archivo o foto sin solicitar permisos de cámara al abrir la pestaña. Estados de carga, error, reintento, permisos insuficientes y migración ausente explícitos.

## Permisos propuestos

- Propietario, administrador y gerente con permiso CRM correspondiente y módulo créditos: acceso al expediente, gestión y decisión manual.
- Vendedor con acceso a créditos: solo resumen operativo en POS, sin ingresos, teléfonos de referencias ni archivos privados.
- Cliente público, personal sin permiso y usuarios de otra organización: sin acceso.
- No ampliar roles existentes. La API y la base deben proteger el acceso, aunque se altere la UI.

Esta distribución es una propuesta que el usuario puede ajustar antes de implementar.

## Datos y persistencia

Tablas separadas para ficha, referencias, metadatos de documentos, eventos de auditoría y configuración de requisitos de organización. Cada relación incluye organización y cliente, con validación de que el cliente pertenece a esa organización. Una ficha por cliente y organización.

- Campos financieros con rangos y valores finitos; ingreso vacío es null, no cero.
- Estados y cambios validados; actor, fecha y organización derivados en servidor, nunca confiados al cliente.
- Auditoría conserva acciones, motivos y versiones, sin copiar documentos o ingresos completos en logs.
- Cambios concurrentes usan versión; conflicto devuelve 409 y permite recargar sin pérdida silenciosa.
- `customers.credit_limit` sigue siendo la única fuente operativa de límite. Aprobar una ficha actualiza el límite y registra la decisión en una sola transacción; no mantener otro límite divergente.
- Aprobar o bajar un límite no borra deuda ni pagos. Si la deuda supera el límite nuevo, el disponible es cero.
- Rechazar/suspender conserva el historial y limita solo nuevas concesiones cuando la política se active.
- Cambiar identificación, referencias verificadas o documentos después de aprobación marca revisión pendiente y audita la modificación. No cambia la deuda.
- La edición genérica de cliente no debe permitir eludir una aprobación obligatoria modificando directamente `credit_limit`.

## Documentos privados

Bucket nuevo privado y separado de imágenes públicas. Rutas generadas por servidor con organización/cliente/documento UUID; nunca confiar en un path suministrado por el usuario. Sin URLs permanentes públicas.

Primera versión: JPEG, PNG y WebP, máximo 5 MB por archivo, máximo 10 archivos activos por ficha. Comprobar tamaño, tipo y firma, y rechazar archivos vacíos, SVG, HTML y ejecutables. PDF queda fuera de la primera versión hasta definir análisis de contenido; mostrar esta limitación en UI.

Descarga autenticada con comprobación de permisos vigente y respuestas privadas sin caché compartida. No cargar archivos con el endpoint público genérico de imágenes. No incluirlos en exportaciones generales de clientes, marketplace, PWA o recordatorios.

La carga y la base no son una única transacción: usar estado de documento pendiente, finalización después de upload validado y compensación de archivos huérfanos ante error. No marcar un documento como completo si falta el archivo.

Reemplazo crea un archivo nuevo; borrado con confirmación, retiro inmediato del acceso y limpieza física idempotente. Conservar solo el evento de eliminación y los metadatos mínimos de auditoría. No aplicar borrados masivos a documentos reales durante pruebas.

No se incorpora antivirus ni análisis externo: la primera versión no debe afirmar que los archivos están libres de malware ni que existe certificación legal de consentimiento. Mostrar finalidad de recopilación y registrar la confirmación manual de que se informó al cliente; no una casilla seleccionada por defecto.

## Requisitos por organización y transición

Modos: informativo, advertir y exigir aprobación/checklist. Predeterminado informativo, para no cortar ventas existentes. Cambiar a exigir es una acción explícita del administrador con explicación de impacto.

Configurar si se exige documento de identidad, referencias verificadas y tipos de documentos. No hacer obligatorios ingresos ni referencias a todas las organizaciones.

Ficha ausente no significa aprobación. Los créditos existentes no reciben aprobación automática al migrar. Cobros de cuotas, devoluciones y consulta de deudas no quedan bloqueados por requisitos nuevos.

## Integración POS y control transaccional

Mostrar estado, pendientes, límite, deuda, disponible y cuotas vencidas con enlace al cliente. No exponer el expediente completo al vendedor.

En modo informativo/advertir, la ficha añade información sin quitar controles financieros existentes. En modo exigir, todas las vías de nuevo crédito aplican la misma validación del servidor y de la transacción final, sin carreras por dos ventas simultáneas ni excepciones client-side. Cuotas vencidas se informan; no generan un bloqueo adicional no solicitado.

La validación financiera calcula deuda y concesión actual con fuentes existentes; no confiar en saldos enviados por el navegador. Los controles actuales de caja, sucursal, permisos y plan no se eliminan.

## Verificación requerida

- Datos válidos/ inválidos, transiciones, concurrencia y actualización atómica del límite.
- Aislamiento por organización y cliente; vendedor no puede leer el expediente completo ni descargar documentos.
- RLS, privilegios de tablas/RPC y bucket; anon y authenticated directo no pueden eludir la ruta autorizada.
- Archivos con MIME falsificado, tamaño excesivo, path manipulado, huérfanos, borrado y descarga no cacheable.
- Integración real de ficha y POS; prueba de que creación manual/lote/venta no elude modo obligatorio.
- Compatibilidad con créditos existentes y cobro de cuotas.
- Navegador 320/768/1024/1440 px, teclado, modal y errores; pruebas sin datos personales reales.
- Pruebas focalizadas, TypeScript, ESLint, build y SQL en base local. Distinguir esto de migración y validación remota.

## Entrega

Entregar implementación verificada en la rama actual, preservar cambios ajenos y listar los SQL generados con la CLI. El usuario ejecuta la migración remota. No aplicar SQL en producción ni desplegar sin autorización específica.

## Fuentes técnicas

- Supabase Storage, buckets privados: https://supabase.com/docs/guides/storage/buckets/fundamentals
- OWASP, validación y restricciones de carga: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html

El índice markdown del changelog no pudo leerse con el navegador de documentación en esta revisión. Revalidar novedades relevantes antes de implementar Supabase; no asumir que se revisó.
