import type { NextConfig } from "next";

// Configurar bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // CRÍTICO: Deshabilitar source maps en producción
  productionBrowserSourceMaps: false,
  
  // Configuración experimental para optimización
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      'recharts',
      'date-fns',
      'framer-motion',
      'html2canvas',
      'dompurify',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      'sonner'
    ],
    
    // Optimizaciones adicionales
    optimizeCss: true,
    scrollRestoration: true,
  },

  // Configuración de imágenes optimizada
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 año
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Configuración de compresión
  compress: true,
  
  // Configuración de output para optimización
  output: 'standalone',
  
  // Configuración de PoweredByHeader
  poweredByHeader: false,

  // Configuración de Turbopack (vacía para silenciar el error)
  turbopack: {},

  // Configuración de webpack para optimización adicional
  webpack: (config, { dev }) => {
    // CRÍTICO: Deshabilitar source maps completamente en producción
    if (!dev) {
      config.devtool = false;
      
      // Configurar splitChunks para mejor división de código - MÁS AGRESIVO
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 10000,      // Reducido de 20000
        maxSize: 150000,     // Reducido de 244000
        minChunks: 1,        // Reducido de 2
        maxAsyncRequests: 30, // Aumentado de 6
        maxInitialRequests: 30, // Aumentado de 4
        cacheGroups: {
          // Chunk para React y Next.js
          framework: {
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            name: 'framework',
            chunks: 'all',
            priority: 50,
            enforce: true,
          },
          // Chunk específico para Recharts (muy pesado)
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: 'recharts',
            chunks: 'all',
            priority: 45,
            enforce: true,
          },
          // Chunk específico para Framer Motion (muy pesado)
          framerMotion: {
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name: 'framer-motion',
            chunks: 'all',
            priority: 44,
            enforce: true,
          },
          // Chunk para Radix UI
          radixUI: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'radix-ui',
            chunks: 'all',
            priority: 40,
          },
          // Chunk para date-fns
          dateFns: {
            test: /[\\/]node_modules[\\/]date-fns[\\/]/,
            name: 'date-fns',
            chunks: 'all',
            priority: 35,
          },
          // Chunk para Supabase
          supabase: {
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            name: 'supabase',
            chunks: 'all',
            priority: 30,
          },
          // Chunk para DND Kit
          dndKit: {
            test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
            name: 'dnd-kit',
            chunks: 'all',
            priority: 25,
          },
          // Chunk para utilidades pesadas
          heavyUtils: {
            test: /[\\/]node_modules[\\/](html2canvas|jspdf|xlsx|dompurify)[\\/]/,
            name: 'heavy-utils',
            chunks: 'all',
            priority: 24,
          },
          // Chunk para Zod
          zod: {
            test: /[\\/]node_modules[\\/]zod[\\/]/,
            name: 'zod',
            chunks: 'all',
            priority: 23,
          },
          // Chunk para iconos
          icons: {
            test: /[\\/]node_modules[\\/](lucide-react|@radix-ui\/react-icons)[\\/]/,
            name: 'icons',
            chunks: 'all',
            priority: 20,
          },
          // Chunk para utilidades generales
          utils: {
            test: /[\\/]node_modules[\\/](lodash|sonner|swr)[\\/]/,
            name: 'utils',
            chunks: 'all',
            priority: 15,
          },
          // Vendor general (más pequeño)
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            maxSize: 100000, // Limitar tamaño del chunk vendor
          },
          // Código común de la aplicación - más agresivo
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
            maxSize: 80000,
          },
          // Chunk específico para páginas de dashboard
          dashboard: {
            test: /[\\/]src[\\/]app[\\/]dashboard[\\/]/,
            name: 'dashboard-pages',
            chunks: 'all',
            priority: 8,
            maxSize: 100000,
          },
          // Chunk específico para páginas de admin
          admin: {
            test: /[\\/]src[\\/]app[\\/]admin[\\/]/,
            name: 'admin-pages',
            chunks: 'all',
            priority: 7,
            maxSize: 100000,
          },
          // Chunk específico para componentes de dashboard
          dashboardComponents: {
            test: /[\\/]src[\\/]components[\\/]dashboard[\\/]/,
            name: 'dashboard-components',
            chunks: 'all',
            priority: 6,
            maxSize: 80000,
          },
        },
      };
      
      // Minimizar el runtime de webpack
      config.optimization.runtimeChunk = {
        name: 'runtime',
      };

      // Configurar alias para tree shaking
      config.resolve.alias = {
        ...config.resolve.alias,
        'lodash': 'lodash-es',
      };

      // Configurar module concatenation para mejor tree shaking
      config.optimization.concatenateModules = true;
      
      // Configurar side effects para mejor tree shaking
      config.optimization.sideEffects = false;
    }

    return config;
  },
  
  // Headers para optimización de caché
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ]
  },
};

export default withBundleAnalyzer(nextConfig);