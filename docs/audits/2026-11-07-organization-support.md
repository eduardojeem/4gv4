# Detalle de organización y modo soporte
## Alcance y autorización
Auditoría local seguida de autorización explícita del usuario para corregir validación y cierre sin ampliar permisos. No se consultaron organizaciones reales ni se inició/cerró soporte en producción. No se modificó el esquema.
## Funcionamiento actual
El inicio exige superadmin y un motivo de 5 a 300 caracteres. Crea una sesión de 30 minutos vinculada al actor autenticado y a la organización. Cookie HttpOnly, SameSite=Lax y Secure en producción. GET y el layout consultan la sesión para el actor autenticado; descartan sesiones de otra persona, terminadas o vencidas. La sesión registra asistencia: no cambia usuario, contexto operativo ni permisos.
## Hallazgos corregidos
- Lectura y cierre filtran super_admin_id con me.id/user.id autenticados. El valor no proviene del body del cliente.
- Si el cierre falla en persistencia, DELETE devuelve error y conserva la cookie para reintentar; no registra un cierre exitoso.
- El banner valida HTTP y success, muestra errores de red/servidor y recupera el botón. El cierre exitoso se anuncia y refresca el layout.
- El vencimiento limpia el intervalo y refresca una sola vez. El layout usa key por ID para no conservar el estado de una sesión anterior.
- Límites de motivo compartidos entre UI, API y helper. Cuerpos no objeto se rechazan. Se evita doble envío y se conserva el motivo ante fallos.
- GET usa Cache-Control: no-store para no cachear el motivo.
## Alcance que se mantiene
SUPPORT_MODE_ENFORCED y getSupportSessionForOrg no tienen consumidores operativos en src. Esta corrección no los conecta a rutas existentes ni concede accesos. No es una suplantación del usuario del comercio. El registro de audit_log sigue usando el helper existente de auditoría best-effort; no se cambió su contrato.
## Verificación
23 pruebas enfocadas pasan. TypeScript y lint pasan. Revisión independiente sin hallazgos concretos. Navegador 375 y 1440: cierre fallido visible, reintento exitoso, inicio simulado, sin desborde ni pageerror. Todas las solicitudes del navegador fueron interceptadas; no hubo sesiones reales. Sin migraciones, commit, push ni deploy.
