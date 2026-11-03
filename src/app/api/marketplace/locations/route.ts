import { NextResponse } from 'next/server'
import { getAllMarketplaceOrganizations } from '@/lib/public/marketplace'
import { locationFacets } from '@/lib/public/marketplace-location'
export async function GET(request:Request){try{const country=new URL(request.url).searchParams.get('country')??'all';const stores=await getAllMarketplaceOrganizations();return NextResponse.json(locationFacets(stores.map(store=>({...store,locations:store.locations??[]})),country))}catch{return NextResponse.json({error:'No se pudieron cargar las ubicaciones.'},{status:503})}}
