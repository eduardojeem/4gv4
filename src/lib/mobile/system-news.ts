export interface PublishedMobileRelease { version: string; storeUrl: string }
const versionParts = (value: string) => /^\d+\.\d+\.\d+$/.test(value) ? value.split('.').map(Number) : null
export function newerPublishedRelease(installed: string | null, release: PublishedMobileRelease | null, platform: string): PublishedMobileRelease | null {
  if (!installed || !release) return null
  const current = versionParts(installed), latest = versionParts(release.version)
  if (!current || !latest || [...current,...latest].some(n=>!Number.isSafeInteger(n))) return null
  try {
    const url = new URL(release.storeUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    const validStore = platform === 'ios' ? url.hostname === 'apps.apple.com' && /\/id\d+(?:\/|$)/.test(url.pathname) : platform === 'android' && url.hostname === 'play.google.com' && url.pathname === '/store/apps/details' && url.searchParams.get('id') === 'com.mitiendapy.app'
    if (!validStore) return null
  } catch { return null }
  for (let index=0;index<3;index++) { if(latest[index]>current[index])return release; if(latest[index]<current[index])return null }
  return null
}
export interface NewsPreference { organization_id:string;user_id:string;push_enabled:boolean;updated_at:string }
export function eligibleNewsRecipients(announcement:{target:string;target_org_ids:string[]|null;sent_at:string|null}, preferences:NewsPreference[]) {
  const groups=new Map<string,Set<string>>()
  const sent=Date.parse(announcement.sent_at ?? '')
  for(const pref of preferences) {
    const optedAt=Date.parse(pref.updated_at)
    if(!pref.push_enabled || !Number.isFinite(sent) || !Number.isFinite(optedAt) || optedAt>sent)continue
    if(announcement.target!=='all' && !(announcement.target==='specific' && announcement.target_org_ids?.includes(pref.organization_id)))continue
    const users=groups.get(pref.organization_id)??new Set<string>();users.add(pref.user_id);groups.set(pref.organization_id,users)
  }
  return [...groups].map(([organizationId,users])=>({organizationId,userIds:[...users]}))
}
