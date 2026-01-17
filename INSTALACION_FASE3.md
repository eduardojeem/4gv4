# 📦 Instalación de Dependencias - Fase 3

## Dependencias Requeridas

La Fase 3 requiere las siguientes dependencias adicionales:

### Nuevas Dependencias

```json
{
  "dependencies": {
    "idb": "^8.0.0"           // IndexedDB wrapper para modo offline
  }
}
```

**Nota**: `date-fns` ya está instalado en el proyecto (v4.1.0)

---

## 🚀 Instalación

### Opción 1: npm

```bash
npm install idb
```

### Opción 2: yarn

```bash
yarn add idb
```

### Opción 3: pnpm

```bash
pnpm add idb
```

---

## ✅ Verificación

Después de instalar, verifica que las dependencias estén correctamente instaladas:

```bash
# Verificar idb
npm list idb

# Verificar date-fns (ya instalado)
npm list date-fns
```

Deberías ver:
```
idb@8.0.0
date-fns@4.1.0
```

---

## 📝 Dependencias por Funcionalidad

### Modo Offline
- **idb** (^8.0.0): Wrapper moderno para IndexedDB
  - Promesas nativas
  - TypeScript completo
  - API simplificada

### Analytics
- **date-fns** (^4.1.0): Utilidades de fecha
  - Formato de fechas
  - Cálculos de períodos
  - Comparaciones temporales

### Recomendaciones
- Sin dependencias externas
  - Algoritmos implementados desde cero
  - Cero overhead

### Historial
- Sin dependencias externas
  - localStorage nativo
  - Serialización JSON

---

## 🔧 Configuración Post-Instalación

### 1. Verificar TypeScript

Las dependencias incluyen tipos TypeScript. Verifica que no haya errores:

```bash
npm run typecheck
```

### 2. Verificar Build

Asegúrate de que el proyecto compile correctamente:

```bash
npm run build
```

### 3. Ejecutar Tests

Si tienes tests configurados:

```bash
npm run test
```

---

## 📊 Tamaño de Bundle

### Impacto en Bundle Size

| Dependencia | Tamaño Minificado | Tamaño Gzipped |
|-------------|-------------------|----------------|
| **idb** | ~8 KB | ~3 KB |
| **date-fns** | Ya instalado | Ya instalado |
| **Total Nuevo** | ~8 KB | ~3 KB |

**Impacto**: Mínimo (~3 KB gzipped)

---

## 🌐 Compatibilidad de Navegadores

### IndexedDB (idb)

Soportado en:
- ✅ Chrome 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ Edge 12+
- ✅ Opera 15+

**Cobertura**: >95% de navegadores

### date-fns

Soportado en:
- ✅ Todos los navegadores modernos
- ✅ Node.js 12+

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'idb'"

**Solución**:
```bash
# Limpiar cache
rm -rf node_modules package-lock.json

# Reinstalar
npm install
```

### Error de TypeScript con idb

**Solución**:
```bash
# Verificar que @types estén instalados
npm install --save-dev @types/node

# Reiniciar TypeScript server en VS Code
Ctrl+Shift+P > "TypeScript: Restart TS Server"
```

### Error de Build

**Solución**:
```bash
# Limpiar build
rm -rf .next

# Rebuild
npm run build
```

---

## 📚 Documentación de Dependencias

### idb
- **Documentación**: https://github.com/jakearchibald/idb
- **NPM**: https://www.npmjs.com/package/idb
- **Ejemplos**: Ver `src/app/dashboard/pos/lib/offline-manager.ts`

### date-fns
- **Documentación**: https://date-fns.org/
- **NPM**: https://www.npmjs.com/package/date-fns
- **Ejemplos**: Ver `src/app/dashboard/pos/lib/analytics-engine.ts`

---

## ✅ Checklist de Instalación

- [ ] Instalar `idb` con npm/yarn/pnpm
- [ ] Verificar instalación con `npm list idb`
- [ ] Ejecutar `npm run typecheck`
- [ ] Ejecutar `npm run build`
- [ ] Verificar que no haya errores
- [ ] Probar funcionalidades de Fase 3

---

## 🎯 Próximos Pasos

Después de instalar las dependencias:

1. **Inicializar Modo Offline**
   ```typescript
   import { useOfflineMode } from './hooks/useOfflineMode'
   
   const offline = useOfflineMode()
   
   useEffect(() => {
     offline.initialize()
   }, [])
   ```

2. **Usar Analytics**
   ```typescript
   import { usePOSAnalytics } from './hooks/usePOSAnalytics'
   
   const analytics = usePOSAnalytics()
   ```

3. **Implementar Recomendaciones**
   ```typescript
   import { useSmartSuggestions } from './hooks/useSmartSuggestions'
   
   const suggestions = useSmartSuggestions(cartProductIds)
   ```

4. **Agregar Historial**
   ```typescript
   import { useSearchHistory } from './hooks/useSearchHistory'
   
   const history = useSearchHistory()
   ```

---

## 📞 Soporte

Si encuentras problemas durante la instalación:

1. Verifica la versión de Node.js: `node --version` (requiere 18+)
2. Verifica la versión de npm: `npm --version` (requiere 8+)
3. Limpia cache: `npm cache clean --force`
4. Reinstala dependencias: `rm -rf node_modules && npm install`

---

*Documentación generada: Enero 2026*
*Versión: 3.0.0*
*Estado: Fase 3 - Instalación*

