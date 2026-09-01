'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSharedSettings } from '@/hooks/use-shared-settings'
import {
  readCreditPaperFormat,
  writeCreditPaperFormat,
  type CreditPaperFormat,
} from '@/lib/credits/paper'

/**
 * Datos del emisor y formato de papel para todo lo que se imprime en creditos.
 *
 * Existe para que los tres puntos que imprimen — el comprobante del dialogo de
 * pago, el de la linea de tiempo y el estado de cuenta — no vuelvan a divergir.
 * El comprobante de pago salia sin nombre de comercio porque cada pantalla
 * armaba su propia entrada y ninguna se acordaba de incluirlo.
 */
export type CreditIssuer = {
  businessName: string
  businessRuc?: string
  businessPhone?: string
  businessAddress?: string
}

export function useCreditPrinting() {
  const { settings } = useSharedSettings()
  const [format, setFormat] = useState<CreditPaperFormat>('80mm')

  // La preferencia se lee despues del montaje: en el servidor no hay
  // localStorage, y leerla durante el render daria un HTML distinto al del
  // cliente.
  useEffect(() => {
    setFormat(readCreditPaperFormat())
  }, [])

  const changeFormat = useCallback((next: CreditPaperFormat) => {
    setFormat(next)
    writeCreditPaperFormat(next)
  }, [])

  const issuer: CreditIssuer = {
    businessName: settings.companyName,
    businessRuc: settings.companyRuc || undefined,
    businessPhone: settings.companyPhone || undefined,
    businessAddress: settings.companyAddress || undefined,
  }

  return { format, changeFormat, issuer }
}
