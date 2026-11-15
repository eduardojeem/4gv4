import { useColorScheme } from 'react-native';

export const palette = {
  primary: '#2563EB',
  danger: '#DC2626',
  success: '#16A34A',
} as const;

const schemes = {
  light: {
    isDark: false,
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    muted: '#64748B',
    border: '#CBD5E1',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.10)',
    successText: '#15803D',
    warningText: '#B45309',
    dangerText: '#B91C1C',
  },
  dark: {
    isDark: true,
    background: '#0B1120',
    card: '#111827',
    text: '#F1F5F9',
    muted: '#94A3B8',
    border: '#334155',
    accent: '#60A5FA',
    accentSoft: 'rgba(96, 165, 250, 0.16)',
    successText: '#4ADE80',
    warningText: '#FBBF24',
    dangerText: '#F87171',
  },
} as const;

export function usePalette() {
  return schemes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
