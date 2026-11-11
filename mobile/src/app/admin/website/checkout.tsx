import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { WebsiteImageField } from '@/components/website/website-image-field';
import {
  Field,
  Notice,
  SaveBar,
  Section,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
} from '@/components/website/website-ui';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { saveWebsiteSettings, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  CHECKOUT_RECOMMENDATIONS,
  brandHex,
  fillCartTextsFromCompany,
  guidanceFamily,
  isDirty,
  newSlideId,
  normalizeCheckoutSettings,
  reviewCartSetup,
  transferAccounts,
  type BankTransferOption,
  type CheckoutSettings,
  type CommerceMode,
  type DeliveryZoneOption,
  type WebsiteSettings,
} from '@/lib/website-model';

const COMMERCE_MODES: {
  value: CommerceMode;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'cart',
    title: 'Carrito online',
    desc: 'Compran directo en tu tienda eligiendo entrega y medio de pago.',
    icon: 'cart-outline',
  },
  {
    value: 'whatsapp',
    title: 'Pedidos por WhatsApp',
    desc: 'Arman su pedido y te lo mandan listo por WhatsApp para coordinar.',
    icon: 'logo-whatsapp',
  },
  {
    value: 'catalog',
    title: 'Solo catálogo digital',
    desc: 'Muestra productos y precios como vitrina, sin carrito ni checkout.',
    icon: 'book-outline',
  },
];

const parseMoney = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

export default function CheckoutScreen() {
  return (
    <WebsiteGate title="Pagos y entregas">
      {(settings) => <CheckoutEditor settings={settings} />}
    </WebsiteGate>
  );
}

function CheckoutEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, capabilities } = useWebsite();

  const saved = useMemo(
    () => normalizeCheckoutSettings(settings.checkout),
    [settings.checkout],
  );
  const [checkout, setCheckout] = useState<CheckoutSettings>(saved);
  const [saving, setSaving] = useState(false);

  const dirty = isDirty(saved, checkout);
  const family = guidanceFamily(capabilities);
  const recommendation = CHECKOUT_RECOMMENDATIONS[family];
  const accent = brandHex(settings.company_info);

  const setupIssues = useMemo(
    () =>
      reviewCartSetup(checkout, {
        company: settings.company_info,
        deliveryModuleEnabled: capabilities.hasDeliveryModule,
      }),
    [checkout, settings.company_info, capabilities.hasDeliveryModule],
  );
  const blockingErrors = setupIssues.filter((i) => i.level === 'error');
  const warnings = setupIssues.filter((i) => i.level === 'warn');

  const updatePayment = (
    key: 'cash' | 'card' | 'transfer' | 'digital_wallet',
    patch: Partial<CheckoutSettings['payment']['cash']>,
  ) => {
    setCheckout((prev) => ({
      ...prev,
      payment: {
        ...prev.payment,
        [key]: { ...prev.payment[key], ...patch },
      },
    }));
  };

  const accounts = useMemo(
    () => transferAccounts(checkout.payment.transfer),
    [checkout.payment.transfer],
  );
  const setAccounts = (next: BankTransferOption[]) => {
    updatePayment('transfer', { transferOptions: next });
  };

  const zones = checkout.delivery.zoneOptions ?? [];
  const setZones = (next: DeliveryZoneOption[]) => {
    setCheckout((prev) => ({
      ...prev,
      delivery: { ...prev.delivery, zoneOptions: next },
    }));
  };

  const applyRecommendation = () => {
    setCheckout((prev) => ({
      ...prev,
      commerceMode: recommendation.mode,
      pickup: { ...prev.pickup, enabled: recommendation.pickup },
      delivery: {
        ...prev.delivery,
        enabled: capabilities.hasDeliveryModule && recommendation.delivery,
      },
      payment: {
        ...prev.payment,
        cash: { ...prev.payment.cash, enabled: recommendation.cash },
        card: { ...prev.payment.card, enabled: recommendation.card },
      },
    }));
    void Haptics.selectionAsync();
  };

  const fillTexts = () => {
    setCheckout((prev) => fillCartTextsFromCompany(prev, settings.company_info));
    void Haptics.selectionAsync();
  };

  const save = useCallback(async () => {
    if (blockingErrors.length > 0) {
      Alert.alert(
        'Faltan datos obligatorios',
        blockingErrors.map((e) => `• ${e.message}`).join('\n'),
      );
      return false;
    }
    setSaving(true);
    try {
      const persisted = await saveWebsiteSettings({ checkout });
      applySaved(persisted as Partial<WebsiteSettings>);
      if (persisted.checkout) {
        setCheckout(
          normalizeCheckoutSettings(persisted.checkout as CheckoutSettings),
        );
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar Pagos y entregas. Revisá tu conexión e intentá nuevamente.',
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [blockingErrors, checkout, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  const activePaymentNames = [
    checkout.payment.cash.enabled && (checkout.payment.cash.label || 'Efectivo'),
    checkout.payment.card.enabled && (checkout.payment.card.label || 'Tarjeta'),
    checkout.payment.transfer.enabled &&
      (checkout.payment.transfer.label || 'Transferencia'),
    checkout.payment.digital_wallet.enabled &&
      (checkout.payment.digital_wallet.label || 'Billetera'),
  ].filter(Boolean) as string[];

  const hasWhatsappPhone = Boolean(
    (settings.company_info.whatsapp || settings.company_info.phone || '').replace(
      /\D/g,
      '',
    ).length >= 6,
  );

  return (
    <WebsiteScreen
      saving={saving}
      title="Pagos y entregas"
      subtitle="Cómo compran y reciben en tu tienda"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setCheckout(saved)}
        />
      }
    >
      <OfflineNotice />

      {/* Vista previa del cliente */}
      <View
        style={[
          styles.previewCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.previewHead}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>
            Así ve el checkout tu cliente
          </Text>
          <StatusPill
            label={
              COMMERCE_MODES.find((m) => m.value === checkout.commerceMode)
                ?.title ?? 'Carrito'
            }
            tone="primary"
          />
        </View>
        {checkout.commerceMode === 'cart' ? (
          <View style={styles.previewDetails}>
            <Text style={[styles.previewLine, { color: colors.muted }]}>
              Pagos:{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {activePaymentNames.length
                  ? activePaymentNames.join(' · ')
                  : 'Ninguno activo'}
              </Text>
            </Text>
            <Text style={[styles.previewLine, { color: colors.muted }]}>
              Entrega:{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {[
                  checkout.pickup.enabled && 'Retiro gratis',
                  checkout.delivery.enabled &&
                    capabilities.hasDeliveryModule &&
                    (checkout.delivery.defaultCost > 0
                      ? `Delivery desde ${formatGs(checkout.delivery.defaultCost)}`
                      : 'Delivery (a coordinar / por zona)'),
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Sin entrega activa'}
              </Text>
            </Text>
            {checkout.minOrderAmount > 0 ? (
              <Text style={[styles.previewLine, { color: accent, fontWeight: '700' }]}>
                Pedido mínimo: {formatGs(checkout.minOrderAmount)}
              </Text>
            ) : null}
          </View>
        ) : checkout.commerceMode === 'whatsapp' ? (
          <Text style={[styles.previewLine, { color: colors.muted }]}>
            Al confirmar su carrito, se abre WhatsApp con el detalle armado para{' '}
            {settings.company_info.whatsapp || settings.company_info.phone || 'tu negocio'}.
          </Text>
        ) : (
          <Text style={[styles.previewLine, { color: colors.muted }]}>
            Catálogo en modo vitrina: se muestran precios sin botones de compra.
          </Text>
        )}
      </View>

      {/* Recomendación según rubro */}
      <View
        style={[
          styles.recCard,
          {
            backgroundColor: `${palette.primary}0D`,
            borderColor: `${palette.primary}35`,
          },
        ]}
      >
        <View style={styles.recHead}>
          <Ionicons name="bulb-outline" size={17} color={palette.primary} />
          <Text style={[styles.recTitle, { color: colors.text }]}>
            Recomendación para tu rubro
          </Text>
        </View>
        <Text style={[styles.recBody, { color: colors.muted }]}>
          {recommendation.summary}
        </Text>
        <Pressable onPress={applyRecommendation} style={styles.recBtn}>
          <Text style={styles.recBtnText}>Aplicar recomendación</Text>
        </Pressable>
      </View>

      {/* Alertas de validación */}
      {blockingErrors.map((issue) => (
        <Notice key={issue.id} tone="danger" text={issue.message} />
      ))}
      {warnings.map((issue) => (
        <Notice
          key={issue.id}
          tone="warning"
          text={issue.message}
          actionLabel={
            issue.fixIn === 'company' ? 'Cargar dirección en Negocio' : undefined
          }
          onAction={
            issue.fixIn === 'company'
              ? () => router.push('/admin/website/business' as never)
              : undefined
          }
        />
      ))}

      {/* Modalidad de venta */}
      <Section title="Modalidad de venta" icon="storefront-outline">
        {COMMERCE_MODES.map((mode) => {
          const selected = checkout.commerceMode === mode.value;
          return (
            <Pressable
              key={mode.value}
              onPress={() =>
                setCheckout((prev) => ({ ...prev, commerceMode: mode.value }))
              }
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.modeCard,
                {
                  borderColor: selected ? palette.primary : colors.border,
                  backgroundColor: selected
                    ? `${palette.primary}0E`
                    : colors.background,
                },
              ]}
            >
              <Ionicons
                name={mode.icon}
                size={21}
                color={selected ? palette.primary : colors.muted}
              />
              <View style={styles.flex}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.modeTitle, { color: colors.text }]}>
                    {mode.title}
                  </Text>
                  {selected ? (
                    <StatusPill label="Activa" tone="primary" />
                  ) : null}
                </View>
                <Text style={[styles.modeDesc, { color: colors.muted }]}>
                  {mode.desc}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {checkout.commerceMode === 'whatsapp' && !hasWhatsappPhone ? (
          <Notice
            tone="warning"
            text="Para recibir pedidos por WhatsApp necesitás cargar un número válido en Negocio."
            actionLabel="Configurar WhatsApp"
            onAction={() => router.push('/admin/website/business' as never)}
          />
        ) : null}
      </Section>

      {/* Si es carrito: pagos, cuentas, QR, delivery, pickup y confirmación */}
      {checkout.commerceMode === 'cart' ? (
        <>
          <Section
            title="Medios de pago"
            icon="card-outline"
            hint="Activá los medios disponibles al finalizar la compra."
          >
            {/* Efectivo */}
            <PaymentBlock
              label="Efectivo"
              icon="cash-outline"
              config={checkout.payment.cash}
              onChange={(patch) => updatePayment('cash', patch)}
              placeholder="Ej: Pagás al recibir o retirar en el local."
            />

            {/* Tarjeta */}
            <PaymentBlock
              label="Tarjeta / POS"
              icon="card-outline"
              config={checkout.payment.card}
              onChange={(patch) => updatePayment('card', patch)}
              placeholder="Ej: Posnet disponible para débito y crédito."
            />

            {/* Transferencia bancaria */}
            <PaymentBlock
              label="Transferencia bancaria"
              icon="business-outline"
              config={checkout.payment.transfer}
              onChange={(patch) => updatePayment('transfer', patch)}
              placeholder="Ej: Envianos el comprobante por WhatsApp."
            >
              {checkout.payment.transfer.enabled ? (
                <View style={styles.subList}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.subTitle, { color: colors.text }]}>
                      Cuentas bancarias ({accounts.length}/8)
                    </Text>
                    {accounts.length < 8 ? (
                      <Pressable
                        onPress={() =>
                          setAccounts([
                            ...accounts,
                            {
                              id: newSlideId(),
                              bankName: '',
                              alias: '',
                              accountNumber: '',
                              accountHolder: '',
                            },
                          ])
                        }
                        style={styles.addSmallBtn}
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={16}
                          color={palette.primary}
                        />
                        <Text style={styles.addSmallText}>Agregar cuenta</Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {accounts.length === 0 ? (
                    <Notice
                      tone="warning"
                      text="Agregá al menos una cuenta bancaria con alias o número para completar la transferencia."
                    />
                  ) : null}

                  {accounts.map((acc, idx) => (
                    <View
                      key={acc.id || idx}
                      style={[
                        styles.nestedCard,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ]}
                    >
                      <View style={styles.rowBetween}>
                        <Text
                          style={[styles.nestedHead, { color: colors.text }]}
                        >
                          Cuenta #{idx + 1}
                        </Text>
                        <Pressable
                          onPress={() =>
                            setAccounts(accounts.filter((_, i) => i !== idx))
                          }
                          hitSlop={8}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color={palette.danger}
                          />
                        </Pressable>
                      </View>
                      <Field
                        label="Banco / Entidad"
                        value={acc.bankName}
                        onChangeText={(val) =>
                          setAccounts(
                            accounts.map((a, i) =>
                              i === idx ? { ...a, bankName: val } : a,
                            ),
                          )
                        }
                        placeholder="Ej: Banco Itaú / Ueno"
                      />
                      <Field
                        label="Alias"
                        value={acc.alias ?? ''}
                        onChangeText={(val) =>
                          setAccounts(
                            accounts.map((a, i) =>
                              i === idx ? { ...a, alias: val } : a,
                            ),
                          )
                        }
                        placeholder="Ej: 4123456 o mitienda.py"
                      />
                      <Field
                        label="Número de cuenta"
                        value={acc.accountNumber ?? ''}
                        onChangeText={(val) =>
                          setAccounts(
                            accounts.map((a, i) =>
                              i === idx ? { ...a, accountNumber: val } : a,
                            ),
                          )
                        }
                        placeholder="Opcional si ya cargaste alias"
                      />
                      <Field
                        label="Titular"
                        value={acc.accountHolder ?? ''}
                        onChangeText={(val) =>
                          setAccounts(
                            accounts.map((a, i) =>
                              i === idx ? { ...a, accountHolder: val } : a,
                            ),
                          )
                        }
                        placeholder="Nombre y apellido / Razón social"
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </PaymentBlock>

            {/* Billetera digital / QR */}
            <PaymentBlock
              label="Billetera digital / QR"
              icon="qr-code-outline"
              config={checkout.payment.digital_wallet}
              onChange={(patch) => updatePayment('digital_wallet', patch)}
              placeholder="Ej: Escaneá nuestro QR o transferí al alias."
            >
              {checkout.payment.digital_wallet.enabled ? (
                <View style={styles.subList}>
                  <Field
                    label="Alias o número de billetera"
                    value={checkout.payment.digital_wallet.walletAlias ?? ''}
                    onChangeText={(val) =>
                      updatePayment('digital_wallet', { walletAlias: val })
                    }
                    placeholder="Ej: 0981 123 456 (Tigo Money / Billetera)"
                  />
                  <WebsiteImageField
                    label="Imagen del código QR (opcional)"
                    kind="banner"
                    slideId="checkout-qr"
                    aspect="square"
                    value={checkout.payment.digital_wallet.qrImageUrl}
                    onUploaded={(url) =>
                      updatePayment('digital_wallet', { qrImageUrl: url })
                    }
                    onClear={() =>
                      updatePayment('digital_wallet', { qrImageUrl: '' })
                    }
                    help="Subí la captura del QR para que paguen rápido."
                  />
                </View>
              ) : null}
            </PaymentBlock>
          </Section>

          {/* Delivery */}
          <Section
            title="Envíos a domicilio"
            icon="bicycle-outline"
            hint="Tarifas, tiempo estimado y zonas de cobertura."
          >
            {!capabilities.hasDeliveryModule ? (
              <Notice text="Tu plan actual no incluye el módulo Delivery. Podés ofrecer retiro en el local o envíos coordinados." />
            ) : (
              <>
                <ToggleRow
                  label="Ofrecer envíos a domicilio"
                  value={checkout.delivery.enabled}
                  onValueChange={(value) =>
                    setCheckout((prev) => ({
                      ...prev,
                      delivery: { ...prev.delivery, enabled: value },
                    }))
                  }
                />
                {checkout.delivery.enabled ? (
                  <>
                    <View style={styles.twoCol}>
                      <View style={styles.flex}>
                        <Field
                          label="Costo base (Gs.)"
                          value={
                            checkout.delivery.defaultCost
                              ? String(checkout.delivery.defaultCost)
                              : ''
                          }
                          onChangeText={(val) =>
                            setCheckout((prev) => ({
                              ...prev,
                              delivery: {
                                ...prev.delivery,
                                defaultCost: parseMoney(val),
                              },
                            }))
                          }
                          keyboardType="number-pad"
                          placeholder="0 (a coordinar)"
                        />
                      </View>
                      <View style={styles.flex}>
                        <Field
                          label="Envío gratis desde (Gs.)"
                          value={
                            checkout.delivery.freeThreshold
                              ? String(checkout.delivery.freeThreshold)
                              : ''
                          }
                          onChangeText={(val) =>
                            setCheckout((prev) => ({
                              ...prev,
                              delivery: {
                                ...prev.delivery,
                                freeThreshold: parseMoney(val),
                              },
                            }))
                          }
                          keyboardType="number-pad"
                          placeholder="0 (sin envío gratis)"
                        />
                      </View>
                    </View>
                    <Field
                      label="Tiempo estimado de entrega"
                      value={checkout.delivery.estimatedTime}
                      onChangeText={(val) =>
                        setCheckout((prev) => ({
                          ...prev,
                          delivery: { ...prev.delivery, estimatedTime: val },
                        }))
                      }
                      placeholder="30–60 min o en el día"
                    />
                    <Field
                      label="Instrucciones de entrega"
                      value={checkout.delivery.instructions ?? ''}
                      onChangeText={(val) =>
                        setCheckout((prev) => ({
                          ...prev,
                          delivery: { ...prev.delivery, instructions: val },
                        }))
                      }
                      multiline
                      placeholder="Ej: Avisamos por WhatsApp antes de salir."
                    />

                    {/* Zonas con tarifa diferenciada */}
                    <View style={styles.subList}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.subTitle, { color: colors.text }]}>
                          Zonas y tarifas ({zones.length}/20)
                        </Text>
                        {zones.length < 20 ? (
                          <Pressable
                            onPress={() =>
                              setZones([
                                ...zones,
                                { id: newSlideId(), name: '', cost: 0 },
                              ])
                            }
                            style={styles.addSmallBtn}
                          >
                            <Ionicons
                              name="add-circle-outline"
                              size={16}
                              color={palette.primary}
                            />
                            <Text style={styles.addSmallText}>
                              Agregar zona
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {zones.map((z, idx) => (
                        <View
                          key={z.id || idx}
                          style={[
                            styles.zoneRow,
                            {
                              borderColor: colors.border,
                              backgroundColor: colors.background,
                            },
                          ]}
                        >
                          <TextInput
                            value={z.name}
                            onChangeText={(val) =>
                              setZones(
                                zones.map((item, i) =>
                                  i === idx ? { ...item, name: val } : item,
                                ),
                              )
                            }
                            placeholder="Zona / Ciudad"
                            placeholderTextColor={colors.muted}
                            style={[styles.zoneNameInput, { color: colors.text }]}
                          />
                          <TextInput
                            value={z.cost ? String(z.cost) : ''}
                            onChangeText={(val) =>
                              setZones(
                                zones.map((item, i) =>
                                  i === idx
                                    ? { ...item, cost: parseMoney(val) }
                                    : item,
                                ),
                              )
                            }
                            placeholder="Gs."
                            keyboardType="number-pad"
                            placeholderTextColor={colors.muted}
                            style={[
                              styles.zoneCostInput,
                              {
                                color: colors.text,
                                borderLeftColor: colors.border,
                              },
                            ]}
                          />
                          <Pressable
                            onPress={() =>
                              setZones(zones.filter((_, i) => i !== idx))
                            }
                            hitSlop={8}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={palette.danger}
                            />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            )}
          </Section>

          {/* Retiro en local */}
          <Section title="Retiro en el local" icon="bag-check-outline">
            <ToggleRow
              label="Permitir retiro en sucursal"
              value={checkout.pickup.enabled}
              onValueChange={(value) =>
                setCheckout((prev) => ({
                  ...prev,
                  pickup: { ...prev.pickup, enabled: value },
                }))
              }
            />
            {checkout.pickup.enabled ? (
              <>
                <Field
                  label="Demora de preparación"
                  value={checkout.pickup.estimatedTime}
                  onChangeText={(val) =>
                    setCheckout((prev) => ({
                      ...prev,
                      pickup: { ...prev.pickup, estimatedTime: val },
                    }))
                  }
                  placeholder="20–30 min"
                />
                <Field
                  label="Instrucciones de retiro"
                  value={checkout.pickup.instructions ?? ''}
                  onChangeText={(val) =>
                    setCheckout((prev) => ({
                      ...prev,
                      pickup: { ...prev.pickup, instructions: val },
                    }))
                  }
                  multiline
                  placeholder="Dirección y horarios para pasar a retirar."
                />
              </>
            ) : null}
          </Section>

          {/* Reglas del pedido & mensaje final */}
          <Section
            title="Pedido mínimo y confirmación"
            icon="receipt-outline"
            right={
              <Pressable onPress={fillTexts} hitSlop={6}>
                <Text style={styles.fillLink}>Autocompletar textos</Text>
              </Pressable>
            }
          >
            <Field
              label="Monto mínimo de compra (Gs.)"
              value={
                checkout.minOrderAmount ? String(checkout.minOrderAmount) : ''
              }
              onChangeText={(val) =>
                setCheckout((prev) => ({
                  ...prev,
                  minOrderAmount: parseMoney(val),
                }))
              }
              keyboardType="number-pad"
              placeholder="0 (sin mínimo)"
            />
            <Field
              label="Mensaje al confirmar el pedido"
              value={checkout.confirmationMessage ?? ''}
              onChangeText={(val) =>
                setCheckout((prev) => ({ ...prev, confirmationMessage: val }))
              }
              multiline
              maxLength={400}
              showCount
              placeholder="¡Gracias por tu compra! Ya recibimos tu pedido…"
            />
          </Section>
        </>
      ) : null}
    </WebsiteScreen>
  );
}

function PaymentBlock({
  label,
  icon,
  config,
  onChange,
  placeholder,
  children,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  config: CheckoutSettings['payment']['cash'];
  onChange: (patch: Partial<CheckoutSettings['payment']['cash']>) => void;
  placeholder: string;
  children?: React.ReactNode;
}) {
  const colors = usePalette();
  return (
    <View
      style={[
        styles.payBlock,
        {
          borderColor: config.enabled ? palette.primary : colors.border,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.payHead}>
        <Ionicons
          name={icon}
          size={18}
          color={config.enabled ? palette.primary : colors.muted}
        />
        <Text style={[styles.payTitle, { color: colors.text }]}>{label}</Text>
        <Switch
          value={config.enabled}
          onValueChange={(value) => onChange({ enabled: value })}
          trackColor={{ false: colors.border, true: palette.primary }}
        />
      </View>
      {config.enabled ? (
        <View style={styles.payFields}>
          <Field
            label="Nombre visible para el cliente"
            value={config.label ?? label}
            onChangeText={(val) => onChange({ label: val })}
            maxLength={50}
          />
          <Field
            label="Instrucciones (opcional)"
            value={config.instructions ?? ''}
            onChangeText={(val) => onChange({ instructions: val })}
            placeholder={placeholder}
            multiline
            maxLength={300}
          />
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewTitle: { fontSize: 14, fontWeight: '800' },
  previewDetails: { gap: 4 },
  previewLine: { fontSize: 12, lineHeight: 18 },
  recCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  recHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recTitle: { fontSize: 13, fontWeight: '800' },
  recBody: { fontSize: 12, lineHeight: 17 },
  recBtn: {
    alignSelf: 'flex-start',
    backgroundColor: palette.primary,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 2,
  },
  recBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  modeTitle: { fontSize: 14, fontWeight: '800' },
  modeDesc: { fontSize: 12, marginTop: 2 },
  payBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  payHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  payTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  payFields: { gap: 10 },
  subList: { gap: 8, paddingTop: 4 },
  subTitle: { fontSize: 13, fontWeight: '800' },
  addSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addSmallText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  nestedCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  nestedHead: { fontSize: 13, fontWeight: '800' },
  twoCol: { flexDirection: 'row', gap: 10 },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  zoneNameInput: { flex: 1.4, fontSize: 13 },
  zoneCostInput: {
    flex: 0.9,
    fontSize: 13,
    borderLeftWidth: 1,
    paddingLeft: 8,
  },
  fillLink: { color: palette.primary, fontSize: 12, fontWeight: '800' },
});
