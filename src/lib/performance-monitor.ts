/**
 * Performance Monitor - Fase 4 Optimización
 * Sistema de monitoreo de rendimiento en tiempo real
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  type: 'timing' | 'counter' | 'gauge';
  tags?: Record<string, string>;
}

interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private thresholds: PerformanceThreshold[] = [];
  private observers: PerformanceObserver[] = [];
  private isEnabled = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupObservers();
      this.setupDefaultThresholds();
    }
  }

  private setupObservers() {
    // Observer para Navigation Timing
    if ('PerformanceObserver' in window) {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric('page_load_time', navEntry.loadEventEnd - navEntry.fetchStart, 'timing');
            this.recordMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.fetchStart, 'timing');
            this.recordMetric('first_paint', navEntry.responseEnd - navEntry.fetchStart, 'timing');
          }
        }
      });
      
      try {
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);
      } catch (e) {
        console.warn('Navigation timing observer not supported');
      }
    }

    // Observer para Resource Timing
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            this.recordMetric(
              'resource_load_time',
              resourceEntry.responseEnd - resourceEntry.fetchStart,
              'timing',
              { resource: resourceEntry.name.split('/').pop() || 'unknown' }
            );
          }
        }
      });
      
      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (e) {
        console.warn('Resource timing observer not supported');
      }
    }

    // Observer para Largest Contentful Paint
    if ('PerformanceObserver' in window) {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('largest_contentful_paint', lastEntry.startTime, 'timing');
      });
      
      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported');
      }
    }

    // Observer para First Input Delay
    if ('PerformanceObserver' in window) {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('first_input_delay', entry.processingStart - entry.startTime, 'timing');
        }
      });
      
      try {
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID observer not supported');
      }
    }

    // Observer para Cumulative Layout Shift
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            this.recordMetric('cumulative_layout_shift', clsValue, 'gauge');
          }
        }
      });
      
      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported');
      }
    }
  }

  private setupDefaultThresholds() {
    this.thresholds = [
      { metric: 'page_load_time', warning: 3000, critical: 5000 },
      { metric: 'dom_content_loaded', warning: 1500, critical: 3000 },
      { metric: 'largest_contentful_paint', warning: 2500, critical: 4000 },
      { metric: 'first_input_delay', warning: 100, critical: 300 },
      { metric: 'cumulative_layout_shift', warning: 0.1, critical: 0.25 },
      { metric: 'component_render_time', warning: 16, critical: 50 },
      { metric: 'api_response_time', warning: 1000, critical: 3000 },
    ];
  }

  recordMetric(name: string, value: number, type: PerformanceMetric['type'] = 'gauge', tags?: Record<string, string>) {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      type,
      tags,
    };

    this.metrics.push(metric);
    this.checkThresholds(metric);
    
    // Mantener solo las últimas 1000 métricas
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  private checkThresholds(metric: PerformanceMetric) {
    const threshold = this.thresholds.find(t => t.metric === metric.name);
    if (!threshold) return;

    if (metric.value >= threshold.critical) {
      console.warn(`🚨 Performance Critical: ${metric.name} = ${metric.value}ms (threshold: ${threshold.critical}ms)`);
      this.triggerAlert('critical', metric, threshold);
    } else if (metric.value >= threshold.warning) {
      console.warn(`⚠️ Performance Warning: ${metric.name} = ${metric.value}ms (threshold: ${threshold.warning}ms)`);
      this.triggerAlert('warning', metric, threshold);
    }
  }

  private triggerAlert(level: 'warning' | 'critical', metric: PerformanceMetric, threshold: PerformanceThreshold) {
    // En una implementación real, esto podría enviar alertas a un servicio de monitoreo
    const event = new CustomEvent('performance-alert', {
      detail: { level, metric, threshold }
    });
    window.dispatchEvent(event);
  }

  getMetrics(name?: string, timeRange?: { start: number; end: number }): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (timeRange) {
      filtered = filtered.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
    }

    return filtered;
  }

  getAverageMetric(name: string, timeRange?: { start: number; end: number }): number {
    const metrics = this.getMetrics(name, timeRange);
    if (metrics.length === 0) return 0;
    
    return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  }

  getPercentile(name: string, percentile: number, timeRange?: { start: number; end: number }): number {
    const metrics = this.getMetrics(name, timeRange);
    if (metrics.length === 0) return 0;

    const sorted = metrics.map(m => m.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getPerformanceReport(): {
    summary: Record<string, { avg: number; p95: number; p99: number; count: number }>;
    alerts: { metric: string; level: string; value: number; threshold: number }[];
    recommendations: string[];
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const timeRange = { start: oneHourAgo, end: now };

    const summary: Record<string, { avg: number; p95: number; p99: number; count: number }> = {};
    const alerts: { metric: string; level: string; value: number; threshold: number }[] = [];
    const recommendations: string[] = [];

    // Calcular estadísticas para cada métrica
    const uniqueMetrics = [...new Set(this.metrics.map(m => m.name))];
    
    for (const metricName of uniqueMetrics) {
      const metrics = this.getMetrics(metricName, timeRange);
      if (metrics.length === 0) continue;

      summary[metricName] = {
        avg: this.getAverageMetric(metricName, timeRange),
        p95: this.getPercentile(metricName, 95, timeRange),
        p99: this.getPercentile(metricName, 99, timeRange),
        count: metrics.length,
      };

      // Verificar alertas
      const threshold = this.thresholds.find(t => t.metric === metricName);
      if (threshold) {
        const p95 = summary[metricName].p95;
        if (p95 >= threshold.critical) {
          alerts.push({
            metric: metricName,
            level: 'critical',
            value: p95,
            threshold: threshold.critical,
          });
        } else if (p95 >= threshold.warning) {
          alerts.push({
            metric: metricName,
            level: 'warning',
            value: p95,
            threshold: threshold.warning,
          });
        }
      }
    }

    // Generar recomendaciones
    if (summary.page_load_time?.p95 > 3000) {
      recommendations.push('Considerar implementar lazy loading para componentes no críticos');
    }
    if (summary.largest_contentful_paint?.p95 > 2500) {
      recommendations.push('Optimizar imágenes y recursos críticos above-the-fold');
    }
    if (summary.cumulative_layout_shift?.avg > 0.1) {
      recommendations.push('Revisar elementos que causan layout shift y agregar dimensiones fijas');
    }
    if (summary.first_input_delay?.p95 > 100) {
      recommendations.push('Optimizar JavaScript y considerar code splitting');
    }

    return { summary, alerts, recommendations };
  }

  startComponentTiming(componentName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.recordMetric('component_render_time', duration, 'timing', { component: componentName });
    };
  }

  measureApiCall<T>(apiName: string, apiCall: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    return apiCall().finally(() => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.recordMetric('api_response_time', duration, 'timing', { api: apiName });
    });
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

// Instancia global del monitor
export const performanceMonitor = new PerformanceMonitor();

// Hooks de React para usar el monitor
export const usePerformanceMonitor = () => {
  return {
    recordMetric: performanceMonitor.recordMetric.bind(performanceMonitor),
    startTiming: performanceMonitor.startComponentTiming.bind(performanceMonitor),
    measureApi: performanceMonitor.measureApiCall.bind(performanceMonitor),
    getReport: performanceMonitor.getPerformanceReport.bind(performanceMonitor),
  };
};

// Decorator para medir componentes automáticamente
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = (props: P) => {
    const endTiming = performanceMonitor.startComponentTiming(
      componentName || Component.displayName || Component.name || 'Unknown'
    );

    React.useEffect(() => {
      return endTiming;
    });

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`;
  return WrappedComponent;
};