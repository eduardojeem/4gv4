/**
 * Las redes de la tienda, tal como se guardan en «Sitio Web» o en el onboarding.
 *
 * El dueño escribe lo que tiene a mano: `@tienda`, `tienda`, `instagram.com/tienda`
 * o la URL entera. El encabezado ya normalizaba eso, pero el modal del
 * marketplace pegaba el valor al dominio: quien habia guardado la URL completa
 * terminaba con `instagram.com/https://instagram.com/tienda`, un enlace roto.
 */

export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok'

export type SocialLink = {
  platform: SocialPlatform
  label: string
  /** Lo que se muestra: `@tienda` en Instagram y TikTok, el nombre en Facebook. */
  handle: string
  href: string
}

const PLATFORMS: Record<SocialPlatform, { label: string; base: string; hosts: string[]; at: boolean }> = {
  instagram: { label: 'Instagram', base: 'https://instagram.com/', hosts: ['instagram.com', 'www.instagram.com'], at: true },
  facebook: { label: 'Facebook', base: 'https://facebook.com/', hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com'], at: false },
  tiktok: { label: 'TikTok', base: 'https://tiktok.com/@', hosts: ['tiktok.com', 'www.tiktok.com'], at: true },
}

/** El usuario sin arroba, sin dominio y sin barras. */
export function socialHandle(value: string | null | undefined, platform: SocialPlatform): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''

  let rest = raw.replace(/^https?:\/\//i, '')
  for (const host of PLATFORMS[platform].hosts) {
    if (rest.toLowerCase().startsWith(`${host}/`)) {
      rest = rest.slice(host.length + 1)
      break
    }
  }

  return rest.replace(/^@/, '').replace(/^\/+/, '').replace(/[/?#].*$/, '').trim()
}

/** La direccion del perfil. Devuelve '' si no hay nada util que enlazar. */
export function socialProfileUrl(value: string | null | undefined, platform: SocialPlatform): string {
  const handle = socialHandle(value, platform)
  if (!handle) return ''
  return `${PLATFORMS[platform].base}${handle}`
}

/** Las redes cargadas, en orden, listas para dibujar. */
export function getSocialLinks(
  company: { instagram?: string | null; facebook?: string | null; tiktok?: string | null } | null | undefined,
): SocialLink[] {
  const platforms: SocialPlatform[] = ['instagram', 'facebook', 'tiktok']

  return platforms.flatMap((platform) => {
    const handle = socialHandle(company?.[platform], platform)
    if (!handle) return []
    return [{
      platform,
      label: PLATFORMS[platform].label,
      handle: PLATFORMS[platform].at ? `@${handle}` : handle,
      href: `${PLATFORMS[platform].base}${handle}`,
    }]
  })
}
