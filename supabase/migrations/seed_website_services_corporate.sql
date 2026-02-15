BEGIN;

UPDATE website_settings SET value = '[
  {
    "id": "screens",
    "title": "Reemplazo profesional de pantallas",
    "description": "Suministro e instalación de pantallas originales con garantía, calibración de color y pruebas de tactilidad.",
    "icon": "wrench",
    "color": "blue",
    "benefits": [
      "Repuestos originales certificados",
      "Instalación en menos de 1 hora",
      "Calibración de brillo y color",
      "Pruebas de táctil y sensores",
      "Garantía real de 6 meses",
      "Protector de pantalla de cortesía"
    ]
  },
  {
    "id": "battery",
    "title": "Cambio de batería certificado",
    "description": "Baterías de alto rendimiento con control de calidad, diagnóstico de consumo y seguridad reforzada.",
    "icon": "package",
    "color": "green",
    "benefits": [
      "Baterías certificadas de fábrica",
      "Test de capacidad y ciclos",
      "Optimización de consumo energético",
      "Garantía de 6 meses",
      "Sellado y estándares de seguridad",
      "Reporte de salud de la batería"
    ]
  },
  {
    "id": "software",
    "title": "Soluciones avanzadas de software",
    "description": "Actualización, optimización, limpieza de malware y recuperación de datos con procedimientos seguros.",
    "icon": "shield",
    "color": "purple",
    "benefits": [
      "Diagnóstico sin costo",
      "Optimización de rendimiento",
      "Eliminación de malware",
      "Recuperación de datos",
      "Actualizaciones seguras",
      "Respaldo previo de información"
    ]
  }
]'::jsonb,
updated_at = NOW()
WHERE key = 'services';

COMMIT;

