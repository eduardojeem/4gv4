# Guía de Contribución

¡Gracias por tu interés en contribuir a 4GV4! Esta guía te ayudará a empezar.

## 🚀 Cómo Contribuir

### 1. Fork y Clone

```bash
# Fork el repositorio en GitHub
# Luego clona tu fork
git clone https://github.com/tu-usuario/4gv4.git
cd 4gv4
```

### 2. Configurar el Entorno

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env.local

# Configurar Supabase (ver docs/setup/)
npm run setup:repairs
```

### 3. Crear una Rama

```bash
git checkout -b feature/mi-nueva-caracteristica
# o
git checkout -b fix/correccion-de-bug
```

### 4. Hacer Cambios

- Sigue las convenciones de código existentes
- Escribe tests para nuevas funcionalidades
- Actualiza la documentación si es necesario
- Asegúrate de que los tests pasen

```bash
# Ejecutar tests
npm run test

# Verificar linting
npm run lint

# Verificar tipos
npm run typecheck
```

### 5. Commit y Push

```bash
git add .
git commit -m "feat: agregar nueva funcionalidad"
git push origin feature/mi-nueva-caracteristica
```

### 6. Crear Pull Request

1. Ve a GitHub y crea un Pull Request
2. Describe claramente los cambios realizados
3. Incluye screenshots si hay cambios visuales
4. Menciona issues relacionados

## 📝 Convenciones

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `docs:` cambios en documentación
- `style:` cambios de formato (no afectan funcionalidad)
- `refactor:` refactoring de código
- `test:` agregar o modificar tests
- `chore:` tareas de mantenimiento

### Código

- Usar TypeScript estricto
- Seguir las reglas de ESLint
- Componentes funcionales con hooks
- Props tipadas con interfaces
- Documentar componentes complejos

### Testing

- Tests unitarios para utilidades y hooks
- Tests de componentes con Testing Library
- Tests de integración para flujos críticos
- Tests de accesibilidad con jest-axe

## 🐛 Reportar Bugs

1. Busca si el bug ya fue reportado
2. Crea un issue con:
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Screenshots si aplica
   - Información del entorno

## 💡 Sugerir Funcionalidades

1. Busca si la funcionalidad ya fue sugerida
2. Crea un issue con:
   - Descripción clara de la funcionalidad
   - Justificación del por qué es útil
   - Posible implementación
   - Mockups o ejemplos si aplica

## 📚 Documentación

- Actualiza README.md si cambias funcionalidad principal
- Documenta nuevos componentes en Storybook
- Actualiza guías en docs/ si es necesario
- Mantén comentarios de código actualizados

## 🔍 Code Review

Todos los PRs pasan por code review:

- Código limpio y bien documentado
- Tests que cubran los cambios
- Sin errores de linting o tipos
- Funcionalidad probada manualmente
- Documentación actualizada

## 🆘 Ayuda

Si necesitas ayuda:

1. Revisa la [documentación](docs/)
2. Busca en issues existentes
3. Crea un issue con la etiqueta "question"
4. Únete a nuestras discusiones

¡Gracias por contribuir! 🎉