import { Wrench, Package, Shield, Smartphone, Monitor, Battery, Cpu, Zap, Headset, Laptop, Clock, Sparkles, Droplet, Camera, Receipt, Wallet, Landmark, Banknote, CreditCard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type BrandColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'teal' | 'rose' | 'amber' | 'emerald' | 'cyan' | 'sky' | 'custom'

export interface BrandTheme {
  hero: string
  text200: string
  text300: string
  cta: string
  ctaText: string
  ctaBtn: string
  stepBg: string
  stepText: string
}

export const brandMap: Record<BrandColor, BrandTheme> = {
  blue:    { hero: 'from-blue-600 via-blue-700 to-blue-900',      text200: 'text-blue-200',    text300: 'text-blue-300',    cta: 'from-blue-600 to-blue-800',       ctaText: 'text-blue-100',   ctaBtn: 'text-blue-900',    stepBg: 'bg-blue-100 dark:bg-blue-500/20',    stepText: 'text-blue-600 dark:text-blue-400' },
  green:   { hero: 'from-green-600 via-emerald-600 to-teal-700',  text200: 'text-green-200',   text300: 'text-green-300',   cta: 'from-green-600 to-teal-700',      ctaText: 'text-green-100',  ctaBtn: 'text-green-900',   stepBg: 'bg-green-100 dark:bg-green-500/20',   stepText: 'text-green-600 dark:text-green-400' },
  purple:  { hero: 'from-purple-600 via-fuchsia-600 to-pink-700', text200: 'text-purple-200',  text300: 'text-purple-300',  cta: 'from-purple-600 to-pink-700',     ctaText: 'text-purple-100', ctaBtn: 'text-purple-900',  stepBg: 'bg-purple-100 dark:bg-purple-500/20',  stepText: 'text-purple-600 dark:text-purple-400' },
  orange:  { hero: 'from-orange-600 via-amber-600 to-red-700',    text200: 'text-orange-200',  text300: 'text-orange-300',  cta: 'from-orange-600 to-red-700',      ctaText: 'text-orange-100', ctaBtn: 'text-orange-900',  stepBg: 'bg-orange-100 dark:bg-orange-500/20',  stepText: 'text-orange-600 dark:text-orange-400' },
  red:     { hero: 'from-red-600 via-rose-600 to-red-800',        text200: 'text-red-200',     text300: 'text-red-300',     cta: 'from-red-600 to-rose-700',        ctaText: 'text-red-100',    ctaBtn: 'text-red-900',     stepBg: 'bg-red-100 dark:bg-red-500/20',     stepText: 'text-red-600 dark:text-red-400' },
  indigo:  { hero: 'from-indigo-600 via-indigo-700 to-blue-800',  text200: 'text-indigo-200',  text300: 'text-indigo-300',  cta: 'from-indigo-600 to-blue-800',     ctaText: 'text-indigo-100', ctaBtn: 'text-indigo-900',  stepBg: 'bg-indigo-100 dark:bg-indigo-500/20',  stepText: 'text-indigo-600 dark:text-indigo-400' },
  teal:    { hero: 'from-teal-600 via-emerald-600 to-green-700',  text200: 'text-teal-200',    text300: 'text-teal-300',    cta: 'from-teal-600 to-emerald-700',    ctaText: 'text-teal-100',   ctaBtn: 'text-teal-900',    stepBg: 'bg-teal-100 dark:bg-teal-500/20',    stepText: 'text-teal-600 dark:text-teal-400' },
  rose:    { hero: 'from-rose-600 via-pink-600 to-rose-700',      text200: 'text-rose-200',    text300: 'text-rose-300',    cta: 'from-rose-600 to-pink-700',       ctaText: 'text-rose-100',   ctaBtn: 'text-rose-900',    stepBg: 'bg-rose-100 dark:bg-rose-500/20',    stepText: 'text-rose-600 dark:text-rose-400' },
  amber:   { hero: 'from-amber-500 via-orange-500 to-yellow-600', text200: 'text-amber-100',   text300: 'text-amber-200',   cta: 'from-amber-500 to-orange-700',    ctaText: 'text-amber-100',  ctaBtn: 'text-amber-900',   stepBg: 'bg-amber-100 dark:bg-amber-500/20',   stepText: 'text-amber-600 dark:text-amber-400' },
  emerald: { hero: 'from-emerald-600 via-teal-600 to-green-700',  text200: 'text-emerald-100', text300: 'text-emerald-200', cta: 'from-emerald-600 to-teal-700',    ctaText: 'text-emerald-100',ctaBtn: 'text-emerald-900', stepBg: 'bg-emerald-100 dark:bg-emerald-500/20', stepText: 'text-emerald-600 dark:text-emerald-400' },
  cyan:    { hero: 'from-cyan-600 via-sky-600 to-blue-700',       text200: 'text-cyan-100',    text300: 'text-cyan-200',    cta: 'from-cyan-600 to-sky-700',        ctaText: 'text-cyan-100',   ctaBtn: 'text-cyan-900',    stepBg: 'bg-cyan-100 dark:bg-cyan-500/20',    stepText: 'text-cyan-600 dark:text-cyan-400' },
  sky:     { hero: 'from-sky-500 via-blue-500 to-indigo-600',     text200: 'text-sky-100',     text300: 'text-sky-200',     cta: 'from-sky-500 to-blue-700',        ctaText: 'text-sky-100',    ctaBtn: 'text-sky-900',     stepBg: 'bg-sky-100 dark:bg-sky-500/20',     stepText: 'text-sky-600 dark:text-sky-400' },
  custom:  { hero: 'from-primary via-primary to-primary',          text200: 'text-white/80',     text300: 'text-white/70',     cta: 'from-primary to-primary',          ctaText: 'text-white/80',     ctaBtn: 'text-primary',     stepBg: 'bg-primary/10',   stepText: 'text-primary' },
}

export const colorMap: Record<string, { bg: string; text: string; hover: string }> = {
  blue:    { bg: 'bg-blue-100 dark:bg-blue-500/20',    text: 'text-blue-600 dark:text-blue-400',    hover: 'group-hover:bg-blue-600' },
  green:   { bg: 'bg-green-100 dark:bg-green-500/20',   text: 'text-green-600 dark:text-green-400',   hover: 'group-hover:bg-green-600' },
  purple:  { bg: 'bg-purple-100 dark:bg-purple-500/20',  text: 'text-purple-600 dark:text-purple-400',  hover: 'group-hover:bg-purple-600' },
  orange:  { bg: 'bg-orange-100 dark:bg-orange-500/20',  text: 'text-orange-600 dark:text-orange-400',  hover: 'group-hover:bg-orange-600' },
  red:     { bg: 'bg-red-100 dark:bg-red-500/20',     text: 'text-red-600 dark:text-red-400',     hover: 'group-hover:bg-red-600' },
  indigo:  { bg: 'bg-indigo-100 dark:bg-indigo-500/20',  text: 'text-indigo-600 dark:text-indigo-400',  hover: 'group-hover:bg-indigo-600' },
  teal:    { bg: 'bg-teal-100 dark:bg-teal-500/20',    text: 'text-teal-600 dark:text-teal-400',    hover: 'group-hover:bg-teal-600' },
  yellow:  { bg: 'bg-yellow-100 dark:bg-yellow-500/20',  text: 'text-yellow-700 dark:text-yellow-400',  hover: 'group-hover:bg-yellow-500' },
  pink:    { bg: 'bg-pink-100 dark:bg-pink-500/20',    text: 'text-pink-600 dark:text-pink-400',    hover: 'group-hover:bg-pink-600' },
  rose:    { bg: 'bg-rose-100 dark:bg-rose-500/20',    text: 'text-rose-600 dark:text-rose-400',    hover: 'group-hover:bg-rose-600' },
  amber:   { bg: 'bg-amber-100 dark:bg-amber-500/20',   text: 'text-amber-600 dark:text-amber-400',   hover: 'group-hover:bg-amber-600' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', hover: 'group-hover:bg-emerald-600' },
  cyan:    { bg: 'bg-cyan-100 dark:bg-cyan-500/20',    text: 'text-cyan-600 dark:text-cyan-400',    hover: 'group-hover:bg-cyan-600' },
  sky:     { bg: 'bg-sky-100 dark:bg-sky-500/20',     text: 'text-sky-600 dark:text-sky-400',     hover: 'group-hover:bg-sky-600' },
}

export const iconMap: Record<string, LucideIcon> = {
  wrench: Wrench,
  package: Package,
  shield: Shield,
  smartphone: Smartphone,
  monitor: Monitor,
  battery: Battery,
  cpu: Cpu,
  zap: Zap,
  headset: Headset,
  laptop: Laptop,
  clock: Clock,
  sparkles: Sparkles,
  droplet: Droplet,
  camera: Camera,
  microchip: Cpu,
  receipt: Receipt,
  wallet: Wallet,
  landmark: Landmark,
  banknote: Banknote,
  'credit-card': CreditCard,
}

export function getBrandTheme(color?: string): BrandTheme {
  return brandMap[(color || 'blue') as BrandColor] ?? brandMap.blue
}
