import { NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getAppReturnOrigin, getBrowserRequestOrigin } from '@/lib/http/app-origin'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { PagoparRecurringError } from '@/lib/payments/pagopar-recurring'
import {
  AutopayError,
  completeAutopayCardRegistration,
  getAutopayStatus,
  removeAutopayCard,
  setAutopayEnabled,
  startAutopayCardRegistration,
} from '@/lib/saas/subscription-autopay'

/** Pagopar redirige acá al terminar el formulario; tiene que ser idéntica en agregar y confirmar. */
function getCardReturnUrl(request: Request) {
  return `${getAppReturnOrigin(getBrowserRequestOrigin(request))}/auth/pagopar-tarjeta`
}

async function resolveContext(requireOwner: boolean) {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const organization = await getCurrentOrganizationContext(auth.user.id)
  const isOwner = organization?.role === 'owner' || auth.user.role === 'super_admin'
  if (!organization || (requireOwner ? !isOwner : !['owner', 'admin'].includes(organization.role))) {
    return {
      response: NextResponse.json(
        { error: requireOwner ? 'Solo el propietario puede gestionar el débito automático.' : 'Forbidden' },
        { status: 403 },
      ),
    }
  }
  return { auth, organization }
}

function errorResponse(error: unknown) {
  if (error instanceof AutopayError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof PagoparRecurringError) {
    // 424 y no 502: Cloudflare reemplaza las respuestas 502 por su propia página.
    return NextResponse.json({ error: error.message }, { status: 424 })
  }
  return NextResponse.json({ error: 'No se pudo completar la operación.' }, { status: 500 })
}

export async function GET() {
  const context = await resolveContext(false)
  if ('response' in context) return context.response

  try {
    return NextResponse.json(await getAutopayStatus(context.organization.id))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  const context = await resolveContext(true)
  if ('response' in context) return context.response

  const body = await request.json().catch(() => ({})) as { action?: unknown }
  try {
    switch (body.action) {
      case 'start': {
        const formUrl = await startAutopayCardRegistration({
          organizationId: context.organization.id,
          organizationName: context.organization.name,
          userEmail: context.auth.user.email,
          returnUrl: getCardReturnUrl(request),
        })
        return NextResponse.json({ formUrl })
      }
      case 'confirm':
        return NextResponse.json(await completeAutopayCardRegistration({
          organizationId: context.organization.id,
          returnUrl: getCardReturnUrl(request),
        }))
      case 'enable':
        return NextResponse.json(await setAutopayEnabled(context.organization.id, true))
      case 'disable':
        return NextResponse.json(await setAutopayEnabled(context.organization.id, false))
      default:
        return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
    }
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE() {
  const context = await resolveContext(true)
  if ('response' in context) return context.response

  try {
    return NextResponse.json(await removeAutopayCard(context.organization.id))
  } catch (error) {
    return errorResponse(error)
  }
}
