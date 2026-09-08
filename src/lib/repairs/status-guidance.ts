import type { RepairStatus } from '@/types/repairs'

const FLOW: RepairStatus[] = ['recibido', 'diagnostico', 'reparacion', 'listo', 'entregado']

const GUIDANCE: Record<RepairStatus, {
  currentDescription: string
  recommended: RepairStatus | null
  actionLabel: string
  actionDescription: string
}> = {
  recibido: {
    currentDescription: 'El equipo fue recibido y está pendiente de revisión técnica.',
    recommended: 'diagnostico',
    actionLabel: 'Iniciar diagnóstico',
    actionDescription: 'Comenzá la revisión para registrar el diagnóstico del equipo.',
  },
  diagnostico: {
    currentDescription: 'El equipo está en diagnóstico para definir el trabajo necesario.',
    recommended: 'reparacion',
    actionLabel: 'Iniciar reparación',
    actionDescription: 'Iniciá el trabajo cuando el diagnóstico esté listo y haya un técnico asignado.',
  },
  reparacion: {
    currentDescription: 'El técnico está trabajando en el equipo.',
    recommended: 'listo',
    actionLabel: 'Marcar como listo',
    actionDescription: 'Marcá como listo únicamente después de comprobar que el trabajo terminó correctamente.',
  },
  pausado: {
    currentDescription: 'El trabajo está detenido temporalmente y todavía no está listo para entregar.',
    recommended: 'reparacion',
    actionLabel: 'Reanudar reparación',
    actionDescription: 'Reanudá la reparación cuando desaparezca el motivo de la pausa.',
  },
  listo: {
    currentDescription: 'El trabajo terminó y el equipo puede prepararse para el retiro.',
    recommended: 'entregado',
    actionLabel: 'Cobrar y entregar',
    actionDescription: 'Abrí el proceso de cobro y entrega para registrar correctamente el retiro del equipo.',
  },
  entregado: {
    currentDescription: 'El equipo ya fue entregado. El estado operativo está cerrado.',
    recommended: null,
    actionLabel: '',
    actionDescription: '',
  },
  cancelado: {
    currentDescription: 'La reparación fue cancelada y no continuará en el flujo normal.',
    recommended: null,
    actionLabel: '',
    actionDescription: '',
  },
}

export function getRepairStatusGuidance(status: RepairStatus) {
  const guidance = GUIDANCE[status]

  return {
    ...guidance,
    requiresConfirmation(next: RepairStatus) {
      if (next === 'cancelado') return true
      const currentIndex = FLOW.indexOf(status)
      const nextIndex = FLOW.indexOf(next)
      return currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex
    },
  }
}
