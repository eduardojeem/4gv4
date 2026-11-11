import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  Field,
  Notice,
  SaveBar,
  Section,
  StatusPill,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import {
  resolveMapsShortLink,
  saveCompanyInfo,
  websiteErrorMessage,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  SOCIAL_BASE,
  companyIssues,
  extractMapsCoordinates,
  isDirty,
  isShortMapsLink,
  isValidGoogleMapsUrl,
  mergeSetting,
  socialHandle,
  type CompanyInfo,
  type SocialPlatform,
  type WebsiteSettings,
} from '@/lib/website-model';
import { remainingWebsiteEdits } from '@/lib/website-save-state';

const SOCIALS: readonly {
  platform: SocialPlatform;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
}[] = [
  {
    platform: 'instagram',
    label: 'Instagram',
    icon: 'logo-instagram',
    placeholder: '@tutienda o instagram.com/tutienda',
  },
  {
    platform: 'facebook',
    label: 'Facebook',
    icon: 'logo-facebook',
    placeholder: 'tutienda o facebook.com/tutienda',
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    icon: 'logo-tiktok',
    placeholder: '@tutienda o tiktok.com/@tutienda',
  },
];

export default function BusinessScreen() {
  return (
    <WebsiteGate title="Negocio, horario y mapa">
      {(settings) => <BusinessEditor settings={settings} />}
    </WebsiteGate>
  );
}

function BusinessEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const saved = settings.company_info;
  const [patch, setPatch] = useState<Partial<CompanyInfo>>({});
  const [saving, setSaving] = useState(false);
  const [resolvingMaps, setResolvingMaps] = useState(false);

  const company = useMemo(
    () => mergeSetting<CompanyInfo>(saved, patch),
    [saved, patch],
  );
  const dirty = isDirty(saved, company);
  const issues = companyIssues(company);

  const set = (next: Partial<CompanyInfo>) =>
    setPatch((current) => ({ ...current, ...next }));
  const setHours = (field: 'weekdays' | 'saturday' | 'sunday', value: string) =>
    set({ hours: { ...(company.hours ?? {}), [field]: value } });

  const mapsCoords = useMemo(
    () => extractMapsCoordinates(company.mapsUrl),
    [company.mapsUrl],
  );
  const needsMapsResolve =
    Boolean(company.mapsUrl?.trim()) && isShortMapsLink(company.mapsUrl);

  const handleResolveMaps = async () => {
    const raw = company.mapsUrl?.trim();
    if (!raw || resolvingMaps) return;
    setResolvingMaps(true);
    try {
      const res = await resolveMapsShortLink(raw);
      if (res.resolved && res.url) {
        set({ mapsUrl: res.url });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(
          'No pudimos expandir el enlace',
          'Podés dejar el enlace corto igual, o pegar el enlace largo desde Google Maps en el navegador.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Error al verificar enlace',
        websiteErrorMessage(error, 'Revisá tu conexión e intentá de nuevo.'),
      );
    } finally {
      setResolvingMaps(false);
    }
  };

  const save = useCallback(async () => {
    const problems = Object.values(issues);
    if (problems.length) {
      Alert.alert('Revisá los datos', problems.join('\n'));
      return false;
    }
    setSaving(true);
    try {
      const result = await saveCompanyInfo(saved, patch);
      applySaved({ company_info: result ?? company });
      setPatch((current) => remainingWebsiteEdits(current, patch));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(
          error,
          'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.',
        ),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, saved, patch, company, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  return (
    <WebsiteScreen
      saving={saving}
      title="Negocio, horario y mapa"
      subtitle="Lo que ven tus clientes en el sitio"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setPatch({})}
        />
      }
    >
      <OfflineNotice />
      <Notice text="Estos datos aparecen en tu tienda online y también sincronizan teléfono, email, RUC y dirección con tu sucursal." />

      <Section title="Identidad" icon="storefront-outline">
        <Field
          label="Nombre comercial"
          value={company.name ?? ''}
          onChangeText={(value) => set({ name: value })}
          placeholder="Mi Tienda"
          maxLength={100}
          showCount
          error={issues.name}
        />
        <Field
          label="RUC o identificador fiscal (opcional)"
          value={company.ruc ?? ''}
          onChangeText={(value) => set({ ruc: value })}
          placeholder="Ej: 80012345-6"
          autoCapitalize="none"
          maxLength={30}
        />
        <Field
          label="Eslogan"
          value={company.slogan ?? ''}
          onChangeText={(value) => set({ slogan: value })}
          placeholder="Calidad y buen precio"
          maxLength={100}
          showCount
        />
        <Field
          label="Descripción"
          value={company.description ?? ''}
          onChangeText={(value) => set({ description: value })}
          placeholder="Contá quiénes son y qué ofrecen"
          multiline
          maxLength={1000}
          showCount
        />
      </Section>

      <Section title="Contacto y ubicación" icon="location-outline">
        <Field
          label="Teléfono"
          value={company.phone ?? ''}
          onChangeText={(value) => set({ phone: value })}
          placeholder="0981 123 456"
          keyboardType="phone-pad"
          maxLength={20}
          error={issues.phone}
        />
        <Field
          label="WhatsApp"
          value={company.whatsapp ?? ''}
          onChangeText={(value) => set({ whatsapp: value })}
          placeholder="0981 123 456"
          keyboardType="phone-pad"
          maxLength={50}
          icon="logo-whatsapp"
          help="Si lo dejás vacío, se usa el teléfono."
        />
        <Field
          label="Email público"
          value={company.email ?? ''}
          onChangeText={(value) => set({ email: value.trim() })}
          placeholder="hola@tutienda.com"
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={100}
          error={issues.email}
        />
        <Field
          label="Dirección física"
          value={company.address ?? ''}
          onChangeText={(value) => set({ address: value })}
          placeholder="Av. España 1234, Asunción"
          maxLength={200}
        />
        <Field
          label="Enlace de Google Maps"
          value={company.mapsUrl ?? ''}
          onChangeText={(value) => set({ mapsUrl: value.trim() })}
          placeholder="https://maps.app.goo.gl/…"
          keyboardType="url"
          autoCapitalize="none"
          maxLength={1000}
          error={issues.mapsUrl}
          right={
            mapsCoords ? (
              <StatusPill label="Ubicación exacta" tone="success" />
            ) : undefined
          }
          help="En Google Maps: Compartir → Copiar enlace."
        />

        {needsMapsResolve || (company.mapsUrl && isValidGoogleMapsUrl(company.mapsUrl)) ? (
          <View style={styles.mapsActions}>
            {needsMapsResolve ? (
              <Pressable
                onPress={() => void handleResolveMaps()}
                disabled={resolvingMaps}
                style={[
                  websiteStyles.secondaryButton,
                  styles.mapBtn,
                  { borderColor: palette.primary },
                ]}
              >
                {resolvingMaps ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Ionicons
                    name="locate-outline"
                    size={15}
                    color={palette.primary}
                  />
                )}
                <Text style={[styles.mapBtnText, { color: palette.primary }]}>
                  {resolvingMaps ? 'Resolviendo…' : 'Extraer pin exacto'}
                </Text>
              </Pressable>
            ) : null}

            {company.mapsUrl && isValidGoogleMapsUrl(company.mapsUrl) ? (
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(company.mapsUrl!)}
                style={[
                  websiteStyles.secondaryButton,
                  styles.mapBtn,
                  { borderColor: colors.border },
                ]}
              >
                <Ionicons name="map-outline" size={15} color={colors.text} />
                <Text style={[styles.mapBtnText, { color: colors.text }]}>
                  Probar en Maps
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {mapsCoords ? (
          <Text style={[styles.coordsHint, { color: colors.muted }]}>
            Coordenadas detectadas: {mapsCoords.lat.toFixed(5)},{' '}
            {mapsCoords.lng.toFixed(5)}
          </Text>
        ) : null}
      </Section>

      <Section title="Horarios de atención" icon="time-outline">
        <Field
          label="Lunes a viernes"
          value={company.hours?.weekdays ?? ''}
          onChangeText={(value) => setHours('weekdays', value)}
          placeholder="8:00 a 18:00"
          maxLength={100}
        />
        <Field
          label="Sábados"
          value={company.hours?.saturday ?? ''}
          onChangeText={(value) => setHours('saturday', value)}
          placeholder="8:00 a 12:00"
          maxLength={100}
        />
        <Field
          label="Domingos"
          value={company.hours?.sunday ?? ''}
          onChangeText={(value) => setHours('sunday', value)}
          placeholder="Cerrado"
          maxLength={100}
        />
      </Section>

      <Section title="Redes sociales" icon="share-social-outline">
        {SOCIALS.map(({ platform, label, icon, placeholder }) => {
          const handle = socialHandle(company[platform], platform);
          return (
            <View key={platform}>
              <Field
                label={label}
                value={company[platform] ?? ''}
                onChangeText={(value) => set({ [platform]: value.trim() })}
                placeholder={placeholder}
                autoCapitalize="none"
                maxLength={100}
                icon={icon}
                error={issues[platform]}
              />
              {handle && !issues[platform] ? (
                <Text style={[styles.link, { color: colors.muted }]}>
                  {`${SOCIAL_BASE[platform]}${handle}`.replace('https://', '')}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Section>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 12, marginTop: 4 },
  mapsActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mapBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  mapBtnText: { fontSize: 12, fontWeight: '800' },
  coordsHint: { fontSize: 11, fontWeight: '600' },
});
