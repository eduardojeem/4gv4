import { renderBrandedEmail, BRAND_COLOR_HEX } from './resend'

interface BrandInfo {
  name: string
  color?: string
  logoUrl?: string
}

// ---------------------------------------------------------------------------
// 1. Email de bienvenida al registrar empresa
// ---------------------------------------------------------------------------

export function renderWelcomeEmail(params: {
  ownerName: string
  companyName: string
  plan: string
  loginUrl: string
  brand?: BrandInfo
}) {
  const { ownerName, companyName, plan, loginUrl, brand } = params

  return renderBrandedEmail({
    title: `¡Bienvenido a la plataforma!`,
    preview: `Tu empresa ${companyName} está lista.`,
    intro: `Hola ${ownerName}, tu empresa "${companyName}" fue creada con éxito en el plan ${plan}.`,
    bodyHtml: `
      <p>Ya podés empezar a configurar tu negocio:</p>
      <ul style="padding-left:20px;margin:12px 0;">
        <li>Cargar productos al catálogo</li>
        <li>Configurar tu tienda pública</li>
        <li>Agregar miembros al equipo</li>
        <li>Activar el punto de venta</li>
      </ul>
      <p style="margin-top:16px;">Tu trial de 14 días ya comenzó. Aprovechá todas las funcionalidades sin límite.</p>
    `,
    cta: { label: 'Ir a mi dashboard', url: loginUrl },
    brand: {
      name: brand?.name || 'MiPOS',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
    footerNote: 'Si no creaste esta cuenta, podés ignorar este email.',
  })
}

// ---------------------------------------------------------------------------
// 3. Confirmación de pedido desde tienda pública
// ---------------------------------------------------------------------------

export function renderOrderConfirmationEmail(params: {
  customerName: string
  orderCode: string
  items: Array<{ name: string; quantity: number; price: number }>
  total: number
  currency?: string
  deliveryMethod: 'delivery' | 'pickup'
  estimatedTime?: string
  trackUrl?: string
  brand?: BrandInfo
}) {
  const { customerName, orderCode, items, total, currency = 'Gs.', deliveryMethod, estimatedTime, trackUrl, brand } = params

  const itemsHtml = items.map(item =>
    `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">${item.name}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;text-align:center;">${item.quantity}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;text-align:right;">${currency} ${item.price.toLocaleString('es-PY')}</td>
    </tr>`
  ).join('')

  const deliveryLabel = deliveryMethod === 'delivery' ? 'Delivery' : 'Retiro en local'

  return renderBrandedEmail({
    title: `Pedido confirmado #${orderCode}`,
    preview: `Tu pedido por ${currency} ${total.toLocaleString('es-PY')} fue confirmado.`,
    intro: `Hola ${customerName}, recibimos tu pedido correctamente.`,
    bodyHtml: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0;">
            <th style="padding:8px 0;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Producto</th>
            <th style="padding:8px 0;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;">Cant.</th>
            <th style="padding:8px 0;text-align:right;font-size:12px;color:#64748b;text-transform:uppercase;">Precio</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:10px 0;font-size:15px;font-weight:700;color:#0f172a;">Total</td>
            <td style="padding:10px 0;font-size:15px;font-weight:700;color:#0f172a;text-align:right;">${currency} ${total.toLocaleString('es-PY')}</td>
          </tr>
        </tfoot>
      </table>
      <p style="margin:12px 0;font-size:14px;color:#475569;">
        <strong>Método:</strong> ${deliveryLabel}
        ${estimatedTime ? `<br/><strong>Tiempo estimado:</strong> ${estimatedTime}` : ''}
      </p>
    `,
    cta: trackUrl ? { label: 'Rastrear mi pedido', url: trackUrl } : undefined,
    brand: {
      name: brand?.name || 'Tienda',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
    footerNote: `Pedido ${orderCode} · Si tenés dudas, respondé a este email.`,
  })
}

// ---------------------------------------------------------------------------
// 5. Recordatorio de pago para créditos vencidos
// ---------------------------------------------------------------------------

export function renderPaymentReminderEmail(params: {
  customerName: string
  amount: number
  currency?: string
  dueDate: string
  daysOverdue: number
  creditCode?: string
  paymentUrl?: string
  brand?: BrandInfo
}) {
  const { customerName, amount, currency = 'Gs.', dueDate, daysOverdue, creditCode, paymentUrl, brand } = params

  const urgencyColor = daysOverdue > 7 ? '#dc2626' : daysOverdue > 3 ? '#ea580c' : '#d97706'

  return renderBrandedEmail({
    title: 'Recordatorio de pago',
    preview: `Tenés un pago pendiente de ${currency} ${amount.toLocaleString('es-PY')}`,
    intro: `Hola ${customerName}, te recordamos que tenés un pago pendiente.`,
    bodyHtml: `
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin:16px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:14px;color:#475569;">Monto pendiente</td>
            <td style="font-size:20px;font-weight:700;color:${urgencyColor};text-align:right;">${currency} ${amount.toLocaleString('es-PY')}</td>
          </tr>
          <tr>
            <td style="font-size:14px;color:#475569;padding-top:8px;">Vencimiento</td>
            <td style="font-size:14px;color:#475569;text-align:right;padding-top:8px;">${dueDate}</td>
          </tr>
          ${daysOverdue > 0 ? `<tr>
            <td style="font-size:14px;color:${urgencyColor};padding-top:8px;font-weight:600;">Días de atraso</td>
            <td style="font-size:14px;color:${urgencyColor};text-align:right;padding-top:8px;font-weight:600;">${daysOverdue} días</td>
          </tr>` : ''}
          ${creditCode ? `<tr>
            <td style="font-size:12px;color:#94a3b8;padding-top:8px;">Referencia</td>
            <td style="font-size:12px;color:#94a3b8;text-align:right;padding-top:8px;">${creditCode}</td>
          </tr>` : ''}
        </table>
      </div>
      <p style="font-size:14px;color:#475569;">Regularizá tu pago para mantener tu línea de crédito activa.</p>
    `,
    cta: paymentUrl ? { label: 'Pagar ahora', url: paymentUrl } : undefined,
    brand: {
      name: brand?.name || 'Tienda',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
    footerNote: 'Si ya realizaste el pago, ignorá este mensaje.',
  })
}

// ---------------------------------------------------------------------------
// 4. Ciclo de regularizacion por baja de plan
// ---------------------------------------------------------------------------

/**
 * Aviso durante los 7 dias previos a la desactivacion.
 *
 * Se dice el numero exacto de productos en juego y los dias que quedan: un
 * aviso generico no mueve a nadie a actuar.
 */
export function renderPlanGraceWarningEmail(params: {
  companyName: string
  activeProducts: number
  productLimit: number
  daysLeft: number
  upgradeUrl: string
  brand?: BrandInfo
}) {
  const { companyName, activeProducts, productLimit, daysLeft, upgradeUrl, brand } = params
  const excess = Math.max(0, activeProducts - productLimit)
  const dayLabel = daysLeft === 1 ? '1 día' : `${daysLeft} días`

  return renderBrandedEmail({
    title: 'Actualizá tu plan para mantener todos tus productos',
    preview: `Te ${daysLeft === 1 ? 'queda' : 'quedan'} ${dayLabel} para regularizar tu suscripción.`,
    intro: `Hola, tu cuenta "${companyName}" tiene ${activeProducts} productos activos y tu plan actual permite ${productLimit}.`,
    bodyHtml: `
      <p><strong>Tenés ${dayLabel} para actualizar tu plan y mantener todos tus productos activos.</strong></p>
      <p>Si no regularizás tu suscripción dentro de este plazo, solo se mantendrán activos tus
      ${productLimit} productos más vendidos. Los ${excess} restantes se desactivarán, pero
      <strong>no se pierden</strong>: los recuperás en cuanto actualices el plan.</p>
    `,
    cta: { label: 'Actualizar mi plan', url: upgradeUrl },
    brand: {
      name: brand?.name || 'MiPOS',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
    footerNote: 'Tus ventas, reportes e historial no se ven afectados en ningún caso.',
  })
}

/** Aviso durante los 30 dias posteriores a la desactivacion. */
export function renderPlanDeactivatedEmail(params: {
  companyName: string
  deactivatedProducts: number
  productLimit: number
  daysLeft: number
  upgradeUrl: string
  brand?: BrandInfo
}) {
  const { companyName, deactivatedProducts, productLimit, daysLeft, upgradeUrl, brand } = params
  const dayLabel = daysLeft === 1 ? '1 día' : `${daysLeft} días`

  return renderBrandedEmail({
    title: 'Tenés productos desactivados por el límite de tu plan',
    preview: `Recuperá tus ${deactivatedProducts} productos actualizando el plan.`,
    intro: `Hola, en "${companyName}" quedaron ${deactivatedProducts} productos desactivados porque tu plan permite ${productLimit} activos.`,
    bodyHtml: `
      <p>Podés recuperarlos en cualquier momento: <strong>al actualizar el plan se reactivan
      automáticamente</strong>, tal como estaban.</p>
      <p>Te ${daysLeft === 1 ? 'queda' : 'quedan'} <strong>${dayLabel}</strong> para hacerlo. Pasado ese plazo, los productos
      desactivados se archivan y dejan de aparecer en tu catálogo.</p>
    `,
    cta: { label: 'Actualizar mi plan', url: upgradeUrl },
    brand: {
      name: brand?.name || 'MiPOS',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
    footerNote: 'Tu historial de ventas y tus reportes se conservan siempre.',
  })
}

// ---------------------------------------------------------------------------
// Débito automático de la suscripción rechazado
// ---------------------------------------------------------------------------

function escapeText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderAutopayFailedEmail(params: {
  companyName: string
  planName: string
  amountPyg: number
  attempt: number
  maxAttempts: number
  /** null cuando fue el último intento y el débito quedó suspendido. */
  nextAttemptAt: Date | null
  reason: string
  manageUrl: string
  brand?: BrandInfo
}) {
  const { companyName, planName, amountPyg, attempt, maxAttempts, nextAttemptAt, reason, manageUrl, brand } = params
  const amount = new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amountPyg)
  const nextDate = nextAttemptAt
    ? new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'long', timeZone: 'America/Asuncion' }).format(nextAttemptAt)
    : null

  return renderBrandedEmail({
    title: nextDate
      ? 'No pudimos cobrar tu suscripción'
      : 'Se suspendió el débito automático',
    preview: nextDate
      ? `Vamos a reintentar el ${nextDate}.`
      : 'Pagá a mano o actualizá tu tarjeta para no perder el plan.',
    intro: `Hola, intentamos cobrar ${amount} del plan ${planName} de "${companyName}" con la tarjeta guardada y no se pudo (intento ${attempt} de ${maxAttempts}).`,
    bodyHtml: `
      <p>Motivo informado: <strong>${escapeText(reason)}</strong></p>
      ${nextDate
        ? `<p>Vamos a reintentar automáticamente el <strong>${escapeText(nextDate)}</strong>. Si querés, podés
          cambiar la tarjeta o pagar ahora desde el panel.</p>`
        : `<p>Después de ${maxAttempts} intentos <strong>dejamos de cobrar automáticamente</strong>. Para mantener
          tu plan, pagá desde el panel o guardá otra tarjeta y volvé a activar el débito.</p>`}
    `,
    cta: { label: nextDate ? 'Revisar mi tarjeta' : 'Pagar o cambiar tarjeta', url: manageUrl },
    brand: {
      name: brand?.name || 'MiPOS',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
    footerNote: 'Tus datos y tu historial se conservan siempre.',
  })
}

// ---------------------------------------------------------------------------
// Pago de la suscripción por transferencia bancaria
// ---------------------------------------------------------------------------

function formatPyg(amount: number) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount)
}

/** Aviso al superadmin: llegó un comprobante para revisar. */
export function renderTransferReceiptSubmittedEmail(params: {
  companyName: string
  planName: string
  amountPyg: number
  reference: string
  operationReference: string | null
  reviewUrl: string
}) {
  const { companyName, planName, amountPyg, reference, operationReference, reviewUrl } = params
  return renderBrandedEmail({
    title: 'Comprobante de transferencia para revisar',
    preview: `${companyName} envió el comprobante del plan ${planName}.`,
    intro: `"${companyName}" envió el comprobante de la transferencia de ${formatPyg(amountPyg)} por el plan ${planName}.`,
    bodyHtml: `
      <p>Referencia de la solicitud: <strong>${escapeText(reference)}</strong></p>
      ${operationReference ? `<p>Operación bancaria informada: <strong>${escapeText(operationReference)}</strong></p>` : ''}
      <p>El plan se activa recién cuando apruebes la transferencia.</p>
    `,
    cta: { label: 'Revisar transferencia', url: reviewUrl },
    brand: { name: 'MiTiendaPY', color: BRAND_COLOR_HEX.blue || '#2563eb' },
  })
}

/** Aviso al comercio: su transferencia se aprobó o se rechazó. */
export function renderTransferReviewedEmail(params: {
  companyName: string
  planName: string
  amountPyg: number
  approved: boolean
  periodEndsAt: string | null
  reason: string | null
  manageUrl: string
  brand?: BrandInfo
}) {
  const { companyName, planName, amountPyg, approved, periodEndsAt, reason, manageUrl, brand } = params
  const periodEnd = periodEndsAt
    ? new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Asuncion' }).format(new Date(periodEndsAt))
    : null

  return renderBrandedEmail({
    title: approved ? 'Aprobamos tu transferencia' : 'No pudimos aprobar tu transferencia',
    preview: approved
      ? `Tu plan ${planName} está activo${periodEnd ? ` hasta el ${periodEnd}` : ''}.`
      : 'Revisá el motivo y generá una nueva solicitud.',
    intro: approved
      ? `Hola, confirmamos la transferencia de ${formatPyg(amountPyg)} de "${companyName}". El plan ${planName} ya está activo.`
      : `Hola, revisamos la transferencia de ${formatPyg(amountPyg)} de "${companyName}" por el plan ${planName} y no pudimos aprobarla.`,
    bodyHtml: approved
      ? (periodEnd ? `<p>El período pagado vence el <strong>${escapeText(periodEnd)}</strong>.</p>` : '')
      : `<p>Motivo: <strong>${escapeText(reason || 'sin detalle')}</strong></p>
         <p>Podés generar una nueva solicitud y adjuntar el comprobante correcto desde el panel.</p>`,
    cta: { label: approved ? 'Ver mi suscripción' : 'Generar nueva solicitud', url: manageUrl },
    brand: {
      name: brand?.name || 'MiTiendaPY',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
  })
}

// ---------------------------------------------------------------------------
// Ciclo de la suscripción: recordatorios, recibo y reversión
// ---------------------------------------------------------------------------

/** Aviso del ciclo: vencimiento cercano, pago pendiente o baja a Gratuito. */
export function renderSubscriptionNoticeEmail(params: {
  title: string
  preview: string
  intro: string
  detail: string
  ctaLabel: string
  manageUrl: string
  brand?: BrandInfo
}) {
  const { title, preview, intro, detail, ctaLabel, manageUrl, brand } = params
  return renderBrandedEmail({
    title,
    preview,
    intro,
    bodyHtml: `<p>${escapeText(detail)}</p>`,
    cta: { label: ctaLabel, url: manageUrl },
    brand: {
      name: brand?.name || 'MiTiendaPY',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
    footerNote: 'Tus datos y tu historial se conservan siempre.',
  })
}

/** Recibo de un pago de la suscripción (no es una factura legal). */
export function renderSubscriptionReceiptEmail(params: {
  companyName: string
  planName: string
  amountPyg: number
  method: string
  paidAt: string
  periodEndsAt: string | null
  reference: string
  manageUrl: string
  brand?: BrandInfo
}) {
  const { companyName, planName, amountPyg, method, paidAt, periodEndsAt, reference, manageUrl, brand } = params
  const date = (value: string) => new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Asuncion' }).format(new Date(value))
  return renderBrandedEmail({
    title: 'Recibimos tu pago',
    preview: `${formatPyg(amountPyg)} por el plan ${planName}.`,
    intro: `Hola, registramos el pago de "${companyName}". Gracias.`,
    bodyHtml: `
      <p>Plan: <strong>${escapeText(planName)}</strong></p>
      <p>Monto: <strong>${escapeText(formatPyg(amountPyg))}</strong> · ${escapeText(method)}</p>
      <p>Fecha del pago: ${escapeText(date(paidAt))}</p>
      ${periodEndsAt ? `<p>Tu plan está pago hasta el <strong>${escapeText(date(periodEndsAt))}</strong>.</p>` : ''}
      <p style="color:#64748b;font-size:12px">Referencia: ${escapeText(reference)}. Este correo es un comprobante de pago, no una factura legal.</p>
    `,
    cta: { label: 'Ver mi suscripción', url: manageUrl },
    brand: {
      name: brand?.name || 'MiTiendaPY',
      color: BRAND_COLOR_HEX[brand?.color || 'blue'] || '#2563eb',
      logoUrl: brand?.logoUrl,
    },
  })
}

/** Confirmación del pedido de eliminación de cuenta. */
export function renderAccountDeletionRequestedEmail(params: {
  scheduledFor: string
  closedOrganizations: string[]
  supportEmail: string
}) {
  const date = new Date(params.scheduledFor).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })
  const closed = params.closedOrganizations.length
    ? `<p>Como eras el único administrador, se cerró: ${params.closedOrganizations.map(escapeText).join(', ')}.</p>`
    : ''
  return renderBrandedEmail({
    title: 'Recibimos tu pedido de eliminar la cuenta',
    preview: `Tu cuenta quedó bloqueada y tus datos personales se eliminan el ${date}.`,
    intro: 'Tu cuenta quedó bloqueada desde ahora y ya no podés iniciar sesión.',
    bodyHtml: `<p>El ${escapeText(date)} se eliminan tus datos personales (nombre, correo, teléfono, foto y preferencias). Los registros comerciales y fiscales de los negocios se conservan sin tus datos, como exige la ley.</p>${closed}<p>Si no fuiste vos o te arrepentiste, escribinos a ${escapeText(params.supportEmail)} antes de esa fecha.</p>`,
    brand: { name: 'MiTiendaPY', color: '#2563eb' },
  })
}
