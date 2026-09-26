import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { EnhancedProductList } from './EnhancedProductList'

// Mock de datos de productos para las stories

const meta: Meta<typeof EnhancedProductList> = {
  title: 'Products/Core/EnhancedProductList',
  component: EnhancedProductList,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
El componente EnhancedProductList es una versión avanzada de la lista de productos que utiliza los nuevos hooks compuestos para gestión de estado y filtrado.

## Características principales:
- **Vista múltiple**: Soporte para vista de tabla y cuadrícula
- **Selección múltiple**: Permite seleccionar productos individuales o todos
- **Acciones masivas**: Operaciones en lote sobre productos seleccionados
- **Ordenamiento**: Ordenamiento por diferentes campos
- **Hooks compuestos**: Utiliza useProductManagement y useProductFiltering
- **Animaciones**: Transiciones suaves con Framer Motion
- **Responsive**: Adaptable a diferentes tamaños de pantalla

## Hooks utilizados:
- \`useProductManagement\`: Gestión de productos, selección y ordenamiento
- \`useProductFiltering\`: Filtrado y búsqueda de productos

## Estados de stock:
- **En Stock**: Stock normal (verde)
- **Stock Bajo**: Por debajo del mínimo (amarillo)
- **Agotado**: Sin stock (rojo)
- **Sobrestock**: Por encima del máximo (azul)
        `
      }
    }
  },
  argTypes: {
    viewMode: {
      control: 'select',
      options: ['table', 'grid', 'compact'],
      description: 'Modo de visualización de la lista'
    },
    enableSelection: {
      control: 'boolean',
      description: 'Habilitar selección de productos'
    },
    enableBulkActions: {
      control: 'boolean',
      description: 'Habilitar acciones masivas'
    },
    onProductAction: {
      action: 'product-action',
      description: 'Callback para acciones individuales de producto'
    },
    onBulkAction: {
      action: 'bulk-action',
      description: 'Callback para acciones masivas'
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
    viewMode: 'table',
    enableSelection: true,
    enableBulkActions: true,
    onProductAction: () => {},
    onBulkAction: () => {}
  }
}

// Vista de tabla
export const TableView: Story = {
  args: {
    viewMode: 'table',
    enableSelection: true,
    enableBulkActions: true,
    onProductAction: () => {},
    onBulkAction: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Vista de tabla con todas las funcionalidades habilitadas. Permite ordenamiento por columnas, selección múltiple y acciones masivas.'
      }
    }
  }
}

// Vista de cuadrícula
export const GridView: Story = {
  args: {
    viewMode: 'grid',
    enableSelection: true,
    enableBulkActions: true,
    onProductAction: () => {},
    onBulkAction: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Vista de cuadrícula que muestra los productos como tarjetas. Ideal para visualización rápida y navegación visual.'
      }
    }
  }
}

// Sin selección
export const WithoutSelection: Story = {
  args: {
    viewMode: 'table',
    enableSelection: false,
    enableBulkActions: false,
    onProductAction: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: 'Lista de productos sin funcionalidad de selección. Útil para vistas de solo lectura.'
      }
    }
  }
}

// Solo lectura
export const ReadOnly: Story = {
  args: {
    viewMode: 'grid',
    enableSelection: false,
    enableBulkActions: false
  },
  parameters: {
    docs: {
      description: {
        story: 'Vista de solo lectura sin acciones disponibles. Ideal para dashboards informativos.'
      }
    }
  }
}

// Estados de stock
export const StockStates: Story = {
  args: {
    viewMode: 'table',
    enableSelection: true,
    enableBulkActions: true,
    onProductAction: () => {},
    onBulkAction: () => {}
  },
  parameters: {
    docs: {
      description: {
        story: `
Esta story muestra los diferentes estados de stock que puede tener un producto:

- **iPhone 15 Pro**: En stock normal (verde)
- **Samsung Galaxy S24**: Stock bajo (amarillo) - cantidad por debajo del mínimo
- **MacBook Air M3**: Agotado (rojo) - sin stock
- **Dell XPS 13**: En stock normal (verde)
- **AirPods Pro 2**: En stock normal (verde)

Los colores y badges ayudan a identificar rápidamente el estado del inventario.
        `
      }
    }
  }
}

// Cargando
export const Loading: Story = {
  args: {
    viewMode: 'table',
    enableSelection: true,
    enableBulkActions: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Estado de carga con skeletons animados mientras se cargan los datos.'
      }
    }
  },
  render: (_args) => {
    // Simular estado de carga
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center space-x-4 p-4 border rounded-lg">
              <div className="h-4 w-4 bg-muted rounded" />
              <div className="h-10 w-10 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-1/6" />
              </div>
              <div className="h-6 w-16 bg-muted rounded" />
              <div className="h-4 w-8 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-12 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-8 w-8 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }
}

// Estado vacío
export const Empty: Story = {
  args: {
    viewMode: 'table',
    enableSelection: true,
    enableBulkActions: true
  },
  parameters: {
    docs: {
      description: {
        story: 'Estado cuando no hay productos para mostrar. Incluye mensaje informativo y sugerencias.'
      }
    }
  },
  render: (_args) => {
    return (
      <div className="text-center py-12">
        <div className="h-12 w-12 mx-auto text-muted-foreground mb-4">
          📦
        </div>
        <h3 className="text-lg font-semibold mb-2">No hay productos</h3>
        <p className="text-muted-foreground">
          No se encontraron productos que coincidan con los criterios de búsqueda.
        </p>
      </div>
    )
  }
}
