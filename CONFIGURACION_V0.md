# Configuración de Vercel V0 en el Proyecto

**Fecha:** 16 de febrero de 2026  
**Estado:** ✅ Configurado

---

## 📋 ¿Qué es Vercel V0?

Vercel V0 es una herramienta de IA que genera componentes de UI basados en descripciones en lenguaje natural. Utiliza modelos de lenguaje avanzados para crear código React/Next.js con Tailwind CSS y shadcn/ui.

### Características principales:
- Generación de componentes UI con IA
- Integración con shadcn/ui
- Soporte para Tailwind CSS
- Iteración y refinamiento de componentes
- Exportación de código listo para usar

---

## 🔑 Credenciales Configuradas

Las siguientes credenciales han sido agregadas a `.env.local`:

```env
# Vercel V0 API Configuration
V0_API_KEY=vcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
V0_PROJECT_ID=v1:xxxxxxxxxxxxxxxxxxxxxxxx
```

**Nota:** Los valores reales están en tu archivo `.env.local` local y no deben ser compartidos públicamente.

### Descripción de las variables:

- **V0_API_KEY**: Token de autenticación para la API de V0
- **V0_PROJECT_ID**: Identificador único de tu proyecto en V0

---

## 🚀 Formas de Usar V0

### 1. Interfaz Web (Recomendado para empezar)

La forma más fácil de usar V0 es a través de su interfaz web:

1. Visita: https://v0.dev
2. Inicia sesión con tu cuenta de Vercel
3. Describe el componente que necesitas en lenguaje natural
4. V0 generará el código
5. Itera y refina hasta obtener el resultado deseado
6. Copia el código a tu proyecto

**Ejemplo de prompt:**
```
Crea un componente de tarjeta de producto para e-commerce con:
- Imagen del producto con hover effect
- Nombre y descripción
- Precio destacado
- Badge de descuento si aplica
- Botón de agregar al carrito
- Usa shadcn/ui y Tailwind CSS
```

### 2. CLI de V0 (Para desarrolladores avanzados)

Puedes instalar el CLI de V0 para generar componentes desde la terminal:

```bash
# Instalar CLI globalmente
npm install -g @vercel/v0

# O usar con npx
npx @vercel/v0
```

**Comandos útiles:**

```bash
# Generar un componente
v0 generate "descripción del componente"

# Listar proyectos
v0 projects

# Ver historial de generaciones
v0 history
```

### 3. API de V0 (Integración programática)

Para integrar V0 directamente en tu flujo de desarrollo:

```typescript
// lib/v0-client.ts
const V0_API_KEY = process.env.V0_API_KEY
const V0_PROJECT_ID = process.env.V0_PROJECT_ID

export async function generateComponent(prompt: string) {
  const response = await fetch('https://api.v0.dev/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${V0_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: V0_PROJECT_ID,
      prompt,
      framework: 'nextjs',
      styling: 'tailwind'
    })
  })
  
  return response.json()
}
```

---

## 💡 Mejores Prácticas

### 1. Prompts Efectivos

**❌ Prompt vago:**
```
Crea un formulario
```

**✅ Prompt específico:**
```
Crea un formulario de contacto con:
- Campos: nombre, email, teléfono, mensaje
- Validación con react-hook-form y zod
- Diseño moderno con shadcn/ui
- Botón de envío con estado de carga
- Mensajes de error inline
- Responsive para mobile y desktop
```

### 2. Iteración Incremental

En lugar de pedir todo de una vez, itera:

1. **Primera iteración:** Estructura básica
2. **Segunda iteración:** Agregar validación
3. **Tercera iteración:** Mejorar estilos
4. **Cuarta iteración:** Agregar animaciones

### 3. Especificar Tecnologías

Siempre menciona las tecnologías que usas:

```
Usa Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, 
y los componentes que ya tenemos en src/components/ui
```

### 4. Contexto del Proyecto

Proporciona contexto sobre tu proyecto:

```
Este componente es para un sistema de gestión de reparaciones de celulares.
Los usuarios son técnicos que necesitan registrar reparaciones rápidamente.
El diseño debe ser limpio y funcional, no muy colorido.
```

---

## 🎯 Casos de Uso en Este Proyecto

### 1. Generar Componentes de UI

```bash
# Ejemplo: Generar un componente de estadísticas
v0 generate "Dashboard de estadísticas con 4 cards mostrando:
- Total de productos
- Valor del inventario
- Productos con stock bajo
- Productos más vendidos
Usa shadcn/ui Card, Badge y lucide-react icons"
```

### 2. Crear Formularios Complejos

```bash
v0 generate "Formulario de registro de reparación con:
- Información del cliente (nombre, teléfono, email)
- Detalles del dispositivo (marca, modelo, IMEI)
- Descripción del problema
- Prioridad (baja, media, alta)
- Costo estimado
- Validación con zod
- Diseño en 2 columnas para desktop"
```

### 3. Diseñar Páginas Completas

```bash
v0 generate "Página de perfil de usuario con:
- Header con avatar y nombre
- Tabs: Información personal, Seguridad, Notificaciones
- Formularios editables en cada tab
- Botones de guardar/cancelar
- Responsive design"
```

### 4. Componentes de Visualización de Datos

```bash
v0 generate "Componente de tabla de productos con:
- Columnas: imagen, nombre, SKU, precio, stock, acciones
- Paginación
- Búsqueda y filtros
- Ordenamiento por columnas
- Acciones: editar, eliminar, duplicar
- Usa shadcn/ui Table y DataTable"
```

---

## 🔧 Integración con el Proyecto

### Estructura Recomendada

Cuando generes componentes con V0, organízalos así:

```
src/
├── components/
│   ├── ui/              # Componentes base de shadcn/ui
│   ├── v0/              # Componentes generados con V0
│   │   ├── product-card-v0.tsx
│   │   ├── stats-dashboard-v0.tsx
│   │   └── repair-form-v0.tsx
│   └── [feature]/       # Componentes específicos del proyecto
```

### Workflow de Integración

1. **Generar con V0**
   ```bash
   v0 generate "tu prompt aquí"
   ```

2. **Revisar el código generado**
   - Verificar que usa las dependencias correctas
   - Comprobar tipos TypeScript
   - Validar estilos

3. **Adaptar al proyecto**
   - Ajustar imports
   - Integrar con hooks existentes
   - Agregar lógica de negocio

4. **Testear**
   - Verificar funcionamiento
   - Probar responsive
   - Validar accesibilidad

5. **Refinar si es necesario**
   - Volver a V0 para ajustes
   - O modificar manualmente

---

## 📚 Ejemplos Prácticos

### Ejemplo 1: Card de Producto Mejorado

**Prompt:**
```
Crea una tarjeta de producto premium para e-commerce con:
- Imagen con efecto parallax en hover
- Badge de "Nuevo" o "Oferta" en esquina superior
- Nombre del producto con truncado a 2 líneas
- Precio actual y precio anterior tachado si hay descuento
- Rating con estrellas (1-5)
- Botón de "Agregar al carrito" con animación
- Botón de favoritos (corazón) en esquina superior derecha
- Indicador de stock bajo si quedan menos de 5 unidades
- Usa shadcn/ui, Tailwind CSS y lucide-react
- Diseño moderno con gradientes sutiles
```

### Ejemplo 2: Modal de Confirmación

**Prompt:**
```
Crea un modal de confirmación reutilizable con:
- Título personalizable
- Descripción/mensaje
- Icono de advertencia (opcional)
- Dos botones: Cancelar (secundario) y Confirmar (primario destructivo)
- Animación de entrada/salida suave
- Overlay con blur
- Cierre al hacer clic fuera o presionar ESC
- Props: title, description, onConfirm, onCancel, isOpen
- Usa shadcn/ui Dialog
```

### Ejemplo 3: Tabla de Datos Avanzada

**Prompt:**
```
Crea una tabla de datos avanzada con:
- Columnas configurables
- Ordenamiento por columnas (asc/desc)
- Búsqueda global
- Filtros por columna
- Paginación con selector de items por página
- Selección múltiple con checkboxes
- Acciones en lote (eliminar, exportar)
- Menú de acciones por fila (editar, ver, eliminar)
- Estados de carga y vacío
- Responsive: en mobile muestra cards en lugar de tabla
- Usa shadcn/ui Table, DataTable y TanStack Table
```

---

## 🎨 Personalización de Componentes V0

### Adaptar al Design System del Proyecto

Cuando uses componentes de V0, ajústalos a tu design system:

```typescript
// Antes (generado por V0)
<div className="bg-blue-500 text-white p-4 rounded-lg">
  {content}
</div>

// Después (adaptado al proyecto)
<div className="bg-primary text-primary-foreground p-4 rounded-lg">
  {content}
</div>
```

### Agregar Lógica de Negocio

```typescript
// Componente base de V0
export function ProductCard({ product }) {
  return (
    <div className="...">
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>{product.price}</p>
    </div>
  )
}

// Adaptado con lógica del proyecto
export function ProductCard({ product }: { product: PublicProduct }) {
  const { user } = useAuth()
  const isWholesale = user?.user_metadata?.customer_type === 'mayorista'
  const displayPrice = isWholesale && product.wholesale_price 
    ? product.wholesale_price 
    : product.sale_price
  
  return (
    <div className="...">
      <Image 
        src={cleanImageUrl(product.image)} 
        alt={product.name}
        fill
        sizes="(max-width: 640px) 100vw, 50vw"
      />
      <h3>{product.name}</h3>
      <p>{formatPrice(displayPrice)}</p>
      {isWholesale && <Badge>Precio Mayorista</Badge>}
    </div>
  )
}
```

---

## 🔒 Seguridad

### Proteger las Credenciales

✅ **Correcto:**
- Las credenciales están en `.env.local` (no se sube a Git)
- `.env.local` está en `.gitignore`
- Solo se usan en el servidor (no en el cliente)

❌ **Incorrecto:**
- No uses `NEXT_PUBLIC_` para las credenciales de V0
- No las expongas en el código del cliente
- No las compartas públicamente

### Variables de Entorno en Producción

En Vercel (o tu plataforma de hosting):

1. Ve a Settings → Environment Variables
2. Agrega:
   - `V0_API_KEY`
   - `V0_PROJECT_ID`
3. Selecciona el entorno (Production, Preview, Development)
4. Guarda y redeploy

---

## 📊 Límites y Consideraciones

### Límites de la API

- **Rate Limiting**: Verifica los límites de tu plan
- **Tokens**: Cada generación consume tokens
- **Complejidad**: Componentes muy complejos pueden requerir múltiples iteraciones

### Cuándo NO usar V0

❌ No uses V0 para:
- Lógica de negocio compleja
- Integraciones con APIs específicas
- Componentes que requieren conocimiento profundo del dominio
- Código que necesita optimizaciones muy específicas

✅ Usa V0 para:
- Prototipos rápidos
- Componentes de UI estándar
- Layouts y diseños
- Formularios básicos
- Componentes visuales

---

## 🆘 Troubleshooting

### Error: "Invalid API Key"

**Solución:**
1. Verifica que la API key esté correcta en `.env.local`
2. Reinicia el servidor de desarrollo
3. Verifica que la key no haya expirado en v0.dev

### Error: "Project not found"

**Solución:**
1. Verifica el PROJECT_ID en `.env.local`
2. Asegúrate de tener acceso al proyecto en v0.dev
3. Verifica que el proyecto no haya sido eliminado

### Componente generado no funciona

**Solución:**
1. Verifica que todas las dependencias estén instaladas
2. Revisa los imports (pueden necesitar ajustes)
3. Adapta los tipos TypeScript si es necesario
4. Verifica que los componentes de shadcn/ui existan

---

## 📖 Recursos Adicionales

### Documentación Oficial
- V0 Docs: https://v0.dev/docs
- Vercel Docs: https://vercel.com/docs
- shadcn/ui: https://ui.shadcn.com

### Tutoriales
- Getting Started with V0: https://v0.dev/docs/getting-started
- V0 Best Practices: https://v0.dev/docs/best-practices
- Component Library: https://v0.dev/components

### Comunidad
- Discord de Vercel: https://vercel.com/discord
- GitHub Discussions: https://github.com/vercel/v0/discussions
- Twitter: @vercel

---

## ✅ Checklist de Configuración

- [x] Variables de entorno agregadas a `.env.local`
- [x] Variables de entorno agregadas a `.env.example`
- [x] Documentación creada
- [ ] CLI de V0 instalado (opcional)
- [ ] Primer componente generado (prueba)
- [ ] Variables configuradas en producción (cuando sea necesario)

---

## 🎯 Próximos Pasos

1. **Probar V0**: Ve a https://v0.dev y genera tu primer componente
2. **Experimentar**: Prueba diferentes prompts y estilos
3. **Integrar**: Incorpora componentes generados en el proyecto
4. **Iterar**: Refina y mejora los componentes según necesites
5. **Compartir**: Documenta los componentes útiles para el equipo

---

**Estado:** ✅ Configuración completada y lista para usar

Para empezar, visita https://v0.dev e inicia sesión con tu cuenta de Vercel.
