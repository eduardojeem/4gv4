import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { Field, Notice, SaveBar, Section, WebsiteScreen, useUnsavedChangesGuard } from '@/components/website/website-ui';
import { usePalette } from '@/lib/palette';
import { saveCompanyInfo, websiteErrorMessage } from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  SOCIAL_BASE,
  companyIssues,
  isDirty,
  mergeSetting,
  socialHandle,
  type CompanyInfo,
  type SocialPlatform,
  type WebsiteSettings,
} from '@/lib/website-model';

const SOCIALS: readonly { platform: SocialPlatform; label: string; icon: keyof typeof Ionicons.glyphMap; placeholder: string }[] = [
  { platform: 'instagram', label: 'Instagram', icon: 'logo-instagram', placeholder: '@tutienda o instagram.com/tutienda' },
  { platform: 'facebook', label: 'Facebook', icon: 'logo-facebook', placeholder: 'tutienda o facebook.com/tutienda' },
  { platform: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', placeholder: '@tutienda o tiktok.com/@tutienda' },
];

export default function BusinessScreen() {
  return <WebsiteGate title="Negocio y redes">{(settings) => <BusinessEditor settings={settings} />}</WebsiteGate>;
}

function BusinessEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved } = useWebsite();
  const saved = settings.company_info;
  const [patch, setPatch] = useState<Partial<CompanyInfo>>({});
  const [saving, setSaving] = useState(false);
  const company = useMemo(() => mergeSetting<CompanyInfo>(saved, patch), [saved, patch]);
  const dirty = isDirty(saved, company);
  const issues = companyIssues(company);
  const set = (next: Partial<CompanyInfo>) => setPatch((current) => ({ ...current, ...next }));
  const setHours = (field: 'weekdays' | 'saturday' | 'sunday', value: string) => set({ hours: { ...(company.hours ?? {}), [field]: value } });

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
      setPatch({});
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert('No pudimos guardar', websiteErrorMessage(error, 'No pudimos guardar los cambios. Revisá tu conexión e intentá nuevamente.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, saved, patch, company, applySaved]);

  useUnsavedChangesGuard(dirty && !saving, save);

  return (
    <WebsiteScreen title="Negocio y redes" subtitle="Lo que ven tus clientes" footer={<SaveBar dirty={dirty} saving={saving} onSave={() => void save()} />}>
      <OfflineNotice />
      <Notice text="Estos datos son públicos: aparecen en tu tienda. El teléfono, el email y la dirección también se actualizan en tu sucursal principal." />

      <Section title="Identidad" icon="storefront-outline">
        <Field label="Nombre comercial" value={company.name ?? ''} onChangeText={(value) => set({ name: value })} placeholder="Mi Tienda" maxLength={100} error={issues.name} />
        <Field label="Eslogan" value={company.slogan ?? ''} onChangeText={(value) => set({ slogan: value })} placeholder="Calidad y buen precio" maxLength={100} />
        <Field label="Descripción" value={company.description ?? ''} onChangeText={(value) => set({ description: value })} placeholder="Contá quiénes son y qué ofrecen" multiline maxLength={1000} />
      </Section>

      <Section title="Contacto" icon="call-outline">
        <Field label="Teléfono" value={company.phone ?? ''} onChangeText={(value) => set({ phone: value })} placeholder="0981 123 456" keyboardType="phone-pad" maxLength={20} error={issues.phone} />
        <Field label="WhatsApp" value={company.whatsapp ?? ''} onChangeText={(value) => set({ whatsapp: value })} placeholder="0981 123 456" keyboardType="phone-pad" maxLength={50} icon="logo-whatsapp" help="Si lo dejás vacío, se usa el teléfono." />
        <Field label="Email público" value={company.email ?? ''} onChangeText={(value) => set({ email: value.trim() })} placeholder="hola@tutienda.com" keyboardType="email-address" autoCapitalize="none" maxLength={100} error={issues.email} />
        <Field label="Dirección" value={company.address ?? ''} onChangeText={(value) => set({ address: value })} placeholder="Calle y número, ciudad" maxLength={200} />
        <Field label="Enlace de Google Maps" value={company.mapsUrl ?? ''} onChangeText={(value) => set({ mapsUrl: value.trim() })} placeholder="https://maps.app.goo.gl/…" keyboardType="url" autoCapitalize="none" maxLength={1000} error={issues.mapsUrl}
          help="En Google Maps: Compartir → Copiar enlace." />
      </Section>

      <Section title="Horarios" icon="time-outline">
        <Field label="Lunes a viernes" value={company.hours?.weekdays ?? ''} onChangeText={(value) => setHours('weekdays', value)} placeholder="8:00 a 18:00" maxLength={100} />
        <Field label="Sábados" value={company.hours?.saturday ?? ''} onChangeText={(value) => setHours('saturday', value)} placeholder="8:00 a 12:00" maxLength={100} />
        <Field label="Domingos" value={company.hours?.sunday ?? ''} onChangeText={(value) => setHours('sunday', value)} placeholder="Cerrado" maxLength={100} />
      </Section>

      <Section title="Redes sociales" icon="share-social-outline">
        {SOCIALS.map(({ platform, label, icon, placeholder }) => {
          const handle = socialHandle(company[platform], platform);
          return (
            <View key={platform}>
              <Field label={label} value={company[platform] ?? ''} onChangeText={(value) => set({ [platform]: value.trim() })} placeholder={placeholder} autoCapitalize="none" maxLength={100} icon={icon} error={issues[platform]} />
              {handle && !issues[platform] ? <Text style={[styles.link, { color: colors.muted }]}>{`${SOCIAL_BASE[platform]}${handle}`.replace('https://', '')}</Text> : null}
            </View>
          );
        })}
      </Section>
    </WebsiteScreen>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 12, marginTop: 4 },
});
