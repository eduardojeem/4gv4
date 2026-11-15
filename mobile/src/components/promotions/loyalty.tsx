import { useState } from 'react'
import { View } from 'react-native'
import { BottomSheet } from '../bottom-sheet'
import { usePanel } from '@/lib/panel'
import {
  DEFAULT_LOYALTY_SETTINGS,
  type LoyaltySettingsRow,
  type PointRuleRow,
} from '../../../../src/lib/loyalty/contracts'
import {
  fetchLoyaltySettings,
  saveLoyaltySettings,
  fetchPointRules,
  savePointRule,
  togglePointRule,
  deletePointRule,
} from '@/lib/promotions'
import { buildLoyaltySettings, buildPointRule, pointRuleDraft } from '@/lib/promotions-model'
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
export function LoyaltyTab() {
  const { can } = usePanel()
  const resource = useResource(fetchLoyaltySettings),
    rules = useResource(fetchPointRules)
  const [editing, setEditing] = useState(false),
    [ruleEditor, setRuleEditor] = useState<PointRuleRow | null | undefined>(undefined)
  const mutation = useMutation(rules.refresh)
  const config = resource.data?.settings ?? null
  const mode = config?.earning_mode ?? 'amount'
  if (resource.loading) return <Loading />
  if (resource.error) return <Notice message={resource.error} onRetry={resource.refresh} />
  if (!resource.data?.moduleInstalled)
    return (
      <Notice
        message={
          resource.data?.message ??
          'El programa de puntos todavía no está disponible en este servidor.'
        }
      />
    )
  const ready = resource.data.capabilities?.serviceVisits === true
  const value = Number(config?.redemption_value) || 0
  const min = Number(config?.min_redemption_points) || 1
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Heading>Fidelización y beneficios</Heading>
        <Copy>
          {config?.enabled
            ? 'Programa activo'
            : 'Programa pausado: se conserva el saldo de los clientes.'}
        </Copy>
        <Copy>
          {mode === 'visits'
            ? 'Premiás los turnos atendidos y pagados por completo.'
            : mode === 'both'
              ? 'Premiás lo pagado y los turnos atendidos y pagados por completo.'
              : 'Premiás el monto efectivamente pagado por el cliente.'}
        </Copy>
        <Copy>
          {mode !== 'visits'
            ? String(config?.points_per_unit ?? 1) +
              ' puntos cada ' +
              Number(config?.currency_per_point ?? 10000).toLocaleString('es-PY') +
              ' pagados.'
            : ''}
          {mode !== 'amount' ? ' ' + (config?.points_per_visit ?? 1) + ' puntos por turno.' : ''}
        </Copy>
        <Copy>
          {value > 0
            ? min +
              ' puntos equivalen a ' +
              (min * value).toLocaleString('es-PY') +
              ' de saldo a favor.'
            : 'El canje por saldo a favor está desactivado.'}
        </Copy>
        <Copy>
          Asociá el cliente al cobrar. Reservar, cancelar o reprogramar no suma visitas. Un turno
          financiado cuenta una vez al terminar de pagarse.
        </Copy>
        {!ready ? (
          <Copy warning>
            El modo por turnos requiere la migración pendiente. Podés seguir usando el programa por
            monto.
          </Copy>
        ) : null}
        {can('promotions.manage') ? (
          <Action title="Configurar programa" onPress={() => setEditing(true)} />
        ) : (
          <Copy>Tenés acceso de consulta; la configuración requiere permiso de gestión.</Copy>
        )}
      </Card>
      <Heading>Campañas opcionales</Heading>
      <Copy>
        Se aplica una sola bonificación: la más conveniente. En modo por monto, la frecuencia cuenta
        acreditaciones de puntos (incluidas cuotas). En modo por turnos cuenta turnos pagados. Las
        devoluciones no reinician hitos utilizados.
      </Copy>
      {can('promotions.manage') ? (
        <Action title="Crear campaña de puntos" secondary onPress={() => setRuleEditor(null)} />
      ) : null}
      <Feedback error={mutation.error} message={mutation.message} />
      {rules.loading ? (
        <Loading />
      ) : rules.error ? (
        <Notice message={rules.error} onRetry={rules.refresh} />
      ) : !rules.data?.moduleInstalled ? (
        <Notice message={rules.data?.message ?? 'Las campañas no están disponibles.'} />
      ) : rules.data.rules.length ? (
        rules.data.rules.map((row) => (
          <Card key={row.id}>
            <Heading>{row.name}</Heading>
            <Copy>
              {row.is_active ? 'Habilitada' : 'Pausada'} ·{' '}
              {new Date(row.starts_at).toLocaleString('es-PY')} →{' '}
              {new Date(row.ends_at).toLocaleString('es-PY')}
            </Copy>
            <Copy>
              {row.kind === 'multiplier'
                ? 'Multiplica por ' + row.multiplier + ' los puntos por monto.'
                : row.kind === 'visit_milestone'
                  ? '+' +
                    row.bonus_points +
                    ' puntos cada ' +
                    row.visit_interval +
                    ' ' +
                    (mode === 'amount' ? 'acreditaciones' : 'turnos atendidos y pagados') +
                    '.'
                  : '+' + row.bonus_points + ' puntos por pago elegible.'}
            </Copy>
            {mode === 'visits' && row.kind !== 'visit_milestone' ? (
              <Copy warning>Esta campaña por monto no aplica en el modo exclusivo por turnos.</Copy>
            ) : null}
            <Copy>
              Bonificaciones registradas: {row.awarded_bonus_points}
              {row.max_bonus_points_total != null ? ' de ' + row.max_bonus_points_total : ''}{' '}
              puntos.
            </Copy>
            {can('promotions.manage') ? (
              <>
                <Action
                  secondary
                  title="Editar campaña"
                  disabled={mutation.busy}
                  onPress={() => setRuleEditor(row)}
                />
                <Action
                  secondary
                  title={row.is_active ? 'Pausar campaña' : 'Habilitar campaña'}
                  disabled={mutation.busy}
                  onPress={() => void mutation.run(() => togglePointRule(row.id, !row.is_active))}
                />
                <Action
                  secondary
                  danger
                  title="Eliminar campaña"
                  disabled={mutation.busy}
                  onPress={() =>
                    confirmAction(
                      'Eliminar campaña',
                      'Se eliminará la regla, pero se conservarán los puntos ya acreditados.',
                      () => void mutation.run(() => deletePointRule(row.id), 'Campaña eliminada'),
                    )
                  }
                />
              </>
            ) : null}
          </Card>
        ))
      ) : (
        <Card>
          <Copy>No hay campañas. El programa base funciona sin bonificaciones adicionales.</Copy>
        </Card>
      )}
      {editing ? (
        <SettingsEditor
          settings={config}
          ready={ready}
          onClose={() => setEditing(false)}
          onSaved={resource.refresh}
        />
      ) : null}
      {ruleEditor !== undefined ? (
        <RuleEditor
          row={ruleEditor}
          mode={mode}
          onClose={() => setRuleEditor(undefined)}
          onSaved={rules.refresh}
        />
      ) : null}
    </View>
  )
}
function SettingsEditor({
  settings,
  ready,
  onClose,
  onSaved,
}: {
  settings: LoyaltySettingsRow | null
  ready: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>({
    ...DEFAULT_LOYALTY_SETTINGS,
    ...settings,
    earning_mode: settings?.earning_mode ?? 'amount',
    points_per_visit: settings?.points_per_visit ?? 1,
  })
  const mutation = useMutation(onSaved)
  const mode = draft.earning_mode
  const optional = (key: string) =>
    draft[key] == null || String(draft[key]).trim() === '' ? null : Number(draft[key])
  const fields: Field[] = [
    {
      key: 'enabled',
      label: 'Programa activo',
      type: 'toggle',
      hint: 'Al pausarlo, se conservan los puntos existentes.',
    },
    {
      key: 'earning_mode',
      label: '¿Qué querés premiar?',
      type: 'choice',
      disabled: !ready,
      options: [
        { value: 'amount', label: 'El monto pagado' },
        { value: 'visits', label: 'Los turnos atendidos y pagados' },
        { value: 'both', label: 'Monto pagado y turnos' },
      ],
    },
    {
      key: 'points_per_visit',
      label: 'Puntos por turno',
      type: 'number',
      visible: ready && mode !== 'amount',
    },
    {
      key: 'currency_per_point',
      label: 'Monto pagado por tramo',
      type: 'number',
      visible: mode !== 'visits',
      hint: 'Ejemplo: 10000, sin separadores de miles.',
    },
    {
      key: 'points_per_unit',
      label: 'Puntos por tramo',
      type: 'number',
      visible: mode !== 'visits',
    },
    {
      key: 'redemption_value',
      label: 'Valor de cada punto al canjear',
      type: 'number',
      hint: 'En la moneda del negocio. Dejalo vacío para apagar el canje.',
    },
    { key: 'min_redemption_points', label: 'Mínimo para canjear (puntos)', type: 'number' },
    {
      key: 'rounding',
      label: 'Fracciones de punto',
      type: 'choice',
      visible: mode !== 'visits',
      options: [
        { value: 'floor', label: 'Redondear hacia abajo' },
        { value: 'round', label: 'Redondear al más cercano' },
      ],
    },
    {
      key: 'max_points_per_customer_per_day',
      label: 'Tope diario por cliente (opcional)',
      type: 'number',
    },
    { key: 'points_expiration_months', label: 'Vencimiento en meses (opcional)', type: 'number' },
  ]
  const save = async () => {
    const ok = await mutation.run(async () =>
      saveLoyaltySettings(
        buildLoyaltySettings(
          {
            enabled: draft.enabled === true,
            earning_mode: mode === 'both' || mode === 'visits' ? mode : 'amount',
            points_per_visit: Number(draft.points_per_visit),
            currency_per_point: Number(draft.currency_per_point),
            points_per_unit: Number(draft.points_per_unit),
            rounding: draft.rounding === 'round' ? 'round' : 'floor',
            redemption_value: optional('redemption_value'),
            min_redemption_points: optional('min_redemption_points'),
            max_points_per_customer_per_day: optional('max_points_per_customer_per_day'),
            points_expiration_months: optional('points_expiration_months'),
          },
          ready,
        ),
      ),
    )
    if (ok) onClose()
  }
  const reward = Number(draft.redemption_value),
    minimum = Number(draft.min_redemption_points) || 1
  return (
    <BottomSheet
      visible
      tall
      title="Configurar fidelización"
      onClose={() => {
        if (!mutation.busy) onClose()
      }}
      footer={
        <Action
          title={mutation.busy ? 'Guardando…' : 'Guardar programa'}
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
      {!ready ? (
        <Copy warning>Para usar turnos falta habilitar la migración de fidelización.</Copy>
      ) : null}
      {Number.isFinite(reward) && reward > 0 ? (
        <Card>
          <Heading>Ejemplo del beneficio</Heading>
          <Copy>
            {minimum} puntos = {(minimum * reward).toLocaleString('es-PY')} de saldo a favor para
            pagar otra compra o servicio. No es un cupón exclusivo de un servicio.
          </Copy>
        </Card>
      ) : null}
      <Feedback error={mutation.error} />
    </BottomSheet>
  )
}
function RuleEditor({
  row,
  mode,
  onClose,
  onSaved,
}: {
  row: PointRuleRow | null
  mode: string
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(() => pointRuleDraft(row ?? undefined))
  const mutation = useMutation(onSaved)
  const frequency = mode === 'amount' ? 'acreditaciones' : 'turnos atendidos y pagados'
  const fields: Field[] = [
    { key: 'name', label: 'Nombre de la campaña', maxLength: 160 },
    { key: 'description', label: 'Descripción', type: 'multiline', maxLength: 500 },
    {
      key: 'kind',
      label: 'Tipo de bonificación',
      type: 'choice',
      disabled: !!row,
      options: [
        { value: 'multiplier', label: 'Multiplicar puntos por monto' },
        { value: 'bonus_per_purchase', label: 'Puntos extra por pago' },
        { value: 'visit_milestone', label: 'Puntos cada N ' + frequency },
      ],
    },
    {
      key: 'multiplier',
      label: 'Multiplicador',
      type: 'number',
      visible: draft.kind === 'multiplier',
    },
    {
      key: 'bonus_points',
      label: 'Puntos extra',
      type: 'number',
      visible: draft.kind !== 'multiplier',
    },
    {
      key: 'visit_interval',
      label: 'Frecuencia (de 2 a 100)',
      type: 'number',
      visible: draft.kind === 'visit_milestone',
    },
    { key: 'starts_at', label: 'Inicio', type: 'date', hint: 'Fecha y hora del celular.' },
    { key: 'ends_at', label: 'Cierre', type: 'date' },
    { key: 'min_purchase_amount', label: 'Pago mínimo (opcional)', type: 'number' },
    {
      key: 'max_bonus_points_per_customer',
      label: 'Tope de bonificación por cliente (opcional)',
      type: 'number',
    },
    {
      key: 'max_bonus_points_total',
      label: 'Tope de bonificación de la campaña (opcional)',
      type: 'number',
    },
    { key: 'is_active', label: 'Campaña habilitada', type: 'toggle' },
  ]
  const save = async () => {
    const ok = await mutation.run(async () => savePointRule(buildPointRule(draft), row?.id))
    if (ok) onClose()
  }
  return (
    <BottomSheet
      visible
      tall
      title={row ? 'Editar campaña' : 'Nueva campaña'}
      onClose={() => {
        if (!mutation.busy) onClose()
      }}
      footer={
        <Action
          title={mutation.busy ? 'Guardando…' : 'Guardar campaña'}
          disabled={mutation.busy}
          onPress={() => void save()}
        />
      }
    >
      <Copy>
        Se aplica durante sus fechas y sin superar los topes. Si hay varias campañas, el servidor
        elige una.
      </Copy>
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
