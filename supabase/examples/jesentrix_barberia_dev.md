# Barbería de ejemplo para desarrollo

Archivo: `jesentrix_barberia_dev.sql`. No pertenece a `supabase/migrations`, no se ejecuta mediante `db push` y no se ejecutó contra ninguna base remota desde Codex.

## Ejecutar

1. Abrí el proyecto Supabase **de desarrollo**. Usar localhost no significa que la aplicación esté conectada a una base de desarrollo: verificá el proyecto antes de pegar SQL.
2. Deben existir `jesentrix@gmail.com` en Auth y una membresía activa owner/admin en el negocio de barbería. El archivo no crea cuentas, roles ni empresas. Si faltan, registrá la cuenta normalmente en desarrollo primero.
3. Aplicá las migraciones de agenda hasta `20261014120007_agenda_service_creation_atomic.sql`, si todavía no están aplicadas.
4. Copiá el SQL completo al SQL Editor. Cambiá `v_confirm_development boolean := false` a `true`.
5. Si administrás varias empresas, completá `v_requested_org` con el UUID exacto. El script se detiene antes de escribir si la selección es ambigua, el rubro no corresponde o la moneda no es PYG.
6. Ejecutá el archivo completo. Si falla, su transacción revierte los datos nuevos; no ejecutar fragmentos sueltos.
7. Revisá `/dashboard/agenda/configuracion#servicios`, `#equipo`, `/dashboard/agenda` y `/dashboard/products`.

## Ejemplos

- Corte clásico: Gs. 50.000 / 30 minutos.
- Degradado: Gs. 65.000 / 45 minutos.
- Corte y barba: Gs. 85.000 / 60 minutos.
- Perfilado de barba: Gs. 35.000 / 25 minutos.
- Corte infantil: Gs. 40.000 / 30 minutos.
- Lavado y peinado: Gs. 25.000 / 20 minutos.

Mateo y Diego son perfiles ficticios, no usuarios con acceso. Cuatro tarifas muestran precios/tiempos distintos según quién atiende. Se crean seis turnos confirmados para clientes ficticios sin teléfono, en huecos de los próximos 21 días según el horario y zona configurados, evitando ocupaciones y ausencias.

Todos los nombres se marcan DEMO. Los servicios quedan ocultos en catálogo y no reservables online; los profesionales no se publican. No habilita la tienda, reservas globales, módulos ni planes. Si no existían horarios, agrega un horario orientativo; no reemplaza los existentes. Precio y duración son ejemplos, no recomendaciones comerciales. No crea clientes CRM ni movimientos financieros.

Los servicios reutilizan la RPC atómica y claves de reintento estables. Un tope conservador de 50 servicios protege este ejemplo; no es una implementación del cálculo completo de suscripciones de la API. Conservar las notas identificadoras de los turnos para no duplicarlos al repetir el archivo. No ejecutar en producción.

## Verificación local

`node --test scripts/barbershop-demo-sql.test.mjs`: tres pruebas con PGlite y funciones/migraciones reales de agenda. Auth, planes y numeración usan fixtures reducidos; no equivale a ejecución en Supabase remoto. Se verifican confirmación obligatoria, reejecución sin duplicados, horario existente conservado, ejemplos no publicados, cero ventas/movimientos creados y rechazo de organización ambigua.
