# Cómo usar la ficha para crédito

## Recorrido

1. Abrí **Dashboard → Clientes**, seleccioná un cliente y entrá en **Ficha para crédito**.
2. Completá identificación, trabajo e ingreso declarado si corresponde. El ingreso es opcional: vacío se guarda como `null`.
3. Indicá que informaste al cliente sobre el uso restringido de los datos. La casilla no viene seleccionada.
4. Agregá hasta cinco referencias. Verificarlas es una tarea manual; el sistema no llama ni envía mensajes. Una referencia no es un garante.
5. Presioná **Guardar ficha**. Guardar no aprueba crédito ni cambia la deuda o el límite.
6. Cargá documentos privados: JPEG, PNG o WebP de hasta 4 MiB por imagen, diez activos como máximo. PDF no está habilitado. Cargar no equivale a verificar.
7. Descargá y revisá cada documento; usá **Verificar documento** o **Rechazar documento** y dejá un comentario si hace falta.
8. En **Evaluación manual**, ingresá motivo y límite propuesto. **Aprobar crédito** registra la decisión y actualiza el límite operativo en una misma transacción. También podés solicitar revisión, rechazar o suspender.

Cambiar datos relevantes o retirar un documento de una ficha aprobada la devuelve a revisión pendiente. No borra deuda ni pagos. Si la deuda supera el nuevo límite, el disponible queda en cero.

## Requisitos de la organización

El propietario o administrador con permiso de configuración puede elegir:

- **Informativo**: modo predeterminado; muestra pendientes sin agregar un bloqueo por ficha.
- **Advertir**: destaca los pendientes; mantiene los controles financieros existentes.
- **Exigir**: para nuevos créditos exige aprobación manual y el checklist configurado. Cambiar a este modo requiere confirmar que se entiende el impacto.

Los requisitos son compartidos por la organización, no solo por el cliente abierto. Podés exigir identificación, referencias verificadas y determinados tipos de documentos. No se obliga a declarar ingresos.

Los cobros de cuotas y consultas de créditos existentes siguen disponibles. Una ficha ausente nunca significa aprobación automática.

## En el punto de venta

Al seleccionar crédito, o incluirlo en un pago mixto activo, se muestra estado, límite, deuda, disponible y cuotas vencidas. El vendedor recibe solo ese resumen: no puede consultar ingresos, teléfonos de referencias ni documentos.

El resumen no autoriza una venta. Al confirmar, el servidor y la base vuelven a comprobar requisitos y cupo. Al pagar al contado no se solicita la ficha.

## Conflictos y documentos retirados

- Si otra persona cambió la ficha, se muestra un conflicto y se conservan los datos escritos. **Recargar ficha** solicita confirmación si hay cambios sin guardar.
- **Retirar** solicita confirmación y elimina inmediatamente el acceso autorizado. Si Storage falla al limpiar el objeto, **Reintentar limpieza pendiente** vuelve a intentarlo; el documento ya no cuenta para los requisitos.
- Una carga interrumpida queda pendiente y no satisface el checklist. Retirala y cargala nuevamente.
- Las imágenes antiguas mayores de 4 MiB se conservan, pero la descarga por esta API las rechaza: solicitá una copia más liviana.

## SQL de esta funcionalidad

Ejecutar en orden, solo si todavía no están aplicados:

1. `20261011161845_customer_credit_files.sql`
2. `20261011161852_customer_credit_file_enforcement.sql`
3. `20261011180518_customer_credit_documents_4mb.sql`
4. `20261011181644_customer_credit_document_lifecycle.sql`

El usuario confirmó los dos primeros. Las migraciones adicionales se probaron en Docker local; esa evidencia no confirma su aplicación remota. No usar `migration repair --status applied` para sustituir la ejecución de SQL pendiente.

## Límites de la primera versión

Evaluación humana, sin scoring ni proveedor externo. No incorpora antivirus, certificación legal de consentimiento ni contacto automático con referencias. La comprobación de firma y MIME no certifica que un archivo esté libre de malware.

Las comprobaciones visuales usan componentes reales con cliente ficticio y respuestas en memoria; no sustituyen una prueba autenticada contra la base remota.
