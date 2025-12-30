import type { UISupplier } from '@/lib/types/supplier-ui'
import { toast } from 'sonner'

export interface ExportOptions {
    format: 'csv' | 'excel' | 'pdf' | 'json'
    fields?: string[]
    filename?: string
}

export async function exportSuppliers(
    suppliers: UISupplier[],
    options: ExportOptions
) {
    const { format, fields, filename } = options
    const defaultFilename = `proveedores-${new Date().toISOString().split('T')[0]}`

    try {
        switch (format) {
            case 'csv':
                return exportToCSV(suppliers, fields, filename || defaultFilename)
            case 'json':
                return exportToJSON(suppliers, fields, filename || defaultFilename)
            case 'excel':
                toast.info('Exportación a Excel próximamente')
                break
            case 'pdf':
                toast.info('Exportación a PDF próximamente')
                break
        }
    } catch (error) {
        console.error('Export error:', error)
        toast.error('Error al exportar proveedores')
    }
}

function exportToCSV(suppliers: UISupplier[], fields?: string[], filename?: string) {
    const defaultFields = [
        'name',
        'contact_person',
        'email',
        'phone',
        'city',
        'country',
        'business_type',
        'status',
        'rating',
        'total_orders',
        'total_amount'
    ]

    const selectedFields = fields || defaultFields
    const headers = selectedFields.map(field => {
        const labels: Record<string, string> = {
            name: 'Nombre',
            contact_person: 'Contacto',
            email: 'Email',
            phone: 'Teléfono',
            city: 'Ciudad',
            country: 'País',
            business_type: 'Tipo de Negocio',
            status: 'Estado',
            rating: 'Calificación',
            total_orders: 'Total Órdenes',
            total_amount: 'Monto Total'
        }
        return labels[field] || field
    })

    const rows = suppliers.map(supplier => {
        return selectedFields.map(field => {
            const value = supplier[field as keyof UISupplier]
            if (value === null || value === undefined) return ''
            if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`
            return value
        })
    })

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n')

    downloadFile(csvContent, `${filename}.csv`, 'text/csv')
    toast.success(`${suppliers.length} proveedores exportados a CSV`)
}

function exportToJSON(suppliers: UISupplier[], fields?: string[], filename?: string) {
    let data: Record<string, unknown>[] = suppliers

    if (fields && fields.length > 0) {
        data = suppliers.map(supplier => {
            const filtered: Record<string, unknown> = {}
            fields.forEach(field => {
                filtered[field] = supplier[field as keyof UISupplier]
            })
            return filtered
        })
    }

    const jsonContent = JSON.stringify(data, null, 2)
    downloadFile(jsonContent, `${filename}.json`, 'application/json')
    toast.success(`${suppliers.length} proveedores exportados a JSON`)
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

// Import from CSV
export async function importSuppliersFromCSV(file: File): Promise<Partial<UISupplier>[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string
                const lines = text.split('\n').filter(line => line.trim())

                if (lines.length < 2) {
                    throw new Error('El archivo CSV está vacío')
                }

                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
                const suppliers: Partial<UISupplier>[] = []

                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i])
                    const supplier: Record<string, unknown> = {}

                    headers.forEach((header, index) => {
                        const value = values[index]?.trim().replace(/"/g, '')
                        if (value) {
                            supplier[header] = value
                        }
                    })

                    if (supplier.name) {
                        suppliers.push(supplier)
                    }
                }

                resolve(suppliers)
                toast.success(`${suppliers.length} proveedores importados`)
            } catch (error) {
                reject(error)
                toast.error('Error al importar CSV')
            }
        }

        reader.onerror = () => {
            reject(new Error('Error al leer el archivo'))
            toast.error('Error al leer el archivo')
        }

        reader.readAsText(file)
    })
}

function parseCSVLine(line: string): string[] {
    const values: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"'
                i++
            } else {
                inQuotes = !inQuotes
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current)
            current = ''
        } else {
            current += char
        }
    }

    values.push(current)
    return values
}
