import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAgendaConfig } from '@/lib/agenda/agenda-server'

/**
 * Un comercio que nunca guardó la configuración de la Agenda no tiene fila: la
 * pantalla muestra el horario por defecto, pero sin fila el servidor no usaba
 * el guardado transaccional y el turno no se podía crear. La fila se crea solo
 * con el comercio: el resto son los valores por defecto de la tabla, los mismos
 * que muestra la pantalla. Si ya existe, no se toca. Va con el cliente de
 * servidor porque quien agenda (un vendedor) puede no tener permiso de
 * configuración; el comercio sale de la sesión, nunca del pedido.
 */
export async function ensureDefaultAgendaSettings(admin: SupabaseClient, organizationId: string): Promise<boolean> {
  const { error } = await admin
    .from('agenda_settings')
    .upsert({ organization_id: organizationId }, { onConflict: 'organization_id', ignoreDuplicates: true })
  return !error
}

/** La configuración para guardar un turno: si el comercio nunca la guardó, se crea con los valores por defecto. */
export async function loadAgendaConfigForBooking(client: SupabaseClient, organizationId: string, admin: () => SupabaseClient) {
  const config = await loadAgendaConfig(client, organizationId)
  if (!config || config.settingsSaved || config.capabilities.professionalBooking) return config
  if (!(await ensureDefaultAgendaSettings(admin(), organizationId))) return config
  return loadAgendaConfig(client, organizationId)
}
