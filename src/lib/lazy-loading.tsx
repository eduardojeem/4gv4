/**
 * Utilidades de Lazy Loading - Fase 4 Optimización
 * Implementa carga diferida para componentes y páginas no críticas
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Componente de loading personalizado
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
  </div>
);

// Componente de loading para páginas completas
const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-lg font-medium">Cargando página...</p>
      <p className="text-sm text-muted-foreground">Por favor espere</p>
    </div>
  </div>
);

/**
 * Factory para crear componentes lazy con configuración personalizada
 */
export const createLazyComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    loading?: ComponentType;
    ssr?: boolean;
    suspense?: boolean;
  } = {}
) => {
  return dynamic(importFn, {
    loading: options.loading || LoadingSpinner,
    ssr: options.ssr ?? true,
    suspense: options.suspense ?? false,
  });
};

/**
 * Factory para páginas lazy (sin SSR por defecto)
 */
export const createLazyPage = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) => {
  return dynamic(importFn, {
    loading: PageLoading,
    ssr: false, // Páginas no críticas sin SSR
  });
};

// Componentes lazy pre-configurados para páginas no críticas
export const LazyComponents = {
  // Admin pages (no críticas)
  AdminInventoryManagement: createLazyPage(() => 
    import('@/components/admin/inventory/inventory-management')
  ),
  AdminReports: createLazyPage(() => 
    import('@/components/admin/reports/reports-system')
  ),
  AdminUserManagement: createLazyPage(() => 
    import('@/components/admin/users/user-management')
  ),
  AdminSystemMonitoring: createLazyPage(() => 
    import('@/components/admin/system/system-monitoring')
  ),
  
  // Analytics (no críticas)
  AnalyticsDashboard: createLazyPage(() => 
    import('@/components/analytics/AdvancedAnalyticsDashboard')
  ),
  
  // Backup & Monitoring (no críticas)
  BackupDashboard: createLazyPage(() => 
    import('@/components/backup/BackupDashboard')
  ),
  PerformanceDashboard: createLazyPage(() => 
    import('@/components/monitoring/PerformanceDashboard')
  ),
  
  // Integrations (no críticas)
  IntegrationsDashboard: createLazyPage(() => 
    import('@/components/integrations/IntegrationsDashboard')
  ),
  
  // Componentes grandes que se pueden lazy load
  NotificationCenter: createLazyComponent(() => 
    import('@/components/dashboard/customers/NotificationCenter')
  ),
  CustomerHistory: createLazyComponent(() => 
    import('@/components/dashboard/customers/CustomerHistory')
  ),
  ProductConfiguration: createLazyComponent(() => 
    import('@/components/dashboard/product-configuration')
  ),
};

/**
 * Hook para precargar componentes lazy
 */
export const usePreloadComponent = () => {
  const preload = (componentName: keyof typeof LazyComponents) => {
    const component = LazyComponents[componentName];
    if (component && 'preload' in component) {
      (component as any).preload();
    }
  };

  return { preload };
};

/**
 * Configuración de rutas lazy por prioridad
 */
export const LAZY_ROUTES = {
  // Alta prioridad - cargar inmediatamente
  critical: [
    '/dashboard',
    '/dashboard/pos',
    '/dashboard/customers',
    '/dashboard/products',
  ],
  
  // Media prioridad - cargar al hover o interacción
  important: [
    '/dashboard/repairs',
    '/dashboard/suppliers',
    '/dashboard/reports',
  ],
  
  // Baja prioridad - cargar solo cuando se necesite
  lazy: [
    '/admin',
    '/admin/inventory',
    '/admin/reports',
    '/admin/users',
    '/admin/system',
    '/dashboard/analytics',
    '/dashboard/integrations',
    '/dashboard/backup',
  ],
};

/**
 * Utilidad para determinar si una ruta debe ser lazy
 */
export const shouldLazyLoad = (pathname: string): boolean => {
  return LAZY_ROUTES.lazy.some(route => pathname.startsWith(route));
};

/**
 * Preloader inteligente basado en navegación del usuario
 */
export class IntelligentPreloader {
  private preloadedRoutes = new Set<string>();
  private preloadQueue: string[] = [];
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.setupIntersectionObserver();
      this.setupHoverPreloading();
    }
  }
  
  private setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const href = entry.target.getAttribute('href');
          if (href && shouldLazyLoad(href)) {
            this.preloadRoute(href);
          }
        }
      });
    });
    
    // Observar todos los links
    document.querySelectorAll('a[href]').forEach(link => {
      observer.observe(link);
    });
  }
  
  private setupHoverPreloading() {
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && shouldLazyLoad(link.href)) {
        this.preloadRoute(link.href);
      }
    });
  }
  
  private preloadRoute(route: string) {
    if (this.preloadedRoutes.has(route)) return;
    
    this.preloadedRoutes.add(route);
    
    // Implementar preload específico según la ruta
    // Esto se conectaría con el router de Next.js
    console.log(`Preloading route: ${route}`);
  }
}

// Instancia global del preloader
export const preloader = typeof window !== 'undefined' 
  ? new IntelligentPreloader() 
  : null;