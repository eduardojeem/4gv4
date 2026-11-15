import { useCallback, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { View, Text, type ViewStyle } from 'react-native'
import { BottomSheet } from '../bottom-sheet'
import { usePanel } from '@/lib/panel'
import {
  getPrivateCacheContext,
  isPrivateCacheSnapshotCompatible,
} from '@/lib/private-cache-context'
import {
  fetchLoyaltyCustomers,
  fetchCustomerLoyaltyHistory,
  fetchLoyaltySettings,
  redeemLoyalty,
  type ProgramData,
  type LoyaltySettingsRow,
} from '@/lib/promotions'
import { numberField } from '@/lib/promotions-model'
import {
  pendingRedemption,
  submitRedemption,
  type PendingRedemption,
  type RedemptionContext,
} from '@/lib/loyalty-redemption-attempt'
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
  usePromotionColors,
  confirmAction,
} from './ui'
import { Pagination, Search, useSearch } from './discounts'
const storage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
}
type Customer = ProgramData['customers'][number]
export function CustomersTab() {
  const { can } = usePanel()
  const [page, setPage] = useState(1)
  const search = useSearch()
  const loader = useCallback(
    () => fetchLoyaltyCustomers(search.search, (page - 1) * 25),
    [search.search, page],
  )
  const resource = useResource(loader),
    settings = useResource(fetchLoyaltySettings)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [history, setHistory] = useState<Customer | null>(null)
  const pendingLoader = useCallback(async () => {
    const context = getPrivateCacheContext()
    return context.userId && context.organizationId
      ? pendingRedemption(
          { userId: context.userId, organizationId: context.organizationId },
          storage,
        )
      : null
  }, [])
  const pending = useResource(pendingLoader)
  const mutation = useMutation(() => {
    resource.refresh()
    pending.refresh()
  })
  const [confirmed, setConfirmed] = useState(false)
  const config = settings.data?.settings
  const minimum = Number(config?.min_redemption_points) || 1
  const pointValue = Number(config?.redemption_value) || 0
  const allowRedeem = can('pos.sales.create') || can('crm.customers.manage')
  const colors = usePromotionColors()
  const resume = (attempt: PendingRedemption) => {
    const context = getPrivateCacheContext()
    if (!context.userId || !context.organizationId) return
    const scope = context
    const identity = { userId: context.userId, organizationId: context.organizationId }
    confirmAction(
      'Reintentar canje',
      'Se consultará el mismo canje de ' +
        attempt.points +
        ' puntos para ' +
        attempt.customerName +
        '. No se crea una clave nueva.',
      () =>
        void mutation.run(
          () =>
            submitRedemption(identity, attempt, {
              storage,
              submit: redeemLoyalty,
              isCurrent: () => isPrivateCacheSnapshotCompatible(scope),
            }),
          'Canje confirmado. El saldo está actualizado.',
        ),
    )
  }
  return (
    <View style={{ gap: 14 }}>
      <Heading>Clientes y resultados</Heading>
      <Copy>
        Los turnos se registran desde la habilitación de esta función. Puntos y visitas se muestran
        por separado.
      </Copy>
      <Feedback
        error={mutation.error}
        message={
          confirmed
            ? 'Canje confirmado. Se generó saldo a favor para el cliente.'
            : mutation.message
        }
      />
      {settings.error ? <Notice message={settings.error} onRetry={settings.refresh} /> : null}
      {pending.error ? (
        <Notice message={pending.error} onRetry={pending.refresh} />
      ) : pending.data ? (
        <Card>
          <Heading>Canje pendiente de confirmación</Heading>
          <Copy>
            {pending.data.customerName}: {pending.data.points} puntos. Reintentá el mismo canje
            antes de iniciar otro.
          </Copy>
          {allowRedeem ? (
            <Action
              title="Reintentar canje pendiente"
              disabled={mutation.busy}
              onPress={() => resume(pending.data!)}
            />
          ) : null}
        </Card>
      ) : null}
      <Search
        label="Buscar cliente por nombre"
        value={search.query}
        onChange={(value) => {
          search.setQuery(value)
          setPage(1)
        }}
      />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Notice message={resource.error} onRetry={resource.refresh} />
      ) : resource.data ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[
              { name: 'Clientes con historial', value: resource.data.summary.customers },
              { name: 'Turnos pagados', value: resource.data.summary.visits },
              { name: 'Clientes que volvieron', value: resource.data.summary.returningCustomers },
              { name: 'Canjes por saldo', value: resource.data.summary.redemptions },
            ].map((metric) => (
              <View key={metric.name} style={{ width: '47%', flexGrow: 1 }}>
                <Card>
                  <Text style={{ color: colors.text, fontSize: 25, fontWeight: '700' }}>
                    {Number(metric.value).toLocaleString('es-PY')}
                  </Text>
                  <Copy>{metric.name}</Copy>
                </Card>
              </View>
            ))}
          </View>
          <Copy>
            Totales del negocio sin filtrar por nombre. Los canjes no indican cuánto saldo se usó
            después.
          </Copy>
          {!resource.data.customers.length ? (
            <Card>
              <Copy>
                {search.search
                  ? 'No encontramos clientes con ese nombre.'
                  : 'Todavía no hay historial. Asociá un cliente al cobrar para empezar.'}
              </Copy>
            </Card>
          ) : (
            resource.data.customers.map((row) => {
              const balance = Number(row.balance)
              const left = Math.max(0, minimum - balance)
              const progress = Math.min(100, Math.max(0, (balance / minimum) * 100))
              return (
                <Card key={row.id}>
                  <Heading>{row.name}</Heading>
                  <Text style={{ color: colors.brand, fontSize: 22, fontWeight: '700' }}>
                    {balance.toLocaleString('es-PY')} puntos
                  </Text>
                  <Copy>{Number(row.visits)} turnos atendidos y pagados</Copy>
                  {pointValue > 0 ? (
                    <>
                      <View
                        accessibilityRole="progressbar"
                        accessibilityLabel={'Progreso de ' + row.name}
                        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
                        style={{
                          height: 8,
                          borderRadius: 10,
                          overflow: 'hidden',
                          backgroundColor: colors.border,
                        }}
                      >
                        <View
                          style={{
                            height: 8,
                            width: (progress + '%') as ViewStyle['width'],
                            backgroundColor: colors.brand,
                          }}
                        />
                      </View>
                      <Copy>
                        {balance <= 0
                          ? 'Todavía no tiene puntos para canjear.'
                          : left > 0
                            ? 'Le faltan ' + left + ' puntos para el mínimo de canje.'
                            : (balance * pointValue).toLocaleString('es-PY') +
                              ' de saldo a favor al canjear.'}
                      </Copy>
                    </>
                  ) : null}
                  {config && !config.enabled ? (
                    <Copy warning>
                      Programa pausado. El saldo se conserva; el canje requiere reactivarlo.
                    </Copy>
                  ) : null}
                  <Copy>
                    {row.last_visit
                      ? 'Último turno: ' + new Date(row.last_visit).toLocaleDateString('es-PY')
                      : 'Sin turnos registrados en este programa.'}
                  </Copy>
                  {config?.enabled && pointValue > 0 && balance >= minimum && allowRedeem ? (
                    <Action
                      title="Canjear puntos por saldo"
                      disabled={
                        mutation.busy || !!pending.data || !!pending.error || pending.loading
                      }
                      onPress={() => setCustomer(row)}
                    />
                  ) : null}
                  {can('crm.customers.read') ? (
                    <Action
                      secondary
                      title="Ver historial de puntos"
                      onPress={() => setHistory(row)}
                    />
                  ) : null}
                </Card>
              )
            })
          )}
          <Pagination page={page} pages={Math.ceil(resource.data.total / 25)} onPage={setPage} />
        </>
      ) : null}
      {history ? <CustomerHistory customer={history} onClose={() => setHistory(null)} /> : null}
      {customer && config ? (
        <RedemptionEditor
          customer={customer}
          settings={config}
          onClose={() => {
            setCustomer(null)
            pending.refresh()
          }}
          onSaved={() => {
            setConfirmed(true)
            resource.refresh()
            pending.refresh()
          }}
        />
      ) : null}
    </View>
  )
}
function RedemptionEditor({
  customer,
  settings,
  onClose,
  onSaved,
}: {
  customer: Customer
  settings: LoyaltySettingsRow
  onClose: () => void
  onSaved: () => void
}) {
  const minimum = Number(settings.min_redemption_points) || 1
  const [points, setPoints] = useState(String(minimum))
  const mutation = useMutation(onSaved)
  const scope = getPrivateCacheContext()
  const context: RedemptionContext | null =
    scope.userId && scope.organizationId
      ? { userId: scope.userId, organizationId: scope.organizationId }
      : null
  const save = async () => {
    const ok = await mutation.run(async () => {
      if (!context) throw new Error('Volvé a iniciar sesión.')
      const amount = numberField(
        points,
        'Puntos a canjear',
        minimum,
        Number(customer.balance),
        true,
      )
      return submitRedemption(
        context,
        { customerId: customer.id, customerName: customer.name, points: amount },
        {
          storage,
          submit: redeemLoyalty,
          isCurrent: () => isPrivateCacheSnapshotCompatible(scope),
        },
      )
    })
    if (ok) onClose()
  }
  const value = Number(points) * Number(settings.redemption_value)
  return (
    <BottomSheet
      visible
      title="Canjear puntos por saldo"
      subtitle={customer.name}
      onClose={() => {
        if (!mutation.busy) onClose()
      }}
      footer={
        <Action
          title={mutation.busy ? 'Confirmando…' : 'Confirmar canje'}
          disabled={mutation.busy}
          onPress={() =>
            confirmAction(
              'Confirmar canje',
              'Se descontarán los puntos elegidos y se generará saldo a favor para este cliente.',
              () => void save(),
            )
          }
        />
      }
    >
      <Copy>
        Saldo: {Number(customer.balance)} puntos. Mínimo: {minimum}. El saldo a favor se puede usar
        para pagar una compra o servicio.
      </Copy>
      <Fields
        values={{ points }}
        disabled={mutation.busy}
        fields={[{ key: 'points', label: 'Puntos a canjear', type: 'number' }]}
        onChange={(_key, value) => setPoints(String(value))}
      />
      {Number.isFinite(value) && value > 0 ? (
        <Copy>Recibe {value.toLocaleString('es-PY')} en la moneda del negocio.</Copy>
      ) : null}
      <Copy>
        Si se corta la conexión, reintentá el canje pendiente. Conservamos la misma referencia para
        evitar descontar dos veces.
      </Copy>
      <Feedback error={mutation.error} />
    </BottomSheet>
  )
}

function CustomerHistory({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const loader = useCallback(() => fetchCustomerLoyaltyHistory(customer.id), [customer.id])
  const resource = useResource(loader)
  const [limit, setLimit] = useState(20)
  return (
    <BottomSheet
      visible
      tall
      title="Historial de puntos"
      subtitle={customer.name}
      onClose={onClose}
    >
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Notice message={resource.error} onRetry={resource.refresh} />
      ) : !resource.data?.moduleInstalled ? (
        <Notice message={resource.data?.message ?? 'El historial no está disponible.'} />
      ) : (
        <>
          <Heading>
            {resource.data.account
              ? Number(resource.data.account.balance).toLocaleString('es-PY') +
                ' puntos disponibles'
              : 'Todavía no tiene una cuenta de puntos'}
          </Heading>
          <Copy>
            Últimos 200 movimientos registrados. Los vencimientos, reintegros y canjes se muestran
            por separado en la descripción.
          </Copy>
          {resource.data.ledger.slice(0, limit).map((entry) => (
            <Card key={entry.id}>
              <Heading>
                {Number(entry.points) > 0 ? '+' : ''}
                {Number(entry.points).toLocaleString('es-PY')} puntos
              </Heading>
              <Copy>{entry.description}</Copy>
              <Copy>{new Date(entry.created_at).toLocaleString('es-PY')}</Copy>
            </Card>
          ))}
          {!resource.data.ledger.length ? <Copy>No hay movimientos de puntos.</Copy> : null}
          {resource.data.ledger.length > limit ? (
            <Action secondary title="Ver más movimientos" onPress={() => setLimit((n) => n + 20)} />
          ) : null}
          <Heading>Números recientes (hasta 20)</Heading>
          {resource.data.tickets.slice(0, 20).map((ticket) => (
            <Copy key={ticket.id}>
              Número {ticket.ticket_number} · {ticket.raffle?.name ?? 'Sorteo no disponible'}
            </Copy>
          ))}
          {!resource.data.tickets.length ? <Copy>No tiene números registrados.</Copy> : null}
          <Heading>Premios recientes (hasta 20)</Heading>
          {resource.data.winners.slice(0, 20).map((winner) => (
            <Copy key={winner.id}>
              {winner.prize_title} · {winner.raffle?.name ?? 'Sorteo no disponible'}
            </Copy>
          ))}
          {!resource.data.winners.length ? <Copy>No tiene premios registrados.</Copy> : null}
        </>
      )}
    </BottomSheet>
  )
}
