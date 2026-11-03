'use client'
import { Suspense, type ComponentProps } from 'react'
import Link from 'next/link'
import { useMarketplaceLocationHref } from './MarketplaceLocationPicker'
function LocatedLink(props:ComponentProps<typeof Link>){const withLocation=useMarketplaceLocationHref();return <Link {...props} href={typeof props.href==='string'?withLocation(props.href):props.href}/>}
export default function MarketplaceLink(props:ComponentProps<typeof Link>){return <Suspense fallback={<Link {...props}/>}><LocatedLink {...props}/></Suspense>}
