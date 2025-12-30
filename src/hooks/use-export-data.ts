'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Repair } from '@/types/repairs'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export type ExportFormat = 'csv' | 'json' | 'pdf'

interface ExportOptions {
    format: ExportFormat
    filename?: string
    includeMetrics?: boolean
}

export function useExportData() {
    const [isExporting, setIsExporting] = useState(false)

    const exportRepairs = async (repairs: Repair[], options: ExportOptions) => {
        setIsExporting(true)
        
        try {
            const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
            const filename = options.filename || `historial_reparaciones_${timestamp}`

            switch (options.format) {
                case 'csv':
                    await exportToCSV(repairs, filename, options.includeMetrics)
                    break
                case 'json':
                    await exportToJSON(repairs, filename, options.includeMetrics)
                    break
                case 'pdf':
                    await exportToPDF(repairs, filename, options.includeMetrics)
                    break
                default:
                    throw new Error('Formato de exportación no soportado')
            }

            toast.success(`Datos exportados exitosamente como ${options.format.toUpperCase()}`)
        } catch (error) {
            console.error('Error al exportar:', error)
            toast.error('Error al exportar los datos')
        } finally {
            setIsExporting(false)
        }
    }

    const exportToCSV = async (repairs: Repair[], filename: string, includeMetrics?: boolean) => {
        const headers = [
            'ID',
            'Cliente',
            'Teléfono',
            'Dispositivo',
            'Marca',
            'Modelo',
            'Problema',
            'Estado',
            'Prioridad',
            'Urgencia',
            'Costo Final',
            'Costo Estimado',
            'Fecha Creación',
            'Fecha Completado',
            'Duración (días)',
            'Calificación Cliente',
            'Técnico'
        ]

        const csvData = repairs.map(repair => {
            const duration = repair.completedAt && repair.createdAt 
                ? Math.ceil((new Date(repair.completedAt).getTime() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : ''

            return [
                repair.id,
                repair.customer.name,
                repair.customer.phone,
                repair.device,
                repair.brand,
                repair.model,
                repair.issue,
                getStatusLabel(repair.dbStatus || repair.status),
                getPriorityLabel(repair.priority),
                repair.urgency === 'urgent' ? 'Urgente' : 'Normal',
                repair.finalCost || '',
                repair.estimatedCost || '',
                format(new Date(repair.createdAt), 'dd/MM/yyyy HH:mm', { locale: es }),
                repair.completedAt ? format(new Date(repair.completedAt), 'dd/MM/yyyy HH:mm', { locale: es }) : '',
                duration,
                repair.customerRating || '',
                repair.technician?.name || ''
            ]
        })

        // Agregar métricas si se solicita
        if (includeMetrics) {
            const metrics = calculateMetrics(repairs)
            csvData.push([]) // Línea vacía
            csvData.push(['=== MÉTRICAS ==='])
            csvData.push(['Total Reparaciones', metrics.total.toString()])
            csvData.push(['Reparaciones Completadas', metrics.completed.toString()])
            csvData.push(['Ingresos Totales', metrics.totalRevenue.toString()])
            csvData.push(['Tiempo Promedio (días)', metrics.avgRepairTime.toString()])
            csvData.push(['Calificación Promedio', metrics.avgRating.toString()])
        }

        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n')

        downloadFile(csvContent, `${filename}.csv`, 'text/csv')
    }

    const exportToJSON = async (repairs: Repair[], filename: string, includeMetrics?: boolean) => {
        const exportData: any = {
            exportDate: new Date().toISOString(),
            totalRecords: repairs.length,
            repairs: repairs.map(repair => ({
                id: repair.id,
                customer: {
                    name: repair.customer.name,
                    phone: repair.customer.phone,
                    email: repair.customer.email
                },
                device: {
                    type: repair.deviceType,
                    brand: repair.brand,
                    model: repair.model,
                    device: repair.device
                },
                repair: {
                    issue: repair.issue,
                    description: repair.description,
                    status: repair.dbStatus || repair.status,
                    priority: repair.priority,
                    urgency: repair.urgency
                },
                costs: {
                    estimated: repair.estimatedCost,
                    final: repair.finalCost
                },
                dates: {
                    created: repair.createdAt,
                    completed: repair.completedAt,
                    duration: repair.completedAt && repair.createdAt 
                        ? Math.ceil((new Date(repair.completedAt).getTime() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                        : null
                },
                rating: repair.customerRating,
                technician: repair.technician?.name
            }))
        }

        if (includeMetrics) {
            exportData.metrics = calculateMetrics(repairs)
        }

        const jsonContent = JSON.stringify(exportData, null, 2)
        downloadFile(jsonContent, `${filename}.json`, 'application/json')
    }

    const exportToPDF = async (repairs: Repair[], filename: string, includeMetrics?: boolean) => {
        // Para PDF, vamos a crear un HTML que se puede imprimir como PDF
        const metrics = includeMetrics ? calculateMetrics(repairs) : null
        
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Historial de Reparaciones</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .metrics { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        .metrics h3 { margin-top: 0; }
        .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .status { padding: 2px 6px; border-radius: 3px; font-size: 10px; }
        .status-entregado { background: #d4edda; color: #155724; }
        .status-listo { background: #d1ecf1; color: #0c5460; }
        .status-reparacion { background: #fff3cd; color: #856404; }
        .priority-high { color: #dc3545; font-weight: bold; }
        .priority-medium { color: #fd7e14; }
        .priority-low { color: #28a745; }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Historial de Reparaciones</h1>
        <p>Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
        <p>Total de registros: ${repairs.length}</p>
    </div>

    ${metrics ? `
    <div class="metrics">
        <h3>Métricas de Rendimiento</h3>
        <div class="metrics-grid">
            <div><strong>Total Reparaciones:</strong> ${metrics.total}</div>
            <div><strong>Completadas:</strong> ${metrics.completed}</div>
            <div><strong>Ingresos Totales:</strong> ₲${metrics.totalRevenue.toLocaleString()}</div>
            <div><strong>Tiempo Promedio:</strong> ${metrics.avgRepairTime} días</div>
            <div><strong>Calificación Promedio:</strong> ${metrics.avgRating}/5</div>
            <div><strong>Tasa de Éxito:</strong> ${Math.round((metrics.completed / metrics.total) * 100)}%</div>
        </div>
    </div>
    ` : ''}

    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Dispositivo</th>
                <th>Problema</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Costo</th>
                <th>Fecha</th>
                <th>Duración</th>
                <th>Rating</th>
            </tr>
        </thead>
        <tbody>
            ${repairs.map(repair => {
                const duration = repair.completedAt && repair.createdAt 
                    ? Math.ceil((new Date(repair.completedAt).getTime() - new Date(repair.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                    : '-'
                
                const statusClass = `status status-${repair.dbStatus || repair.status}`
                const priorityClass = `priority-${repair.priority}`
                
                return `
                <tr>
                    <td>${repair.id.slice(0, 8)}</td>
                    <td>
                        <strong>${repair.customer.name}</strong><br>
                        <small>${repair.customer.phone}</small>
                    </td>
                    <td>${repair.brand} ${repair.model}</td>
                    <td>${repair.issue}</td>
                    <td><span class="${statusClass}">${getStatusLabel(repair.dbStatus || repair.status)}</span></td>
                    <td><span class="${priorityClass}">${getPriorityLabel(repair.priority)}</span></td>
                    <td>₲${(repair.finalCost || repair.estimatedCost).toLocaleString()}</td>
                    <td>${format(new Date(repair.completedAt || repair.createdAt), 'dd/MM/yyyy', { locale: es })}</td>
                    <td>${duration} días</td>
                    <td>${repair.customerRating ? `⭐ ${repair.customerRating}` : '-'}</td>
                </tr>
                `
            }).join('')}
        </tbody>
    </table>

    <div class="no-print" style="margin-top: 30px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Imprimir / Guardar como PDF
        </button>
    </div>
</body>
</html>
        `

        // Abrir en nueva ventana para imprimir/guardar como PDF
        const printWindow = window.open('', '_blank')
        if (printWindow) {
            printWindow.document.write(htmlContent)
            printWindow.document.close()
            printWindow.focus()
        }
    }

    const calculateMetrics = (repairs: Repair[]) => {
        const completed = repairs.filter(r => r.dbStatus === 'entregado')
        const totalRevenue = completed.reduce((sum, r) => sum + (r.finalCost || r.estimatedCost), 0)
        
        const repairTimes = completed
            .filter(r => r.completedAt && r.createdAt)
            .map(r => Math.ceil((new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
        
        const avgRepairTime = repairTimes.length > 0 
            ? Math.round((repairTimes.reduce((sum, time) => sum + time, 0) / repairTimes.length) * 10) / 10
            : 0

        const ratedRepairs = completed.filter(r => r.customerRating && r.customerRating > 0)
        const avgRating = ratedRepairs.length > 0 
            ? Math.round((ratedRepairs.reduce((sum, r) => sum + (r.customerRating || 0), 0) / ratedRepairs.length) * 10) / 10
            : 0

        return {
            total: repairs.length,
            completed: completed.length,
            totalRevenue,
            avgRepairTime,
            avgRating
        }
    }

    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'recibido': 'Recibido',
            'diagnostico': 'Diagnóstico',
            'reparacion': 'En Reparación',
            'pausado': 'Pausado',
            'listo': 'Listo',
            'entregado': 'Entregado',
            'cancelado': 'Cancelado'
        }
        return labels[status] || status
    }

    const getPriorityLabel = (priority: string) => {
        const labels: Record<string, string> = {
            'high': 'Alta',
            'medium': 'Media',
            'low': 'Baja'
        }
        return labels[priority] || priority
    }

    return {
        exportRepairs,
        isExporting
    }
}