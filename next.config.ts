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
      
      // Configurar splitChunks ULTRA AGRESIVO para chunks compartidos optimizados
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 5000,       // Muy pequeño para máxima granularidad
        maxSize: 80000,      // Chunks más pequeños
        minChunks: 1,        
        maxAsyncRequests: 50, // Permitir muchos chunks async
        maxInitialRequests: 50, // Permitir muchos chunks iniciales
        cacheGroups: {
          // Framework core - React/Next.js separados
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 60,
            enforce: true,
          },
          nextjs: {
            test: /[\\/]node_modules[\\/]next[\\/]/,
            name: 'nextjs',
            chunks: 'all',
            priority: 55,
            enforce: true,
          },
          
          // Librerías pesadas separadas individualmente
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: 'recharts',
            chunks: 'all',
            priority: 50,
            enforce: true,
          },
          
          // Radix UI dividido por componentes
          radixCore: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]react-(accordion|alert-dialog|avatar|checkbox|collapsible)[\\/]/,
            name: 'radix-core',
            chunks: 'all',
            priority: 45,
          },
          radixNavigation: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]react-(dialog|dropdown-menu|navigation-menu|popover)[\\/]/,
            name: 'radix-navigation',
            chunks: 'all',
            priority: 44,
          },
          radixForm: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]react-(label|radio-group|select|slider|switch|tabs)[\\/]/,
            name: 'radix-form',
            chunks: 'all',
            priority: 43,
          },
          radixOther: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'radix-other',
            chunks: 'all',
            priority: 42,
          },
          
          // Date utilities
          dateFns: {
            test: /[\\/]node_modules[\\/]date-fns[\\/]/,
            name: 'date-fns',
            chunks: 'all',
            priority: 40,
          },
          
          // Supabase dividido
          supabaseAuth: {
            test: /[\\/]node_modules[\\/]@supabase[\\/](auth-|gotrue-)[\\/]/,
            name: 'supabase-auth',
            chunks: 'all',
            priority: 38,
          },
          supabaseCore: {
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            name: 'supabase-core',
            chunks: 'all',
            priority: 37,
          },
          
          // Validation
          zod: {
            test: /[\\/]node_modules[\\/]zod[\\/]/,
            name: 'zod',
            chunks: 'all',
            priority: 35,
          },
          
          // Icons separados
          lucideIcons: {
            test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
            name: 'lucide-icons',
            chunks: 'all',
            priority: 30,
          },
          
          // Utilities pequeñas
          sonner: {
            test: /[\\/]node_modules[\\/]sonner[\\/]/,
            name: 'sonner',
            chunks: 'all',
            priority: 25,
          },
          swr: {
            test: /[\\/]node_modules[\\/]swr[\\/]/,
            name: 'swr',
            chunks: 'all',
            priority: 24,
          },
          
          // Vendor general dividido por tamaño
          vendorLarge: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor-large',
            chunks: 'all',
            priority: 15,
            minSize: 30000,
            maxSize: 60000,
          },
          vendorMedium: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor-medium',
            chunks: 'all',
            priority: 14,
            minSize: 10000,
            maxSize: 30000,
          },
          vendorSmall: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor-small',
            chunks: 'all',
            priority: 13,
            maxSize: 10000,
          },
          
          // Código de aplicación dividido por funcionalidad
          dashboardPages: {
            test: /[\\/]src[\\/]app[\\/]dashboard[\\/]/,
            name: 'dashboard-pages',
            chunks: 'all',
            priority: 12,
            maxSize: 50000,
          },
          adminPages: {
            test: /[\\/]src[\\/]app[\\/]admin[\\/]/,
            name: 'admin-pages',
            chunks: 'all',
            priority: 11,
            maxSize: 50000,
          },
          
          // Componentes divididos por área
          dashboardComponents: {
            test: /[\\/]src[\\/]components[\\/]dashboard[\\/]/,
            name: 'dashboard-components',
            chunks: 'all',
            priority: 10,
            maxSize: 40000,
          },
          adminComponents: {
            test: /[\\/]src[\\/]components[\\/]admin[\\/]/,
            name: 'admin-components',
            chunks: 'all',
            priority: 9,
            maxSize: 40000,
          },
          uiComponents: {
            test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
            name: 'ui-components',
            chunks: 'all',
            priority: 8,
            maxSize: 30000,
          },
          
          // Shared utilities
          sharedUtils: {
            test: /[\\/]src[\\/](lib|utils|contexts|hooks)[\\/]/,
            name: 'shared-utils',
            chunks: 'all',
            priority: 7,
            maxSize: 25000,
          },
          
          // Common code - muy granular
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
            maxSize: 20000,
          },
          
          // Default fallback
          default: {
            minChunks: 2,
            priority: 1,
            reuseExistingChunk: true,
            maxSize: 15000,
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