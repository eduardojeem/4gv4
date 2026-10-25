/**
 * La ficha de un producto del marketplace: la lista trae lo básico (una foto,
 * precio, si hay stock) y el detalle completo sale de /api/public/products/[id],
 * el mismo endpoint público de la tienda. Lógica pura para poder probarla.
 */

export type ProductVariantOption = {
  id: string;
  name: string;
  price: number | null;
  stock: number;
  inStock: boolean;
};

export type ProductDetail = {
  description: string | null;
  images: string[];
  stock: number;
  inStock: boolean;
  unit: string | null;
  /** La tienda publicó el producto sin precio: no se muestra ningún importe. */
  hidePrice: boolean;
  price: number | null;
  offerPrice: number | null;
  promotionName: string | null;
  variants: ProductVariantOption[];
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0);

/**
 * Lleva la respuesta del endpoint público a lo que muestra la ficha.
 * `toImageUrl` convierte rutas guardadas en direcciones completas.
 */
export function toProductDetail(raw: Record<string, unknown> | null | undefined, toImageUrl: (value: string) => string | null): ProductDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const hidePrice = raw.hide_price === true;
  const list = [text(raw.image), ...(Array.isArray(raw.images) ? raw.images.map(text) : [])]
    .filter((value): value is string => Boolean(value))
    .map(toImageUrl)
    .filter((value): value is string => Boolean(value));
  const images = [...new Set(list)];
  const stock = Math.max(0, Math.trunc(number(raw.stock_quantity)));
  const salePrice = number(raw.sale_price);
  const offer = raw.has_offer === true && typeof raw.offer_price === 'number' && raw.offer_price > 0 && raw.offer_price < salePrice ? raw.offer_price : null;
  const variants = (Array.isArray(raw.variants) ? raw.variants : [])
    .filter((variant): variant is Record<string, unknown> => Boolean(variant) && typeof variant === 'object' && (variant as { is_active?: unknown }).is_active !== false)
    .map((variant) => {
      const variantStock = Math.max(0, Math.trunc(number(variant.stock_quantity)));
      const variantPrice = number(variant.sale_price);
      return {
        id: String(variant.id),
        name: text(variant.variant_name) ?? 'Opción',
        price: hidePrice || variantPrice <= 0 ? null : variantPrice,
        stock: variantStock,
        inStock: variantStock > 0,
      };
    });
  return {
    description: text(raw.description),
    images,
    stock,
    inStock: raw.in_stock === true || stock > 0,
    unit: text(raw.unit_measure),
    hidePrice,
    price: hidePrice || salePrice <= 0 ? null : salePrice,
    offerPrice: hidePrice ? null : offer,
    promotionName: hidePrice ? null : text(raw.promotion_name),
    variants,
  };
}

/** «Disponible», «Últimas 3 unidades» o «Sin stock». */
export function availabilityLabel(inStock: boolean, stock: number | null): string {
  if (!inStock) return 'Sin stock';
  if (stock !== null && stock > 0 && stock <= 5) return `${stock === 1 ? 'Última unidad' : `Últimas ${stock} unidades`}`;
  return 'Disponible';
}

/** Lo que sale en el mensaje de WhatsApp: el producto y, si eligió una, la opción. */
export function whatsappProductLine(name: string, option: ProductVariantOption | null): string {
  return option ? `${name} (${option.name})` : name;
}
