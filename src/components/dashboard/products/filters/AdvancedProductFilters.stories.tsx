import type { Meta, StoryObj } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { AdvancedProductFilters } from './AdvancedProductFilters'

const meta: Meta<typeof AdvancedProductFilters> = {
  title: 'Products/Filters/AdvancedProductFilters',
  component: AdvancedProductFilters,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
El componente AdvancedProductFilters proporciona una interfaz avanzada de filtrado para productos utilizando el hook compuesto \`useProductFiltering\`.

## Características principales:
- **Búsqueda con debounce**: Búsqueda en tiempo real con optimización de rendimiento
- **Filtros preestablecidos**: Filtros rápidos predefinidos (stock bajo, agotados, etc.)
- **Filtros por categoría y proveedor**: Selección múltiple con autocompletado
- **Rangos de valores**: Filtros por precio, stock y margen con sliders
- **Filtros de fecha**: Selección de rango de fechas de creación
- **Estado persistente**: Los filtros se mantienen durante la sesión
- **Exportación de filtros**: Posibilidad de guardar y compartir configuraciones

## Hook utilizado:
- \`useProductFiltering\`: Gestión completa del estado de filtrado

## Tipos de filtros:
1. **Búsqueda de texto**: Busca en nombre, SKU y descripción
2. **Presets**: Filtros rápidos predefinidos
3. **Categorías**: Filtrado por una o múltiples categorías
4. **Proveedores**: Filtrado por uno o múltiples proveedores
5. **Estado de stock**: En stock, stock bajo, agotado, sobrestock
6. **Rango de precios**: Precio mínimo y máximo
7. **Rango de stock**: Cantidad mínima y máxima en inventario
8. **Rango de margen**: Porcentaje de margen mínimo y máximo
9. **Fecha de creación**: Rango de fechas de creación del producto

## Estados de preset:
- **Todos**: Sin filtros aplicados
- **Stock Bajo**: Productos por debajo del stock mínimo
- **Agotados**: Productos sin stock
- **Más Vendidos**: Productos con mayor rotación
- **Nuevos**: Productos creados recientemente
- **Alto Margen**: Productos con margen superior al 40%
        `
      }
    }
  },
  argTypes: {
    onFiltersChange: {
      action: 'filters-changed',
      description: 'Callback cuando cambian los filtros'
    },
    onPresetChange: {
      action: 'preset-changed',
      description: 'Callback cuando se selecciona un preset'
    },
    onExportFilters: {
      action: 'export-filters',
      description: 'Callback para exportar configuración de filtros'
    },
    onImportFilters: {
      action: 'import-filters',
      description: 'Callback para importar configuración de filtros'
    },
    className: {
      control: 'text',
      description: 'Clases CSS adicionales'
    }
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl mx-auto p-6 bg-background">
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
    onFiltersChange: action('filters-changed'),
    onPresetChange: action('preset-changed'),
    onExportFilters: action('export-filters'),
    onImportFilters: action('import-filters')
  }
}

// Con filtros aplicados
export const WithActiveFilters: Story = {
  args: {
    onFiltersChange: action('filters-changed'),
    onPresetChange: action('preset-changed'),
    onExportFilters: action('export-filters'),
    onImportFilters: action('import-filters')
  },
  parameters: {
    docs: {
      description: {
        story: 'Muestra el componente con varios filtros ya aplicados para demostrar el estado activo.'
      }
    }
  }
}

// Preset de stock bajo
export const LowStockPreset: Story = {
  args: {
    onFiltersChange: action('filters-changed'),
    onPresetChange: action('preset-changed'),
    onExportFilters: action('export-filters'),
    onImportFilters: action('import-filters')
  },
  parameters: {
    docs: {
      description: {
        story: 'Preset configurado para mostrar productos con stock bajo. Útil para gestión de inventario.'
      }
    }
  }
}

// Filtros de rango
export const RangeFilters: Story = {
  args: {
    onFiltersChange: action('filters-changed'),
    onPresetChange: action('preset-changed'),
    onExportFilters: action('export-filters'),
    onImportFilters: action('import-filters')
  },
  parameters: {
    docs: {
      description: {
        story: 'Enfoque en los filtros de rango (precio, stock, margen) con sliders interactivos.'
      }
    }
  }
}

// Filtros de categoría y proveedor
export const CategorySupplierFilters: Story = {
  args: {
    onFiltersChange: action('filters-changed'),
    onPresetChange: action('preset-changed'),
    onExportFilters: action('export-filters'),
    onImportFilters: action('import-filters')
  },
  parameters: {
    docs: {
      description: {
        story: 'Demuestra los filtros de categoría y proveedor con selección múltiple y autocompletado.'
      }
    }
  }
}

// Modo compacto
export const Compact: Story = {
  args: {
    onFiltersChange: action('filters-changed'),
    onPresetChange: action('preset-changed'),
    onExportFilters: action('export-filters'),
    onImportFilters: action('import-filters'),
    className: 'compact-mode'
  },
  parameters: {
    docs: {
      description: {
        story: 'Versión compacta del componente para espacios reducidos o sidebars.'
      }
    }
  }
}

// Solo búsqueda
export const SearchOnly: Story = {
  args: {
    onFiltersChange: action('filters-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Versión simplificada que solo muestra la búsqueda, ideal para interfaces minimalistas.'
      }
    }
  },
  render: (args) => (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar productos..."
            className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            onChange={(e) => args.onFiltersChange?.({ search: e.target.value })}
          />
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          Buscar
        </button>
      </div>
    </div>
  )
}

// Con datos de ejemplo
export const WithMockData: Story = {
  args: {
    onFiltersChange: action('filters-changed'),
    onPresetChange: action('preset-changed'),
    onExportFilters: action('export-filters'),
    onImportFilters: action('import-filters')
  },
  parameters: {
    docs: {
      description: {
        story: `
Esta story muestra el componente con datos de ejemplo para demostrar cómo se comporta con información real:

**Categorías disponibles:**
- Smartphones (15 productos)
- Laptops (8 productos)
- Audio (12 productos)
- Accesorios (25 productos)

**Proveedores disponibles:**
- Apple Inc. (20 productos)
- Samsung Electronics (15 productos)
- Dell Technologies (8 productos)
- Sony Corporation (10 productos)

**Rangos de datos:**
- Precios: $29.99 - $2,499.99
- Stock: 0 - 500 unidades
- Margen: 15% - 65%
        `
      }
    }
  }
}

// Estado de carga
export const Loading: Story = {
  args: {
    onFiltersChange: action('filters-changed')
  },
  parameters: {
    docs: {
      description: {
        story: 'Estado de carga mientras se obtienen las opciones de filtrado (categorías, proveedores, rangos).'
      }
    }
  },
  render: () => (
    <div className="space-y-6">
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded-md" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-6 bg-muted rounded w-1/4" />
          <div className="h-10 bg-muted rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-6 bg-muted rounded w-1/4" />
          <div className="h-10 bg-muted rounded" />
        </div>
      </div>
    </div>
  )
}

// Responsive
export const Responsive: Story = {
  args: {
    onFiltersChange: action('filters-changed'),
    onPresetChange: action('preset-changed'),
    onExportFilters: action('export-filters'),
    onImportFilters: action('import-filters')
  },
  parameters: {
    docs: {
      description: {
        story: 'Demuestra cómo el componente se adapta a diferentes tamaños de pantalla.'
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