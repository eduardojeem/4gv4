# 4GV4 - Sistema de Gestión Empresarial

Un sistema completo de gestión empresarial construido con Next.js 15, React 19 y Supabase, diseñado para manejar inventarios, reparaciones, clientes y punto de venta.

## 🚀 Características Principales

- **Dashboard Administrativo**: Panel completo con métricas y análisis en tiempo real
- **Gestión de Inventarios**: Control de productos, categorías y stock
- **Sistema POS**: Punto de venta integrado con gestión de clientes
- **Módulo de Reparaciones**: Seguimiento completo de reparaciones técnicas
- **Gestión de Clientes**: CRM integrado con historial y créditos
- **Reportes y Analytics**: Dashboards interactivos con exportación
- **Modo Oscuro**: Interfaz adaptable con soporte completo para tema oscuro
- **Responsive Design**: Optimizado para desktop, tablet y móvil

## 🛠️ Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Testing**: Vitest, Testing Library, Playwright
- **CI/CD**: GitHub Actions
- **Deployment**: Vercel

## 📋 Requisitos Previos

- Node.js 18.x o superior
- npm, yarn, pnpm o bun
- Cuenta de Supabase (para base de datos)

## 🚀 Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/4gv4.git
cd 4gv4
```

### 2. Instalar dependencias

```bash
npm install
# o
yarn install
# o
pnpm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### 3.1 Configurar Resend

La base ya existe en el proyecto:
- [src/lib/email/resend.ts](/F:/4g/4gv4/src/lib/email/resend.ts)
- [src/app/api/admin/email/test/route.ts](/F:/4g/4gv4/src/app/api/admin/email/test/route.ts)

Variables recomendadas en `.env.local`:

```env
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM="SERVIX 360 <onboarding@resend.dev>"
EMAIL_REPLY_TO=soporte@tudominio.com
```

Notas:
- `onboarding@resend.dev` sirve para pruebas iniciales.
- En produccion conviene verificar tu dominio en Resend y usar un remitente propio.
- Si falta `RESEND_API_KEY`, el helper no rompe el flujo: omite el envio y devuelve `skipped`.

Prueba rapida con sesion admin activa:

```bash
curl -X POST http://localhost:3000/api/admin/email/test ^
  -H "Content-Type: application/json" ^
  -d "{\"to\":\"tu-email@dominio.com\"}"
```

### 4. Configurar Supabase

```bash
# Ejecutar migraciones de base de datos
npm run setup:repairs
npm run verify:supabase
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📁 Estructura del Proyecto

```
├── .github/              # GitHub workflows y templates
├── .storybook/           # Configuración de Storybook
├── public/               # Archivos estáticos
├── scripts/              # Scripts de utilidad y setup
├── src/                  # Código fuente principal
│   ├── app/             # App Router de Next.js
│   │   ├── dashboard/   # Páginas del dashboard
│   │   ├── api/         # API routes
│   │   └── auth/        # Páginas de autenticación
│   ├── components/      # Componentes reutilizables
│   │   ├── ui/          # Componentes base de UI
│   │   ├── dashboard/   # Componentes específicos del dashboard
│   │   └── pos/         # Componentes del punto de venta
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Utilidades y configuración
│   ├── types/           # Definiciones de TypeScript
│   └── styles/          # Estilos globales
├── supabase/            # Migraciones y configuración de Supabase
└── package.json         # Dependencias y scripts
```

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm run test

# Tests con coverage
npm run test:coverage

# Tests de integración
npm run test:integration

# Tests de accesibilidad
npm run test:accessibility
```

## 📦 Build y Deployment

```bash
# Build para producción
npm run build:production

# Análisis del bundle
npm run build:analyze

# Deploy a staging
npm run deploy:staging
```

## 🔧 Scripts Disponibles

- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build para producción
- `npm run start` - Servidor de producción
- `npm run lint` - Linting del código
- `npm run test` - Ejecutar tests
- `npm run storybook` - Ejecutar Storybook

## 📚 Documentación

- [Guía de Contribución](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Configuración de Storybook](.storybook/)
- [Scripts de Setup](scripts/)

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:

1. Revisa la [documentación en el código](src/)
2. Busca en los [issues existentes](https://github.com/tu-usuario/4gv4/issues)
3. Crea un nuevo issue si es necesario

## 🔄 Changelog

Ver [CHANGELOG.md](CHANGELOG.md) para los cambios recientes.

---

Desarrollado con ❤️ usando Next.js y Supabase
