# Organizaciones: rediseño completo
## Alcance acordado
El usuario eligió rediseño completo: directorio, ficha, creación y edición; mejorar navegación, filtros y mensajes. Estructura comunicada: directorio con búsqueda, estado y acceso a empresa; ficha con Resumen, Funciones, Equipo, Suscripción, Sucursales; formularios separados por datos básicos, plan/acceso, funciones y propietario.
## Diseño
Interfaz neutra con acento primary, tarjetas con títulos claros, tipografía legible y acciones táctiles de 44px. Directorio con filtros etiquetados y vistas tabla/tarjetas, tarjetas automáticas en móvil, consulta de estado de pago separada de suscripción. Detalle con navegación adaptable y descripciones útiles por sección, sin repetir el resumen en una mascota. Alta con navegación por secciones y resumen de creación. Edición con grupos, revisión del cambio real y guardado parcial: no reemplazar módulos heredados ni configuraciones no editadas.
## Límites
Conservar autenticación, autorización, APIs y reglas de plan. Sin migraciones ni producción ni envíos reales de correo. Pruebas de formularios con mocks. Preservar los cambios de Claude.

## Ajuste de persistencia necesario
La API PATCH conserva su contrato. Se corrige la rama de suscripción ausente para que estado/cancelación realmente se guarden con el plan actual, y se comprueban errores antes de devolver éxito. No requiere migración.
