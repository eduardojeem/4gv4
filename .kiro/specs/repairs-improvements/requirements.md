# Requirements Document: Mejoras Técnicas del Módulo de Reparaciones

## Introduction

Este documento define los requerimientos para implementar mejoras técnicas críticas en el módulo de reparaciones (`/dashboard/repairs`). Las mejoras se enfocan en tres áreas prioritarias identificadas en la auditoría:

1. **Manejo de errores estructurado** - Reemplazar el manejo genérico actual con un sistema robusto y consistente
2. **Validación de formularios con Zod** - Migrar de validación manual a un sistema declarativo y reutilizable
3. **Optimización de performance** - Reducir re-renders innecesarios y mejorar tiempos de respuesta

Estas mejoras son fundamentales para la escalabilidad, mantenibilidad y experiencia de usuario del sistema.

## Glossary

- **AppError**: Clase centralizada para manejo estructurado de errores con códigos, contexto y acciones sugeridas
- **Zod**: Librería de validación de schemas TypeScript-first para validación declarativa
- **React.memo**: HOC de React para memoización de componentes y prevención de re-renders
- **useMemo**: Hook de React para memoización de valores computados
- **useCallback**: Hook de React para memoización de funciones
- **Toast**: Notificación temporal no intrusiva para feedback al usuario
- **Schema**: Definición declarativa de la estructura y reglas de validación de datos
- **Resolver**: Función que integra un schema de validación con React Hook Form
- **Fallback**: Comportamiento alternativo cuando ocurre un error
- **Logger**: Sistema de registro estructurado de eventos y errores

## Requirements

### Requirement 1: Sistema de Manejo de Errores Estructurado

**User Story:** Como desarrollador, quiero un sistema centralizado de manejo de errores, para que los errores sean consistentes, rastreables y proporcionen feedback útil al usuario.

#### Acceptance Criteria

1. WHEN un error ocurre en cualquier operación de reparaciones, THEN el sistema SHALL capturar el error con contexto completo (código, mensaje, stack trace, metadata)
2. WHEN un error es capturado, THEN el sistema SHALL clasificarlo según su tipo (autenticación, red, validación, servidor, desconocido)
3. WHEN un error de autenticación ocurre, THEN el sistema SHALL mostrar un toast con acción para recargar la página
4. WHEN un error de red ocurre, THEN el sistema SHALL mostrar un toast indicando problema de conexión y sugerir reintentar
5. WHEN el sistema usa datos mock como fallback, THEN el sistema SHALL notificar al usuario que está en modo demostración
6. WHEN un error es registrado, THEN el sistema SHALL enviar logs estructurados con timestamp, userId, operación y contexto
7. WHEN múltiples errores ocurren en secuencia, THEN el sistema SHALL agruparlos para evitar spam de notificaciones
8. WHEN un error crítico ocurre, THEN el sistema SHALL ofrecer una acción de recuperación (reintentar, recargar, contactar soporte)

### Requirement 2: Validación de Formularios con Zod

**User Story:** Como desarrollador, quiero validación declarativa de formularios con Zod, para que las reglas sean reutilizables, type-safe y fáciles de mantener.

#### Acceptance Criteria

1. WHEN se define un schema de reparación, THEN el schema SHALL incluir todas las reglas de validación (tipos, longitudes, formatos, relaciones)
2. WHEN un campo es validado, THEN el sistema SHALL proporcionar mensajes de error específicos y localizados en español
3. WHEN el formulario de reparación se renderiza, THEN el sistema SHALL usar React Hook Form con zodResolver para validación automática
4. WHEN un usuario completa un campo, THEN el sistema SHALL validar en tiempo real (onChange) y mostrar errores inmediatamente
5. WHEN se valida un teléfono, THEN el sistema SHALL aceptar formatos internacionales con código de país opcional
6. WHEN se valida un email, THEN el sistema SHALL verificar formato RFC 5322 estándar
7. WHEN se agregan múltiples dispositivos, THEN cada dispositivo SHALL validarse independientemente con su propio conjunto de errores
8. WHEN el formulario tiene errores, THEN el botón de guardar SHALL estar deshabilitado hasta que todos los errores se resuelvan
9. WHEN se intenta enviar un formulario inválido, THEN el sistema SHALL enfocar el primer campo con error
10. WHEN se valida en modo rápido, THEN el sistema SHALL relajar validaciones opcionales (descripción detallada)

### Requirement 3: Optimización de Performance

**User Story:** Como usuario, quiero que la interfaz de reparaciones responda instantáneamente, para que pueda trabajar eficientemente sin lag o demoras.

#### Acceptance Criteria

1. WHEN se aplica un filtro, THEN el sistema SHALL actualizar la vista en menos de 100ms
2. WHEN se cambia entre vistas (tabla/kanban/calendario), THEN el sistema SHALL renderizar en menos de 200ms
3. WHEN un componente hijo recibe las mismas props, THEN el componente SHALL evitar re-renderizarse usando React.memo
4. WHEN se calcula una lista filtrada, THEN el sistema SHALL memoizar el resultado y solo recalcular cuando las dependencias cambien
5. WHEN se renderizan 100+ reparaciones, THEN el sistema SHALL mantener 60fps durante scroll
6. WHEN se abre el formulario de reparación, THEN el sistema SHALL cargar en menos de 300ms
7. WHEN se escriben sugerencias de búsqueda, THEN el sistema SHALL debounce las búsquedas con 300ms de delay
8. WHEN se cargan datos de Supabase, THEN el sistema SHALL usar caché SWR para evitar fetches duplicados
9. WHEN se actualiza una reparación, THEN solo los componentes afectados SHALL re-renderizarse
10. WHEN hay más de 500 reparaciones, THEN el sistema SHALL implementar virtualización para la vista de tabla

### Requirement 4: Logging y Observabilidad

**User Story:** Como administrador del sistema, quiero logs estructurados de todas las operaciones, para que pueda diagnosticar problemas y monitorear el uso del sistema.

#### Acceptance Criteria

1. WHEN ocurre cualquier operación CRUD, THEN el sistema SHALL registrar un log con operación, userId, timestamp y resultado
2. WHEN un error ocurre, THEN el log SHALL incluir stack trace completo y contexto de la operación
3. WHEN se registra un log, THEN el sistema SHALL incluir nivel (debug, info, warn, error, critical)
4. WHEN se ejecuta en producción, THEN los logs SHALL enviarse a un servicio de logging externo (opcional)
5. WHEN se ejecuta en desarrollo, THEN los logs SHALL mostrarse en consola con formato legible
6. WHEN se registra información sensible, THEN el sistema SHALL sanitizar datos personales (emails, teléfonos)

### Requirement 5: Feedback Visual Mejorado

**User Story:** Como usuario, quiero feedback visual claro de todas las acciones, para que siempre sepa el estado de mis operaciones.

#### Acceptance Criteria

1. WHEN se guarda una reparación, THEN el sistema SHALL mostrar un toast de éxito con el ID de la reparación
2. WHEN una operación está en progreso, THEN el sistema SHALL mostrar un indicador de carga en el botón de acción
3. WHEN ocurre un error recuperable, THEN el toast SHALL incluir un botón de "Reintentar"
4. WHEN se usa modo demo, THEN el sistema SHALL mostrar un banner persistente indicando "Modo Demostración"
5. WHEN se valida un formulario, THEN los errores SHALL mostrarse inline junto al campo afectado
6. WHEN se completa una acción exitosamente, THEN el sistema SHALL proporcionar confirmación visual (checkmark, animación)

### Requirement 6: Manejo de Estados de Carga

**User Story:** Como usuario, quiero ver claramente cuando el sistema está cargando datos, para que no intente interactuar con datos incompletos.

#### Acceptance Criteria

1. WHEN se cargan reparaciones inicialmente, THEN el sistema SHALL mostrar un skeleton loader con la estructura de la tabla
2. WHEN se aplica un filtro, THEN el sistema SHALL mostrar un indicador de carga sutil sin bloquear la UI
3. WHEN se actualiza una reparación, THEN solo esa fila SHALL mostrar un indicador de carga
4. WHEN una operación toma más de 3 segundos, THEN el sistema SHALL mostrar un mensaje de "Esto está tomando más tiempo de lo usual"
5. WHEN se pierde la conexión, THEN el sistema SHALL mostrar un banner de "Sin conexión" y deshabilitar acciones que requieren red

### Requirement 7: Recuperación de Errores

**User Story:** Como usuario, quiero que el sistema se recupere automáticamente de errores temporales, para que pueda continuar trabajando sin interrupciones.

#### Acceptance Criteria

1. WHEN falla una petición de red, THEN el sistema SHALL reintentar automáticamente hasta 3 veces con backoff exponencial
2. WHEN se pierde la sesión, THEN el sistema SHALL intentar refrescar el token automáticamente
3. WHEN falla el refresh de token, THEN el sistema SHALL redirigir al login preservando la URL actual
4. WHEN se recupera de un error, THEN el sistema SHALL restaurar el estado previo al error
5. WHEN múltiples reintentos fallan, THEN el sistema SHALL ofrecer modo offline con sincronización posterior

### Requirement 8: Type Safety Mejorado

**User Story:** Como desarrollador, quiero type safety completo en validaciones y manejo de errores, para que TypeScript detecte errores en tiempo de compilación.

#### Acceptance Criteria

1. WHEN se define un schema Zod, THEN el tipo TypeScript SHALL inferirse automáticamente del schema
2. WHEN se usa un error tipado, THEN TypeScript SHALL validar que el código de error existe en el enum
3. WHEN se accede a campos validados, THEN TypeScript SHALL garantizar que los tipos son correctos
4. WHEN se pasa data inválida a una función, THEN TypeScript SHALL mostrar error de compilación
5. WHEN se define un nuevo tipo de error, THEN el sistema SHALL forzar actualización de todos los handlers

## Testing Strategy

### Unit Tests
- Validar schemas Zod con casos válidos e inválidos
- Probar clasificación de errores por tipo
- Verificar memoización de componentes
- Validar debouncing de búsquedas

### Integration Tests
- Flujo completo de creación de reparación con validación
- Manejo de errores de red con reintentos
- Recuperación de sesión expirada
- Filtrado y búsqueda con grandes volúmenes de datos

### Property-Based Tests
- Validación de schemas con datos aleatorios
- Consistencia de memoización con diferentes inputs
- Idempotencia de operaciones de reintento

### Performance Tests
- Medir tiempo de renderizado con 100, 500, 1000 reparaciones
- Verificar que filtrado toma <100ms
- Confirmar 60fps durante scroll
- Validar que re-renders son mínimos

## Success Metrics

- Tiempo de carga inicial: <500ms (actualmente ~800ms)
- Tiempo de filtrado: <100ms (actualmente ~150ms)
- Re-renders por acción: 1-2 (actualmente 3-5)
- Cobertura de tests: >80%
- Errores no manejados: 0
- Tiempo de recuperación de errores: <2s
- Satisfacción de usuario: >4.5/5

## Dependencies

- `zod` - Schema validation
- `@hookform/resolvers` - Zod integration with React Hook Form
- `react-hook-form` - Form state management
- `swr` - Data fetching and caching
- `react-window` o `@tanstack/react-virtual` - Virtualización (opcional)

## Migration Strategy

1. **Fase 1 (Semana 1):** Implementar sistema de errores sin romper código existente
2. **Fase 2 (Semana 1-2):** Migrar validación de formulario principal a Zod
3. **Fase 3 (Semana 2):** Optimizar componentes críticos con memoización
4. **Fase 4 (Semana 2):** Agregar tests y documentación
5. **Fase 5 (Semana 3):** Migrar formularios restantes y cleanup

## Risks and Mitigations

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Breaking changes en validación | Media | Alto | Mantener validación antigua en paralelo durante migración |
| Performance regression | Baja | Alto | Benchmarks antes/después, rollback si necesario |
| Complejidad de migración | Media | Medio | Migración incremental, feature flags |
| Resistencia del equipo | Baja | Bajo | Documentación clara, ejemplos, pair programming |

## Out of Scope

- Paginación en servidor (Requirement separado)
- Búsqueda full-text (Requirement separado)
- Sistema de notificaciones push (Requirement separado)
- Gestión de imágenes (Requirement separado)
- Cambios en UI/UX (solo mejoras técnicas)
