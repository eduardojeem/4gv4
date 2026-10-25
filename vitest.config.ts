/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // Opciones de compilación fijas, iguales a las de tsconfig.json (las únicas
  // que usa esbuild). Sin esto Vite busca el tsconfig de cada archivo, y los
  // tests que importan código de mobile/ caen en mobile/tsconfig.json, que
  // extiende expo/tsconfig.base: en CI no se instalan las dependencias de la
  // app y el tsconfig no se puede resolver.
  esbuild: {
    tsconfigRaw: JSON.stringify({ compilerOptions: { target: 'ES2020', jsx: 'react-jsx' } }),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    reporters: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.next/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        },
        // Umbrales específicos para archivos críticos
        'src/hooks/': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        },
        'src/lib/': {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    },
    // Configuración de timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    // Configuración de archivos de test
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'coverage',
      'tests/e2e/**'
    ],
    // Configuración de mocks
    server: {
      deps: {
        inline: ['@testing-library/jest-dom']
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/test': path.resolve(__dirname, './src/test'),
      'expo-local-authentication': path.resolve(__dirname, './src/test/mocks/expo-local-authentication.ts'),
      'expo-secure-store': path.resolve(__dirname, './src/test/mocks/expo-secure-store.ts'),
    }
  }
})
