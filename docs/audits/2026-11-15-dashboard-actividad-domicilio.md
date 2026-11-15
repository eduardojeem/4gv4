# Actividad principal y atención a domicilio — 2026-11-15

## Alcance implementado

- Web /admin/settings y Expo Admin → Configuración → Perfil del negocio permiten elegir Automático, Ventas y caja, Agenda y servicios o Taller y reparaciones. La opción se guarda por organización, se audita y respeta los módulos y permisos ya existentes.
- El perfil se propaga al contexto web y al endpoint de menú móvil. Foco, pestañas y accesos rápidos comparten la elección. Cambiar de empresa usa la configuración de la nueva empresa.
- Agenda web y móvil guardan lugar de atención, dirección, indicaciones y minutos de ida/vuelta. La modalidad en local limpia los datos de domicilio. Los traslados no suman un recargo ni modifican el precio.
- Los intervalos ocupados incluyen traslados más el tiempo de preparación existente. El servidor rechaza cruces con turnos y ausencias y verifica que todo el recorrido quede dentro del horario. En domicilio no se permite la excepción administrativa fuera de horario.
- Las consultas públicas de disponibilidad contemplan el intervalo ocupado. Los datos de dirección se leen en la agenda privada, no se agregan al resultado público de disponibilidad.
- La UI distingue una previsualización de cruces de la disponibilidad definitiva validada al guardar. Textos y notas distinguen barbería de otros servicios.

## Migración preparada, NO aplicada

supabase/migrations/20261115023522_business_primary_and_home_appointments.sql

Agrega primary_activity y campos de domicilio/traslado. Conserva los registros anteriores con actividad automática, atención en local y traslado cero. Deriva el escritor transaccional de las funciones instaladas para conservar las condiciones aceptadas y las reglas vigentes. Rechaza una definición inesperada y revierte la transacción completa. Nuevas RPC de escritura solo para service_role; sin ampliar permisos de tablas.

La función agenda_booking_version pasa a 4 únicamente dentro de la misma migración. Las interfaces no ofrecen los campos de domicilio antes de detectar esa versión. Elegir una actividad distinta sin la columna devuelve un error claro; guardar otros ajustes sin cambiar la actividad sigue siendo compatible.

## Verificación

- PostgreSQL embebido PGlite, con funciones SQL reales y datos sintéticos: dirección, traslados, conflictos por ambos extremos, ausencias, horario, cambios atómicos de modalidad, cuenta de otra empresa, visitas cobradas, permisos y edición desde un cliente anterior.
- Pruebas de contratos Expo/API y rechazo de domicilio sin migración/dirección. Los IDs de organización y actor de la escritura salen de la sesión, no del cuerpo enviado.
- Matriz de navegación de dueño, administrador, cajero y técnico; cambio de empresa y módulos; sin crear un rol ficticio de barbero.
- Chrome 390 y 1280 px: formulario real, carga de dirección y traslados, guardado contra API simulada, sin desbordamiento horizontal ni errores de consola. Capturas agenda-domicilio-390.png y agenda-domicilio-1280.png en la carpeta de visualizaciones de la sesión.
- Puertos 3000 y 8081 observados apuntando a C:/proyecto/mitiendapy. Metro respondió HTTP 200 al compilar el bundle iOS.

No se realizaron escrituras ni pruebas funcionales contra producción. Sin push, merge, deploy ni migración remota.

## Pendiente externo y límites

Aplicar la migración en el entorno elegido antes de activar los campos persistentes nuevos; no se aplicó en esta sesión. Falta la prueba física en Expo Go y la revisión visual individual de las restantes páginas del dashboard: esta revisión visual cubrió el formulario de agenda, no las 51 páginas. La compilación del bundle no sustituye una prueba en el dispositivo.
Resultado final: 334/334 pruebas del alcance aprobadas en 52 archivos, TypeScript raíz y mobile con salida 0, ESLint sin errores (dos advertencias de variables sin uso en una prueba existente).
