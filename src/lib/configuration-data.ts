import { ConfigurationGroup } from '@/types/settings'

export const configurationGroups: ConfigurationGroup[] = [
  {
    id: 'appearance',
    title: 'Apariencia',
    description: 'Personaliza la apariencia y temas del sistema',
    icon: 'Palette',
    searchKeywords: ['tema', 'color', 'apariencia', 'diseño', 'interfaz', 'modo oscuro', 'claro'],
    sections: [
      {
        id: 'theme',
        title: 'Tema y Colores',
        description: 'Configura el tema y esquema de colores',
        component: 'ThemeSettings',
        settings: [
          {
            id: 'theme-mode',
            key: 'theme.mode',
            title: 'Modo de Tema',
            description: 'Selecciona el modo de tema preferido',
            type: 'select',
            value: 'system',
            defaultValue: 'system',
            options: [
              { label: 'Claro', value: 'light' },
              { label: 'Oscuro', value: 'dark' },
              { label: 'Sistema', value: 'system' }
            ],
            searchKeywords: ['tema', 'modo', 'claro', 'oscuro', 'sistema'],
            category: 'appearance'
          },
          {
            id: 'color-scheme',
            key: 'theme.colorScheme',
            title: 'Esquema de Color',
            description: 'Elige el esquema de color principal',
            type: 'select',
            value: 'default',
            defaultValue: 'default',
            options: [
              { label: 'Por Defecto', value: 'default' },
              { label: 'Azul', value: 'blue' },
              { label: 'Verde', value: 'green' },
              { label: 'Púrpura', value: 'purple' },
              { label: 'Naranja', value: 'orange' },
              { label: 'Rojo', value: 'red' },
              { label: 'Corporativo', value: 'corporate' },
              { label: 'Índigo', value: 'indigo' },
              { label: 'Turquesa', value: 'teal' },
              { label: 'Rosa', value: 'pink' },
              { label: 'Ámbar', value: 'amber' },
              { label: 'Cian', value: 'cyan' },
              { label: 'Personalizado', value: 'custom' }
            ],
            searchKeywords: ['color', 'esquema', 'azul', 'verde', 'púrpura', 'naranja', 'rojo'],
            category: 'appearance'
          }
        ]
      }
    ]
  },
  {
    id: 'system',
    title: 'Sistema',
    description: 'Configuraciones generales del sistema',
    icon: 'Settings',
    searchKeywords: ['sistema', 'general', 'configuración', 'moneda', 'impuestos', 'sesión'],
    sections: [
      {
        id: 'general',
        title: 'Configuración General',
        description: 'Configuraciones básicas del sistema',
        component: 'GeneralSettings',
        settings: [
          {
            id: 'demo-no-db',
            key: 'system.demoNoDb',
            title: 'Modo demo sin Base de Datos',
            description: 'No persistir datos en Supabase (solo estado local)',
            type: 'boolean',
            value: false,
            defaultValue: false,
            searchKeywords: ['demo', 'sin bd', 'supabase', 'persistencia', 'base de datos'],
            category: 'system'
          },
          {
            id: 'company-name',
            key: 'system.companyName',
            title: 'Nombre de la Empresa',
            description: 'Nombre que aparecerá en reportes y documentos',
            type: 'text',
            value: 'Mi Empresa',
            defaultValue: 'Mi Empresa',
            validation: { required: true },
            searchKeywords: ['empresa', 'nombre', 'compañía'],
            category: 'system'
          },
          {
            id: 'currency',
            key: 'system.currency',
            title: 'Moneda',
            description: 'Moneda principal del sistema',
            type: 'select',
            value: 'PYG',
            defaultValue: 'PYG',
            options: [
              { label: 'PYG - Guaraní Paraguayo', value: 'PYG' },
              { label: 'USD - Dólar', value: 'USD' },
              { label: 'EUR - Euro', value: 'EUR' },
              { label: 'MXN - Peso Mexicano', value: 'MXN' },
              { label: 'COP - Peso Colombiano', value: 'COP' }
            ],
            searchKeywords: ['moneda', 'divisa', 'guaraní', 'dólar', 'euro', 'peso'],
            category: 'system'
          },
          {
            id: 'tax-rate',
            key: 'system.taxRate',
            title: 'Tasa de Impuesto (%)',
            description: 'Tasa de impuesto por defecto',
            type: 'number',
            value: 10,
            defaultValue: 10,
            validation: { min: 0, max: 100 },
            searchKeywords: ['impuesto', 'tasa', 'iva', 'porcentaje'],
            category: 'system'
          },
          {
            id: 'session-timeout',
            key: 'system.sessionTimeout',
            title: 'Tiempo de Sesión (minutos)',
            description: 'Tiempo antes de cerrar sesión automáticamente',
            type: 'number',
            value: 60,
            defaultValue: 60,
            validation: { min: 5, max: 480 },
            searchKeywords: ['sesión', 'tiempo', 'logout', 'expiración'],
            category: 'system'
          }
        ]
      },
      {
        id: 'inventory',
        title: 'Inventario',
        description: 'Configuraciones relacionadas con el inventario',
        component: 'InventorySettings',
        settings: [
          {
            id: 'low-stock-threshold',
            key: 'inventory.lowStockThreshold',
            title: 'Umbral de Stock Bajo',
            description: 'Cantidad mínima antes de alertar stock bajo',
            type: 'number',
            value: 10,
            defaultValue: 10,
            validation: { min: 1 },
            searchKeywords: ['stock', 'inventario', 'umbral', 'mínimo', 'alerta'],
            category: 'system',
            subcategory: 'inventory'
          }
        ]
      }
    ]
  },
  {
    id: 'notifications',
    title: 'Notificaciones',
    description: 'Configura alertas y notificaciones',
    icon: 'Bell',
    searchKeywords: ['notificaciones', 'alertas', 'email', 'sms', 'avisos'],
    sections: [
      {
        id: 'email',
        title: 'Notificaciones por Email',
        description: 'Configurar notificaciones por correo electrónico',
        component: 'EmailNotifications',
        settings: [
          {
            id: 'email-notifications',
            key: 'notifications.email.enabled',
            title: 'Habilitar Email',
            description: 'Recibir notificaciones importantes por email',
            type: 'boolean',
            value: true,
            defaultValue: true,
            searchKeywords: ['email', 'correo', 'notificaciones', 'habilitar'],
            category: 'notifications'
          }
        ]
      },
      {
        id: 'sms',
        title: 'Notificaciones por SMS',
        description: 'Configurar alertas por mensaje de texto',
        component: 'SmsNotifications',
        settings: [
          {
            id: 'sms-notifications',
            key: 'notifications.sms.enabled',
            title: 'Habilitar SMS',
            description: 'Recibir alertas críticas por SMS',
            type: 'boolean',
            value: false,
            defaultValue: false,
            searchKeywords: ['sms', 'mensaje', 'texto', 'alertas', 'críticas'],
            category: 'notifications'
          }
        ]
      }
    ]
  },
  {
    id: 'catalog',
    title: 'Catálogo',
    description: 'Gestión de categorías, marcas y proveedores',
    icon: 'Package',
    searchKeywords: ['catálogo', 'categorías', 'marcas', 'proveedores', 'productos'],
    sections: [
      {
        id: 'categories',
        title: 'Categorías',
        description: 'Gestionar categorías de productos',
        component: 'CategoryManagement',
        settings: []
      },
      {
        id: 'brands',
        title: 'Marcas',
        description: 'Gestionar marcas de productos',
        component: 'BrandManagement',
        settings: []
      },
      {
        id: 'suppliers',
        title: 'Proveedores',
        description: 'Gestionar proveedores',
        component: 'SupplierManagement',
        settings: []
      }
    ]
  },
  {
    id: 'security',
    title: 'Seguridad',
    description: 'Configuraciones de seguridad y acceso',
    icon: 'Shield',
    searchKeywords: ['seguridad', 'contraseña', 'acceso', 'autenticación', 'permisos'],
    sections: [
      {
        id: 'authentication',
        title: 'Autenticación',
        description: 'Configurar métodos de autenticación',
        component: 'AuthenticationSettings',
        permissions: ['admin'],
        settings: [
          {
            id: 'password-min-length',
            key: 'security.passwordMinLength',
            title: 'Longitud Mínima de Contraseña',
            description: 'Número mínimo de caracteres para contraseñas',
            type: 'number',
            value: 8,
            defaultValue: 8,
            validation: { min: 6, max: 32 },
            searchKeywords: ['contraseña', 'longitud', 'mínima', 'caracteres'],
            category: 'security'
          },
          {
            id: 'require-special-chars',
            key: 'security.requireSpecialChars',
            title: 'Requerir Caracteres Especiales',
            description: 'Las contraseñas deben incluir caracteres especiales',
            type: 'boolean',
            value: true,
            defaultValue: true,
            searchKeywords: ['contraseña', 'caracteres', 'especiales', 'requerir'],
            category: 'security'
          }
        ]
      }
    ]
  },
  {
    id: 'backup',
    title: 'Respaldos',
    description: 'Configuración de respaldos y recuperación',
    icon: 'Database',
    searchKeywords: ['respaldo', 'backup', 'recuperación', 'automático', 'datos'],
    sections: [
      {
        id: 'automatic',
        title: 'Respaldo Automático',
        description: 'Configurar respaldos automáticos',
        component: 'BackupSettings',
        permissions: ['admin'],
        settings: [
          {
            id: 'auto-backup',
            key: 'backup.autoBackup',
            title: 'Respaldo Automático',
            description: 'Crear respaldos automáticos diarios',
            type: 'boolean',
            value: true,
            defaultValue: true,
            searchKeywords: ['respaldo', 'automático', 'diario', 'backup'],
            category: 'backup'
          }
        ]
      }
    ]
  },
  {
    id: 'accessibility',
    title: 'Accesibilidad',
    description: 'Configuraciones para mejorar la accesibilidad y usabilidad',
    icon: 'accessibility',
    color: 'purple',
    sections: [
      {
        id: 'visual-accessibility',
        title: 'Accesibilidad Visual',
        description: 'Configuraciones para mejorar la visibilidad',
        settings: [
          {
            id: 'high-contrast',
            title: 'Alto Contraste',
            description: 'Aumenta el contraste para mejor visibilidad',
            type: 'boolean',
            defaultValue: false,
            category: 'accessibility'
          },
          {
            id: 'font-size',
            title: 'Tamaño de Fuente',
            description: 'Ajusta el tamaño de fuente global',
            type: 'select',
            defaultValue: 'medium',
            options: [
              { value: 'small', label: 'Pequeño (14px)' },
              { value: 'medium', label: 'Mediano (16px)' },
              { value: 'large', label: 'Grande (18px)' },
              { value: 'extra-large', label: 'Extra Grande (20px)' }
            ],
            category: 'accessibility'
          },
          {
            id: 'focus-indicator',
            title: 'Indicadores de Foco Mejorados',
            description: 'Resalta elementos enfocados para navegación por teclado',
            type: 'boolean',
            defaultValue: true,
            category: 'accessibility'
          },
          {
            id: 'color-blind-friendly',
            title: 'Amigable para Daltonismo',
            description: 'Usa patrones y símbolos además de colores',
            type: 'boolean',
            defaultValue: false,
            category: 'accessibility'
          }
        ]
      },
      {
        id: 'interaction-accessibility',
        title: 'Accesibilidad de Interacción',
        description: 'Configuraciones para mejorar la navegación e interacción',
        settings: [
          {
            id: 'reduced-motion',
            title: 'Movimiento Reducido',
            description: 'Reduce animaciones y transiciones',
            type: 'boolean',
            defaultValue: false,
            category: 'accessibility'
          },
          {
            id: 'keyboard-navigation',
            title: 'Navegación por Teclado',
            description: 'Habilita navegación completa por teclado',
            type: 'boolean',
            defaultValue: true,
            category: 'accessibility'
          },
          {
            id: 'screen-reader-optimized',
            title: 'Optimización para Lectores de Pantalla',
            description: 'Mejora la compatibilidad con tecnologías asistivas',
            type: 'boolean',
            defaultValue: false,
            category: 'accessibility'
          }
        ]
      }
    ]
  }
]