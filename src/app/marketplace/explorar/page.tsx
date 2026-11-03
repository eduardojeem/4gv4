import { MarketplaceHomeContent } from '@/components/public/MarketplaceHomeContent'
import { getScopedLocationCatalog } from '@/lib/public/marketplace-location-catalog'
import { parseMarketplaceLocation } from '@/lib/public/marketplace-location'
export const dynamic='force-dynamic'
export default async function LocatedMarketplace({searchParams}:{searchParams:Promise<{country?:string;city?:string}>}){const selection=parseMarketplaceLocation(await searchParams);const scoped=await getScopedLocationCatalog(selection);return <MarketplaceHomeContent scoped={scoped}/>}
