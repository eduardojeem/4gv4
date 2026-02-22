# Fix: URL del QR en Comprobantes de Reparación

## Problema

El QR en los comprobantes mostraba `localhost:3000` en lugar de la URL real del dominio, haciendo que los QR no funcionaran correctamente cuando se escaneaban desde dispositivos externos.

## Solución Implementada

Se implementó un sistema inteligente de detección de URL que prioriza el origen real del navegador sobre las variables de entorno.

### Cambios en `src/lib/repair-qr.ts`

```typescript
/**
 * Obtiene la URL base de la aplicación
 * Prioriza: window.location.origin > NEXT_PUBLIC_APP_URL > localhost
 */
function getBaseURL(): string {
  // En el cliente, usar window.location.origin
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // En el servidor, usar variable de entorno
  return process.env.NEXT_PUBLIC_APP_URL || 
         process.env.NEXT_PUBLIC_BASE_URL || 
         'http://localhost:3000'
}
```

## Prioridad de URLs

1. **`window.location.origin`** (cliente) - Detecta automáticamente el dominio actual
2. **`NEXT_PUBLIC_APP_URL`** (env) - Configuración manual para servidor
3. **`NEXT_PUBLIC_BASE_URL`** (env) - Alternativa compatible con SEO
4. **`localhost:3000`** (fallback) - Solo para desarrollo sin configuración

## Beneficios

### ✅ En Desarrollo
- No requiere configuración
- Funciona automáticamente con cualquier puerto
- Compatible con túneles (ngrok, localtunnel, etc.)

### ✅ En Producción
- Detecta automáticamente el dominio
- Compatible con múltiples dominios
- Funciona con preview deployments (Vercel, Netlify)

### ✅ En Servidor (SSR)
- Usa variables de entorno
- Configurable por ambiente
- Fallback seguro

## Configuración

### Desarrollo (Opcional)
No se requiere configuración. El sistema usa automáticamente `window.location.origin`.

### Producción (Recomendado)
Agregar a `.env.local` o variables de entorno del hosting:

```env
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

## Pruebas

### Script de Prueba
```bash
npx tsx scripts/test-qr-url.ts
```

### Resultado Esperado
```
✅ En el navegador: Usa window.location.origin
✅ En el servidor: Usa NEXT_PUBLIC_APP_URL
✅ Fallback: localhost (solo desarrollo)
```

### Prueba Manual
1. Crear una reparación
2. Imprimir comprobante
3. Verificar que el QR contenga tu dominio real
4. Escanear con móvil
5. Confirmar que abre la URL correcta

## Casos de Uso

### Desarrollo Local
```
URL generada: http://localhost:3000/mis-reparaciones?ticket=...
```

### Desarrollo con Túnel (ngrok)
```
URL generada: https://abc123.ngrok.io/mis-reparaciones?ticket=...
```

### Producción
```
URL generada: https://tu-dominio.com/mis-reparaciones?ticket=...
```

### Preview Deploy (Vercel)
```
URL generada: https://tu-app-git-branch.vercel.app/mis-reparaciones?ticket=...
```

## Compatibilidad

- ✅ Next.js 13+ (App Router)
- ✅ Vercel
- ✅ Netlify
- ✅ Railway
- ✅ Render
- ✅ Desarrollo local
- ✅ Túneles (ngrok, localtunnel)
- ✅ Docker
- ✅ Kubernetes

## Archivos Modificados

1. `src/lib/repair-qr.ts` - Función `getBaseURL()` agregada
2. `.env.example` - Documentación actualizada
3. `docs/IMPLEMENTACION_QR_REPARACIONES.md` - Guía actualizada

## Archivos Creados

1. `scripts/test-qr-url.ts` - Script de prueba
2. `docs/FIX_QR_URL.md` - Esta documentación

## Migración

### Si ya tienes el sistema implementado:

1. Actualizar `src/lib/repair-qr.ts` con la nueva función
2. No se requieren cambios en otros archivos
3. El sistema es retrocompatible

### Si usas variables de entorno:

Las variables existentes siguen funcionando:
- `NEXT_PUBLIC_APP_URL` - Sigue siendo respetada
- `NEXT_PUBLIC_BASE_URL` - Ahora también es compatible

## Troubleshooting

### El QR sigue mostrando localhost

**Causa**: El comprobante se generó en el servidor (SSR) sin variables de entorno.

**Solución**: 
1. Configurar `NEXT_PUBLIC_APP_URL` en `.env.local`
2. Reiniciar el servidor
3. Regenerar el comprobante

### El QR muestra un dominio incorrecto

**Causa**: Estás usando un proxy o reverse proxy.

**Solución**:
1. Configurar `NEXT_PUBLIC_APP_URL` manualmente
2. O configurar los headers del proxy correctamente

### El QR no funciona en preview deployments

**Causa**: El sistema está usando la variable de entorno en lugar del dominio del preview.

**Solución**:
1. No configurar `NEXT_PUBLIC_APP_URL` en preview
2. O usar variables de entorno dinámicas del hosting

## Notas Técnicas

### SSR vs CSR

- **CSR (Client-Side Rendering)**: Usa `window.location.origin` ✅
- **SSR (Server-Side Rendering)**: Usa variables de entorno ⚠️

Los comprobantes se generan en el cliente (CSR), por lo que siempre usarán `window.location.origin`.

### Seguridad

La función `getBaseURL()` es segura porque:
- Solo lee `window.location.origin` (no modifica)
- No expone información sensible
- Usa variables de entorno públicas (`NEXT_PUBLIC_*`)

### Performance

- Sin impacto en performance
- Función simple y rápida
- Sin llamadas a APIs externas

---

**Fecha**: 22 de febrero de 2025  
**Versión**: 1.1.0  
**Estado**: ✅ Implementado y Probado
