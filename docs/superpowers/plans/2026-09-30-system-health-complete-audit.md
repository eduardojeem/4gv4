# Auditoria integral de System Health

## Objetivo

Hacer que `/superadmin/system-health` distinga riesgos reales, falsos positivos y controles no verificables, y que muestre claramente todo lo pendiente para una salida a produccion.

## Hallazgos confirmados

1. El analizador RLS no reconoce una politica `RESTRICTIVE` para `authenticated` cuando la politica permisiva usa el rol `public`, aunque la expresion permisiva exige una sesion. Esto genera falsos criticos en `cash_registers` y `website_settings`.
2. `global_device_models` y `platform_expenses` son catalogos globales de la plataforma, pero no estan declarados como tales en el analizador.
3. La tarjeta de problemas solo lista `warning` y `error`; los controles `unknown` y `not_configured` quedan fuera del resumen operativo.
4. Contraste/formularios, errores reales de produccion y backups requieren fuentes externas o pruebas de navegador; no deben marcarse como aprobados.

## Implementacion

1. Agregar pruebas de regresion para las combinaciones reales de politicas RLS y para las tablas globales.
2. Corregir la cobertura de roles de politicas restrictivas sin debilitar el caso anonimo.
3. Mostrar cobertura verificada y pendientes no verificables en el resumen del dashboard.
4. Mantener como `unknown` los controles sin evidencia automatica; documentar la accion concreta que los habilita.
5. Ejecutar pruebas enfocadas, typecheck, lint, auditoria de navegador y comprobacion real contra Supabase/produccion.

## Fuera de alcance automatico

- Instalar Sentry o contratar/configurar un Log Drain sin credenciales y decision del operador.
- Confirmar restauracion de backups/PITR sin acceso al panel de Supabase y un proyecto de staging.
- Enviar formularios con datos reales; debe hacerse con cuentas y transacciones de prueba en staging.
