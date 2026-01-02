import { lazy } from 'react';

// Lazy loading para páginas específicas del dashboard
export const LazyProductsPage = lazy(() => import('../../app/dashboard/products/page'));
export const LazyCustomersPage = lazy(() => import('../../app/dashboard/customers/page'));
export const LazyRepairsPage = lazy(() => import('../../app/dashboard/repairs/page'));
export const LazyReportsPage = lazy(() => import('../../app/dashboard/reports/page'));
export const LazySettingsPage = lazy(() => import('../../app/dashboard/settings/page'));
export const LazyProfilePage = lazy(() => import('../../app/dashboard/profile/page'));

// Lazy loading para páginas de administración
export const LazyAdminUsersPage = lazy(() => import('../../app/admin/users/page'));
export const LazyAdminSettingsPage = lazy(() => import('../../app/admin/settings/page'));
export const LazyAdminReportsPage = lazy(() => import('../../app/admin/reports/page'));
export const LazyAdminSecurityPage = lazy(() => import('../../app/admin/security/page'));

// Lazy loading para páginas especializadas
export const LazyPOSPage = lazy(() => import('../../app/dashboard/pos/page'));
export const LazyTechnicianPage = lazy(() => import('../../app/dashboard/technician/page'));
export const LazyInventoryPage = lazy(() => import('../../app/admin/inventory/page'));

// Lazy loading para páginas de reportes específicos
export const LazyProductsReportPage = lazy(() => import('../../app/dashboard/reports/products/page'));
export const LazyRepairsAnalyticsPage = lazy(() => import('../../app/dashboard/repairs/analytics/page'));
export const LazyTechnicianStatsPage = lazy(() => import('../../app/dashboard/technician/stats/page'));

// Wrapper para rutas con loading
export const RouteWrapper = ({ children, fallback = <div className="loading-page">Cargando página...</div> }) => {
  return (
    <div className="route-container">
      {children}
    </div>
  );
};