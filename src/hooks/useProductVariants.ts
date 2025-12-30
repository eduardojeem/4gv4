import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  VariantAttribute,
  VariantOption,
  ProductVariant,
  ProductWithVariants,
  CartItemWithVariant,
  ProductVariantConfig,
  VariantFilter,
  ProductSearchWithVariants,
  ProductSearchResult,
  VariantStockMovement,
  VariantAttributeValue
} from '@/types/product-variants'

// Mock data para desarrollo
const mockAttributes: VariantAttribute[] = [
  {
    id: 'attr-1',
    name: 'Color',
    type: 'color',
    required: true,
    options: [
      { id: 'opt-1', attribute_id: 'attr-1', value: 'Rojo', color_hex: '#FF0000', sort_order: 1, active: true },
      { id: 'opt-2', attribute_id: 'attr-1', value: 'Azul', color_hex: '#0000FF', sort_order: 2, active: true },
      { id: 'opt-3', attribute_id: 'attr-1', value: 'Verde', color_hex: '#00FF00', sort_order: 3, active: true }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'attr-2',
    name: 'Talla',
    type: 'size',
    required: true,
    options: [
      { id: 'opt-4', attribute_id: 'attr-2', value: 'XS', sort_order: 1, active: true },
      { id: 'opt-5', attribute_id: 'attr-2', value: 'S', sort_order: 2, active: true },
      { id: 'opt-6', attribute_id: 'attr-2', value: 'M', sort_order: 3, active: true },
      { id: 'opt-7', attribute_id: 'attr-2', value: 'L', sort_order: 4, active: true },
      { id: 'opt-8', attribute_id: 'attr-2', value: 'XL', sort_order: 5, active: true }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'attr-3',
    name: 'Material',
    type: 'text',
    required: false,
    options: [
      { id: 'opt-9', attribute_id: 'attr-3', value: 'Algodón', sort_order: 1, active: true },
      { id: 'opt-10', attribute_id: 'attr-3', value: 'Poliéster', sort_order: 2, active: true },
      { id: 'opt-11', attribute_id: 'attr-3', value: 'Lana', sort_order: 3, active: true }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

const mockProductsWithVariants: ProductWithVariants[] = [
  {
    id: 'prod-1',
    name: 'Camiseta Básica',
    description: 'Camiseta de algodón básica disponible en varios colores y tallas',
    has_variants: true,
    variant_attributes: ['attr-1', 'attr-2'],
    variants: [
      {
        id: 'var-1',
        product_id: 'prod-1',
        sku: 'CAM-ROJO-S',
        name: 'Camiseta Básica - Rojo S',
        attributes: [
          { attribute_id: 'attr-1', attribute_name: 'Color', option_id: 'opt-1', value: 'Rojo', color_hex: '#FF0000' },
          { attribute_id: 'attr-2', attribute_name: 'Talla', option_id: 'opt-5', value: 'S' }
        ],
        price: 25.00,
        wholesale_price: 18.00,
        cost_price: 12.00,
        stock: 15,
        min_stock: 5,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'var-2',
        product_id: 'prod-1',
        sku: 'CAM-AZUL-M',
        name: 'Camiseta Básica - Azul M',
        attributes: [
          { attribute_id: 'attr-1', attribute_name: 'Color', option_id: 'opt-2', value: 'Azul', color_hex: '#0000FF' },
          { attribute_id: 'attr-2', attribute_name: 'Talla', option_id: 'opt-6', value: 'M' }
        ],
        price: 25.00,
        wholesale_price: 18.00,
        cost_price: 12.00,
        stock: 8,
        min_stock: 5,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

export function useProductVariants() {
  const [attributes, setAttributes] = useState<VariantAttribute[]>(mockAttributes)
  const [products, setProducts] = useState<ProductWithVariants[]>(mockProductsWithVariants)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Gestión de atributos
  const createAttribute = useCallback(async (attribute: Omit<VariantAttribute, 'id' | 'created_at' | 'updated_at' | 'options'> & { options: Omit<VariantOption, 'id' | 'attribute_id'>[] }) => {
    setLoading(true)
    try {
      const attributeId = `attr-${Date.now()}`
      const newAttribute: VariantAttribute = {
        ...attribute,
        id: attributeId,
        options: attribute.options.map((opt, index) => ({
          ...opt,
          id: `opt-${Date.now()}-${index}`,
          attribute_id: attributeId
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      setAttributes(prev => [...prev, newAttribute])
      toast.success('Atributo creado exitosamente')
      return newAttribute
    } catch (err) {
      const message = 'Error al crear atributo'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateAttribute = useCallback(async (id: string, updates: Partial<VariantAttribute>) => {
    setLoading(true)
    try {
      setAttributes(prev => prev.map(attr => 
        attr.id === id 
          ? { ...attr, ...updates, updated_at: new Date().toISOString() }
          : attr
      ))
      toast.success('Atributo actualizado exitosamente')
    } catch (err) {
      const message = 'Error al actualizar atributo'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteAttribute = useCallback(async (id: string) => {
    setLoading(true)
    try {
      setAttributes(prev => prev.filter(attr => attr.id !== id))
      toast.success('Atributo eliminado exitosamente')
    } catch (err) {
      const message = 'Error al eliminar atributo'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Gestión de opciones de atributos
  const addAttributeOption = useCallback(async (attributeId: string, option: Omit<VariantOption, 'id' | 'attribute_id'>) => {
    setLoading(true)
    try {
      const newOption: VariantOption = {
        ...option,
        id: `opt-${Date.now()}`,
        attribute_id: attributeId
      }
      
      setAttributes(prev => prev.map(attr => 
        attr.id === attributeId 
          ? { ...attr, options: [...attr.options, newOption] }
          : attr
      ))
      toast.success('Opción agregada exitosamente')
      return newOption
    } catch (err) {
      const message = 'Error al agregar opción'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Gestión de variantes de productos
  const createProductVariant = useCallback(async (productId: string, variant: Omit<ProductVariant, 'id' | 'product_id' | 'created_at' | 'updated_at'>) => {
    setLoading(true)
    try {
      const newVariant: ProductVariant = {
        ...variant,
        id: `var-${Date.now()}`,
        product_id: productId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      setProducts(prev => prev.map(product => 
        product.id === productId 
          ? { ...product, variants: [...product.variants, newVariant] }
          : product
      ))
      toast.success('Variante creada exitosamente')
      return newVariant
    } catch (err) {
      const message = 'Error al crear variante'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const updateProductVariant = useCallback(async (variantId: string, updates: Partial<ProductVariant>) => {
    setLoading(true)
    try {
      setProducts(prev => prev.map(product => ({
        ...product,
        variants: product.variants.map(variant => 
          variant.id === variantId 
            ? { ...variant, ...updates, updated_at: new Date().toISOString() }
            : variant
        )
      })))
      toast.success('Variante actualizada exitosamente')
    } catch (err) {
      const message = 'Error al actualizar variante'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteProductVariant = useCallback(async (variantId: string) => {
    setLoading(true)
    try {
      setProducts(prev => prev.map(product => ({
        ...product,
        variants: product.variants.filter(variant => variant.id !== variantId)
      })))
      toast.success('Variante eliminada exitosamente')
    } catch (err) {
      const message = 'Error al eliminar variante'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // Búsqueda y filtrado
  const searchProducts = useCallback(async (searchParams: ProductSearchWithVariants): Promise<ProductSearchResult> => {
    setLoading(true)
    try {
      let filteredProducts = [...products]

      // Filtrar por query
      if (searchParams.query) {
        const query = searchParams.query.toLowerCase()
        filteredProducts = filteredProducts.filter(product => 
          product.name.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query) ||
          product.variants.some(variant => 
            variant.name.toLowerCase().includes(query) ||
            variant.sku.toLowerCase().includes(query)
          )
        )
      }

      // Filtrar por categoría
      if (searchParams.category_id) {
        filteredProducts = filteredProducts.filter(product => 
          product.category_id === searchParams.category_id
        )
      }

      // Filtrar por variantes
      if (searchParams.variant_filters && searchParams.variant_filters.length > 0) {
        filteredProducts = filteredProducts.filter(product => 
          product.variants.some(variant => 
            searchParams.variant_filters!.every(filter => 
              variant.attributes.some(attr => 
                attr.attribute_id === filter.attribute_id &&
                filter.option_ids.includes(attr.option_id)
              )
            )
          )
        )
      }

      // Filtrar por stock
      if (searchParams.in_stock) {
        filteredProducts = filteredProducts.filter(product => 
          product.variants.some(variant => variant.stock > 0)
        )
      }

      // Filtrar por rango de precios
      if (searchParams.price_min !== undefined || searchParams.price_max !== undefined) {
        filteredProducts = filteredProducts.filter(product => 
          product.variants.some(variant => {
            const price = variant.price
            return (searchParams.price_min === undefined || price >= searchParams.price_min) &&
                   (searchParams.price_max === undefined || price <= searchParams.price_max)
          })
        )
      }

      // Ordenar
      if (searchParams.sort_by) {
        filteredProducts.sort((a, b) => {
          let aValue: string | number, bValue: string | number
          
          switch (searchParams.sort_by) {
            case 'name':
              aValue = a.name
              bValue = b.name
              break
            case 'price':
              aValue = Math.min(...a.variants.map(v => v.price))
              bValue = Math.min(...b.variants.map(v => v.price))
              break
            case 'stock':
              aValue = a.variants.reduce((sum, v) => sum + v.stock, 0)
              bValue = b.variants.reduce((sum, v) => sum + v.stock, 0)
              break
            case 'created_at':
              aValue = new Date(a.created_at).getTime()
              bValue = new Date(b.created_at).getTime()
              break
            default:
              return 0
          }

          if (searchParams.sort_order === 'desc') {
            return bValue > aValue ? 1 : -1
          }
          return aValue > bValue ? 1 : -1
        })
      }

      // Paginación
      const offset = searchParams.offset || 0
      const limit = searchParams.limit || 50
      const paginatedProducts = filteredProducts.slice(offset, offset + limit)

      // Generar filtros disponibles
      const filters = {
        categories: [] as { id: string; name: string; count: number }[],
        brands: [] as { name: string; count: number }[],
        attributes: attributes.map(attr => ({
          attribute: attr,
          options: attr.options.map(option => ({
            option,
            count: filteredProducts.filter(product => 
              product.variants.some(variant => 
                variant.attributes.some(vAttr => vAttr.option_id === option.id)
              )
            ).length
          }))
        })),
        price_range: {
          min: Math.min(...filteredProducts.flatMap(p => p.variants.map(v => v.price))),
          max: Math.max(...filteredProducts.flatMap(p => p.variants.map(v => v.price)))
        }
      }

      return {
        products: paginatedProducts,
        total: filteredProducts.length,
        filters
      }
    } catch (err) {
      const message = 'Error al buscar productos'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [products, attributes])

  // Utilidades
  const getVariantByAttributes = useCallback((productId: string, attributeValues: { [attributeId: string]: string }) => {
    const product = products.find(p => p.id === productId)
    if (!product) return null

    return product.variants.find(variant => 
      Object.entries(attributeValues).every(([attrId, optionId]) => 
        variant.attributes.some(attr => 
          attr.attribute_id === attrId && attr.option_id === optionId
        )
      )
    )
  }, [products])

  const generateVariantSKU = useCallback((productName: string, attributes: VariantAttributeValue[]) => {
    const productCode = productName.substring(0, 3).toUpperCase()
    const attrCodes = attributes.map(attr => attr.value.substring(0, 2).toUpperCase()).join('-')
    return `${productCode}-${attrCodes}`
  }, [])

  const getVariantDisplayName = useCallback((variant: ProductVariant) => {
    const attrNames = variant.attributes.map(attr => attr.value).join(' - ')
    return `${variant.name} (${attrNames})`
  }, [])

  // Obtener producto con variantes
  const getProductWithVariants = useCallback((productId: string): ProductWithVariants | null => {
    return products.find(p => p.id === productId) || null
  }, [products])

  // Conversión para el carrito
  const convertVariantToCartItem = useCallback((variant: ProductVariant, quantity: number = 1): CartItemWithVariant => {
    const product = products.find(p => p.id === variant.product_id)
    return {
      id: `cart-${variant.id}-${Date.now()}`,
      product_id: variant.product_id,
      variant_id: variant.id,
      product_name: product?.name || '',
      variant_name: variant.name,
      variant_attributes: variant.attributes,
      sku: variant.sku,
      barcode: variant.barcode,
      price: variant.price,
      wholesale_price: variant.wholesale_price,
      quantity,
      stock: variant.stock,
      image: variant.images?.[0]
    }
  }, [products])

  return {
    // Estado
    attributes,
    products,
    loading,
    error,

    // Gestión de atributos
    createAttribute,
    updateAttribute,
    deleteAttribute,
    addAttributeOption,

    // Gestión de variantes
    createProductVariant,
    updateProductVariant,
    deleteProductVariant,

    // Búsqueda y filtrado
    searchProducts,

    // Utilidades
    getVariantByAttributes,
    generateVariantSKU,
    getVariantDisplayName,
    getProductWithVariants,
    convertVariantToCartItem,

    // Limpiar errores
    clearError: () => setError(null)
  }
}