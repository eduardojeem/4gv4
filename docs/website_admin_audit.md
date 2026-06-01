# Reporte de Auditoría: Sección `/admin/website`
**Fecha de Evaluación**: 30 de Mayo de 2026  
**Tecnologías Principales**: Next.js (App Router), Supabase (PostgreSQL + RLS), SWR, TailwindCSS / UI shadcn.

---

## 1. Resumen Ejecutivo

Se ha realizado una auditoría exhaustiva del diseño, funcionamiento y control de permisos de la sección de administración del sitio web (`/admin/website`). 

La sección tiene una excelente arquitectura moderna en general:
- **Separación de responsabilidades clara**: Configuración centralizada almacenada en PostgreSQL (`public.website_settings`) tipo clave-valor (`key` de tipo `text` y `value` de tipo `jsonb`).
- **Seguridad robusta en backend**: Rate limiting a nivel de API (10 solicitudes por minuto por usuario), validación estricta de esquemas de datos con **Zod** y sanitización recursiva de HTML con **DOMPurify** en Node.js para prevenir ataques XSS.
- **Experiencia de usuario premium**: Formularios interactivos, guardados optimistas con revalidación mediante SWR, y componentes visualmente atractivos que implementan degradados dinámicos y micro-animaciones en botones flotantes de guardado.

Sin embargo, se han identificado **dos fallas críticas de funcionamiento e inconsistencias de permisos/esquemas** que impiden el correcto funcionamiento del editor y rompen la experiencia de usuario.

---

## 2. Hallazgos Críticos y Errores de Funcionamiento

### 🔴 Falla Crítica 1: Bloqueo Completo al Guardar "Proceso" (`process_steps`)
- **Descripción**: La pestaña "Proceso" permite al usuario editar los pasos del flujo de trabajo, pero al hacer clic en "Guardar Pasos", la API retorna un error `400 Bad Request` ("Invalid setting key").
- **Causa Raíz**: 
  1. En `src/app/api/admin/website/settings/[key]/route.ts`, el array `VALID_KEYS` que filtra las claves válidas **no contiene** `'process_steps'`.
  2. En `src/lib/validation/website-settings.ts`, no existe un esquema Zod para validar `'process_steps'` en `SETTING_SCHEMAS`, por lo que la función `validateSetting('process_steps', value)` siempre falla y retorna un error.
- **Impacto**: Esta sección está completamente rota en producción para cualquier administrador que intente modificar el flujo de su negocio.

### 🟡 Inconsistencia 2: Componentes Huérfanos e Inactivos
- **Descripción**: Existen dos componentes clave en la carpeta `src/components/admin/website`:
  - `MaintenanceModeToggle.tsx` (Modo Mantenimiento)
  - `TestimonialsManager.tsx` (Gestor de Testimonios)
- **Causa Raíz**: El archivo de ruta principal `src/app/admin/website/page.tsx` define solo 4 pestañas: *Empresa*, *Hero*, *Servicios*, y *Proceso*. Ha dejado fuera a los testimonios y al modo mantenimiento, a pesar de que el backend (migraciones, esquemas Zod, APIs y base de datos) está 100% preparado para soportarlos.
- **Impacto**: Se desperdicia funcionalidad ya desarrollada y los administradores no pueden activar el modo mantenimiento o gestionar los testimonios desde el panel.

---

## 3. Funcionamiento de APIs y Flujo de Datos

### Arquitectura de Backend
Las peticiones se realizan de forma asíncrona usando fetch y son administradas en el frontend por el custom hook `useAdminWebsiteSettings` (basado en `useSWR` para caché rápida y actualizaciones optimistas en tiempo real):

1. **GET `/api/admin/website/settings`**:
   - Retorna todas las configuraciones del sitio web.
   - **Estrategia de Hidratación**: Si algún campo de `company_info` está vacío, el endpoint hace un fallback automático cruzando datos con `organization_settings.display_name` y la sucursal por defecto (`branches` donde `is_default = true`). Esto garantiza que el sitio nunca se muestre sin datos mínimos de contacto.
2. **POST `/api/admin/website/settings`**:
   - Inicializa de forma segura todas las configuraciones faltantes en la base de datos basándose en el archivo `default-settings.ts` sin sobreescribir registros existentes.
3. **PUT `/api/admin/website/settings/[key]`**:
   - Actualiza una sección específica (`company_info`, `hero_content`, `hero_stats`, etc.).
   - Aplica sanitización profunda contra XSS.
   - Valida la estructura mediante Zod.
   - Guarda el historial de cambios en `audit_log` para fines de trazabilidad.

---

## 4. Auditoría de Seguridad y Permisos (Auth & RLS)

### Autenticación en Capa API (`withAdminAuth`)
El endpoint administrativo está protegido por el middleware de orden superior `withAdminAuth` (`src/lib/api/withAdminAuth.ts`), el cual garantiza:
- **Autenticación**: El usuario debe tener una sesión activa.
- **Roles**: Solo se permiten usuarios con rol `admin` o `super_admin` (definidos en la tabla `user_roles` o en `profiles`).
- **Trazabilidad**: Se genera un registro de auditoría (`audit_log`) para cada intento de escritura (POST, PUT, DELETE) detallando quién realizó el cambio y los valores nuevos/anteriores.
- **Rate Limiting**: La API limita a un máximo de **10 peticiones por minuto por usuario** para evitar denegación de servicios (DoS) o abuso del endpoint, retornando un código de estado `429 Too Many Requests`.

### Seguridad a Nivel de Base de Datos (RLS en Supabase)
El acceso a la base de datos está perfectamente restringido mediante políticas de **Row Level Security (RLS)** en PostgreSQL (definidas en la migración `20260601009000_settings_catalog_tenant_rls.sql`):
- **Lectura Pública**: Cualquier usuario (anon/authenticated) puede consultar la configuración del sitio web (necesario para el portal público).
- **Escritura Administrativa**: Las políticas `tenant admins can create/update/delete website settings` exigen que el usuario tenga el permiso `'settings.manage'` dentro de su organización:
  ```sql
  CREATE POLICY "tenant admins can update website settings"
  ON public.website_settings FOR UPDATE TO authenticated
  USING ( public.has_org_permission(organization_id, 'settings.manage') )
  ```
- **Aislamiento Multitenant**: Cada registro está vinculado a un `organization_id`, aislando completamente la configuración de un cliente del resto en el entorno SaaS.

---

## 5. Auditoría de Diseño y Estética (UI/UX)

La sección destaca por un diseño sumamente premium que cumple con altos estándares de desarrollo visual moderno:
- **Paleta de Colores Curada**: Uso consistente de gradients sofisticados en los encabezados de las tarjetas (`from-indigo-50 to-purple-50`, `from-pink-50 to-rose-50`, etc.) y modos oscuros nativos compatibles.
- **Tipografía y Componentes**: Implementación limpia de componentes Shadcn UI (`Tabs`, `Card`, `Switch`, `Select`) con bordes redondeados modernos (`rounded-xl`), sombras suaves (`shadow-lg hover:shadow-xl`), y transiciones de hover excelentes.
- **Acceso Rápido y Responsive**: Botón flotante de acción principal ("Guardar Cambios") que se adapta de manera fluida entre dispositivos móviles y escritorio, y optimizaciones táctiles para la subida de logos.
- **Feedback Interactivo**: Integración con `sonner` para toasts dinámicos e indicadores de carga (`Loader2` con animación spin) para asegurar que el usuario conozca el estado de la aplicación en todo momento.

---

## 6. Plan de Acción y Recomendaciones de Corrección

Para solventar los problemas encontrados y activar las funcionalidades faltantes, se propone el siguiente plan técnico:

### Paso 1: Corregir el backend para soportar `process_steps`
1. Modificar `src/app/api/admin/website/settings/[key]/route.ts` para añadir `'process_steps'` al array de `VALID_KEYS`.
2. Crear e integrar el esquema de validación en `src/lib/validation/website-settings.ts`:
   ```typescript
   export const ProcessStepSchema = z.object({
     id: z.string(),
     number: z.number().int(),
     title: z.string().min(2, 'Mínimo 2 caracteres').max(100),
     description: z.string().min(5, 'Mínimo 5 caracteres').max(300)
   })
   export const ProcessStepsSchema = z.array(ProcessStepSchema).min(1).max(8)
   ```
3. Agregar `process_steps: ProcessStepsSchema` al mapeo `SETTING_SCHEMAS`.

### Paso 2: Integrar las pestañas huérfanas en la interfaz de usuario
Actualizar `src/app/admin/website/page.tsx` para reactivar el Modo Mantenimiento y los Testimonios:
- Agregar `testimonials` y `maintenance` al array de `TABS`.
- Importar y renderizar `<TestimonialsManager />` y `<MaintenanceModeToggle />` en sus respectivos `<TabsContent>`.

---
**Resultado de la Auditoría**: **Aprobado con Observaciones Críticas** (La base es excelente y segura, pero requiere corregir el backend de la sección de procesos y habilitar las interfaces huérfanas).
