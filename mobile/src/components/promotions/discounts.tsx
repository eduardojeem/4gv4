import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { BottomSheet } from '../bottom-sheet'
import { fetchCategories, fetchProduct, fetchProducts, type Product } from '@/lib/products'
import {
  fetchPromotions,
  savePromotion,
  togglePromotion,
  deletePromotion,
  type Promotion,
} from '@/lib/promotions'
import {
  buildPromotion,
  promotionDraft,
  promotionStatus,
  type PromotionDraft,
} from '@/lib/promotions-model'
import { usePanel } from '@/lib/panel'
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
  type Field,
} from './ui'
export function useSearch() {
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350)
    return () => clearTimeout(timer)
  }, [query])
  return { query, setQuery, search }
}
export function Search({
  value,
  onChange,
  label = 'Buscar por nombre o código',
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const c = usePromotionColors()
  return (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={c.muted}
      value={value}
      onChangeText={onChange}
      style={{
        minHeight: 46,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        padding: 12,
        color: c.text,
        backgroundColor: c.card,
      }}
    />
  )
}
export function DiscountTab() {
  const colors = usePromotionColors()
  const { can } = usePanel()
  const [page, setPage] = useState(1)
  const search = useSearch()
  const [editor, setEditor] = useState<Promotion | null | undefined>(undefined)
  const loader = useCallback(() => fetchPromotions(page, search.search), [page, search.search])
  const resource = useResource(loader),
    mutation = useMutation(resource.refresh)
  return (
    <View style={{ gap: 14 }}>
      <Heading>Descuentos y ofertas</Heading>
      <Copy>
        Creá descuentos para caja, cupones para la tienda u ofertas automáticas para productos y
        servicios seleccionados. Se aplican al cobrar, no al reservar.
      </Copy>
      {can('promotions.create') ? (
        <Action title="Crear descuento" onPress={() => setEditor(null)} />
      ) : null}
      <Search
        value={search.query}
        onChange={(value) => {
          search.setQuery(value)
          setPage(1)
        }}
      />
      <Feedback error={mutation.error} message={mutation.message} />
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <Notice message={resource.error} onRetry={resource.refresh} />
      ) : resource.data ? (
        <>
          <Copy>{resource.data.pagination.total} promociones encontradas</Copy>
          {!resource.data.promotions.length ? (
            <Card>
              <Copy>
                No hay promociones para esta búsqueda. Podés crear la primera si tenés permiso.
              </Copy>
            </Card>
          ) : (
            resource.data.promotions.map((row) => (
              <Card key={row.id}>
                <Heading>{row.name}</Heading>
                <Copy>
                  {row.code} · {promotionStatus(row)}
                </Copy>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
                  {row.type === 'percentage'
                    ? row.value + '%'
                    : row.value.toLocaleString('es-PY') + ' de descuento'}
                </Text>
                <Copy>
                  {row.public_mode === 'automatic'
                    ? 'Oferta automática en la tienda'
                    : row.public_mode === 'coupon'
                      ? 'Cupón público para la tienda'
                      : 'Uso interno en caja'}{' '}
                  · {row.usage_count ?? 0} usos
                  {row.usage_limit != null ? ' de ' + row.usage_limit : ''}
                </Copy>
                <Copy>
                  {row.applicable_products?.length
                    ? row.applicable_products.length + ' productos o servicios seleccionados'
                    : row.applicable_categories?.length
                      ? row.applicable_categories.length + ' categorías seleccionadas'
                      : 'Aplicable a compras elegibles del negocio'}
                </Copy>
                {row.end_date ? (
                  <Copy>Hasta {new Date(row.end_date).toLocaleString('es-PY')}</Copy>
                ) : null}
                {can('promotions.update') ? (
                  <>
                    <Action
                      secondary
                      title={'Editar ' + row.name}
                      disabled={mutation.busy}
                      onPress={() => setEditor(row)}
                    />
                    <Action
                      secondary
                      title={row.is_active ? 'Pausar promoción' : 'Habilitar promoción'}
                      disabled={mutation.busy}
                      onPress={() =>
                        void mutation.run(() => togglePromotion(row.id, !row.is_active))
                      }
                    />
                  </>
                ) : null}
                {can('promotions.delete') ? (
                  <Action
                    secondary
                    danger
                    title="Eliminar promoción"
                    disabled={mutation.busy}
                    onPress={() =>
                      confirmAction(
                        'Eliminar promoción',
                        'Se eliminará ' + row.name + '. Esta acción no se puede deshacer.',
                        () =>
                          void mutation.run(() => deletePromotion(row.id), 'Promoción eliminada'),
                      )
                    }
                  />
                ) : null}
              </Card>
            ))
          )}
          <Pagination page={page} pages={resource.data.pagination.pages} onPage={setPage} />
        </>
      ) : null}
      {editor !== undefined ? (
        <DiscountEditor
          row={editor}
          onClose={() => setEditor(undefined)}
          onSaved={resource.refresh}
        />
      ) : null}
    </View>
  )
}
export function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (page: number) => void
}) {
  return pages > 1 ? (
    <View style={{ gap: 8 }}>
      <Copy>
        Página {page} de {pages}
      </Copy>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Action
            title="Anterior"
            secondary
            disabled={page <= 1}
            onPress={() => onPage(page - 1)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Action
            title="Siguiente"
            secondary
            disabled={page >= pages}
            onPress={() => onPage(page + 1)}
          />
        </View>
      </View>
    </View>
  ) : null
}
function DiscountEditor({
  row,
  onClose,
  onSaved,
}: {
  row: Promotion | null
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(() => promotionDraft(row ?? undefined))
  const mutation = useMutation(onSaved)
  const change = (key: string, value: string | boolean) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const fields: Field[] = [
    { key: 'name', label: 'Nombre de la promoción', maxLength: 160 },
    {
      key: 'code',
      label: 'Código',
      hint: 'Ejemplo: MARTES15. El cliente lo usa para identificar el beneficio.',
    },
    { key: 'description', label: 'Descripción', type: 'multiline' },
    {
      key: 'type',
      label: 'Tipo de descuento',
      type: 'choice',
      options: [
        { value: 'percentage', label: 'Porcentaje (%)' },
        { value: 'fixed', label: 'Monto fijo en la moneda del negocio' },
      ],
    },
    {
      key: 'value',
      label: draft.type === 'percentage' ? 'Descuento (%)' : 'Monto de descuento',
      type: 'number',
      hint: 'Usá números sin separadores de miles.',
    },
    {
      key: 'public_mode',
      label: 'Dónde se ofrece',
      type: 'choice',
      options: [
        { value: 'disabled', label: 'Solo en caja' },
        { value: 'coupon', label: 'Cupón en la tienda online' },
        { value: 'automatic', label: 'Oferta automática en productos o servicios' },
      ],
    },
    {
      key: 'start_date',
      label: 'Inicio (opcional)',
      type: 'date',
      hint: 'Se usa la zona horaria del celular.',
    },
    { key: 'end_date', label: 'Fin (opcional)', type: 'date' },
    { key: 'min_purchase', label: 'Pago mínimo (opcional)', type: 'number' },
    {
      key: 'max_discount',
      label: 'Descuento máximo (opcional)',
      type: 'number',
      visible: draft.type === 'percentage',
    },
    { key: 'usage_limit', label: 'Límite total de usos (opcional)', type: 'number' },
    {
      key: 'is_active',
      label: 'Promoción habilitada',
      type: 'toggle',
      hint: 'La vigencia también depende de fechas y usos disponibles.',
    },
  ]
  const save = async () => {
    const ok = await mutation.run(async () => savePromotion(buildPromotion(draft), row?.id))
    if (ok) onClose()
  }
  return (
    <BottomSheet
      visible
      title={row ? 'Editar descuento' : 'Nuevo descuento'}
      subtitle="El formulario conserva lo ingresado si falla el guardado."
      tall
      onClose={() => {
        if (!mutation.busy) onClose()
      }}
      footer={
        <Action
          title={mutation.busy ? 'Guardando…' : 'Guardar descuento'}
          disabled={mutation.busy}
          onPress={() => void save()}
        />
      }
    >
      <Fields fields={fields} values={draft} onChange={change} disabled={mutation.busy} />
      <ProductScope draft={draft} setDraft={setDraft} disabled={mutation.busy} />
      <Feedback error={mutation.error} />
    </BottomSheet>
  )
}
function ProductScope({
  draft,
  setDraft,
  disabled,
}: {
  draft: PromotionDraft
  setDraft: React.Dispatch<React.SetStateAction<PromotionDraft>>
  disabled: boolean
}) {
  const [specific, setSpecific] = useState(
    !!draft.applicable_products.length ||
      !!draft.applicable_categories.length ||
      draft.public_mode === 'automatic',
  )
  const c = usePromotionColors()
  const search = useSearch()
  const [page, setPage] = useState(1)
  const loader = useCallback(
    () => fetchProducts({ query: search.search, page }),
    [search.search, page],
  )
  const products = useResource(loader)
  const categories = useResource(fetchCategories)
  const [names, setNames] = useState<Record<string, string>>({})
  const initialIds = useState(() => draft.applicable_products)[0]
  useEffect(() => {
    let active = true
    Promise.allSettled(initialIds.map((id) => fetchProduct(id))).then((results) => {
      if (active)
        setNames(
          Object.fromEntries(
            results.flatMap((item, index) =>
              item.status === 'fulfilled' ? [[initialIds[index], item.value.name]] : [],
            ),
          ),
        )
    })
    return () => {
      active = false
    }
  }, [initialIds])
  const scoped = specific || draft.public_mode === 'automatic'
  const toggle = (id: string) =>
    setDraft((current) => ({
      ...current,
      applicable_products: current.applicable_products.includes(id)
        ? current.applicable_products.filter((item) => item !== id)
        : [...current.applicable_products, id],
    }))
  return (
    <View style={{ gap: 12 }}>
      <Heading>Productos y servicios incluidos</Heading>
      <Action
        secondary
        disabled={disabled || draft.public_mode === 'automatic'}
        title={scoped ? 'Usar descuento general' : 'Elegir productos, servicios o categorías'}
        onPress={() => {
          setSpecific(!scoped)
          if (scoped)
            setDraft((current) => ({
              ...current,
              applicable_products: [],
              applicable_categories: [],
            }))
        }}
      />
      {scoped ? (
        <>
          <Copy>
            Elegí sobre qué productos o servicios se aplica. Una oferta automática requiere al menos
            uno.
          </Copy>
          {draft.applicable_products.map((id) => (
            <Action
              key={id}
              secondary
              disabled={disabled}
              title={
                'Quitar: ' +
                (names[id] ??
                  products.data?.products.find((p) => p.id === id)?.name ??
                  'Producto seleccionado (' + id.slice(-6) + ')')
              }
              onPress={() => toggle(id)}
            />
          ))}
          <Search
            value={search.query}
            onChange={(value) => {
              search.setQuery(value)
              setPage(1)
            }}
            label="Buscar producto o servicio"
          />
          {products.loading ? (
            <Loading />
          ) : products.error ? (
            <Notice message={products.error} onRetry={products.refresh} />
          ) : products.data ? (
            <>
              {products.data.products.map((product: Product) => (
                <Pressable
                  key={product.id}
                  disabled={disabled}
                  accessibilityRole="checkbox"
                  accessibilityLabel={product.name}
                  accessibilityState={{
                    checked: draft.applicable_products.includes(product.id),
                    disabled,
                  }}
                  onPress={() => {
                    setNames((current) => ({ ...current, [product.id]: product.name }))
                    toggle(product.id)
                  }}
                  style={{ padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 10 }}
                >
                  <Text style={{ color: c.text }}>
                    {draft.applicable_products.includes(product.id) ? '☑ ' : '☐ '}
                    {product.name}
                  </Text>
                </Pressable>
              ))}
              {!products.data.products.length ? (
                <Copy>No se encontraron productos o servicios.</Copy>
              ) : null}
              <Pagination
                page={page}
                pages={Math.ceil(products.data.total / products.data.per_page)}
                onPage={setPage}
              />
            </>
          ) : null}
          <Heading>Categorías (opcional)</Heading>
          {categories.loading ? (
            <Loading />
          ) : categories.error ? (
            <Notice message={categories.error} onRetry={categories.refresh} />
          ) : (
            categories.data?.map((category) => (
              <Pressable
                key={category.id}
                disabled={disabled}
                accessibilityRole="checkbox"
                accessibilityLabel={category.name}
                accessibilityState={{
                  checked: draft.applicable_categories.includes(category.id),
                  disabled,
                }}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    applicable_categories: current.applicable_categories.includes(category.id)
                      ? current.applicable_categories.filter((id) => id !== category.id)
                      : [...current.applicable_categories, category.id],
                  }))
                }
                style={{ padding: 10 }}
              >
                <Text style={{ color: c.text }}>
                  {draft.applicable_categories.includes(category.id) ? '☑ ' : '☐ '}
                  {category.name}
                </Text>
              </Pressable>
            ))
          )}
        </>
      ) : null}
    </View>
  )
}
