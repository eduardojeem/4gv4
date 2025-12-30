import type { Category } from '@/hooks/useCategories'

export interface CategoryStats {
    total_categories: number
    active_categories: number
    inactive_categories: number
    categories_with_products: number
    total_subcategories: number
    root_categories: number
}

export function computeCategoryStats(categories: Category[]): CategoryStats {
    const total = categories.length
    const active = categories.filter(c => c.is_active).length
    const inactive = total - active
    const withProducts = categories.filter(c => (c.products_count || 0) > 0).length
    const subcategories = categories.filter(c => c.parent_id !== null).length
    const roots = total - subcategories

    return {
        total_categories: total,
        active_categories: active,
        inactive_categories: inactive,
        categories_with_products: withProducts,
        total_subcategories: subcategories,
        root_categories: roots
    }
}
