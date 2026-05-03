import { Wrench, Package, Shield, Smartphone, Monitor, Battery, Cpu, Zap, Headset, Laptop, Clock, Sparkles, Droplet, Camera } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type BrandColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'indigo' | 'teal' | 'rose' | 'amber' | 'emerald' | 'cyan' | 'sky'

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
  blue:    { hero: 'from-blue-600 via-blue-700 to-blue-900',      text200: 'text-blue-200',    text300: 'text-blue-300',    cta: 'from-blue-600 to-blue-800',       ctaText: 'text-blue-100',   ctaBtn: 'text-blue-900',    stepBg: 'bg-blue-100',    stepText: 'text-blue-600' },
  green:   { hero: 'from-green-600 via-emerald-600 to-teal-700',  text200: 'text-green-200',   text300: 'text-green-300',   cta: 'from-green-600 to-teal-700',      ctaText: 'text-green-100',  ctaBtn: 'text-green-900',   stepBg: 'bg-green-100',   stepText: 'text-green-600' },
  purple:  { hero: 'from-purple-600 via-fuchsia-600 to-pink-700', text200: 'text-purple-200',  text300: 'text-purple-300',  cta: 'from-purple-600 to-pink-700',     ctaText: 'text-purple-100', ctaBtn: 'text-purple-900',  stepBg: 'bg-purple-100',  stepText: 'text-purple-600' },
  orange:  { hero: 'from-orange-600 via-amber-600 to-red-700',    text200: 'text-orange-200',  text300: 'text-orange-300',  cta: 'from-orange-600 to-red-700',      ctaText: 'text-orange-100', ctaBtn: 'text-orange-900',  stepBg: 'bg-orange-100',  stepText: 'text-orange-600' },
  red:     { hero: 'from-red-600 via-rose-600 to-red-800',        text200: 'text-red-200',     text300: 'text-red-300',     cta: 'from-red-600 to-rose-700',        ctaText: 'text-red-100',    ctaBtn: 'text-red-900',     stepBg: 'bg-red-100',     stepText: 'text-red-600' },
  indigo:  { hero: 'from-indigo-600 via-indigo-700 to-blue-800',  text200: 'text-indigo-200',  text300: 'text-indigo-300',  cta: 'from-indigo-600 to-blue-800',     ctaText: 'text-indigo-100', ctaBtn: 'text-indigo-900',  stepBg: 'bg-indigo-100',  stepText: 'text-indigo-600' },
  teal:    { hero: 'from-teal-600 via-emerald-600 to-green-700',  text200: 'text-teal-200',    text300: 'text-teal-300',    cta: 'from-teal-600 to-emerald-700',    ctaText: 'text-teal-100',   ctaBtn: 'text-teal-900',    stepBg: 'bg-teal-100',    stepText: 'text-teal-600' },
  rose:    { hero: 'from-rose-600 via-pink-600 to-rose-700',      text200: 'text-rose-200',    text300: 'text-rose-300',    cta: 'from-rose-600 to-pink-700',       ctaText: 'text-rose-100',   ctaBtn: 'text-rose-900',    stepBg: 'bg-rose-100',    stepText: 'text-rose-600' },
  amber:   { hero: 'from-amber-500 via-orange-500 to-yellow-600', text200: 'text-amber-100',   text300: 'text-amber-200',   cta: 'from-amber-500 to-orange-700',    ctaText: 'text-amber-100',  ctaBtn: 'text-amber-900',   stepBg: 'bg-amber-100',   stepText: 'text-amber-600' },
  emerald: { hero: 'from-emerald-600 via-teal-600 to-green-700',  text200: 'text-emerald-100', text300: 'text-emerald-200', cta: 'from-emerald-600 to-teal-700',    ctaText: 'text-emerald-100',ctaBtn: 'text-emerald-900', stepBg: 'bg-emerald-100', stepText: 'text-emerald-600' },
  cyan:    { hero: 'from-cyan-600 via-sky-600 to-blue-700',       text200: 'text-cyan-100',    text300: 'text-cyan-200',    cta: 'from-cyan-600 to-sky-700',        ctaText: 'text-cyan-100',   ctaBtn: 'text-cyan-900',    stepBg: 'bg-cyan-100',    stepText: 'text-cyan-600' },
  sky:     { hero: 'from-sky-500 via-blue-500 to-indigo-600',     text200: 'text-sky-100',     text300: 'text-sky-200',     cta: 'from-sky-500 to-blue-700',        ctaText: 'text-sky-100',    ctaBtn: 'text-sky-900',     stepBg: 'bg-sky-100',     stepText: 'text-sky-600' },
}

export const colorMap: Record<string, { bg: string; text: string; hover: string }> = {
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-600',    hover: 'group-hover:bg-blue-600' },
  green:   { bg: 'bg-green-100',   text: 'text-green-600',   hover: 'group-hover:bg-green-600' },
  purple:  { bg: 'bg-purple-100',  text: 'text-purple-600',  hover: 'group-hover:bg-purple-600' },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-600',  hover: 'group-hover:bg-orange-600' },
  red:     { bg: 'bg-red-100',     text: 'text-red-600',     hover: 'group-hover:bg-red-600' },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-600',  hover: 'group-hover:bg-indigo-600' },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-600',    hover: 'group-hover:bg-teal-600' },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-600',    hover: 'group-hover:bg-rose-600' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-600',   hover: 'group-hover:bg-amber-600' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', hover: 'group-hover:bg-emerald-600' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-600',    hover: 'group-hover:bg-cyan-600' },
  sky:     { bg: 'bg-sky-100',     text: 'text-sky-600',     hover: 'group-hover:bg-sky-600' },
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
}

export function getBrandTheme(color?: string): BrandTheme {
  return brandMap[(color || 'blue') as BrandColor] ?? brandMap.blue
}
