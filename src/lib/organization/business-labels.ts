import type { BusinessVertical, OperatingModel } from './business-profile'

/** Nombres de rubro que ve el dueño: los mismos en el onboarding y en Configuración. */
export const BUSINESS_VERTICAL_LABELS: Record<BusinessVertical, string> = {
  general: 'Comercio general',
  clothing: 'Ropa y moda',
  barbershop: 'Barbería y peluquería',
  beauty_services: 'Belleza y cuidado personal',
  cosmetics: 'Cosmética y belleza',
  electronics: 'Electrónica y tecnología',
  food: 'Alimentos',
  hardware: 'Ferretería',
  other: 'Otro rubro',
}

export const OPERATING_MODEL_LABELS: Record<OperatingModel, string> = {
  retail: 'Venta minorista',
  wholesale: 'Venta mayorista',
  service: 'Prestación de servicios',
  repair: 'Taller y reparaciones',
  mixed: 'Negocio mixto',
}
