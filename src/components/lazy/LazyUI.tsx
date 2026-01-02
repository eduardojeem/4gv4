import { lazy } from 'react';

// Lazy loading para componentes UI pesados
export const LazyCalendar = lazy(() => import('../ui/calendar'));
export const LazyDropdownMenu = lazy(() => import('../ui/dropdown-menu'));
export const LazyScrollArea = lazy(() => import('../ui/scroll-area'));
export const LazyNotificationBell = lazy(() => import('../ui/notification-bell'));

// Lazy loading para componentes de formularios complejos
export const LazyProductConfiguration = lazy(() => import('../dashboard/product-configuration'));
export const LazySegmentationSystem = lazy(() => import('../dashboard/customers/SegmentationSystem'));
export const LazyCustomerCommunications = lazy(() => import('../dashboard/customers/advanced/CustomerCommunications'));
export const LazyAnalyticsDashboard = lazy(() => import('../dashboard/customers/AnalyticsDashboard'));

// Lazy loading para componentes de proveedores
export const LazyHeroHeader = lazy(() => import('../suppliers/HeroHeader'));

// Wrapper genérico para componentes UI
export const UIWrapper = ({ children, loading = false, fallback = <div>Cargando...</div> }) => {
  if (loading) return fallback;
  return <>{children}</>;
};