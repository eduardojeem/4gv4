import { useColorScheme } from 'react-native';

export const palette = {
  primary: '#2563EB',
  danger: '#DC2626',
  success: '#16A34A',
} as const;

const schemes = {
  light: { background: '#F8FAFC', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', border: '#CBD5E1' },
  dark: { background: '#0B1120', card: '#111827', text: '#F1F5F9', muted: '#94A3B8', border: '#334155' },
} as const;

export function usePalette() {
  return schemes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
