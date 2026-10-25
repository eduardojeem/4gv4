import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { fetchSettings, updateSettings, type SystemSettings } from '@/lib/admin';
import { palette, usePalette } from '@/lib/palette';

export default function SettingsAdminScreen() {
  const colors = usePalette();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Form local state
  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ruc, setRuc] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('Gs.');
  const [taxRate, setTaxRate] = useState('10');
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [inventoryAlerts, setInventoryAlerts] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  useEffect(() => {
    let active = true;
    fetchSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setCompanyName(data.companyName || '');
        setLegalName(data.legalName || '');
        setRuc(data.ruc || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setAddress(data.address || '');
        setCity(data.city || '');
        setCurrencySymbol(data.currencySymbol || 'Gs.');
        setTaxRate(String(data.taxRate ?? 10));
        setAutoPrintInvoice(Boolean(data.autoPrintInvoice));
        setAllowNegativeStock(Boolean(data.allowNegativeStock));
        setInventoryAlerts(data.inventoryAlerts !== false);
        setLowStockThreshold(String(data.lowStockThreshold ?? 5));
      })
      .catch((err) => {
        if (active) Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo cargar la configuración.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        companyName: companyName.trim(),
        legalName: legalName.trim(),
        ruc: ruc.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        currencySymbol: currencySymbol.trim(),
        taxRate: Number(taxRate) || 10,
        autoPrintInvoice,
        allowNegativeStock,
        inventoryAlerts,
        lowStockThreshold: Number(lowStockThreshold) || 5,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Configuración guardada', 'Los cambios se aplicaron exitosamente a tu negocio.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <View style={styles.flex}>
          <Text style={[styles.topTitle, { color: colors.text }]}>Configuración</Text>
          <Text style={[styles.topSub, { color: colors.muted }]}>Parámetros de tu comercio y facturación</Text>
        </View>
        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          style={[styles.saveBtnTop, { opacity: saving || loading ? 0.6 : 1 }]}>
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={17} color="#fff" />
              <Text style={styles.saveBtnText}>Guardar</Text>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        {loading && !settings ? (
          <ActivityIndicator style={styles.loading} color={palette.primary} />
        ) : (
          <>
            {/* Datos del Negocio */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="storefront-outline" size={18} color={palette.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Datos del Comercio</Text>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Nombre comercial / de fantasía</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Mi Tienda"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Razón Social</Text>
                <TextInput
                  value={legalName}
                  onChangeText={setLegalName}
                  placeholder="Nombre legal o personal"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>RUC / Cédula</Text>
                <TextInput
                  value={ruc}
                  onChangeText={setRuc}
                  placeholder="Ej: 80012345-6"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.grid2}>
                <View style={[styles.field, styles.flex]}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Teléfono</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="0981 123 456"
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                </View>
                <View style={[styles.field, styles.flex]}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Ciudad</Text>
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    placeholder="Asunción"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Email de contacto</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="contacto@comercio.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Dirección física</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Calle y número de local"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>
            </View>

            {/* Moneda e Impuestos */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="cash-outline" size={18} color={palette.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Moneda e Impuestos</Text>
              </View>

              <View style={styles.grid2}>
                <View style={[styles.field, styles.flex]}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Símbolo de moneda</Text>
                  <TextInput
                    value={currencySymbol}
                    onChangeText={setCurrencySymbol}
                    placeholder="Gs."
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                </View>
                <View style={[styles.field, styles.flex]}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>IVA por defecto (%)</Text>
                  <TextInput
                    value={taxRate}
                    onChangeText={setTaxRate}
                    placeholder="10"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                </View>
              </View>
            </View>

            {/* Operaciones y Punto de Venta */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="hardware-chip-outline" size={18} color={palette.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Opciones Operativas</Text>
              </View>

              <View style={[styles.switchRow, { borderColor: colors.border }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Alertas de stock bajo</Text>
                  <Text style={[styles.switchSub, { color: colors.muted }]}>
                    Avisar cuando un producto llega a su nivel mínimo
                  </Text>
                </View>
                <Switch
                  value={inventoryAlerts}
                  onValueChange={setInventoryAlerts}
                  trackColor={{ false: colors.border, true: palette.primary }}
                />
              </View>

              {inventoryAlerts && (
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Umbral mínimo de unidades por defecto</Text>
                  <TextInput
                    value={lowStockThreshold}
                    onChangeText={setLowStockThreshold}
                    placeholder="5"
                    keyboardType="numeric"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  />
                </View>
              )}

              <View style={[styles.switchRow, { borderColor: colors.border }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Imprimir ticket al cobrar</Text>
                  <Text style={[styles.switchSub, { color: colors.muted }]}>
                    Abrir diálogo o imprimir comprobante tras cada cobro
                  </Text>
                </View>
                <Switch
                  value={autoPrintInvoice}
                  onValueChange={setAutoPrintInvoice}
                  trackColor={{ false: colors.border, true: palette.primary }}
                />
              </View>

              <View style={[styles.switchRow, { borderColor: colors.border }]}>
                <View style={styles.switchInfo}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Permitir venta con stock negativo</Text>
                  <Text style={[styles.switchSub, { color: colors.muted }]}>
                    Permitir continuar la venta aunque no figure inventario cargado
                  </Text>
                </View>
                <Switch
                  value={allowNegativeStock}
                  onValueChange={setAllowNegativeStock}
                  trackColor={{ false: colors.border, true: palette.primary }}
                />
              </View>
            </View>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.bottomSaveBtn, { opacity: saving ? 0.7 : 1 }]}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={styles.bottomSaveText}>Guardar todos los cambios</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  topSub: { fontSize: 12, marginTop: 1 },
  saveBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  content: { padding: 16, gap: 14, paddingBottom: 36 },
  loading: { paddingVertical: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  grid2: { flexDirection: 'row', gap: 10 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  switchInfo: { flex: 1, paddingRight: 10, gap: 2 },
  switchLabel: { fontSize: 13, fontWeight: '700' },
  switchSub: { fontSize: 11 },
  bottomSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 6,
  },
  bottomSaveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
