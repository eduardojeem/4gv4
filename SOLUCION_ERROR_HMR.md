# Solución: Error de HMR (Hot Module Replacement)

**Error**: `Module PhoneCall was instantiated but the module factory is not available`

---

## Causa

Este error ocurre cuando:
1. Se elimina un import durante el desarrollo (`PhoneCall`)
2. El sistema de Hot Module Replacement (HMR) intenta actualizar el módulo
3. El módulo eliminado aún está en caché del HMR

---

## Solución

### Opción 1: Reiniciar el Servidor de Desarrollo (Recomendado)

```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar:
npm run dev
```

### Opción 2: Limpiar Caché y Reiniciar

```bash
# Detener el servidor (Ctrl+C)
# Limpiar caché de Next.js
rm -rf .next

# Reiniciar
npm run dev
```

### Opción 3: Hard Refresh en el Navegador

Si el servidor ya está corriendo:
1. Abrir DevTools (F12)
2. Click derecho en el botón de refresh
3. Seleccionar "Empty Cache and Hard Reload"

---

## Verificación

Después de reiniciar, verificar que:
- ✅ No hay errores en la consola
- ✅ El botón "Escribinos" aparece correctamente
- ✅ El icono de WhatsApp (MessageCircle) se muestra
- ✅ El enlace de WhatsApp funciona

---

## Código Correcto

El archivo `src/components/public/PublicHeader.tsx` ahora tiene:

```typescript
// ✅ CORRECTO - Solo MessageCircle
import { Package, Wrench, Menu, X, Phone, MessageCircle } from 'lucide-react'

// ❌ ANTES - Incluía PhoneCall
// import { Package, Wrench, Menu, X, Phone, PhoneCall } from 'lucide-react'
```

---

## Nota

Este tipo de error es común durante el desarrollo cuando se modifican imports. No afecta la aplicación en producción y se resuelve automáticamente al reiniciar el servidor de desarrollo.
