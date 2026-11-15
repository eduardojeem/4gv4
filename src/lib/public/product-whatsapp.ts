import { formatWhatsAppPhone } from '../whatsapp-number';

export type ProductWhatsappContact = {
  whatsapp?: string | null;
  phone?: string | null;
  productWhatsappEnabled?: boolean;
};

type InquiryProduct = { name: string; url: string; priceHidden?: boolean };

function validNumber(contact: ProductWhatsappContact | null | undefined): string | null {
  for (const raw of [contact?.whatsapp, contact?.phone]) {
    if (!raw?.trim()) continue;
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8) continue;
    const international = raw.trim().startsWith('+') || raw.trim().startsWith('00')
      || (!digits.startsWith('0') && digits.length >= 11);
    let number = international
      ? (digits.startsWith('00') ? digits.slice(2) : digits)
      : formatWhatsAppPhone(raw);
    if (number.startsWith('5950')) number = '595' + number.slice(4);
    if (/^[1-9]\d{9,14}$/.test(number)) return number;
  }
  return null;
}

/** Only the selected business/branch supplies the destination, never platform support. */
export function productWhatsappInquiryHref({ company, branch, product, message: customMessage }: {
  company: ProductWhatsappContact | null | undefined;
  branch?: ProductWhatsappContact | null;
  product: InquiryProduct;
  message?: string;
}): string | null {
  if (company?.productWhatsappEnabled === false) return null;
  const phone = validNumber(branch) || validNumber(company);
  if (!phone) return null;
  try {
    if (!['http:', 'https:'].includes(new URL(product.url).protocol)) return null;
  } catch {
    return null;
  }
  const message = customMessage ?? (product.priceHidden
    ? `Hola. Quiero consultar el precio de este producto:\n*${product.name.trim()}*\n${product.url}`
    : `Hola, me interesa ${product.name.trim()}. ¿Está disponible?\n${product.url}`);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}