import { lazy } from 'react';

// Lazy loading para modales pesados
export const LazyProductModal = lazy(() => import('../dashboard/product-modal'));
export const LazySupplierModal = lazy(() => import('../dashboard/supplier-modal'));
export const LazyUserManagement = lazy(() => import('../admin/users/user-management'));
export const LazyInventoryManagement = lazy(() => import('../admin/inventory/inventory-management'));

// Lazy loading para componentes de sistema
export const LazySystemMonitoring = lazy(() => import('../admin/system/system-monitoring'));
export const LazyDatabaseMonitoring = lazy(() => import('../admin/system/database-monitoring'));
export const LazySecurityPanel = lazy(() => import('../admin/system/security-panel'));

// Lazy loading para reportes
export const LazyReportsSystem = lazy(() => import('../admin/reports/reports-system'));
export const LazyAnalyticsDashboard = lazy(() => import('../admin/reports/analytics-dashboard'));

// Wrapper para modales con loading
export const ModalWrapper = ({ children, isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};