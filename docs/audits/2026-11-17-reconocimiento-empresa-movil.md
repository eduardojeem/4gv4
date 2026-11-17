# Reconocimiento de negocio en la app móvil — 2026-11-17

## Corrección
La consulta de cuenta/empresa se actualiza al enfocar la pantalla, al regresar la app al primer plano, al actualizar manualmente el marketplace y al cambiar de usuario, empresa, sucursal o permisos. Se descartan respuestas tardías y datos del contexto anterior. La revocación de acceso oculta los datos sin iniciar un bucle de consultas; permite reintentar explícitamente.

Un 403 genérico, una respuesta incompleta o un error del servidor pasan a acceso desconocido con reintento. Solo NO_ACTIVE_BUSINESS_MEMBERSHIP representa ausencia confirmada de empresa. El servidor valida la identidad con requireAuth y, si no resuelve la organización seleccionada, comprueba las membresías staff activas del usuario autenticado. Si existe alguna, informa selección no resuelta (409); si falla la lectura, responde 503. No cambia automáticamente a una empresa distinta ante una selección inválida. Respuestas private/no-store.

No modifica cuentas, organizaciones, membresías, roles ni permisos en la base. No implica reparar usuarios individuales ni crear empresas duplicadas.

## Verificación
44 pruebas de API, navegación de cuenta, registro y contexto móvil aprobadas. TypeScript raíz y mobile. ESLint de cambios sin nuevos errores; se conserva el aviso anterior de openRegistration sin uso en index.tsx.

El hook real fue comprobado en React Native Web con servicios y eventos de foco/primer plano simulados: ausencia inicial seguida de nueva membresía; regreso a la pantalla; rechazo genérico sin falsa ausencia; reintento; ocultamiento tras revocación sin bucle; cambio de usuario. Sin errores de página.

No se probó la cuenta real en un teléfono ni la versión binaria instalada. Sin migración, producción, commit, push ni deploy. Para distribución hacen falta publicar el contrato actualizado de la API y actualizar el cliente móvil.
