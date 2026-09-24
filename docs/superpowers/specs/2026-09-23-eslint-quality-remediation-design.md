# Diseño: saneamiento integral de ESLint y calidad

## Objetivo

Eliminar las 3.328 incidencias de lint sin desactivar reglas, preservando comportamiento y dejando verificación reproducible. Se corregirán primero riesgos funcionales y después deuda mecánica y de tipado.

## Estado inicial

- CI informa 1 error y 3.327 advertencias.
- El bloqueo es `react-hooks/set-state-in-effect` en `StoreOffersPromoShowcase.tsx`.
- Dominan `no-unused-vars` (2.050), `no-explicit-any` (1.157), `no-img-element` (69) y `react-hooks/exhaustive-deps` (42).
- Hay incidencias aisladas de accesibilidad, expresiones sin efecto y exportación anónima.
- Se preservará todo trabajo local preexistente.

## Principios

1. No desactivar reglas para obtener un resultado artificialmente limpio.
2. No sustituir `any` por assertions igualmente inseguras.
3. Tratar hooks, accesibilidad y expresiones sin efecto como posibles defectos.
4. Diferenciar imágenes de producción de mocks antes de migrarlas.
5. Trabajar en lotes pequeños, verificables y reversibles.
6. No declarar limpieza total sin lint, typecheck y pruebas.

## Fases

### 1. Línea base

- Generar salida ESLint estructurada con conteos por regla y archivo.
- Registrar typecheck y pruebas relevantes.
- Identificar modificaciones previas para evitar solapamientos.

### 2. Riesgos funcionales y accesibilidad

- Eliminar el `setState` sincrónico del efecto del carrusel mediante la acción de selección o aislamiento del estado.
- Revisar individualmente las dependencias de hooks; estabilizar funciones o replantear efectos, sin agregar dependencias a ciegas.
- Reescribir expresiones sueltas con control de flujo explícito.
- Corregir texto alternativo y atributos ARIA incompatibles.
- Añadir pruebas de regresión para cambios observables.

### 3. Imágenes

- Migrar `<img>` de producción a `next/image` cuando exista una configuración segura.
- Conservar HTML simple en mocks solo mediante excepciones locales justificadas.
- Verificar recorte, proporción, prioridad y accesibilidad.

### 4. Código muerto

- Retirar imports y variables inequívocamente no utilizados.
- Comprobar referencias antes de eliminar estados, funciones o componentes completos.
- Restaurar conexiones si una variable revela funcionalidad incompleta.
- Ejecutar lint y pruebas enfocadas por grupo.

### 5. Tipado por dominios

Orden: APIs; finanzas, caja, ventas, inventario y reparaciones; productos, clientes y administración; servicios, hooks y utilidades; componentes; pruebas, mocks y shims.

En límites externos se usará `unknown` más validación o tipos concretos. Los errores se estrecharán de forma segura y se reutilizarán tipos de bibliotecas cuando existan.

### 6. Cierre

- Alcanzar cero incidencias con `npm run lint`.
- Ejecutar `npm run typecheck` y pruebas completas, separando con evidencia fallos previos independientes.
- Ejecutar `git diff --check` y revisar el diff.
- Mantener las severidades actuales de ESLint.

## Verificación

Cada lote exige ESLint enfocado, pruebas relacionadas, typecheck cuando sea viable y revisión del diff. El cierre global exige `npm run lint`, `npm run typecheck`, `npm test` y `git diff --check`. Los cambios visuales requieren comprobación en navegador, teclado y responsive.

## Riesgos y mitigaciones

- **Volumen:** dividir por regla y dominio.
- **Eliminación accidental:** buscar consumidores y probar antes de borrar.
- **Bucles en hooks:** analizar identidad y ciclo de vida; no usar autofix indiscriminado.
- **Tipos falsamente precisos:** validar entradas y preferir `unknown`.
- **Regresiones visuales:** verificar dimensiones y accesibilidad.
- **Trabajo concurrente:** comprobar Git antes de cada lote.

## Fuera de alcance

- Rediseños ajenos al lint.
- Cambios de producto, permisos o persistencia no exigidos por una corrección.
- Actualizaciones masivas de dependencias.
- Desactivar reglas o excluir código de producción.

## Criterios de aceptación

1. `npm run lint` termina con código 0 y sin incidencias en `src`.
2. Typecheck sin errores nuevos y globalmente aprobado, salvo bloqueo previo demostrado.
3. Pruebas enfocadas y globales aprobadas, salvo bloqueo previo demostrado.
4. Comportamiento conservado o cubierto por pruebas de regresión.
5. Cambios locales preexistentes preservados.
6. Informe final con verificación enfocada, global y manual.

