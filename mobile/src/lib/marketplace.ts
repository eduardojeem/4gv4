import * as WebBrowser from 'expo-web-browser';

import { apiFetch } from './api';
import { getMobileRuntimeConfig } from './runtime-config';

/** Sitio público: los detalles todavía se abren en la web, dentro de la app. */
export const SITE_URL = getMobileRuntimeConfig().siteUrl;

export type MarketProduct = {
  id: string;
  name: string;
  brand: string | null;
  category?: { id: string; name: string } | null;
  image: string | null;
  price: number | null;
  offerPrice: number | null;
  inStock: boolean;
  featured: boolean;
  store: { name: string; slug: string };
};

export type MarketStore = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  city: string | null;
  /** Ciudad unificada por el servidor (misma clave que /empresas en la web). */
  cityKey?: string | null;
  rubro: string | null;
  whatsapp?: string | null;
  products: number;
  rating: number | null;
};

export type MarketplaceHome = {
  stats: { key: 'stores' | 'cities' | 'products'; value: number }[];
  categories: { id: string; name: string; count: number }[];
  offers: MarketProduct[];
  brands: { name: string; logo: string | null; count: number }[];
  products: MarketProduct[];
  stores: MarketStore[];
};

export const fetchMarketplaceHome = () => apiFetch<MarketplaceHome>('/api/mobile/marketplace', { auth: false });

export const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

export const productPath = (product: MarketProduct) => `/${product.store.slug}/productos/${product.id}`;
export const storePath = (store: { slug: string }) => `/${store.slug}/inicio`;

/** Guaraníes sin decimales y con punto de miles, como la web. */
export function formatGs(value: number) {
  return `Gs. ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
