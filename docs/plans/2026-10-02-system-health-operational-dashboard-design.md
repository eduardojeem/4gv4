# Diseño: panel operativo de Salud del sistema

## Objetivo

Convertir `/superadmin/system-health` en un panel operativo que permita responder, sin interpretar datos técnicos dispersos:

- cuál es el estado actual del sistema;
- qué cambió desde el diagnóstico anterior;
- qué módulos y servicios están afectados;
- qué acción concreta corresponde a cada hallazgo;
- qué información fue comprobada y cuál no pudo verificarse.

Esta fase es de diagnóstico y lectura. No enviará alertas ni ejecutará correcciones automáticas.

## Alcance

### Incluido

- Resumen ejecutivo del diagnóstico actual.
- Comparación con la ejecución anterior por identificador estable de comprobación.
- Clasificación de cambios: nuevo, mejoró, empeoró, sin cambios y resuelto.
- Impacto por módulo funcional.
- Acciones guiadas con archivo, variable, comando o destino administrativo cuando exista evidencia suficiente.
- Información del despliegue disponible en el entorno de ejecución.
- Comparación de migraciones locales y remotas usando las fuentes ya existentes.
- Estado y latencia de integraciones comprobables: Supabase, Upstash, Telegram, Turnstile, Cloudflare y proveedor de pagos.
- Estado verificable de tareas programadas.
- Métricas de rendimiento con mediana y percentil 95, además del detalle por ruta.
- Resumen de entrega de imágenes: optimizadas, directas, pesadas y disponibilidad del optimizador.
- Estados explícitos: correcto, advertencia, error, no configurado y no verificable.

### Fuera de alcance

- Alertas automáticas por Telegram u otros canales.
- Reparaciones automáticas, ejecución de migraciones o cambios de configuración.
- Lectura de secretos o exposición de valores sensibles.
- Sustituir observabilidad de producción basada en logs/APM cuando no existe una integración configurada.

## Enfoques considerados

### A. Calcular todo en el cliente

Usar el reporte actual y las entradas de historial cargadas en la página. Es simple, pero mezcla reglas de diagnóstico con presentación y puede producir comparaciones incompletas por paginación.

### B. Ampliar el reporte en el servidor (seleccionado)

El servidor obtiene la ejecución anterior, calcula cambios y entrega un modelo de resumen listo para presentar. Mantiene las reglas en una capa comprobable, evita duplicación en React y no requiere una migración mientras el historial actual conserve los datos necesarios.

### C. Crear snapshots agregados nuevos en la base

Facilita tendencias largas y gráficas históricas, pero agrega esquema, escritura y mantenimiento antes de validar la utilidad operativa del panel.

Se implementará el enfoque B. Solo se propondrá una migración posterior si las consultas sobre el historial existente resultan insuficientes.

## Modelo de datos

El contrato `HealthReport` se ampliará con estructuras derivadas y seguras:

- `comparison`: referencia de la ejecución anterior, conteos de cambios y cambio por `checkId`.
- `executiveSummary`: críticos, advertencias, servicios degradados, resueltos y alcance de la ejecución.
- `deployment`: commit, entorno, host y disponibilidad de esos datos.
- `serviceHealth`: servicio, estado, latencia, método de comprobación y motivo de indisponibilidad.
- `scheduledTasks`: tarea, estado, última ejecución, próxima ejecución cuando sea verificable, duración y último error seguro.

Cada cambio tendrá un tipo estable:

- `new_issue`: antes estaba correcto o no existía y ahora tiene un problema.
- `worsened`: aumentó la gravedad o pasó a un estado menos confiable.
- `improved`: disminuyó la gravedad sin quedar completamente resuelto.
- `resolved`: antes tenía un problema y ahora está correcto.
- `unchanged`: conserva el mismo estado.
- `not_comparable`: no existe evidencia anterior suficiente.

La comparación usará una precedencia explícita de estados y severidades. `unknown` y `not_configured` nunca se convertirán en `healthy` ni contarán como aprobación.

## Arquitectura

1. `runSystemHealth()` conserva la coordinación de comprobaciones.
2. Una función pura compara el reporte actual con la ejecución inmediatamente anterior.
3. Los checks especializados siguen siendo responsables de recopilar evidencia y redactar hallazgos.
4. El servidor compone el resumen ejecutivo y elimina cualquier dato sensible antes de devolver el reporte.
5. React se limita a filtros, selección de detalles y representación accesible.

La lectura del historial deberá identificar una ejecución completa anterior por `runId`, no simplemente las últimas filas globales. Si no existe una ejecución comparable, el panel mostrará “Sin comparación anterior”.

## Experiencia de usuario

### Encabezado ejecutivo

Mostrará estado general, críticos, advertencias, cambios nuevos/empeorados, servicios degradados, duración y hora. También distinguirá “diagnóstico completo” de “comprobación parcial” según la disponibilidad de las fuentes.

### Prioridades

Los problemas se ordenarán por:

1. estado;
2. severidad;
3. cambio reciente;
4. identificador estable para mantener un orden predecible.

Cada fila indicará el módulo afectado y si el problema es nuevo o empeoró.

### Acciones guiadas

El detalle conservará evidencia, método y recomendación, y podrá mostrar instrucciones estructuradas. Los comandos se presentarán para copiar; no se ejecutarán desde el navegador. Las variables se mostrarán solo por nombre y nunca por valor.

### Rendimiento e imágenes

- Tiempo de respuesta: mediana, p95, máximo y detalle por ruta.
- Imágenes: cantidad optimizada, directa, pesada y no verificable.
- El consumo monetario de Vercel se mostrará como no verificable salvo que exista una fuente oficial configurada; no se inferirán costos a partir del HTML.

### Historial

El historial existente mantendrá filtros. Se añadirá una vista resumida por ejecución para evitar confundir entradas individuales con diagnósticos completos.

## Integraciones y tareas programadas

Una integración se marcará:

- `healthy` solo si una comprobación real tuvo éxito;
- `warning` o `error` si respondió con degradación o fallo;
- `not_configured` si falta la configuración necesaria;
- `unknown` si existe configuración pero no hay una fuente segura para comprobarla.

Las pruebas externas tendrán timeout y aislamiento de errores. El fallo de una integración no cancelará el resto del diagnóstico.

Las tareas programadas mostrarán únicamente información respaldada por tablas, RPC o APIs existentes. La próxima ejecución no se inventará cuando la programación no sea consultable.

## Seguridad y privacidad

- Todas las acciones seguirán exigiendo `getSuperAdminUser()` en el servidor.
- No se enviarán tokens, URLs firmadas, encabezados de autorización ni mensajes de error sin sanitizar al cliente.
- Los endpoints comprobados se limitarán a destinos permitidos para evitar SSRF.
- Los resultados persistidos contendrán estados, duraciones y mensajes seguros, no secretos.
- Ningún control del panel realizará mutaciones de infraestructura en esta fase.

## Manejo de errores

- Cada check fallará de forma independiente.
- Un timeout se representará como `unknown`, con fuente y motivo.
- Si no se puede persistir historial, el reporte actual seguirá siendo utilizable y mostrará la advertencia existente.
- Si no puede obtenerse la ejecución anterior, solo se desactivará la comparación.
- Los cálculos estadísticos tolerarán conjuntos vacíos y muestras pequeñas.

## Verificación

### Pruebas unitarias

- Precedencia de estados y severidades.
- Clasificación de nuevo, empeorado, mejorado, resuelto y no comparable.
- Mediana y p95 para muestras pares, impares, únicas y vacías.
- Orden de prioridades.
- Sanitización de acciones y metadatos.

### Pruebas de integración

- Lectura de la ejecución anterior agrupada por `runId`.
- Reporte válido cuando el historial no está disponible.
- Fallo aislado de una integración externa.
- Autorización de las server actions.

### Pruebas de interfaz

- Estados explícitos y texto accesible.
- Cabecera con comparación disponible y sin comparación.
- Detalle de acción guiada sin exponer valores secretos.
- Filtros del historial y navegación por teclado.

### Validación final

- Typecheck y pruebas enfocadas.
- Lint de archivos modificados.
- `git diff --check`.
- Prueba autenticada en `/superadmin/system-health` cuando el entorno lo permita.
- Un build que no finalice no se reportará como exitoso; se documentará por separado.

## Criterios de aceptación

- El superadministrador identifica en la cabecera si el sistema empeoró desde la ejecución anterior.
- Cada problema muestra estado, severidad, cambio, módulo, evidencia y acción recomendada.
- “No configurado” y “No verificable” permanecen visibles y no cuentan como correctos.
- Rendimiento muestra mediana y p95, no solo promedio.
- Migraciones, despliegue, integraciones, tareas e imágenes tienen secciones comprensibles y basadas en evidencia.
- La página funciona aunque una fuente externa, el historial o la persistencia fallen.
- No se exponen secretos ni se agregan mutaciones operativas.
