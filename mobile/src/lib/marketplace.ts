import type { PublicLocation, MarketplaceLocation } from '../../../src/lib/public/marketplace-location';
import * as WebBrowser from 'expo-web-browser';

import { apiFetch } from './api';
import { formatCurrencyAmount } from '../../../src/lib/regional/contract';
import { getMobileRuntimeConfig } from './runtime-config';

/** Sitio público: los detalles todavía se abren en la web, dentro de la app. */
export const SITE_URL = getMobileRuntimeConfig().siteUrl;

export type MarketProduct = {
  currency?: string;
  id: string;
  name: string;
  brand: string | null;
  category?: { id: string; name: string } | null;
  image: string | null;
  price: number | null;
  offerPrice: number | null;
  inStock: boolean;
  featured: boolean;
  store: { name: string; slug: string; whatsapp?: string | null; countryCode?: string | null; locations?: PublicLocation[] };
};

export type MarketStore = {
  businessVertical?: string | null;
  operatingModel?: string | null;
  countryCode?: string | null;
  locations?: PublicLocation[];
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
  pagination?: Record<'products'|'offers'|'stores',{page:number;total:number;totalPages:number}>;
  home?: {products:MarketProduct[];total:number;offers:MarketProduct[];stores:MarketStore[]};
  storeOptions?: MarketStore[];
  priceFilteringAvailable?: boolean;
  currency?: string | null;
  location?: {selection:MarketplaceLocation;countries:{code:string;label:string;count:number}[];cities:{key:string;label:string;count:number;countryCode:string|null}[];allCities:{key:string;label:string;count:number;countryCode:string|null}[]};
  stats: { key: 'stores' | 'cities' | 'products'; value: number }[];
  categories: { id: string; name: string; count: number }[];
  offers: MarketProduct[];
  brands: { name: string; logo: string | null; count: number }[];
  products: MarketProduct[];
  stores: MarketStore[];
};

export const fetchMarketplaceHome = (query = '') => {
 const params=new URLSearchParams(query),favorites=params.get('favorites');params.delete('favorites');
 return apiFetch<MarketplaceHome>('/api/mobile/marketplace/catalog'+(params.toString()?'?'+params.toString():''),favorites!==null?{auth:false,method:'POST',body:JSON.stringify({favorites:favorites.split(',').filter(Boolean)})}:{auth:false});
};

export const openWeb = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

export const productPath = (product: MarketProduct) => `/${product.store.slug}/productos/${product.id}`;
export const storePath = (store: { slug: string }) => `/${store.slug}/inicio`;

/** Guaraníes sin decimales y con punto de miles, como la web. */
export function formatGs(value: number) {
  return formatCurrencyAmount(Math.round(value), 'PYG', 'es-PY').replace(/\u00a0/g, ' ');
}

export function formatMarketPrice(value:number,currency='PYG'){try{return new Intl.NumberFormat('es-PY',{style:'currency',currency,maximumFractionDigits:currency==='PYG'?0:2}).format(value)}catch{return value.toLocaleString('es-PY')+' '+currency}}
