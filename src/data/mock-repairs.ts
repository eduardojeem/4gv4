import {
    Clock, PlayCircle, Package, CheckCircle, XCircle, PauseCircle,
    Activity, Zap, Smartphone, Tablet, Laptop, Monitor
} from 'lucide-react'
import {
    Repair, StatusConfigItem, PriorityConfigItem, UrgencyConfigItem, DeviceTypeConfigItem,
    RepairStatus
} from '@/types/repairs'

export const mockRepairs: Repair[] = [
    {
        id: 'REP-001',
        customer: {
            name: 'Juan Pérez',
            phone: '+1 234-567-8901',
            email: 'juan.perez@email.com'
        },
        device: 'iPhone 14 Pro',
        deviceType: 'smartphone',
        brand: 'Apple',
        model: '14 Pro',
        issue: 'Pantalla rota',
        description: 'Pantalla completamente agrietada después de caída. Cliente reporta que el touch funciona parcialmente.',
        status: 'recibido',
        priority: 'high',
        urgency: 'urgent',
        estimatedCost: 250.00,
        finalCost: null,
        laborCost: 45.00,
        technician: {
            name: 'Carlos Rodríguez',
            id: 'TECH-001'
        },
        location: 'Taller Principal',
        warranty: '90 días',
        createdAt: '2024-01-15T10:30:00Z',
        estimatedCompletion: '2024-01-17T16:00:00Z',
        completedAt: null,
        lastUpdate: '2024-01-15T10:30:00Z',
        progress: 0,
        customerRating: null,
        notes: [
            { id: 1, text: 'Cliente confirmó que el dispositivo se cayó desde 1.5m', timestamp: '2024-01-15T10:30:00Z', author: 'Recepción' }
        ],
        parts: [
            { id: 1, name: 'Pantalla iPhone 14 Pro OLED', cost: 200.00, quantity: 1, supplier: 'TechParts Inc', partNumber: 'IP14P-LCD-001' },
            { id: 2, name: 'Adhesivo pantalla 3M', cost: 5.00, quantity: 1, supplier: 'Local', partNumber: 'ADH-001' }
        ],
        images: [],
        notifications: {
            customer: true,
            technician: true,
            manager: false
        }
    },
    {
        id: 'REP-002',
        customer: {
            name: 'María García',
            phone: '+1 234-567-8902',
            email: 'maria.garcia@email.com'
        },
        device: 'Samsung Galaxy S22',
        deviceType: 'smartphone',
        brand: 'Samsung',
        model: 'Galaxy S22',
        issue: 'Batería no carga',
        description: 'El dispositivo no mantiene carga y se apaga constantemente. Batería se agota en menos de 2 horas.',
        status: 'reparacion',
        priority: 'medium',
        urgency: 'normal',
        estimatedCost: 120.00,
        finalCost: null,
        laborCost: 40.00,
        technician: {
            name: 'Ana López',
            id: 'TECH-002'
        },
        location: 'Taller Principal',
        warranty: '60 días',
        createdAt: '2024-01-14T14:20:00Z',
        estimatedCompletion: '2024-01-16T12:00:00Z',
        completedAt: null,
        lastUpdate: '2024-01-15T09:15:00Z',
        progress: 65,
        customerRating: null,
        notes: [
            { id: 1, text: 'Diagnóstico inicial: batería hinchada', timestamp: '2024-01-14T15:00:00Z', author: 'Ana López' },
            { id: 2, text: 'Batería de reemplazo pedida al proveedor', timestamp: '2024-01-15T09:15:00Z', author: 'Ana López' }
        ],
        parts: [
            { id: 1, name: 'Batería Samsung Galaxy S22', cost: 80.00, quantity: 1, supplier: 'Samsung Parts', partNumber: 'SGS22-BAT-001' }
        ],
        images: [],
        notifications: {
            customer: true,
            technician: true,
            manager: true
        }
    },
    {
        id: 'REP-003',
        customer: {
            name: 'Carlos López',
            phone: '+1 234-567-8903',
            email: 'carlos.lopez@email.com'
        },
        device: 'iPhone 13',
        deviceType: 'smartphone',
        brand: 'Apple',
        model: '13',
        issue: 'Cámara no funciona',
        description: 'Cámara trasera no enfoca y muestra imagen borrosa. Problema comenzó después de actualización.',
        status: 'entregado',
        priority: 'low',
        urgency: 'normal',
        estimatedCost: 180.00,
        finalCost: 175.00,
        laborCost: 25.00,
        technician: {
            name: 'Miguel Torres',
            id: 'TECH-003'
        },
        location: 'Taller Principal',
        warranty: '90 días',
        createdAt: '2024-01-10T09:15:00Z',
        estimatedCompletion: '2024-01-12T17:00:00Z',
        completedAt: '2024-01-12T15:30:00Z',
        lastUpdate: '2024-01-12T15:30:00Z',
        progress: 100,
        customerRating: 5,
        notes: [
            { id: 1, text: 'Cámara reemplazada exitosamente', timestamp: '2024-01-12T14:00:00Z', author: 'Miguel Torres' },
            { id: 2, text: 'Pruebas de calidad completadas', timestamp: '2024-01-12T15:30:00Z', author: 'Miguel Torres' }
        ],
        parts: [
            { id: 1, name: 'Cámara iPhone 13 Principal', cost: 150.00, quantity: 1, supplier: 'Apple Parts', partNumber: 'IP13-CAM-001' }
        ],
        images: [],
        notifications: {
            customer: true,
            technician: false,
            manager: false
        }
    },
    {
        id: 'REP-004',
        customer: {
            name: 'Ana Martínez',
            phone: '+1 234-567-8904',
            email: 'ana.martinez@email.com'
        },
        device: 'Xiaomi Redmi Note 11',
        deviceType: 'smartphone',
        brand: 'Xiaomi',
        model: 'Redmi Note 11',
        issue: 'No enciende',
        description: 'El dispositivo no responde al botón de encendido. Posible daño por líquido.',
        status: 'cancelado',
        priority: 'high',
        urgency: 'urgent',
        estimatedCost: 200.00,
        finalCost: null,
        laborCost: 60.00,
        technician: null,
        location: 'Taller Principal',
        warranty: null,
        createdAt: '2024-01-13T11:45:00Z',
        estimatedCompletion: null,
        completedAt: null,
        lastUpdate: '2024-01-13T16:20:00Z',
        progress: 0,
        customerRating: null,
        notes: [
            { id: 1, text: 'Cliente decidió no proceder con la reparación por costo', timestamp: '2024-01-13T16:20:00Z', author: 'Recepción' }
        ],
        parts: [],
        images: [],
        notifications: {
            customer: false,
            technician: false,
            manager: false
        }
    },
    {
        id: 'REP-005',
        customer: {
            name: 'Roberto Silva',
            phone: '+1 234-567-8905',
            email: 'roberto.silva@email.com'
        },
        device: 'MacBook Pro 13"',
        deviceType: 'laptop',
        brand: 'Apple',
        model: 'MacBook Pro 13" M1',
        issue: 'Teclado no responde',
        description: 'Varias teclas del teclado no funcionan. Posible derrame de líquido.',
        status: 'pausado',
        priority: 'medium',
        urgency: 'normal',
        estimatedCost: 320.00,
        finalCost: null,
        laborCost: 80.00,
        technician: {
            name: 'Laura Mendez',
            id: 'TECH-004'
        },
        location: 'Taller Especializado',
        warranty: '120 días',
        createdAt: '2024-01-16T08:00:00Z',
        estimatedCompletion: '2024-01-20T17:00:00Z',
        completedAt: null,
        lastUpdate: '2024-01-16T14:30:00Z',
        progress: 25,
        customerRating: null,
        notes: [
            { id: 1, text: 'Diagnóstico confirmado: teclado dañado por líquido', timestamp: '2024-01-16T10:00:00Z', author: 'Laura Mendez' },
            { id: 2, text: 'Teclado de reemplazo en camino', timestamp: '2024-01-16T14:30:00Z', author: 'Laura Mendez' }
        ],
        parts: [
            { id: 1, name: 'Teclado MacBook Pro 13" M1', cost: 240.00, quantity: 1, supplier: 'Apple Authorized', partNumber: 'MBP13-KB-M1' }
        ],
        images: [],
        notifications: {
            customer: true,
            technician: true,
            manager: false
        }
    },
    {
        id: 'REP-010',
        customer: {
            name: 'Sofía Herrera',
            phone: '+1 234-567-8910',
            email: 'sofia.herrera@email.com'
        },
        device: 'Motorola Moto G Power',
        deviceType: 'smartphone',
        brand: 'Motorola',
        model: 'Moto G Power',
        issue: 'Cambio de batería',
        description: 'Reemplazo de batería debido a descarga rápida.',
        status: 'entregado',
        priority: 'medium',
        urgency: 'normal',
        estimatedCost: 90.00,
        finalCost: 95.00,
        laborCost: 25.00,
        technician: {
            name: 'Carlos Rodríguez',
            id: 'TECH-001'
        },
        location: 'Taller Principal',
        warranty: '60 días',
        createdAt: '2024-01-09T10:00:00Z',
        estimatedCompletion: '2024-01-10T16:00:00Z',
        completedAt: '2024-01-10T15:45:00Z',
        lastUpdate: '2024-01-10T15:45:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Batería reemplazada y pruebas realizadas', timestamp: '2024-01-10T15:30:00Z', author: 'Carlos Rodríguez' },
            { id: 2, text: 'Cliente indica que no carga aún al 100%', timestamp: '2024-01-12T09:00:00Z', author: 'Recepción' }
        ],
        parts: [
            { id: 1, name: 'Batería Moto G Power', cost: 70.00, quantity: 1, supplier: 'TechParts Inc', partNumber: 'MGP-BAT-001' }
        ],
        images: [],
        notifications: {
            customer: true,
            technician: true,
            manager: false
        }
    },
    {
        id: 'REP-011',
        customer: {
            name: 'Andrés Gómez',
            phone: '+1 234-567-8911',
            email: 'andres.gomez@email.com'
        },
        device: 'HP Pavilion 15',
        deviceType: 'laptop',
        brand: 'HP',
        model: 'Pavilion 15',
        issue: 'No enciende',
        description: 'Equipo no enciende; se revisó fuente y placa.',
        status: 'entregado',
        priority: 'high',
        urgency: 'urgent',
        estimatedCost: 180.00,
        finalCost: 175.00,
        laborCost: 50.00,
        technician: {
            name: 'Laura Mendez',
            id: 'TECH-004'
        },
        location: 'Taller Especializado',
        warranty: '30 días',
        createdAt: '2024-01-08T11:20:00Z',
        estimatedCompletion: '2024-01-09T17:00:00Z',
        completedAt: '2024-01-09T16:40:00Z',
        lastUpdate: '2024-01-09T16:40:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Se reemplazó módulo de encendido', timestamp: '2024-01-09T15:50:00Z', author: 'Laura Mendez' },
            { id: 2, text: 'Cliente reporta que no enciende al llevarlo a casa', timestamp: '2024-01-10T10:15:00Z', author: 'Recepción' }
        ],
        parts: [
            { id: 1, name: 'Módulo de encendido HP', cost: 120.00, quantity: 1, supplier: 'HP Authorized', partNumber: 'HP-PWR-015' }
        ],
        images: [],
        notifications: {
            customer: true,
            technician: true,
            manager: true
        }
    },
    {
        id: 'REP-012',
        customer: {
            name: 'Lucía Romero',
            phone: '+1 234-567-8912',
            email: 'lucia.romero@email.com'
        },
        device: 'iPad Air 4',
        deviceType: 'tablet',
        brand: 'Apple',
        model: 'Air 4',
        issue: 'Pantalla parpadea',
        description: 'Parpadeo intermitente en pantalla; se cambió flex y se probó.',
        status: 'entregado',
        priority: 'medium',
        urgency: 'normal',
        estimatedCost: 150.00,
        finalCost: 155.00,
        laborCost: 35.00,
        technician: {
            name: 'Miguel Torres',
            id: 'TECH-003'
        },
        location: 'Taller Principal',
        warranty: '90 días',
        createdAt: '2024-01-07T09:30:00Z',
        estimatedCompletion: '2024-01-08T16:00:00Z',
        completedAt: '2024-01-08T15:10:00Z',
        lastUpdate: '2024-01-08T15:10:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Cambio de flex y ajuste de pantalla', timestamp: '2024-01-08T13:40:00Z', author: 'Miguel Torres' },
            { id: 2, text: 'Cliente comenta que sigue fallando con parpadeo', timestamp: '2024-01-09T09:00:00Z', author: 'Recepción' }
        ],
        parts: [
            { id: 1, name: 'Flex pantalla iPad Air 4', cost: 120.00, quantity: 1, supplier: 'Apple Parts', partNumber: 'IPAD-A4-FLEX' }
        ],
        images: [],
        notifications: {
            customer: true,
            technician: true,
            manager: false
        }
    },
    {
        id: 'REP-013',
        customer: { name: 'Diego Castro', phone: '+1 234-567-8913', email: 'diego.castro@email.com' },
        device: 'Huawei P40',
        deviceType: 'smartphone',
        brand: 'Huawei',
        model: 'P40',
        issue: 'Cambio de puerto de carga',
        description: 'Se reemplaza el puerto de carga por falsos contactos.',
        status: 'entregado',
        priority: 'medium',
        urgency: 'normal',
        estimatedCost: 110.00,
        finalCost: 115.00,
        laborCost: 30.00,
        technician: { name: 'Ana López', id: 'TECH-002' },
        location: 'Taller Principal',
        warranty: '60 días',
        createdAt: '2024-01-06T10:15:00Z',
        estimatedCompletion: '2024-01-07T16:00:00Z',
        completedAt: '2024-01-07T15:20:00Z',
        lastUpdate: '2024-01-07T15:20:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Pruebas OK en taller tras reemplazo', timestamp: '2024-01-07T14:30:00Z', author: 'Ana López' },
            { id: 2, text: 'Cliente dice que no carga al conectarlo en casa', timestamp: '2024-01-08T09:20:00Z', author: 'Recepción' }
        ],
        parts: [{ id: 1, name: 'Puerto de carga Huawei P40', cost: 75.00, quantity: 1, supplier: 'Huawei Parts', partNumber: 'HW-P40-USB' }],
        images: [],
        notifications: { customer: true, technician: true, manager: false }
    },
    {
        id: 'REP-014',
        customer: { name: 'Valentina Pérez', phone: '+1 234-567-8914', email: 'valentina.perez@email.com' },
        device: 'Google Pixel 7',
        deviceType: 'smartphone',
        brand: 'Google',
        model: 'Pixel 7',
        issue: 'Cámara principal no enfoca',
        description: 'Se cambia módulo de cámara por enfoque errático.',
        status: 'entregado',
        priority: 'medium',
        urgency: 'normal',
        estimatedCost: 160.00,
        finalCost: 165.00,
        laborCost: 35.00,
        technician: { name: 'Miguel Torres', id: 'TECH-003' },
        location: 'Taller Principal',
        warranty: '90 días',
        createdAt: '2024-01-05T09:00:00Z',
        estimatedCompletion: '2024-01-06T17:00:00Z',
        completedAt: '2024-01-06T16:15:00Z',
        lastUpdate: '2024-01-06T16:15:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Cámara reemplazada y pruebas de enfoque OK', timestamp: '2024-01-06T15:40:00Z', author: 'Miguel Torres' },
            { id: 2, text: 'Cliente reporta que sigue fallando el enfoque', timestamp: '2024-01-07T11:05:00Z', author: 'Recepción' }
        ],
        parts: [{ id: 1, name: 'Módulo cámara Pixel 7', cost: 130.00, quantity: 1, supplier: 'Google Parts', partNumber: 'PIX7-CAM-001' }],
        images: [],
        notifications: { customer: true, technician: true, manager: false }
    },
    {
        id: 'REP-015',
        customer: { name: 'Gabriel Álvarez', phone: '+1 234-567-8915', email: 'gabriel.alvarez@email.com' },
        device: 'Dell XPS 15',
        deviceType: 'laptop',
        brand: 'Dell',
        model: 'XPS 15',
        issue: 'Teclado no responde',
        description: 'Reemplazo de teclado tras derrame.',
        status: 'entregado',
        priority: 'high',
        urgency: 'urgent',
        estimatedCost: 220.00,
        finalCost: 230.00,
        laborCost: 60.00,
        technician: { name: 'Laura Mendez', id: 'TECH-004' },
        location: 'Taller Especializado',
        warranty: '60 días',
        createdAt: '2024-01-04T12:10:00Z',
        estimatedCompletion: '2024-01-05T18:00:00Z',
        completedAt: '2024-01-05T17:40:00Z',
        lastUpdate: '2024-01-05T17:40:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Teclado nuevo instalado; pruebas OK', timestamp: '2024-01-05T16:30:00Z', author: 'Laura Mendez' },
            { id: 2, text: 'Cliente comenta que sigue igual, algunas teclas no responden', timestamp: '2024-01-06T09:30:00Z', author: 'Recepción' }
        ],
        parts: [{ id: 1, name: 'Teclado Dell XPS 15', cost: 180.00, quantity: 1, supplier: 'Dell Authorized', partNumber: 'DELL-XPS15-KB' }],
        images: [],
        notifications: { customer: true, technician: true, manager: true }
    },
    {
        id: 'REP-016',
        customer: { name: 'Paula Ríos', phone: '+1 234-567-8916', email: 'paula.rios@email.com' },
        device: 'Lenovo ThinkPad T14',
        deviceType: 'laptop',
        brand: 'Lenovo',
        model: 'ThinkPad T14',
        issue: 'No carga',
        description: 'Se reemplaza conector DC y se revisa placa.',
        status: 'entregado',
        priority: 'medium',
        urgency: 'normal',
        estimatedCost: 140.00,
        finalCost: 145.00,
        laborCost: 40.00,
        technician: { name: 'Carlos Rodríguez', id: 'TECH-001' },
        location: 'Taller Principal',
        warranty: '60 días',
        createdAt: '2024-01-03T10:05:00Z',
        estimatedCompletion: '2024-01-04T16:00:00Z',
        completedAt: '2024-01-04T15:30:00Z',
        lastUpdate: '2024-01-04T15:30:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Conector DC reemplazado; carga OK en taller', timestamp: '2024-01-04T14:50:00Z', author: 'Carlos Rodríguez' },
            { id: 2, text: 'Cliente indica que no carga en su adaptador original', timestamp: '2024-01-05T10:10:00Z', author: 'Recepción' }
        ],
        parts: [{ id: 1, name: 'Conector DC Lenovo T14', cost: 95.00, quantity: 1, supplier: 'Lenovo Parts', partNumber: 'LNV-T14-DC' }],
        images: [],
        notifications: { customer: true, technician: true, manager: false }
    },
    {
        id: 'REP-017',
        customer: { name: 'Martín Suárez', phone: '+1 234-567-8917', email: 'martin.suarez@email.com' },
        device: 'HP OMEN Desktop',
        deviceType: 'desktop',
        brand: 'HP',
        model: 'OMEN 30L',
        issue: 'No enciende',
        description: 'Cambio de fuente de poder y verificación de GPU.',
        status: 'entregado',
        priority: 'high',
        urgency: 'urgent',
        estimatedCost: 240.00,
        finalCost: 235.00,
        laborCost: 70.00,
        technician: { name: 'Luis Técnico', id: 'TECH-003' },
        location: 'Taller Especializado',
        warranty: '30 días',
        createdAt: '2024-01-02T13:00:00Z',
        estimatedCompletion: '2024-01-03T18:00:00Z',
        completedAt: '2024-01-03T17:50:00Z',
        lastUpdate: '2024-01-03T17:50:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Fuente reemplazada; arranca en taller', timestamp: '2024-01-03T17:10:00Z', author: 'Luis Técnico' },
            { id: 2, text: 'Cliente reporta que no prende al llegar a casa', timestamp: '2024-01-04T09:45:00Z', author: 'Recepción' }
        ],
        parts: [
            { id: 1, name: 'Fuente 750W HP', cost: 160.00, quantity: 1, supplier: 'HP Authorized', partNumber: 'HP-PSU-750' }
        ],
        images: [],
        notifications: { customer: true, technician: true, manager: true }
    },
    {
        id: 'REP-018',
        customer: { name: 'Natalia Fuentes', phone: '+1 234-567-8918', email: 'natalia.fuentes@email.com' },
        device: 'Samsung Galaxy Tab S7',
        deviceType: 'tablet',
        brand: 'Samsung',
        model: 'Tab S7',
        issue: 'Pantalla se congela',
        description: 'Se actualiza firmware y se reemplaza flex de pantalla.',
        status: 'entregado',
        priority: 'medium',
        urgency: 'normal',
        estimatedCost: 180.00,
        finalCost: 185.00,
        laborCost: 45.00,
        technician: { name: 'Ana López', id: 'TECH-002' },
        location: 'Taller Principal',
        warranty: '60 días',
        createdAt: '2024-01-02T09:40:00Z',
        estimatedCompletion: '2024-01-03T17:00:00Z',
        completedAt: '2024-01-03T16:20:00Z',
        lastUpdate: '2024-01-03T16:20:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Pruebas OK en taller tras reemplazo de flex', timestamp: '2024-01-03T15:30:00Z', author: 'Ana López' },
            { id: 2, text: 'Cliente indica que sigue fallando, pantalla se congela a veces', timestamp: '2024-01-04T10:15:00Z', author: 'Recepción' }
        ],
        parts: [{ id: 1, name: 'Flex pantalla Tab S7', cost: 130.00, quantity: 1, supplier: 'Samsung Parts', partNumber: 'TAB-S7-FLEX' }],
        images: [],
        notifications: { customer: true, technician: true, manager: false }
    },
    {
        id: 'REP-019',
        customer: { name: 'Elena Vargas', phone: '+1 234-567-8919', email: 'elena.vargas@email.com' },
        device: 'AirPods Pro',
        deviceType: 'accessory',
        brand: 'Apple',
        model: 'AirPods Pro (1ra gen)',
        issue: 'No se escuchan bien',
        description: 'Se limpia y reemplaza malla acústica, se prueba emparejamiento.',
        status: 'entregado',
        priority: 'low',
        urgency: 'normal',
        estimatedCost: 70.00,
        finalCost: 75.00,
        laborCost: 20.00,
        technician: { name: 'Miguel Torres', id: 'TECH-003' },
        location: 'Taller Principal',
        warranty: '30 días',
        createdAt: '2024-01-01T08:50:00Z',
        estimatedCompletion: '2024-01-01T17:00:00Z',
        completedAt: '2024-01-01T16:30:00Z',
        lastUpdate: '2024-01-01T16:30:00Z',
        progress: 100,
        customerRating: null,
        notes: [
            { id: 1, text: 'Limpieza y pruebas OK en taller', timestamp: '2024-01-01T15:40:00Z', author: 'Miguel Torres' },
            { id: 2, text: 'Cliente reporta que siguen sin sincronizar y no se escuchan bien', timestamp: '2024-01-02T10:00:00Z', author: 'Recepción' }
        ],
        parts: [{ id: 1, name: 'Malla acústica AirPods', cost: 50.00, quantity: 2, supplier: 'Apple Parts', partNumber: 'AP-AUDIO-MESH' }],
        images: [],
        notifications: { customer: true, technician: true, manager: false }
    }
]

export const statusConfig: Record<RepairStatus, StatusConfigItem> = {
    recibido: {
        label: 'Recibido',
        color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        icon: Clock,
        bgColor: 'bg-amber-500',
        lightBg: 'bg-amber-100',
        columnBg: 'bg-amber-50/50 dark:bg-amber-950/20'
    },
    diagnostico: {
        label: 'Diagnóstico',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
        icon: Activity,
        bgColor: 'bg-indigo-500',
        lightBg: 'bg-indigo-100',
        columnBg: 'bg-indigo-50/50 dark:bg-indigo-950/20'
    },
    reparacion: {
        label: 'En Reparación',
        color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
        icon: PlayCircle,
        bgColor: 'bg-blue-500',
        lightBg: 'bg-blue-100',
        columnBg: 'bg-blue-50/50 dark:bg-blue-950/20'
    },
    pausado: {
        label: 'Pausado',
        color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
        icon: PauseCircle,
        bgColor: 'bg-purple-500',
        lightBg: 'bg-purple-100',
        columnBg: 'bg-purple-50/50 dark:bg-purple-950/20'
    },
    listo: {
        label: 'Listo para Entrega',
        color: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
        icon: Package,
        bgColor: 'bg-cyan-500',
        lightBg: 'bg-cyan-100',
        columnBg: 'bg-cyan-50/50 dark:bg-cyan-950/20'
    },
    entregado: {
        label: 'Entregado',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        icon: CheckCircle,
        bgColor: 'bg-emerald-500',
        lightBg: 'bg-emerald-100',
        columnBg: 'bg-emerald-50/50 dark:bg-emerald-950/20'
    },
    cancelado: {
        label: 'Cancelado',
        color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
        icon: XCircle,
        bgColor: 'bg-red-500',
        lightBg: 'bg-red-100',
        columnBg: 'bg-red-50/50 dark:bg-red-950/20'
    }
}

export const wipLimits: Partial<Record<RepairStatus, number>> = {
    recibido: 6,
    diagnostico: 5,
    reparacion: 8,
    pausado: 4,
    listo: 12,
    entregado: 20,
    cancelado: 0,
}

export const priorityConfig: Record<string, PriorityConfigItem> = {
    low: {
        label: 'Baja',
        color: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700',
        bgColor: 'bg-slate-400',
        icon: '●'
    },
    medium: {
        label: 'Media',
        color: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
        bgColor: 'bg-orange-500',
        icon: '●●'
    },
    high: {
        label: 'Alta',
        color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
        bgColor: 'bg-red-500',
        icon: '●●●'
    }
}

export const urgencyConfig: Record<string, UrgencyConfigItem> = {
    normal: {
        label: 'Normal',
        color: 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
        icon: Activity
    },
    urgent: {
        label: 'Urgente',
        color: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
        icon: Zap
    }
}

export const deviceTypeConfig: Record<string, DeviceTypeConfigItem> = {
    smartphone: { label: 'Smartphone', icon: Smartphone },
    tablet: { label: 'Tablet', icon: Tablet },
    laptop: { label: 'Laptop', icon: Laptop },
    desktop: { label: 'Desktop', icon: Monitor },
    accessory: { label: 'Accesorio', icon: Package }
}

// Mapeos eliminados - ya no son necesarios porque usamos español directamente

