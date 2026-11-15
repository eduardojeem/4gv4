import { useCallback, useState } from 'react'
import { View } from 'react-native'
import { BottomSheet } from '../bottom-sheet'
import { usePanel } from '@/lib/panel'
import {
  fetchRaffles,
  createRaffle,
  updateRaffle,
  drawRaffle,
  fetchRaffleDetail,
  type RaffleRow,
} from '@/lib/promotions'
import {
  raffleDraft,
  buildRaffle,
  localDate,
  raffleActions,
  raffleStatusLabel,
  type RaffleDraft,
} from '@/lib/promotions-model'
import {
  Action,
  Card,
  Copy,
  Fields,
  Heading,
  Notice,
  Loading,
  Feedback,
  useResource,
  useMutation,
  confirmAction,
  type Field,
} from './ui'
import { Pagination } from './discounts'
export function RafflesTab() {
  const { can } = usePanel()
  const resource = useResource(fetchRaffles),
    mutation = useMutation(resource.refresh)
  const [editor, setEditor] = useState<RaffleRow | null | undefined>(undefined)
  const [detail, setDetail] = useState<string | null>(null)
  const transition = (row: RaffleRow, action: 'publish' | 'close' | 'cancel' | 'draw') => {
    const titles = {
      publish: 'Publicar sorteo',
      close: 'Cerrar sorteo',
      cancel: 'Cancelar sorteo',
      draw: 'Elegir ganadores',
    }
    const messages = {
      publish:
        'El sorteo quedará visible y aceptará canjes durante sus fechas. Revisá los premios y condiciones antes de confirmar.',
      close: 'No se aceptarán más números. Un sorteo cerrado no se puede reabrir.',
      cancel: 'Se cancelará el sorteo y no aceptará más números. No se puede reactivar.',
      draw: 'El servidor elegirá y guardará los ganadores una sola vez. Esta acción no se puede deshacer.',
    }
    confirmAction(
      titles[action],
      messages[action],
      () =>
        void mutation.run(
          () =>
            action === 'draw'
              ? drawRaffle(row.id)
              : updateRaffle(row.id, {
                  status: {
                    publish: 'published' as const,
                    close: 'closed' as const,
                    cancel: 'cancelled' as const,
                  }[action],
                }),
          action === 'draw'
            ? 'Sorteo realizado. Abrí el detalle para ver los ganadores.'
            : 'Estado actualizado',
        ),
    )
  }
  return (
    <View style={{ gap: 14 }}>
      <Heading>Sorteos opcionales</Heading>
      <Copy>
        Son independientes del canje por saldo a favor. Definí premios, fechas y condiciones. Para
        elegir ganadores primero cerrá el sorteo.
      </Copy>
      {can('promotions.manage') ? (
        <Action title="Crear sorteo" onPress={() => setEditor(null)} />
      ) : null}
      <Action title="Actualizar sorteos" secondary onPress={resource.refresh} />
      <Feedback error={mutation.error} message={mutation.message} />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Notice message={resource.error} onRetry={resource.refresh} />
      ) : !resource.data?.moduleInstalled ? (
        <Notice
          message={resource.data?.message ?? 'Los sorteos no están disponibles en este servidor.'}
        />
      ) : resource.data.raffles.length ? (
        resource.data.raffles.map((row) => (
          <Card key={row.id}>
            <Heading>{row.name}</Heading>
            <Copy>
              {raffleStatusLabel[row.status]} · {row.points_per_ticket} puntos por número
            </Copy>
            <Copy>
              {row.participants_count == null
                ? 'Participación sin confirmar'
                : row.participants_count + ' participantes'}{' '}
              · {row.tickets?.[0]?.count ?? 0} números emitidos de {row.max_tickets_total}
            </Copy>
            <Copy>
              Del {new Date(row.starts_at).toLocaleString('es-PY')} al{' '}
              {new Date(row.ends_at).toLocaleString('es-PY')}
            </Copy>
            {row.prizes.map((prize) => (
              <Copy key={prize.position}>
                {prize.position}. {prize.title}
              </Copy>
            ))}
            <Action
              secondary
              title="Ver participantes y ganadores"
              onPress={() => setDetail(row.id)}
            />
            {can('promotions.manage') ? (
              <>
                {row.status === 'draft' || row.status === 'published' ? (
                  <Action
                    secondary
                    title="Editar datos del sorteo"
                    disabled={mutation.busy}
                    onPress={() => setEditor(row)}
                  />
                ) : null}
                {raffleActions(row.status).map((action) => (
                  <Action
                    key={action}
                    secondary={action !== 'draw'}
                    danger={action === 'cancel'}
                    disabled={mutation.busy}
                    title={
                      {
                        publish: 'Publicar sorteo',
                        close: 'Cerrar sorteo',
                        cancel: 'Cancelar sorteo',
                        draw: 'Elegir ganadores',
                      }[action]
                    }
                    onPress={() => transition(row, action)}
                  />
                ))}
              </>
            ) : null}
          </Card>
        ))
      ) : (
        <Card>
          <Copy>Todavía no hay sorteos. Podés usar fidelización sin crear uno.</Copy>
        </Card>
      )}
      {editor !== undefined ? (
        <RaffleEditor
          row={editor}
          onClose={() => setEditor(undefined)}
          onSaved={resource.refresh}
        />
      ) : null}
      {detail ? <RaffleDetails id={detail} onClose={() => setDetail(null)} /> : null}
    </View>
  )
}
function RaffleEditor({
  row,
  onClose,
  onSaved,
}: {
  row: RaffleRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<RaffleDraft>(() =>
    row
      ? {
          ...raffleDraft(),
          name: row.name,
          description: row.description ?? '',
          starts_at: localDate(row.starts_at),
          ends_at: localDate(row.ends_at),
          prizes: row.prizes.map((p) => p.title).join('\n'),
          points_per_ticket: String(row.points_per_ticket),
          max_tickets_total: String(row.max_tickets_total),
          max_tickets_per_customer:
            row.max_tickets_per_customer == null ? '' : String(row.max_tickets_per_customer),
          min_age: String(row.min_age),
          terms: row.terms ?? '',
          requirements: row.requirements ?? '',
          min_purchase_amount:
            row.min_purchase_amount == null ? '' : String(row.min_purchase_amount),
          auto_entry_on_sale: row.auto_entry_on_sale,
          allow_point_purchase: row.allow_point_purchase,
          point_purchase_price:
            row.point_purchase_price == null ? '' : String(row.point_purchase_price),
        }
      : raffleDraft(),
  )
  const mutation = useMutation(onSaved)
  const fields: Field[] = [
    { key: 'name', label: 'Nombre del sorteo', maxLength: 160 },
    { key: 'description', label: 'Descripción', type: 'multiline', maxLength: 1000 },
    {
      key: 'prizes',
      label: 'Premios: uno por renglón, en orden',
      type: 'multiline',
      visible: !row,
      hint: 'Primera línea: primer premio. Segunda línea: segundo premio.',
    },
    {
      key: 'starts_at',
      label: 'Inicio',
      type: 'date',
      visible: !row,
      hint: 'Usa la zona horaria del celular.',
    },
    { key: 'ends_at', label: 'Cierre', type: 'date' },
    { key: 'points_per_ticket', label: 'Puntos por número', type: 'number', visible: !row },
    { key: 'max_tickets_total', label: 'Cantidad total de números', type: 'number', visible: !row },
    {
      key: 'max_tickets_per_customer',
      label: 'Máximo por cliente (opcional)',
      type: 'number',
      visible: !row,
    },
    { key: 'min_age', label: 'Edad mínima', type: 'number', visible: !row },
    {
      key: 'requirements',
      label: 'Requisitos para participar',
      type: 'multiline',
      maxLength: 1000,
    },
    { key: 'terms', label: 'Condiciones del sorteo', type: 'multiline', maxLength: 4000 },
    { key: 'min_purchase_amount', label: 'Pago mínimo (opcional)', type: 'number' },
    {
      key: 'auto_entry_on_sale',
      label: 'Participación automática al cobrar',
      type: 'toggle',
      hint: 'El servidor valida fechas, requisitos y cupos.',
    },
    {
      key: 'allow_point_purchase',
      label: 'Permitir compra de puntos en caja',
      type: 'toggle',
      hint: 'Dejalo apagado si solo querés usar puntos ganados con compras o turnos.',
    },
    {
      key: 'point_purchase_price',
      label: 'Precio por punto',
      type: 'number',
      visible: draft.allow_point_purchase,
    },
  ]
  const save = async () => {
    const ok = await mutation.run(async () => {
      const payload = buildRaffle(draft)
      return row
        ? updateRaffle(row.id, {
            name: payload.name,
            description: payload.description,
            requirements: payload.requirements,
            terms: payload.terms,
            ends_at: payload.ends_at,
            min_purchase_amount: payload.min_purchase_amount,
            auto_entry_on_sale: payload.auto_entry_on_sale,
            allow_point_purchase: payload.allow_point_purchase,
            point_purchase_price: payload.point_purchase_price,
          })
        : createRaffle(payload)
    })
    if (ok) onClose()
  }
  return (
    <BottomSheet
      visible
      tall
      title={row ? 'Editar sorteo' : 'Nuevo sorteo'}
      subtitle={
        row
          ? 'Los premios y el costo por número se fijan al crear.'
          : 'Se guarda como borrador. Después podés revisar y publicar.'
      }
      onClose={() => {
        if (!mutation.busy) onClose()
      }}
      footer={
        <Action
          title={mutation.busy ? 'Guardando…' : row ? 'Guardar cambios' : 'Guardar borrador'}
          disabled={mutation.busy}
          onPress={() => void save()}
        />
      }
    >
      <Fields
        fields={fields}
        values={draft}
        disabled={mutation.busy}
        onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
      />
      <Feedback error={mutation.error} />
    </BottomSheet>
  )
}
function RaffleDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const loader = useCallback(() => fetchRaffleDetail(id, page), [id, page])
  const resource = useResource(loader)
  return (
    <BottomSheet visible tall title="Participantes y ganadores" onClose={onClose}>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Notice message={resource.error} onRetry={resource.refresh} />
      ) : resource.data ? (
        <>
          <Heading>{resource.data.raffle.name}</Heading>
          <Copy>{raffleStatusLabel[resource.data.raffle.status]}</Copy>
          <Heading>Ganadores</Heading>
          {resource.data.winners.length ? (
            resource.data.winners.map((row) => (
              <Card key={row.id}>
                <Heading>
                  {row.prize_position}. {row.prize_title}
                </Heading>
                <Copy>
                  {row.customer?.name ?? 'Cliente no disponible'} · Número{' '}
                  {row.ticket?.ticket_number ?? 'no disponible'}
                </Copy>
              </Card>
            ))
          ) : (
            <Copy>
              {resource.data.raffle.status === 'completed'
                ? 'El servidor no devolvió ganadores para este sorteo.'
                : 'Los ganadores aparecerán después del sorteo.'}
            </Copy>
          )}
          <Heading>Números emitidos</Heading>
          <Copy>
            {resource.data.ticketsPagination.total} números en total. Una persona puede tener
            varios.
          </Copy>
          {resource.data.tickets.length ? (
            resource.data.tickets.map((row) => (
              <Card key={row.id}>
                <Copy>
                  Número {row.ticket_number} · {row.customer?.name ?? 'Cliente no disponible'}
                </Copy>
              </Card>
            ))
          ) : (
            <Copy>No hay números emitidos en esta página.</Copy>
          )}
          <Pagination page={page} pages={resource.data.ticketsPagination.pages} onPage={setPage} />
          {resource.data.raffle.terms ? (
            <>
              <Heading>Condiciones</Heading>
              <Copy>{resource.data.raffle.terms}</Copy>
            </>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  )
}
