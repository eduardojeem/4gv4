# Sincronización de presentación web y Expo

Cambios locales sobre el trabajo existente; sin push, migración ni operaciones contra producción.

- API móvil publica rubro, modelo de negocio, módulos efectivos y modos de atención/reserva. Pestañas y foco usan el modelo de negocio igual que la web.
- Expo reutiliza la política pura de presentación web. POS prioriza servicios para servicios puros y barberías mixtas. Selección manual aislada por organización; cambiar comercio descarta la selección anterior.
- Inicio oculta Stock bajo sin inventario y exige capacidad agenda.create para crear turnos. Sin ampliación de permisos en servidor.
- Resumen de agenda móvil usa la misma validación que web, con errores explícitos, límite de consulta y ámbito empresa. No presenta cero ante un error.
- Guardar/cambiar estado avisa al resumen local. Web Actualizar refresca agenda; foco y refresco periódico recuperan cambios externos. No es sincronización push/realtime entre dispositivos.

## Límites pendientes

No implementado en esta entrega: actividad principal elegida y persistida por empresa; dirección/instrucciones/intervalos de traslado estructurados para domicilio; revisión visual de las 51 páginas y matriz completa por roles. No se probó físicamente en Expo Go ni se publicó una compilación móvil. El proyecto no define un rol barbero/profesional propio: eso requiere definir su relación con los roles existentes antes de afirmar cobertura.
