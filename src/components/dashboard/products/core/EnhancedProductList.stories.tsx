import type { Meta, StoryObj } from '@storybook/react'
import { action } from '@storybook/addon-actions'
import { EnhancedProductList } from './EnhancedProductList'

// Mock de datos de productos para las stories
const mockProducts = [
  {
    id: '1',
    name: 'iPhone 15 Pro',
    sku: 'IPH15P-256-BLU',
    stock_quantity: 25,
    min_stock: 10,
    max_stock: 100,
    sale_price: 1199.99,
    purchase_price: 899.99,
    category_name: 'Smartphones',
    supplier_name: 'Apple Inc.',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T15:30:00Z'
  },
  {
    id: '2',
    name: 'Samsung Galaxy S24',
    sku: 'SGS24-128-BLK',
    stock_quantity: 5,
    min_stock: 10,
    max_stock: 80,
    sale_price: 899.99,
    purchase_price: 649.99,
    category_name: 'Smartphones',
    supplier_name: 'Samsung Electronics',
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-18T12:00:00Z'
  },
  {
    id: '3',
    name: 'MacBook Air M3',
    sku: 'MBA-M3-512-SLV',
    stock_quantity: 0,
    min_stock: 5,
    max_stock: 30,
    sale_price: 1499.99,
    purchase_price: 1199.99,
    category_name: 'Laptops',
    supplier_name: 'Apple Inc.',
    created_at: '2024-01-05T14:00:00Z',
    updated_at: '2024-01-22T09:15:00Z'
  },
  {
    id: '4',
    name: 'Dell XPS 13',
    sku: 'DXP13-1TB-BLK',
    stock_quantity: 15,
    min_stock: 8,
    max_stock: 40,
    sale_price: 1299.99,
    purchase_price: 999.99,
    category_name: 'Laptops',
    supplier_name: 'Dell Technologies',
    created_at: '2024-01-12T11:30:00Z',
    updated_at: '2024-01-19T16:45:00Z'
  },
  {
    id: '5',
    name: 'AirPods Pro 2',
    sku: 'APP2-WHT',
    stock_quantity: 150,
    min_stock: 20,
    max_stock: 200,
    sale_price: 249.99,
    purchase_price: 179.99,
    category_name: 'Audio',
    supplier_name: 'Apple Inc.',
    created_at: '2024-01-08T13:20:00Z',
    updated_at: '2024-01-21T10:30:00Z'
  }
]

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
    onProductAction: action('product-action'),
    onBulkAction: action('bulk-action')
  }
}

// Vista de tabla
export const TableView: Story = {
  args: {
    viewMode: 'table',
    enableSelection: true,
    enableBulkActions: true,
    onProductAction: action('product-action'),
    onBulkAction: action('bulk-action')
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
    onProductAction: action('product-action'),
    onBulkAction: action('bulk-action')
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
    onProductAction: action('product-action')
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
    onProductAction: action('product-action'),
    onBulkAction: action('bulk-action')
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
  render: (args) => {
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
  render: (args) => {
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