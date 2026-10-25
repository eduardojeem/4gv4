import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { WebsiteGate, OfflineNotice } from '@/components/website/website-gate';
import { WebsiteImageField } from '@/components/website/website-image-field';
import { Field, SaveBar, Section, ToggleRow, WebsiteScreen, useUnsavedChangesGuard, websiteStyles } from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import { saveCompanyInfo, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  BRAND_COLORS,
  HEADER_STYLES,
  STOREFRONT_STYLES,
  brandHex,
  companyIssues,
  isDirty,
  mergeSetting,
  type CompanyInfo,
  type WebsiteSettings,
} from '@/lib/website-model';

export default function AppearanceScreen() {
  return <WebsiteGate title="Apariencia">{(settings) => <AppearanceEditor settings={settings} />}</WebsiteGate>;
}

function AppearanceEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const saved = settings.company_info;
  const [patch, setPatch] = useState<Partial<CompanyInfo>>({});
  const [saving, setSaving] = useState(false);
  const company = useMemo(() => mergeSetting<CompanyInfo>(saved, patch), [saved, patch]);
  const dirty = isDirty(saved, company);
  const issues = companyIssues(company);
  const set = (next: Partial<CompanyInfo>) => setPatch((current) => ({ ...current, ...next }));

  const save = useCallback(async () => {
    if (issues.customBrandColor) {
      Alert.alert('Revisá el color', issues.customBrandColor);
      return false;
    }
    setSaving(true);
    try {
      const result = await saveCompanyInfo(saved, patch);
      applySaved({ company_info: result ?? company });
      setPatch({});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('No pudimos guardar', websiteErrorMessage(error, 'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues.customBrandColor, saved, patch, company, applySaved]);

  useUnsavedChangesGuard(dirty && !saving, save);

  const accent = brandHex(company);
  const header = company.headerStyle === 'dark' ? '#0B0F19' : company.headerStyle === 'accent' ? accent : '#FFFFFF';
  const headerText = company.headerStyle === 'solid' || company.headerStyle === 'glass' || !company.headerStyle ? '#0F172A' : '#FFFFFF';

  return (
    <WebsiteScreen title="Apariencia" subtitle="Logo, colores y estilo" footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <OfflineNotice />
      <View style={[styles.preview, { borderColor: colors.border }]} accessible accessibilityLabel="Vista previa de la apariencia">
        <View style={[styles.previewHeader, { backgroundColor: header }]}>
          {company.logoUrl ? <Image source={{ uri: company.logoUrl }} style={styles.previewLogo} contentFit="contain" /> : <View style={[styles.previewLogo, { backgroundColor: accent }]} />}
          <Text numberOfLines={1} style={[styles.previewName, { color: headerText }]}>{company.name || 'Tu tienda'}</Text>
        </View>
        <View style={styles.previewBody}>
          <Text style={styles.previewTitle}>{settings.hero_content?.title || 'Bienvenido a tu tienda'}</Text>
          <View style={[styles.previewButton, { backgroundColor: accent }]}>
            <Text style={styles.previewButtonText}>{settings.hero_content?.ctaPrimaryText || 'Comprar ahora'}</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.caption, { color: colors.muted }]}>Vista aproximada: los cambios se ven acá antes de guardar.</Text>

      <Section title="Logo" icon="image-outline">
        <WebsiteImageField label="Logo de la tienda" kind="logo" value={company.logoUrl} onUploaded={(url) => set({ logoUrl: url })} help="Cuadrado y con fondo transparente se ve mejor. Hasta 2 MB." />
        {company.logoUrl ? (
          <Pressable onPress={() => set({ logoUrl: '' })} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.link}>Quitar logo</Text>
          </Pressable>
        ) : null}
      </Section>

      <Section title="Color de marca" icon="color-fill-outline" hint="Botones, enlaces y detalles de tu tienda.">
        <View style={styles.swatches}>
          {BRAND_COLORS.map((color) => {
            const selected = company.brandColor === color.key || (!company.brandColor && color.key === 'blue');
            return (
              <Pressable key={color.key} onPress={() => set({ brandColor: color.key })} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={color.name}
                style={[styles.swatch, { backgroundColor: color.hex, borderColor: selected ? colors.text : 'transparent' }]} />
            );
          })}
          <Pressable onPress={() => set({ brandColor: 'custom', customBrandColor: company.customBrandColor || '#2563EB' })} accessibilityRole="radio" accessibilityState={{ selected: company.brandColor === 'custom' }} accessibilityLabel="Color personalizado"
            style={[styles.swatch, styles.customSwatch, { borderColor: company.brandColor === 'custom' ? colors.text : colors.border }]}>
            <Text style={[styles.customText, { color: colors.text }]}>#</Text>
          </Pressable>
        </View>
        {company.brandColor === 'custom' ? (
          <Field label="Color personalizado (HEX)" value={company.customBrandColor ?? ''} onChangeText={(value) => set({ customBrandColor: value.trim() })} placeholder="#2563EB" autoCapitalize="none" maxLength={7} error={issues.customBrandColor} />
        ) : null}
      </Section>

      <Section title="Encabezado" icon="browsers-outline">
        <View style={styles.options}>
          {HEADER_STYLES.map((option) => {
            // Como en la web: «glass» (el valor histórico) se muestra como Claro.
            const current = company.headerStyle && company.headerStyle !== 'glass' ? company.headerStyle : 'solid';
            const selected = current === option.value;
            return (
              <Pressable key={option.value} onPress={() => set({ headerStyle: option.value })} accessibilityRole="radio" accessibilityState={{ selected }}
                style={[styles.option, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}10` : 'transparent' }]}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.optionHint, { color: colors.muted }]}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>
        <ToggleRow label="Barra superior" hint="Franja con teléfono y avisos arriba del encabezado" value={company.showTopBar !== false} onValueChange={(value) => set({ showTopBar: value })} />
      </Section>

      <Section title="Estilo de la tienda" icon="grid-outline" hint="Cómo se presentan tus productos.">
        <View style={styles.options}>
          {STOREFRONT_STYLES.map((option) => {
            const selected = (company.storefrontStyle || 'auto') === option.value;
            return (
              <Pressable key={option.value} onPress={() => set({ storefrontStyle: option.value })} accessibilityRole="radio" accessibilityState={{ selected }}
                style={[styles.option, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}10` : 'transparent' }]}>
                <View style={websiteStyles.row}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>{option.label}</Text>
                  {selected ? <Text style={styles.selected}>Elegido</Text> : null}
                </View>
                <Text style={[styles.optionHint, { color: colors.muted }]}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.caption, { color: colors.muted }]}>Las variantes de cada estilo se eligen desde la web.</Text>
      </Section>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  preview: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F8FAFC' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  previewLogo: { width: 32, height: 32, borderRadius: 8 },
  previewName: { flex: 1, fontSize: 15, fontWeight: '800' },
  previewBody: { padding: 16, gap: 12 },
  previewTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  previewButton: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  previewButtonText: { color: '#fff', fontWeight: '800' },
  caption: { fontSize: 12 },
  link: { color: palette.danger, fontSize: 13, fontWeight: '700' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  customSwatch: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  customText: { fontSize: 16, fontWeight: '800' },
  options: { gap: 8 },
  option: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 },
  optionTitle: { fontSize: 14, fontWeight: '800' },
  optionHint: { fontSize: 12 },
  selected: { color: palette.primary, fontSize: 11, fontWeight: '800' },
});
