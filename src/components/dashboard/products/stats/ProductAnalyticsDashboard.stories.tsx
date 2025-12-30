import type { Meta, StoryObj } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { ProductAnalyticsDashboard } from './ProductAnalyticsDashboard'

const meta: Meta<typeof ProductAnalyticsDashboard> = {
  title: 'Products/Stats/ProductAnalyticsDashboard',
  component: ProductAnalyticsDashboard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
El componente ProductAnalyticsDashboard proporciona una vista completa de análisis y métricas de productos utilizando el hook compuesto \`useProductAnalytics\`.

## Características principales:
- **Métricas clave**: Total de productos, valor del inventario, productos con stock bajo, margen promedio
- **Análisis de tendencias**: Gráficos de evolución temporal de ventas, stock y márgenes
- **Análisis por categoría**: Distribución de productos y ventas por categoría
- **Análisis por proveedor**: Rendimiento y distribución por proveedor
- **Alertas de inventario**: Notificaciones de stock bajo, productos agotados, etc.
- **Controles de tiempo**: Selección de rango temporal para análisis
- **Exportación de datos**: Descarga de reportes en diferentes formatos
- **Actualización en tiempo real**: Refresh automático y manual de datos

## Hook utilizado:
- \`useProductAnalytics\`: Gestión completa de análisis y métricas

## Secciones del dashboard:
1. **Métricas principales**: KPIs destacados en tarjetas
2. **Gráficos de tendencias**: Evolución temporal de métricas clave
3. **Análisis por categoría**: Distribución y rendimiento por categoría
4. **Análisis por proveedor**: Rendimiento y distribución por proveedor
5. **Alertas de inventario**: Notificaciones importantes
6. **Controles**: Filtros de tiempo, exportación y actualización

## Tipos de análisis:
- **Temporal**: Evolución de métricas en el tiempo
- **Categórico**: Distribución por categorías de productos
- **Proveedor**: Análisis por proveedor/marca
- **Inventario**: Estado y alertas de stock
- **Financiero**: Márgenes, costos y rentabilidad

## Métricas disponibles:
- Total de productos activos
- Valor total del inventario
- Productos con stock bajo
- Productos agotados
- Margen promedio
- Rotación de inventario
- Productos más vendidos
- Tendencias de ventas
        `
      }
    }
  },
  argTypes: {
    timeRange: {
      control: 'select',
      options: ['7d', '30d', '90d', '1y'],
      description: 'Rango de tiempo para el análisis'
    },
    onTimeRangeChange: {
      action: 'time-range-changed',
      description: 'Callback cuando cambia el rango de tiempo'
    },
    onExportData: {
      action: 'export-data',
      description: 'Callback para exportar datos'
    },
    onRefreshData: {
      action: 'refresh-data',
      description: 'Callback para actualizar datos'
    },
    className: {
      control: 'text',
      description: 'Clases CSS adicionales'
    }
  },
  decorators: [
    (Story) => (
      <div className="p-6 bg-background min-h-screen">
        <Story />
      </div>
    )
  ]
}

export default meta
type Story = StoryObj<typeof meta>

// Story por defecto
export const Default: Story = {
  args: {
    timeRange: '30d',
    onTimeRangeChange: action('time-range-changed'),
    onExportData: action('export-data'),
    onRefreshData: action('refresh-data')
  }
}

// Vista de 7 días
export const SevenDays: Story = {
  args: {
    timeRange: '7d',
    onTimeRangeChange: action('time-range-changed'),
    onExportData: action('export-data'),
    onRefreshData: action('refresh-data')
  },
  parameters: {
    docs: {
      description: {
        story: 'Dashboard configurado para mostrar análisis de los últimos 7 días. Ideal para seguimiento diario.'
      }
    }
  }
}

// Vista de 30 días
export const ThirtyDays: Story = {
  args: {
    timeRange: '30d',
    onTimeRangeChange: action('time-range-changed'),
    onExportData: action('export-data'),
    onRefreshData: action('refresh-data')
  },
  parameters: {
    docs: {
      description: {
        story: 'Dashboard configurado para análisis mensual. Muestra tendencias y patrones mensuales.'
      }
    }
  }
}

// Vista anual
export const YearlyView: Story = {
  args: {
    timeRange: '1y',
    onTimeRangeChange: action('time-range-changed'),
    onExportData: action('export-data'),
    onRefreshData: action('refresh-data')
  },
  parameters: {
    docs: {
      description: {
        story: 'Vista anual para análisis de tendencias a largo plazo y planificación estratégica.'
      }
    }
  }
}

// Con alertas críticas
export const WithCriticalAlerts: Story = {
  args: {
    timeRange: '30d',
    onTimeRangeChange: action('time-range-changed'),
    onExportData: action('export-data'),
    onRefreshData: action('refresh-data')
  },
  parameters: {
    docs: {
      description: {
        story: 'Dashboard mostrando alertas críticas de inventario que requieren atención inmediata.'
      }
    }
  }
}

// Modo compacto
export const Compact: Story = {
  args: {
    timeRange: '30d',
    onTimeRangeChange: action('time-range-changed'),
    onExportData: action('export-data'),
    onRefreshData: action('refresh-data'),
    className: 'compact-dashboard'
  },
  parameters: {
    docs: {
      description: {
        story: 'Versión compacta del dashboard para espacios reducidos o vistas embebidas.'
      }
    }
  }
}

// Solo métricas principales
export const MetricsOnly: Story = {
  args: {
    timeRange: '30d',
    onTimeRangeChange: action('time-range-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Vista simplificada que solo muestra las métricas principales sin gráficos detallados.'
      }
    }
  },
  render: (args) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Métricas principales */}
      <div className="bg-card p-6 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Productos</p>
            <p className="text-2xl font-bold">1,247</p>
          </div>
          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
            📦
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">+12% vs mes anterior</p>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Valor Inventario</p>
            <p className="text-2xl font-bold">$2.4M</p>
          </div>
          <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
            💰
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">+8% vs mes anterior</p>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Stock Bajo</p>
            <p className="text-2xl font-bold text-yellow-600">23</p>
          </div>
          <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
            ⚠️
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">-5 vs semana anterior</p>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Margen Promedio</p>
            <p className="text-2xl font-bold text-green-600">34.2%</p>
          </div>
          <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
            📈
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">+2.1% vs mes anterior</p>
      </div>
    </div>
  )
}

// Estado de carga
export const Loading: Story = {
  args: {
    timeRange: '30d'
  },
  parameters: {
    docs: {
      description: {
        story: 'Estado de carga del dashboard mientras se obtienen los datos analíticos.'
      }
    }
  },
  render: () => (
    <div className="space-y-6">
      {/* Métricas principales - skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card p-6 rounded-lg border animate-pulse">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-8 bg-muted rounded w-16" />
              </div>
              <div className="h-8 w-8 bg-muted rounded-full" />
            </div>
            <div className="h-3 bg-muted rounded w-24 mt-2" />
          </div>
        ))}
      </div>

      {/* Gráficos - skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card p-6 rounded-lg border animate-pulse">
          <div className="h-6 bg-muted rounded w-32 mb-4" />
          <div className="h-64 bg-muted rounded" />
        </div>
        <div className="bg-card p-6 rounded-lg border animate-pulse">
          <div className="h-6 bg-muted rounded w-32 mb-4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>

      {/* Alertas - skeleton */}
      <div className="bg-card p-6 rounded-lg border animate-pulse">
        <div className="h-6 bg-muted rounded w-32 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-4 w-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded flex-1" />
              <div className="h-6 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Con datos de ejemplo
export const WithMockData: Story = {
  args: {
    timeRange: '30d',
    onTimeRangeChange: action('time-range-changed'),
    onExportData: action('export-data'),
    onRefreshData: action('refresh-data')
  },
  parameters: {
    docs: {
      description: {
        story: `
Esta story muestra el dashboard con datos de ejemplo realistas:

**Métricas principales:**
- Total de productos: 1,247 (+12% vs mes anterior)
- Valor del inventario: $2.4M (+8% vs mes anterior)
- Productos con stock bajo: 23 (-5 vs semana anterior)
- Margen promedio: 34.2% (+2.1% vs mes anterior)

**Análisis por categoría:**
- Smartphones: 35% del inventario, $840K valor
- Laptops: 25% del inventario, $600K valor
- Audio: 20% del inventario, $480K valor
- Accesorios: 20% del inventario, $480K valor

**Top proveedores:**
- Apple Inc.: 30% de productos, margen 38%
- Samsung: 25% de productos, margen 32%
- Dell: 15% de productos, margen 28%
- Sony: 12% de productos, margen 35%

**Alertas activas:**
- 23 productos con stock bajo
- 5 productos agotados
- 3 productos con margen bajo
- 2 productos sin movimiento en 90 días
        `
      }
    }
  }
}

// Responsive
export const Responsive: Story = {
  args: {
    timeRange: '30d',
    onTimeRangeChange: action('time-range-changed'),
    onExportData: action('export-data'),
    onRefreshData: action('refresh-data')
  },
  parameters: {
    docs: {
      description: {
        story: 'Demuestra cómo el dashboard se adapta a diferentes tamaños de pantalla.'
      }
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' }
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' }
        }
      }
    }
  }
}