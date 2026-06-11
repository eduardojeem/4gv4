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
