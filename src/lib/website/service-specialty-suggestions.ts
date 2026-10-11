import { SERVICE_SPECIALTY_LABELS, type ServiceSpecialty } from '@/lib/organization/service-specialties'
const EXAMPLES: Record<ServiceSpecialty, string[]> = {
  barbering: ['Corte de cabello', 'Perfilado de barba'], hair: ['Peinado', 'Coloración'],
  nails: ['Manicura', 'Pedicura'], lashes: ['Extensiones de pestañas', 'Lifting de pestañas'],
  brows: ['Diseño de cejas', 'Laminado de cejas'], makeup: ['Maquillaje social', 'Maquillaje para eventos'],
  aesthetics: ['Limpieza facial', 'Cuidado facial'], other: [],
}
export function getServiceSpecialtySuggestions(specialties: readonly ServiceSpecialty[]): Array<{ title: string; category: string }> {
  return [...new Set(specialties)].flatMap(s => EXAMPLES[s].map(title => ({ title, category: SERVICE_SPECIALTY_LABELS[s] })))
}
