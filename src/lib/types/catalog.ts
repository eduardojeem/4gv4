// Tipos para el sistema de catálogo (categorías, marcas y proveedores)

export interface Category {
  id: string
  name: string
  description: string
  subcategories: string[]
  color: string
  isActive: boolean
  productCount: number
  createdAt: string
  updatedAt: string
  parentId?: string // Para categorías anidadas
  icon?: string
  sortOrder?: number
}

export interface Brand {
  id: string
  name: string
  description: string
  website?: string
  logo?: string
  isActive: boolean
  productCount: number
  rating?: number
  country?: string
  foundedYear?: number
  createdAt: string
  updatedAt: string
  contactInfo?: {
    email?: string
    phone?: string
    address?: string
  }
}

export interface CategoryFormData {
  name: string
  description: string
  subcategories: string
  color: string
  parentId?: string
  icon?: string
}

export interface BrandFormData {
  name: string
  description: string
  website: string
  country?: string
  foundedYear?: number
  contactEmail?: string
  contactPhone?: string
}

// Constantes para categorías predefinidas
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Smartphones',
    description: 'Teléfonos inteligentes y dispositivos móviles',
    subcategories: ['iPhone', 'Samsung Galaxy', 'Xiaomi', 'Huawei', 'OnePlus', 'Google Pixel'],
    color: '#3B82F6',
    isActive: true,
    productCount: 0,
    icon: 'Smartphone'
  },
  {
    name: 'Accesorios',
    description: 'Accesorios para dispositivos móviles',
    subcategories: ['Fundas', 'Protectores de pantalla', 'Cargadores', 'Auriculares', 'Cables', 'Soportes'],
    color: '#10B981',
    isActive: true,
    productCount: 0,
    icon: 'Package'
  },
  {
    name: 'Repuestos',
    description: 'Repuestos y componentes para reparaciones',
    subcategories: ['Pantallas', 'Baterías', 'Cámaras', 'Altavoces', 'Conectores', 'Herramientas'],
    color: '#F59E0B',
    isActive: true,
    productCount: 0,
    icon: 'Wrench'
  },
  {
    name: 'Tablets',
    description: 'Tabletas y dispositivos de pantalla grande',
    subcategories: ['iPad', 'Samsung Tab', 'Lenovo', 'Huawei Tab', 'Amazon Fire'],
    color: '#8B5CF6',
    isActive: true,
    productCount: 0,
    icon: 'Tablet'
  }
]

// Constantes para marcas predefinidas
export const DEFAULT_BRANDS: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Apple',
    description: 'Tecnología innovadora y diseño premium',
    website: 'https://www.apple.com',
    isActive: true,
    productCount: 0,
    rating: 4.8,
    country: 'Estados Unidos',
    foundedYear: 1976
  },
  {
    name: 'Samsung',
    description: 'Líder mundial en tecnología móvil',
    website: 'https://www.samsung.com',
    isActive: true,
    productCount: 0,
    rating: 4.6,
    country: 'Corea del Sur',
    foundedYear: 1938
  },
  {
    name: 'Xiaomi',
    description: 'Innovación accesible para todos',
    website: 'https://www.mi.com',
    isActive: true,
    productCount: 0,
    rating: 4.4,
    country: 'China',
    foundedYear: 2010
  },
  {
    name: 'Huawei',
    description: 'Conectando el mundo inteligente',
    website: 'https://www.huawei.com',
    isActive: true,
    productCount: 0,
    rating: 4.3,
    country: 'China',
    foundedYear: 1987
  },
  {
    name: 'OnePlus',
    description: 'Never Settle - Rendimiento sin compromisos',
    website: 'https://www.oneplus.com',
    isActive: true,
    productCount: 0,
    rating: 4.5,
    country: 'China',
    foundedYear: 2013
  }
]

// Tipos para validación
export interface ValidationErrors {
  [key: string]: string
}

// Tipos para estadísticas
export interface CatalogStats {
  totalCategories: number
  activeCategories: number
  totalBrands: number
  activeBrands: number
  totalSuppliers: number
  activeSuppliers: number
  totalProducts: number
}

// Tipos para filtros
export interface CatalogFilters {
  searchTerm?: string
  status: 'all' | 'active' | 'inactive'
  sortBy: 'name' | 'createdAt' | 'productCount'
  sortOrder: 'asc' | 'desc'
}

// Tipos para acciones de modal
export type ModalMode = 'add' | 'edit'
export type CatalogItemType = 'categories' | 'brands' | 'suppliers'

export interface ModalState {
  isOpen: boolean
  mode: ModalMode
  type: CatalogItemType
  item?: Category | Brand | any
}