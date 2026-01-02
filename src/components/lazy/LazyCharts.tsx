import { lazy } from 'react';

// Lazy loading para componentes de gráficos pesados
export const LazyRepairsChart = lazy(() => import('../dashboard/repairs-chart'));
export const LazySalesChart = lazy(() => import('../dashboard/sales-chart'));
export const LazyPerformanceDashboard = lazy(() => import('../monitoring/PerformanceDashboard'));
export const LazyOptimizationDashboard = lazy(() => import('../api/OptimizationDashboard'));

// Lazy loading para gráficos de Recharts específicos
export const LazyBarChart = lazy(() => 
  import('recharts').then(module => ({ default: module.BarChart }))
);

export const LazyLineChart = lazy(() => 
  import('recharts').then(module => ({ default: module.LineChart }))
);

export const LazyPieChart = lazy(() => 
  import('recharts').then(module => ({ default: module.PieChart }))
);

export const LazyAreaChart = lazy(() => 
  import('recharts').then(module => ({ default: module.AreaChart }))
);

// Componente wrapper para gráficos con loading
export const ChartWrapper = ({ children, fallback = <div>Cargando gráfico...</div> }) => {
  return (
    <div className="chart-container">
      {children}
    </div>
  );
};