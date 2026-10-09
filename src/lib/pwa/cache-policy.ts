/** Authenticated HTML, RSC, APIs and remote images never enter this cache. */
export function isPublicStaticAsset(url: URL, origin: string, method: string): boolean {
  return method === 'GET' && url.origin === origin && url.pathname.startsWith('/_next/static/')
    && /\.(?:js|css|woff2?|ttf|otf)$/.test(url.pathname)
}

/** Only cache names previously owned by this app's old PWA plugin. */
export function obsoletePrivateCache(name: string): boolean {
  return ['apis', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'start-url', 'next-data', 'static-data-assets', 'cross-origin'].includes(name)
    || name.startsWith('workbox-precache-')
}
