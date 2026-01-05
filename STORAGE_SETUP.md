# Configuración de Supabase Storage

Este documento explica cómo configurar el almacenamiento de archivos (Supabase Storage) para que funcionen correctamente las funciones de subida de avatares y otros archivos.

## Problema

Si ves el error "Almacenamiento de avatares no configurado. Contacta al administrador", significa que los buckets de Supabase Storage no están configurados.

## Soluciones

### Opción 1: Script Automático (Recomendado)

Ejecuta el script de configuración automática:

```bash
npx tsx scripts/setup-storage-buckets.ts
```

Este script:
- Verifica los buckets existentes
- Crea los buckets faltantes (`avatars`, `repair-images`, `product-images`)
- Configura las políticas de seguridad RLS
- Establece límites de tamaño y tipos de archivo permitidos

### Opción 2: Configuración Manual en Dashboard

1. Ve a tu [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Storage** > **Buckets**
4. Crea los siguientes buckets:

#### Bucket: `avatars`
- **Nombre**: `avatars`
- **Público**: ✅ Sí
- **Límite de tamaño**: 5MB
- **Tipos permitidos**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

#### Bucket: `repair-images`
- **Nombre**: `repair-images`
- **Público**: ✅ Sí

#### Bucket: `product-images`
- **Nombre**: `product-images`
- **Público**: ✅ Sí

### Opción 3: SQL Manual

Ejecuta el archivo SQL en el SQL Editor de Supabase:

```bash
# Copia el contenido de:
scripts/setup-storage-buckets.sql
```

Luego pégalo y ejecuta en **SQL Editor** de tu dashboard de Supabase.

## Configuración desde la Aplicación

Si eres **super admin**, puedes configurar el storage directamente desde la aplicación:

1. Ve a **Perfil** > **Seguridad**
2. Busca la sección "Diagnóstico de Storage"
3. Haz clic en **"Configurar Storage"**

## Verificación

Para verificar que todo está configurado correctamente:

1. Ve a **Storage** > **Buckets** en tu dashboard
2. Deberías ver los buckets: `avatars`, `repair-images`, `product-images`
3. Todos deben estar marcados como **públicos**
4. Intenta subir un avatar desde el perfil de usuario

## Políticas de Seguridad (RLS)

Los buckets tienen las siguientes políticas configuradas:

### Avatars
- **Lectura pública**: Cualquiera puede ver los avatares
- **Subida**: Solo usuarios autenticados pueden subir a su propia carpeta
- **Actualización/Eliminación**: Solo el propietario puede modificar sus avatares

### Repair Images & Product Images
- **Lectura pública**: Cualquiera puede ver las imágenes
- **Subida**: Solo usuarios autenticados pueden subir

## Estructura de Carpetas

```
avatars/
├── {user_id}/
│   └── avatar.webp
│
repair-images/
├── {repair_id}/
│   ├── before.jpg
│   └── after.jpg
│
product-images/
├── {product_id}/
│   ├── main.jpg
│   └── gallery/
│       ├── 1.jpg
│       └── 2.jpg
```

## Troubleshooting

### Error: "Bucket not found"
- Ejecuta uno de los métodos de configuración arriba
- Verifica que los buckets existan en el dashboard

### Error: "Insufficient permissions"
- Verifica que las políticas RLS estén configuradas
- Asegúrate de que el usuario esté autenticado

### Error: "File too large"
- Los avatares tienen límite de 5MB
- Comprime la imagen antes de subirla

### Error: "Invalid file type"
- Solo se permiten imágenes: JPG, PNG, WebP, GIF
- Convierte el archivo a un formato soportado

## Variables de Entorno Requeridas

Asegúrate de tener configuradas:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_key  # Para configuración automática
```

## Soporte

Si sigues teniendo problemas:

1. Verifica que Supabase esté configurado correctamente
2. Revisa los logs en el dashboard de Supabase
3. Contacta al administrador del sistema