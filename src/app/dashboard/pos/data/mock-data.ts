import type { Product, Customer, PaymentMethodOption } from '../types'

// Datos de productos mock
export const mockProducts: Product[] = [
  // Electrónicos
  {
    id: '1',
    name: 'Smartphone Samsung Galaxy A54',
    description: 'Smartphone con cámara de 50MP y pantalla Super AMOLED',
    sku: 'SAM-A54-128',
    barcode: '7891234567890',
    price: 2500000,
    stock: 15,
    category: 'Electrónicos',
    image: '📱',
    featured: true
  },
  {
    id: '2',
    name: 'Auriculares Bluetooth Sony',
    description: 'Auriculares inalámbricos con cancelación de ruido',
    sku: 'SONY-WH1000',
    barcode: '7891234567891',
    price: 850000,
    stock: 8,
    category: 'Electrónicos',
    image: '🎧',
    featured: false
  },
  {
    id: '5',
    name: 'Notebook Lenovo ThinkPad',
    description: 'Laptop empresarial con procesador Intel i7',
    sku: 'LEN-TP-E14',
    barcode: '7891234567894',
    price: 4500000,
    stock: 5,
    category: 'Electrónicos',
    image: '💻',
    featured: true
  },
  // Hogar y Jardín
  {
    id: '3',
    name: 'Cafetera Oster Automática',
    description: 'Cafetera programable de 12 tazas con filtro permanente',
    sku: 'OST-CAF-12',
    barcode: '7891234567892',
    price: 320000,
    stock: 12,
    category: 'Hogar y Jardín',
    image: '☕',
    featured: false
  },
  {
    id: '4',
    name: 'Aspiradora Robot Xiaomi',
    description: 'Robot aspiradora con mapeo inteligente y control por app',
    sku: 'XIA-ROB-V1',
    barcode: '7891234567893',
    price: 1200000,
    stock: 6,
    category: 'Hogar y Jardín',
    image: '🤖',
    featured: true
  },
  // Ropa y Accesorios
  {
    id: '6',
    name: 'Zapatillas Nike Air Max',
    description: 'Zapatillas deportivas con tecnología Air Max',
    sku: 'NIKE-AM-270',
    barcode: '7891234567895',
    price: 450000,
    stock: 20,
    category: 'Ropa y Accesorios',
    image: '👟',
    featured: false
  }
]

// Datos de clientes mock
export const mockCustomers: Customer[] = [
  { id: '1', name: 'Juan Pérez', email: 'juan@email.com', phone: '+57 300 123 4567', loyaltyPoints: 150 },
  { id: '2', name: 'María García', email: 'maria@email.com', phone: '+57 301 234 5678', loyaltyPoints: 89 },
  { id: '3', name: 'Carlos López', email: 'carlos@email.com', phone: '+57 302 345 6789', loyaltyPoints: 234 },
  { id: '4', name: 'Ana Martínez', email: 'ana@email.com', phone: '+57 303 456 7890', loyaltyPoints: 67 },
  { id: '5', name: 'Luis Rodríguez', email: 'luis@email.com', phone: '+57 304 567 8901', loyaltyPoints: 445 }
]

// Métodos de pago disponibles
export const paymentMethods: PaymentMethodOption[] = [
  { id: 'cash', label: 'Efectivo', icon: '💵', requiresReference: false },
  { id: 'card', label: 'Tarjeta', icon: '💳', requiresReference: true },
  { id: 'transfer', label: 'Transferencia', icon: '🏦', requiresReference: true },
  { id: 'digital', label: 'Billetera Digital', icon: '📱', requiresReference: true }
]

// Categorías de productos
export const productCategories = [
  'Todos',
  'Electrónicos',
  'Hogar y Jardín',
  'Ropa y Accesorios',
  'Deportes',
  'Libros',
  'Salud y Belleza',
  'Automóvil',
  'Juguetes',
  'Alimentación'
]