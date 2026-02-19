# Troubleshooting: Imágenes de Productos No Se Muestran

**Fecha:** 18 de febrero de 2026  
**Problema:** Las imágenes de productos no se están mostrando en la sección pública

---

## Diagnóstico Rápido

### 1. Ejecutar Script de Diagnóstico

```bash
npx tsx scripts/check-product-images.ts
```

Este script verificará:
- ✅ Productos con/sin imágenes
- ✅ Formato de las URLs de imágenes
- ✅ Existencia del bucket 'product-images'
- ✅ Archivos en el bucket

### 2. Verificar en el Navegador

Abre la consola del navegador (F12) en `/productos` y busca:

```
Product: [nombre] Image: [url] Resolved: [url_resuelta]
```

Si ves errores como:
- `Image failed to load: ...` → La URL no es válida o el archivo no existe
- `Error resolving product image URL: ...` → Problema con Supabase Storage

---

## Causas Comunes

### Causa 1: Bucket 'product-images' No Existe

**Síntoma:** Todas las imágenes muestran el placeholder

**Solución:**
1. Ve a Supabase Dashboard → Storage
2. Crea un bucket llamado `product-images`
3. Márcalo como público
4. Configura políticas RLS:

```sql
-- Permitir lectura pública
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

-- Permitir subida a usuarios autenticados
CREATE POLICY "Authenticated users can upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);
```

### Causa 2: URLs de Imágenes Incorrectas en la Base de Datos

**Síntoma:** Algunas imágenes funcionan, otras no

**Verificar:**
```sql
SELECT id, name, sku, image_url, images 
FROM products 
WHERE is_active = true 
LIMIT 10;
```

**Formatos válidos:**
- ✅ `https://example.com/image.jpg` (URL completa)
- ✅ `/images/product.jpg` (archivo público en Next.js)
- ✅ `product-123.jpg` (archivo en Supabase Storage)
- ✅ `data:image/png;base64,...` (data URI)
- ❌ `C:\Users\...` (ruta local de Windows)
- ❌ URLs rotas o archivos eliminados

**Solución:**
```sql
-- Actualizar productos sin imagen a NULL
UPDATE products 
SET image_url = NULL 
WHERE image_url IS NOT NULL 
  AND image_url NOT LIKE 'http%' 
  AND image_url NOT LIKE '/%'
  AND image_url NOT LIKE 'data:image%';
```

### Causa 3: Variables de Entorno No Configuradas

**Síntoma:** Error "Supabase not configured"

**Verificar en `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

**Solución:**
1. Copia `.env.example` a `.env.local`
2. Completa con tus credenciales de Supabase
3. Reinicia el servidor de desarrollo

### Causa 4: CORS o Políticas de Seguridad

**Síntoma:** Imágenes externas no cargan

**Verificar en `next.config.ts`:**
```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '**.supabase.co',
    },
    // Agregar otros dominios si es necesario
  ],
}
```

### Causa 5: Archivos No Subidos a Supabase Storage

**Síntoma:** URLs apuntan a archivos que no existen

**Verificar:**
1. Ve a Supabase Dashboard → Storage → product-images
2. Verifica que los archivos existan
3. Verifica que los nombres coincidan con las URLs en la BD

**Solución:**
- Sube las imágenes manualmente desde el dashboard
- O usa la API de upload desde el admin

---

## Soluciones por Escenario

### Escenario A: Proyecto Nuevo Sin Imágenes

1. Crear bucket `product-images` en Supabase
2. Configurar políticas RLS
3. Los productos sin imagen mostrarán el placeholder automáticamente

### Escenario B: Migración de Datos

1. Ejecutar script de diagnóstico
2. Identificar productos con URLs inválidas
3. Actualizar URLs o subir imágenes a Supabase Storage
4. Ejecutar:
```sql
UPDATE products 
SET image_url = NULL 
WHERE image_url IS NOT NULL 
  AND (
    image_url LIKE 'C:%' 
    OR image_url LIKE 'file://%'
  );
```

### Escenario C: Imágenes Externas

Si quieres usar imágenes de URLs externas:

1. Agregar dominio a `next.config.ts`:
```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'tu-cdn.com',
    },
  ],
}
```

2. Asegurar que las URLs sean HTTPS

### Escenario D: Desarrollo Local

Para desarrollo rápido sin Supabase:

1. Coloca imágenes en `public/products/`
2. Actualiza productos:
```sql
UPDATE products 
SET image_url = '/products/imagen.jpg' 
WHERE sku = 'PROD-123';
```

---

## Mejoras Implementadas

### Función `resolveProductImageUrl` Mejorada

**Ubicación:** `src/lib/images.ts`

**Maneja:**
- ✅ URLs completas (http/https)
- ✅ Rutas públicas (/)
- ✅ Data URIs (data:image)
- ✅ Archivos en Supabase Storage
- ✅ Fallback a placeholder

**Logging:**
- En desarrollo, muestra en consola cada imagen procesada
- En producción, solo errores

### ProductCard con Debug

**Ubicación:** `src/components/public/ProductCard.tsx`

**Features:**
- Logging detallado en desarrollo
- Error handling mejorado
- Placeholder SVG optimizado
- Soporte para `unoptimized` en data URIs

---

## Verificación Final

### Checklist

- [ ] Bucket 'product-images' existe y es público
- [ ] Políticas RLS configuradas
- [ ] Variables de entorno configuradas
- [ ] `next.config.ts` tiene dominios permitidos
- [ ] Script de diagnóstico ejecutado sin errores
- [ ] Consola del navegador sin errores de imágenes
- [ ] Placeholder se muestra correctamente
- [ ] Al menos una imagen de prueba funciona

### Prueba Manual

1. Ve a `/productos`
2. Abre consola del navegador (F12)
3. Busca logs de "Product: ... Image: ..."
4. Verifica que las imágenes se muestren o el placeholder aparezca
5. Hover sobre un producto para ver efectos

---

## Contacto y Soporte

Si el problema persiste después de seguir estos pasos:

1. Ejecuta el script de diagnóstico y guarda el output
2. Revisa los logs de la consola del navegador
3. Verifica la configuración de Supabase Storage
4. Revisa las URLs en la base de datos

**Archivos relevantes:**
- `src/components/public/ProductCard.tsx`
- `src/lib/images.ts`
- `src/lib/supabase-storage.ts`
- `src/app/api/public/products/route.ts`
- `scripts/check-product-images.ts`
