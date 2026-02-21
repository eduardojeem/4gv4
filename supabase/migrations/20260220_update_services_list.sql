-- Update services list with more options and better icons
UPDATE website_settings
SET value = '[
  {
    "id": "screens",
    "title": "Reparación de Pantallas",
    "description": "Reemplazo de pantallas rotas, táctil que no responde o imagen dañada. Repuestos originales y alternativos de alta calidad.",
    "icon": "monitor",
    "color": "blue",
    "benefits": ["Garantía escrita", "Instalación en 1 hora", "Vidrio templado de regalo"]
  },
  {
    "id": "battery",
    "title": "Cambio de Batería",
    "description": "Baterías certificadas para recuperar la autonomía de tu equipo. Solución para reinicios y descargas rápidas.",
    "icon": "battery",
    "color": "green",
    "benefits": ["Baterías Premium", "Garantía de 6 meses", "Instalación en 30 min"]
  },
  {
    "id": "charging",
    "title": "Puerto de Carga",
    "description": "Reparación de problemas de carga, falso contacto o pin dañado. Limpieza profunda y mantenimiento.",
    "icon": "zap",
    "color": "yellow",
    "benefits": ["Soldadura reforzada", "Prueba de amperaje", "Limpieza de conectores"]
  },
  {
    "id": "software",
    "title": "Software y Desbloqueo",
    "description": "Actualización de sistema, eliminación de virus, recuperación de cuenta Google/iCloud y liberación de redes.",
    "icon": "cpu",
    "color": "purple",
    "benefits": ["Sin pérdida de datos", "Últimas versiones", "Soporte remoto"]
  },
  {
    "id": "water_damage",
    "title": "Daños por Agua",
    "description": "Limpieza química ultrasónica para recuperar equipos mojados o sulfatados. Diagnóstico de placa madre.",
    "icon": "droplet",
    "color": "cyan",
    "benefits": ["Baño químico", "Microscopía", "Recuperación de info"]
  },
  {
    "id": "camera",
    "title": "Cámaras y Lentes",
    "description": "Reemplazo de cámaras borrosas, rotas o con manchas. Cambio de cristal de cámara trasero.",
    "icon": "camera",
    "color": "red",
    "benefits": ["Enfoque original", "Limpieza de lentes", "Prueba de estabilización"]
  },
  {
    "id": "microsoldering",
    "title": "Microsoldadura",
    "description": "Reparaciones avanzadas de placa: IC de carga, Touch, Audio, Señal y cortos en placa principal.",
    "icon": "microchip",
    "color": "orange",
    "benefits": ["Laboratorio propio", "Esquemáticos oficiales", "Garantía extendida"]
  },
  {
    "id": "accessories",
    "title": "Accesorios y Protección",
    "description": "Venta de fundas, cargadores, cables certificados y protección hidrogel para todas las marcas.",
    "icon": "smartphone",
    "color": "pink",
    "benefits": ["Marcas originales", "Instalación sin cargo", "Variedad de modelos"]
  }
]'::jsonb
WHERE key = 'services';
