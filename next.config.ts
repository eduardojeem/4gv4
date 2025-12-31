import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Optimizaciones de rendimiento para componentes migrados
  experimental: {
    // React Compiler deshabilitado temporalmente para build estable
    // reactCompiler: true,
    // Optimizar importaciones de componentes
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      'lucide-react',
      'framer-motion',
      'recharts',
      'date-fns'
    ],
  },

  // Configuración de webpack para optimizaciones adicionales
  webpack: (config, { dev, isServer }) => {
    // Optimizaciones para producción
    if (!dev && !isServer) {
      // Code splitting mejorado para componentes grandes
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          minSize: 20000,
          maxSize: 250000,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            
            // Chunk separado para páginas críticas
            critical: {
              name: 'critical',
              test: /[\\/]src[\\/](app[\\/](dashboard[\\/](pos|customers|products)[\\/]page|layout)|components[\\/](pos|dashboard[\\/](customers|products))[\\/])/,
              chunks: 'all',
              priority: 30,
              enforce: true,
            },
            
            // Chunk separado para componentes de dashboard
            dashboard: {
              name: 'dashboard',
              test: /[\\/]src[\\/]components[\\/]dashboard[\\/]/,
              chunks: 'all',
              priority: 20,
              minChunks: 2,
            },
            
            // Chunk separado para componentes POS
            pos: {
              name: 'pos',
              test: /[\\/]src[\\/](components[\\/]pos|app[\\/]dashboard[\\/]pos)[\\/]/,
              chunks: 'all',
              priority: 25,
            },
            
            // Chunk separado para admin (lazy loading)
            admin: {
              name: 'admin',
              test: /[\\/]src[\\/](components[\\/]admin|app[\\/]admin)[\\/]/,
              chunks: 'async',
              priority: 15,
            },
            
            // Chunk separado para hooks compuestos
            hooks: {
              name: 'hooks',
              test: /[\\/]src[\\/]hooks[\\/](use-product|use-customer|use-inventory|use-pos)/,
              chunks: 'all',
              priority: 18,
            },
            
            // Chunk separado para utilidades de rendimiento
            performance: {
              name: 'performance',
              test: /[\\/]src[\\/]lib[\\/](performance|optimization|lazy-loading|cache)[\\/]/,
              chunks: 'all',
              priority: 22,
            },
            
            // Chunk para librerías de UI principales
            ui: {
              name: 'ui',
              test: /[\\/]node_modules[\\/](@radix-ui)/,
              chunks: 'all',
              priority: 10,
              enforce: true,
            },
            
            // Chunk para iconos
            icons: {
              name: 'icons',
              test: /[\\/]node_modules[\\/](lucide-react)/,
              chunks: 'all',
              priority: 12,
            },
            
            // Chunk para utilidades grandes
            utils: {
              name: 'utils',
              test: /[\\/]node_modules[\\/](date-fns|lodash|recharts)/,
              chunks: 'all',
              priority: 8,
            },
            
            // Chunk para SWR y cache
            cache: {
              name: 'cache',
              test: /[\\/]node_modules[\\/](swr)[\\/]/,
              chunks: 'all',
              priority: 15,
              enforce: true,
            },
            
            // Chunk para React y Next.js
            framework: {
              name: 'framework',
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              chunks: 'all',
              priority: 40,
              enforce: true,
            },
            
            // Chunk por defecto para vendor
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              chunks: 'all',
              priority: 5,
              minChunks: 2,
            },
          },
        },
        
        // Optimizaciones adicionales
        usedExports: true,
        sideEffects: false,
        
        // Minimización mejorada
        minimize: true,
        minimizer: [
          '...',
          // Se pueden agregar minimizadores adicionales aquí
        ],
      };
      
      // Tree shaking mejorado
      config.resolve.mainFields = ['module', 'main'];
      
      // Análisis de bundle
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: '../bundle-analysis/webpack-report.html',
          })
        );
      }
    }

    // Alias para imports más limpios
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/performance': require('path').resolve(__dirname, 'src/lib/performance-optimization'),
      '@/hooks-compound': require('path').resolve(__dirname, 'src/hooks/compound'),
      '@/lazy': require('path').resolve(__dirname, 'src/lib/lazy-loading'),
      '@/cache': require('path').resolve(__dirname, 'src/lib/cache'),
    };

    return config;
  },

  // Configuración de imágenes optimizada
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 días
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Headers de seguridad y rendimiento
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Configuración de compresión
  compress: true,
  
  // Optimizaciones de output
  output: 'standalone',
  
  // Configuración de PWA (preparación futura)
  // pwa: {
  //   dest: 'public',
  //   register: true,
  //   skipWaiting: true,
  // },

  // Configuración de análisis de bundle
  env: {
    ANALYZE: process.env.ANALYZE,
  },
};

export default nextConfig;
