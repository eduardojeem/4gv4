/**
 * Custom generators for property-based testing with fast-check
 */

import fc from 'fast-check'
import { Product, Category, Supplier, ProductAlert } from '@/types/products'
import { DashboardFilters, SortConfig } from '@/types/products-dashboard'

/**
 * Generate a random product
 */
export const productGenerator = (): fc.Arbitrary<Product> => {
  return fc.record({
    id: fc.uuid(),
    sku: fc.string({ minLength: 3, maxLength: 20 }).map(s => s.toUpperCase()),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
    category_id: fc.option(fc.uuid(), { nil: null }),
    brand: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    supplier_id: fc.option(fc.uuid(), { nil: null }),
    purchase_price: fc.float({ min: 0, max: 10000, noNaN: true }),
    sale_price: fc.float({ min: 0, max: 10000, noNaN: true }),
    wholesale_price: fc.option(fc.float({ min: 0, max: 10000, noNaN: true }), { nil: null }),
    stock_quantity: fc.integer({ min: 0, max: 1000 }),
    min_stock: fc.integer({ min: 0, max: 100 }),
    max_stock: fc.option(fc.integer({ min: 0, max: 2000 }), { nil: null }),
    unit_measure: fc.constantFrom('unidad', 'kg', 'litro', 'metro', 'caja', 'paquete'),
    barcode: fc.option(fc.string({ minLength: 8, maxLength: 13 }), { nil: null }),
    images: fc.option(fc.array(fc.webUrl(), { maxLength: 5 }), { nil: undefined }),
    image_url: fc.option(fc.webUrl(), { nil: null }),
    is_active: fc.boolean(),
    featured: fc.option(fc.boolean(), { nil: undefined }),
    weight: fc.option(fc.float({ min: 0, max: 1000, noNaN: true }), { nil: null }),
    dimensions: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
    location: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
    tags: fc.option(fc.array(fc.string({ maxLength: 20 }), { maxLength: 10 }), { nil: null }),
    created_at: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
    updated_at: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString())
  })
}

/**
 * Generate a product with specific stock status
 */
export const productWithStockStatus = (
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
): fc.Arbitrary<Product> => {
  return productGenerator().chain(product => {
    switch (status) {
      case 'out_of_stock':
        return fc.constant({ ...product, stock_quantity: 0 })
      case 'low_stock':
        return fc.integer({ min: 1, max: product.min_stock }).map(stock => ({
          ...product,
          stock_quantity: stock
        }))
      case 'in_stock':
        return fc.integer({ min: product.min_stock + 1, max: 1000 }).map(stock => ({
          ...product,
          stock_quantity: stock
        }))
    }
  })
}

/**
 * Generate a category
 */
export const categoryGenerator = (): fc.Arbitrary<Category> => {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
    parent_id: fc.option(fc.uuid(), { nil: undefined }),
    is_active: fc.boolean(),
    created_at: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
    updated_at: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
    subcategories: fc.option(fc.constant([]), { nil: undefined }),
    products_count: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined })
  })
}

/**
 * Generate a supplier
 */
export const supplierGenerator = (): fc.Arbitrary<Supplier> => {
  return fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    contact_name: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
    email: fc.option(fc.emailAddress(), { nil: undefined }),
    phone: fc.option(fc.string({ minLength: 10, maxLength: 15 }), { nil: undefined }),
    address: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    tax_id: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: undefined }),
    is_active: fc.boolean(),
    created_at: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
    updated_at: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
    products_count: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined })
  })
}

/**
 * Generate a product alert
 */
export const alertGenerator = (): fc.Arbitrary<ProductAlert> => {
  return fc.record({
    id: fc.uuid(),
    product_id: fc.uuid(),
    type: fc.constantFrom(
      'low_stock',
      'out_of_stock',
      'no_supplier',
      'no_category',
      'no_image',
      'missing_supplier',
      'missing_category',
      'missing_image',
      'price_change',
      'inactive_with_sales',
      'new_product'
    ),
    message: fc.string({ minLength: 10, maxLength: 200 }),
    read: fc.boolean(),
    created_at: fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
    product_name: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
    details: fc.option(
      fc.record({
        current_stock: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
        min_stock: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
        last_sale: fc.option(fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()), { nil: undefined }),
        old_price: fc.option(fc.float({ min: 0, max: 10000 }), { nil: undefined }),
        new_price: fc.option(fc.float({ min: 0, max: 10000 }), { nil: undefined })
      }),
      { nil: undefined }
    ),
    is_resolved: fc.option(fc.boolean(), { nil: undefined }),
    resolved_at: fc.option(fc.integer({ min: 1577836800000, max: Date.now() }).map(ts => new Date(ts).toISOString()), { nil: undefined })
  })
}

/**
 * Generate dashboard filters
 */
export const filtersGenerator = (): fc.Arbitrary<DashboardFilters> => {
  return fc.record({
    search: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
    category_id: fc.option(fc.uuid(), { nil: undefined }),
    supplier_id: fc.option(fc.uuid(), { nil: undefined }),
    brand: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
    is_active: fc.option(fc.boolean(), { nil: undefined }),
    stock_status: fc.option(
      fc.constantFrom('in_stock', 'low_stock', 'out_of_stock'),
      { nil: undefined }
    ),
    price_min: fc.option(fc.float({ min: 0, max: 5000 }), { nil: undefined }),
    price_max: fc.option(fc.float({ min: 5000, max: 10000 }), { nil: undefined }),
    quick_filter: fc.option(
      fc.constantFrom('all', 'low_stock', 'out_of_stock', 'active'),
      { nil: undefined }
    )
  })
}

/**
 * Generate sort configuration
 */
export const sortConfigGenerator = (): fc.Arbitrary<SortConfig> => {
  return fc.record({
    field: fc.constantFrom('name', 'sku', 'sale_price', 'stock_quantity', 'created_at', 'updated_at'),
    direction: fc.constantFrom('asc', 'desc')
  })
}

/**
 * Generate a search query
 */
export const searchQueryGenerator = (): fc.Arbitrary<string> => {
  return fc.oneof(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.constant(''),
    fc.string({ minLength: 1, maxLength: 5 }).map(s => s.toLowerCase()),
    fc.string({ minLength: 1, maxLength: 5 }).map(s => s.toUpperCase())
  )
}

/**
 * Generate an array of products
 */
export const productsArrayGenerator = (
  minLength: number = 0,
  maxLength: number = 50
): fc.Arbitrary<Product[]> => {
  return fc.array(productGenerator(), { minLength, maxLength })
}

/**
 * Generate products with related data
 */
export const productsWithRelationsGenerator = (): fc.Arbitrary<{
  products: Product[]
  categories: Category[]
  suppliers: Supplier[]
}> => {
  return fc.record({
    categories: fc.array(categoryGenerator(), { minLength: 1, maxLength: 10 }),
    suppliers: fc.array(supplierGenerator(), { minLength: 1, maxLength: 10 })
  }).chain(({ categories, suppliers }) => {
    return fc.array(productGenerator(), { minLength: 5, maxLength: 30 }).map(products => {
      // Assign some products to categories and suppliers
      const productsWithRelations = products.map(product => {
        const category = fc.sample(fc.constantFrom(...categories), 1)[0]
        const supplier = fc.sample(fc.constantFrom(...suppliers), 1)[0]
        
        return {
          ...product,
          category_id: Math.random() > 0.3 ? category.id : null,
          supplier_id: Math.random() > 0.3 ? supplier.id : null,
          category: Math.random() > 0.3 ? category : undefined,
          supplier: Math.random() > 0.3 ? supplier : undefined
        }
      })

      return {
        products: productsWithRelations,
        categories,
        suppliers
      }
    })
  })
}

/**
 * Generate a product with multiple images
 */
export const productWithMultipleImagesGenerator = (): fc.Arbitrary<Product> => {
  return productGenerator().chain(product => {
    return fc.array(fc.webUrl(), { minLength: 2, maxLength: 5 }).map(images => ({
      ...product,
      images,
      image_url: images[0]
    }))
  })
}

/**
 * Generate a product without images
 */
export const productWithoutImagesGenerator = (): fc.Arbitrary<Product> => {
  return productGenerator().map(product => ({
    ...product,
    images: undefined,
    image_url: null
  }))
}
