export interface Product {
  id: string
  name: string
  sku: string
  category: string
  purchase_price: number
  sale_price: number
  stock_quantity: number
  min_stock: number
  supplier: string
  created_at: string
  image?: string
  description?: string
  featured?: boolean
  barcode?: string
}