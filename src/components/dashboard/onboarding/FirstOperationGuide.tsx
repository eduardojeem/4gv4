'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const guides = {
  sale: ['Elegí producto o servicio y cantidad. El cliente puede ser consumidor final cuando POS lo permita.', 'Revisá el importe, descuentos y forma de cobro. Usá una caja abierta cuando el flujo lo requiera.', 'Confirmá solo una operación real. Una venta a crédito no significa dinero recibido.', 'Revisá el comprobante y el movimiento registrado antes de repetir una solicitud.'],
  reservation: ['Elegí servicio, horario y profesional cuando corresponda.', 'Revisá cliente, precio y condiciones antes de confirmar la reserva.', 'Registrá la atención cuando el servicio se realice: reservar no significa cobrar.', 'El cobro se registra por el circuito disponible del negocio, no por crear el turno.'],
  repair: ['Registrá cliente, equipo y estado de recepción.', 'Revisá presupuesto, servicio y técnico cuando corresponda.', 'Completá diagnóstico, trabajo y entrega mediante sus acciones reales.', 'Registrar recepción no cobra dinero. Revisá el cobro y comprobante por separado.'],
} as const
export function FirstOperationGuide({ kind }: { kind: keyof typeof guides }) {
  const [demo, setDemo] = useState(false)
  const [step, setStep] = useState(0)
  const steps = guides[kind]
  return <details className="rounded-lg border border-primary/30 p-3 text-sm">
    <summary className="min-h-11 cursor-pointer font-medium">Cómo comenzar tu primera operación</summary>
    <ol className="mt-2 list-decimal space-y-2 pl-5">{steps.map(text => <li key={text}>{text}</li>)}</ol>
    <p className="mt-3 text-muted-foreground">Esta ayuda no guarda, cobra, abre caja ni modifica stock. Revisá siempre los datos del formulario real.</p>
    {!demo ? <Button className="mt-3 min-h-11" variant="outline" onClick={() => { setDemo(true); setStep(0) }}>Ver demostración</Button> : <div className="mt-3 space-y-3 rounded-md bg-muted p-3">
      <p className="font-semibold">Demostración: no registra operaciones</p>
      <p>Ejemplo {step + 1} de {steps.length}: {steps[step]}</p>
      <div className="flex flex-wrap gap-2">{step < steps.length - 1 && <Button variant="outline" onClick={() => setStep(value => value + 1)}>Siguiente ejemplo</Button>}<Button variant="ghost" onClick={() => { setDemo(false); setStep(0) }}>Cerrar demostración</Button></div>
    </div>}
  </details>
}
