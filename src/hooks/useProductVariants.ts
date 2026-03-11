import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  VariantAttribute,
  VariantOption,
  ProductVariant,
  ProductWithVariants,
  CartItemWithVariant,
  ProductSearchWithVariants,
  ProductSearchResult,
  VariantAttributeValue,
} from '@/types/product-variants'

type AttributesApiResponse = {
  success?: boolean
  data?: VariantAttribute[]
  error?: string
}

type AttributeApiResponse = {
  success?: boolean
  data?: VariantAttribute
  error?: string
}

type VariantsApiResponse = {
  success?: boolean
  data?: ProductVariant[]
  pagination?: {
    page?: number
    pages?: number
  }
  error?: string
}

type VariantApiResponse = {
  success?: boolean
  data?: ProductVariant
  error?: string
}

type ProductRow = {
  id: string
  name: string
  description?: string | null
  category_id?: string | null
  brand?: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

type ProductsApiResponse = {
  success?: boolean
  data?: {
    products?: ProductRow[]
    total?: number
  }
  error?: string
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    const message =
      (payload?.error as string | undefined) ||
      (payload?.message as string | undefined) ||
      'Error en la solicitud'
    throw new Error(message)
  }

  return (payload || {}) as T
}

function enrichProduct(product: ProductWithVariants): ProductWithVariants {
  const variantAttributes = Array.from(
    new Set(product.variants.flatMap((variant) => variant.attributes.map((attribute) => attribute.attribute_id)))
  )

  return {
    ...product,
    has_variants: product.variants.length > 0,
    variant_attributes: variantAttributes,
  }
}

function buildProductsWithVariants(products: ProductRow[], variants: ProductVariant[]): ProductWithVariants[] {
  const variantsByProduct = new Map<string, ProductVariant[]>()

  for (const variant of variants) {
    const current = variantsByProduct.get(variant.product_id) || []
    current.push(variant)
    variantsByProduct.set(variant.product_id, current)
  }

  return products.map((product) => {
    const productVariants = (variantsByProduct.get(product.id) || []).slice()
    const baseProduct: ProductWithVariants = {
      id: product.id,
      name: product.name,
      description: product.description ?? undefined,
      category_id: product.category_id ?? undefined,
      brand: product.brand ?? undefined,
      has_variants: productVariants.length > 0,
      variant_attributes: [],
      variants: productVariants,
      active: product.is_active !== false,
      created_at: product.created_at || new Date().toISOString(),
      updated_at: product.updated_at || new Date().toISOString(),
    }

    return enrichProduct(baseProduct)
  })
}

async function fetchAllVariants(): Promise<ProductVariant[]> {
  const limit = 200
  let page = 1
  const allVariants: ProductVariant[] = []

  while (true) {
    const response = await fetchJson<VariantsApiResponse>(`/api/variants?page=${page}&limit=${limit}`)
    const chunk = Array.isArray(response.data) ? response.data : []
    allVariants.push(...chunk)

    const totalPages = Number(response.pagination?.pages || 1)
    if (page >= totalPages || chunk.length === 0) break
    page += 1
  }

  return allVariants
}

async function fetchAllProducts(): Promise<ProductRow[]> {
  const perPage = 300
  let page = 1
  const allProducts: ProductRow[] = []
  let total = Infinity

  while (allProducts.length < total) {
    const response = await fetchJson<ProductsApiResponse>(`/api/products?page=${page}&per_page=${perPage}`)
    const chunk = Array.isArray(response.data?.products) ? response.data?.products : []
    total = Number(response.data?.total || chunk.length)

    if (chunk.length === 0) break
    allProducts.push(...chunk)
    page += 1
  }

  return allProducts
}

export function useProductVariants() {
  const [attributes, setAttributes] = useState<VariantAttribute[]>([])
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [attributesResponse, variants, productRows] = await Promise.all([
        fetchJson<AttributesApiResponse>('/api/attributes'),
        fetchAllVariants(),
        fetchAllProducts(),
      ])

      const nextAttributes = Array.isArray(attributesResponse.data) ? attributesResponse.data : []
      const nextProducts = buildProductsWithVariants(productRows, variants)

      setAttributes(nextAttributes)
      setProducts(nextProducts)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar variantes'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  const updateProductVariantInState = useCallback((variant: ProductVariant) => {
    setProducts((previous) =>
      previous.map((product) => {
        const variantExists = product.variants.some((currentVariant) => currentVariant.id === variant.id)

        if (product.id !== variant.product_id) {
          if (!variantExists) return product

          const remainingVariants = product.variants.filter((currentVariant) => currentVariant.id !== variant.id)
          return enrichProduct({
            ...product,
            variants: remainingVariants,
          })
        }

        const nextVariants = variantExists
          ? product.variants.map((currentVariant) =>
              currentVariant.id === variant.id ? variant : currentVariant
            )
          : [...product.variants, variant]

        return enrichProduct({
          ...product,
          variants: nextVariants,
        })
      })
    )
  }, [])

  const removeProductVariantFromState = useCallback((variantId: string) => {
    setProducts((previous) =>
      previous.map((product) => {
        const nextVariants = product.variants.filter((variant) => variant.id !== variantId)
        if (nextVariants.length === product.variants.length) return product

        return enrichProduct({
          ...product,
          variants: nextVariants,
        })
      })
    )
  }, [])

  const createAttribute = useCallback(
    async (
      attribute: Omit<VariantAttribute, 'id' | 'created_at' | 'updated_at' | 'options'> & {
        options: Omit<VariantOption, 'id' | 'attribute_id'>[]
      }
    ) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchJson<AttributeApiResponse>('/api/attributes', {
          method: 'POST',
          body: JSON.stringify(attribute),
        })

        if (!response.data) throw new Error(response.error || 'No se pudo crear el atributo')
        setAttributes((previous) => [...previous, response.data])
        toast.success('Atributo creado exitosamente')
        return response.data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al crear atributo'
        setError(message)
        toast.error(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const updateAttribute = useCallback(async (id: string, updates: Partial<VariantAttribute>) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchJson<AttributeApiResponse>(`/api/attributes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })

      if (!response.data) throw new Error(response.error || 'No se pudo actualizar el atributo')

      setAttributes((previous) =>
        previous.map((attribute) => (attribute.id === id ? response.data! : attribute))
      )
      toast.success('Atributo actualizado exitosamente')
      return response.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar atributo'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteAttribute = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      await fetchJson<{ success?: boolean; error?: string }>(`/api/attributes/${id}`, {
        method: 'DELETE',
      })

      setAttributes((previous) => previous.filter((attribute) => attribute.id !== id))
      setProducts((previous) =>
        previous.map((product) =>
          enrichProduct({
            ...product,
            variants: product.variants.map((variant) => ({
              ...variant,
              attributes: variant.attributes.filter((attributeValue) => attributeValue.attribute_id !== id),
            })),
          })
        )
      )
      toast.success('Atributo eliminado exitosamente')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar atributo'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const addAttributeOption = useCallback(
    async (attributeId: string, option: Omit<VariantOption, 'id' | 'attribute_id'>) => {
      const currentAttribute = attributes.find((attribute) => attribute.id === attributeId)
      if (!currentAttribute) {
        const message = 'Atributo no encontrado'
        setError(message)
        toast.error(message)
        throw new Error(message)
      }

      const options = [
        ...currentAttribute.options,
        {
          id: `temp-${Date.now()}`,
          attribute_id: attributeId,
          value: option.value,
          display_value: option.display_value,
          color_hex: option.color_hex,
          sort_order: option.sort_order,
          active: option.active !== false,
        },
      ]

      const updated = await updateAttribute(attributeId, { options })
      const lastOption = updated.options[updated.options.length - 1]
      return lastOption
    },
    [attributes, updateAttribute]
  )

  const createProductVariant = useCallback(
    async (
      productId: string,
      variant: Omit<ProductVariant, 'id' | 'product_id' | 'created_at' | 'updated_at'>
    ) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchJson<VariantApiResponse>('/api/variants', {
          method: 'POST',
          body: JSON.stringify({
            ...variant,
            product_id: productId,
          }),
        })

        if (!response.data) throw new Error(response.error || 'No se pudo crear la variante')
        updateProductVariantInState(response.data)
        toast.success('Variante creada exitosamente')
        return response.data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al crear variante'
        setError(message)
        toast.error(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [updateProductVariantInState]
  )

  const updateProductVariant = useCallback(
    async (variantId: string, updates: Partial<ProductVariant>) => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetchJson<VariantApiResponse>(`/api/variants/${variantId}`, {
          method: 'PUT',
          body: JSON.stringify(updates),
        })

        if (!response.data) throw new Error(response.error || 'No se pudo actualizar la variante')
        updateProductVariantInState(response.data)
        toast.success('Variante actualizada exitosamente')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al actualizar variante'
        setError(message)
        toast.error(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [updateProductVariantInState]
  )

  const deleteProductVariant = useCallback(async (variantId: string) => {
    setLoading(true)
    setError(null)
    try {
      await fetchJson<{ success?: boolean; error?: string }>(`/api/variants/${variantId}`, {
        method: 'DELETE',
      })

      removeProductVariantFromState(variantId)
      toast.success('Variante eliminada exitosamente')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar variante'
      setError(message)
      toast.error(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [removeProductVariantFromState])

  const searchProducts = useCallback(
    async (searchParams: ProductSearchWithVariants): Promise<ProductSearchResult> => {
      setLoading(true)
      try {
        let filteredProducts = [...products]

        if (searchParams.query) {
          const query = searchParams.query.toLowerCase()
          filteredProducts = filteredProducts.filter(
            (product) =>
              product.name.toLowerCase().includes(query) ||
              product.description?.toLowerCase().includes(query) ||
              product.variants.some(
                (variant) =>
                  variant.name.toLowerCase().includes(query) ||
                  variant.sku.toLowerCase().includes(query)
              )
          )
        }

        if (searchParams.category_id) {
          filteredProducts = filteredProducts.filter(
            (product) => product.category_id === searchParams.category_id
          )
        }

        if (searchParams.variant_filters && searchParams.variant_filters.length > 0) {
          filteredProducts = filteredProducts.filter((product) =>
            product.variants.some((variant) =>
              searchParams.variant_filters!.every((filter) =>
                variant.attributes.some(
                  (attributeValue) =>
                    attributeValue.attribute_id === filter.attribute_id &&
                    filter.option_ids.includes(attributeValue.option_id)
                )
              )
            )
          )
        }

        if (searchParams.in_stock) {
          filteredProducts = filteredProducts.filter((product) =>
            product.variants.some((variant) => variant.stock > 0)
          )
        }

        if (searchParams.price_min !== undefined || searchParams.price_max !== undefined) {
          filteredProducts = filteredProducts.filter((product) =>
            product.variants.some((variant) => {
              const price = variant.price
              return (
                (searchParams.price_min === undefined || price >= searchParams.price_min) &&
                (searchParams.price_max === undefined || price <= searchParams.price_max)
              )
            })
          )
        }

        if (searchParams.sort_by) {
          filteredProducts.sort((a, b) => {
            let aValue: string | number
            let bValue: string | number

            switch (searchParams.sort_by) {
              case 'name':
                aValue = a.name
                bValue = b.name
                break
              case 'price':
                aValue =
                  a.variants.length > 0 ? Math.min(...a.variants.map((variant) => variant.price)) : 0
                bValue =
                  b.variants.length > 0 ? Math.min(...b.variants.map((variant) => variant.price)) : 0
                break
              case 'stock':
                aValue = a.variants.reduce((sum, variant) => sum + variant.stock, 0)
                bValue = b.variants.reduce((sum, variant) => sum + variant.stock, 0)
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

        const offset = searchParams.offset || 0
        const limit = searchParams.limit || 50
        const paginatedProducts = filteredProducts.slice(offset, offset + limit)

        const priceValues = filteredProducts.flatMap((product) =>
          product.variants.map((variant) => variant.price)
        )
        const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0
        const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 0

        const filters = {
          categories: [] as { id: string; name: string; count: number }[],
          brands: [] as { name: string; count: number }[],
          attributes: attributes.map((attribute) => ({
            attribute,
            options: attribute.options.map((option) => ({
              option,
              count: filteredProducts.filter((product) =>
                product.variants.some((variant) =>
                  variant.attributes.some((variantAttribute) => variantAttribute.option_id === option.id)
                )
              ).length,
            })),
          })),
          price_range: {
            min: minPrice,
            max: maxPrice,
          },
        }

        return {
          products: paginatedProducts,
          total: filteredProducts.length,
          filters,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al buscar productos'
        setError(message)
        toast.error(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [products, attributes]
  )

  const getVariantByAttributes = useCallback(
    (productId: string, attributeValues: { [attributeId: string]: string }) => {
      const product = products.find((currentProduct) => currentProduct.id === productId)
      if (!product) return null

      return product.variants.find((variant) =>
        Object.entries(attributeValues).every(([attributeId, optionId]) =>
          variant.attributes.some(
            (attributeValue) =>
              attributeValue.attribute_id === attributeId && attributeValue.option_id === optionId
          )
        )
      )
    },
    [products]
  )

  const generateVariantSKU = useCallback((productName: string, attributesData: VariantAttributeValue[]) => {
    const productCode = productName.substring(0, 3).toUpperCase()
    const attributeCodes = attributesData
      .map((attribute) => attribute.value.substring(0, 2).toUpperCase())
      .join('-')
    return `${productCode}-${attributeCodes}`
  }, [])

  const getVariantDisplayName = useCallback((variant: ProductVariant) => {
    const attributeNames = variant.attributes.map((attribute) => attribute.value).join(' - ')
    return `${variant.name} (${attributeNames})`
  }, [])

  const getProductWithVariants = useCallback(
    (productId: string): ProductWithVariants | null => {
      return products.find((product) => product.id === productId) || null
    },
    [products]
  )

  const convertVariantToCartItem = useCallback(
    (variant: ProductVariant, quantity = 1): CartItemWithVariant => {
      const product = products.find((item) => item.id === variant.product_id)
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
        image: variant.images?.[0],
      }
    },
    [products]
  )

  return {
    attributes,
    products,
    loading,
    error,
    refreshData,
    createAttribute,
    updateAttribute,
    deleteAttribute,
    addAttributeOption,
    createProductVariant,
    updateProductVariant,
    deleteProductVariant,
    searchProducts,
    getVariantByAttributes,
    generateVariantSKU,
    getVariantDisplayName,
    getProductWithVariants,
    convertVariantToCartItem,
    clearError: () => setError(null),
  }
}
