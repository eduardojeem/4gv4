'use client'

import React from 'react'

interface Product {
  id: string
  name: string
  sku: string
  category: string
  stock_quantity: number
  sale_price: number
  supplier: string
}

interface EnhancedProductListProps {
  products: Product[]
  loading?: boolean
}

const EnhancedProductList: React.FC<EnhancedProductListProps> = ({ 
  products = [], 
  loading = false 
}) => {
  if (loading) {
    return <div>Cargando productos...</div>
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {products.map((product) => (
          <div key={product.id} className="border p-4 rounded">
            <h3>{product.name}</h3>
            <p>SKU: {product.sku}</p>
            <p>Categoría: {product.category}</p>
            <p>Stock: {product.stock_quantity}</p>
            <p>Precio: ${product.sale_price}</p>
            <p>Proveedor: {product.supplier}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default EnhancedProductList