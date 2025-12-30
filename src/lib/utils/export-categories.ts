import { toast } from 'sonner'

interface Category {
    id: string
    name: string
    description: string | null
    parent_id: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    products_count?: number
}

export interface ExportOptions {
    format: 'csv' | 'json'
    fields?: string[]
    filename?: string
}

export async function exportCategories(
    categories: Category[],
    options: ExportOptions
) {
    const { format, fields, filename } = options
    const defaultFilename = `categorias-${new Date().toISOString().split('T')[0]}`

    try {
        switch (format) {
            case 'csv':
                return exportToCSV(categories, fields, filename || defaultFilename)
            case 'json':
                return exportToJSON(categories, fields, filename || defaultFilename)
        }
    } catch (error) {
        console.error('Export error:', error)
        toast.error('Error al exportar categorías')
    }
}

function exportToCSV(categories: Category[], fields?: string[], filename?: string) {
    const defaultFields = [
        'name',
        'description',
        'parent_id',
        'is_active',
        'products_count'
    ]

    const selectedFields = fields || defaultFields
    const headers = selectedFields.map(field => {
        const labels: Record<string, string> = {
            name: 'Nombre',
            description: 'Descripción',
            parent_id: 'ID Categoría Padre',
            is_active: 'Activa',
            products_count: 'Productos'
        }
        return labels[field] || field
    })

    const rows = categories.map(category => {
        return selectedFields.map(field => {
            const value = category[field as keyof Category]
            if (value === null || value === undefined) return ''
            if (typeof value === 'boolean') return value ? 'Sí' : 'No'
            if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`
            return value
        })
    })

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n')

    downloadFile(csvContent, `${filename}.csv`, 'text/csv')
    toast.success(`${categories.length} categorías exportadas a CSV`)
}

function exportToJSON(categories: Category[], fields?: string[], filename?: string) {
    let data: Record<string, unknown>[] = categories

    if (fields && fields.length > 0) {
        data = categories.map(category => {
            const filtered: Record<string, unknown> = {}
            fields.forEach(field => {
                filtered[field] = category[field as keyof Category]
            })
            return filtered
        })
    }

    const jsonContent = JSON.stringify(data, null, 2)
    downloadFile(jsonContent, `${filename}.json`, 'application/json')
    toast.success(`${categories.length} categorías exportadas a JSON`)
}

function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
}
