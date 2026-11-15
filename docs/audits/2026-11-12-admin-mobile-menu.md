# Menú Admin móvil — 12/11/2026

## Implementación
- Se unificaron la cabecera y la barra inferior en un solo menú Más. Se retiró el drawer duplicado y los bloques de métricas del menú; sus pantallas siguen accesibles por las pestañas.
- Barra inferior de cinco posiciones, misma altura de iconos y sin botón central elevado: Resumen, Finanzas, Más, Cajas, Ajustes.
- Búsqueda fija y tres grupos de opciones. Se conserva Datos del negocio; Analítica y Visitas web se consolidan en un único destino, manteniendo la búsqueda por visitas.
- Color del comercio mediante navigationColor y contraste de iconos mediante navigationInk, con superficies claras/oscuras existentes.
- Una columna por debajo de 360 px o con escala de fuente desde 1.25; etiquetas pueden envolver sin recorte.
- Los enlaces web esperan el cierre del modal usando useAfterDismiss. Las rutas y validaciones de acceso existentes no se ampliaron.
- El estado visible queda asociado a ruta, empresa y usuario para cerrarse al cambiar de contexto.

## Validación
- 22 pruebas de navegación aprobadas (4 archivos).
- Fixture del componente real con React Native Web: 390x844 claro/oscuro y 320x568, sin overflow horizontal; búsqueda visitas sin duplicados y cierre antes de navegación externa.
- En el fixture se simularon iconos y safe area nativos; no equivale a una prueba física.
- Bundles nativos iOS y Android compilados por Metro con HTTP 200.
- TypeScript y ESLint verificados en los archivos modificados; prueba física en Expo Go pendiente.

Se aplicó en C:/proyecto/mitiendapy, la copia que sirve Expo Go en 8081. Respaldo previo: C:/Users/EDU/AppData/Local/Temp/mitiendapy-admin-menu-1iqeiT. Sin push, deploy, nuevas dependencias ni cambios de base de datos.
