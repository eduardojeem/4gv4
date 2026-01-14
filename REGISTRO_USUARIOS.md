# Sistema de Registro de Usuarios

## 📋 Resumen

El sistema de registro está completamente integrado con Supabase y utiliza triggers de base de datos para automatizar la creación de perfiles de usuario.

## 🔄 Flujo de Registro

### 1. Usuario completa el formulario
- **Campos requeridos:**
  - Nombre completo
  - Correo electrónico
  - Contraseña (mínimo 8 caracteres, con mayúsculas, minúsculas y números)
  - Confirmación de contraseña

### 2. Validaciones en el frontend
- ✅ Contraseñas coinciden
- ✅ Contraseña cumple requisitos de seguridad
- ✅ Nombre completo no está vacío
- ✅ Email válido

### 3. Registro en Supabase Auth
```typescript
await supabase.auth.signUp({
  email: formData.email,
  password: formData.password,
  options: {
    data: {
      full_name: formData.fullName,
    }
  }
})
```

### 4. Trigger automático en la base de datos
Cuando se crea un usuario en `auth.users`, el trigger `on_auth_user_created` ejecuta la función `handle_new_user()`:

```sql
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 5. Creación automática del perfil
La función `handle_new_user()` crea automáticamente un registro en la tabla `profiles`:

```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'cliente'::user_role
)
```

**Características:**
- ✅ Asigna automáticamente el rol de **'cliente'**
- ✅ Maneja conflictos con `ON CONFLICT DO UPDATE`
- ✅ Usa `COALESCE` para valores por defecto
- ✅ Actualiza `updated_at` automáticamente

### 6. Redirección al dashboard
Después del registro exitoso, el usuario es redirigido automáticamente al dashboard.

## 🎭 Roles de Usuario

El sistema tiene 4 roles definidos en el tipo `user_role`:

| Rol | Descripción | Asignación |
|-----|-------------|------------|
| **cliente** | Usuario básico con permisos de lectura | ✅ Automático en registro |
| **tecnico** | Técnico con permisos de reparaciones | Manual por admin |
| **vendedor** | Vendedor con acceso al POS | Manual por admin |
| **admin** | Administrador con acceso completo | Manual por super admin |

## 🔒 Seguridad

### Validación de contraseña
- Mínimo 8 caracteres
- Al menos una letra mayúscula
- Al menos una letra minúscula
- Al menos un número

### Row Level Security (RLS)
La tabla `profiles` tiene RLS habilitado:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### Función con SECURITY DEFINER
La función `handle_new_user()` se ejecuta con privilegios elevados para poder insertar en la tabla `profiles`:
```sql
SECURITY DEFINER
```

## 📁 Estructura de la tabla profiles

```sql
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'cliente',
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🚀 Aplicar la migración

Para aplicar la mejora en la función de registro:

```bash
# Conectar a Supabase
supabase db push

# O aplicar la migración específica
psql -h [HOST] -U [USER] -d [DATABASE] -f supabase/migrations/20250114_improve_user_registration.sql
```

## 🧪 Probar el registro

1. Ir a `/register`
2. Completar el formulario
3. Verificar que se crea el usuario en `auth.users`
4. Verificar que se crea el perfil en `profiles` con `role = 'cliente'`
5. Verificar que se redirige al dashboard

## 📝 Notas importantes

- ✅ El rol de 'cliente' se asigna **automáticamente** por el trigger
- ✅ No es necesario crear el perfil manualmente desde el código
- ✅ El trigger maneja conflictos y actualizaciones
- ✅ Los metadatos del usuario (`full_name`) se guardan en el perfil
- ⚠️ Solo los administradores pueden cambiar roles de usuario

## 🔧 Troubleshooting

### El perfil no se crea automáticamente
1. Verificar que el trigger existe:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

2. Verificar que la función existe:
```sql
SELECT * FROM pg_proc WHERE proname = 'handle_new_user';
```

3. Aplicar la migración:
```bash
psql -f supabase/migrations/20250114_improve_user_registration.sql
```

### Error de permisos
Verificar que la función tiene `SECURITY DEFINER`:
```sql
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'handle_new_user';
```

### El rol no es 'cliente'
Verificar el valor por defecto en la tabla:
```sql
SELECT column_default FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role';
```
