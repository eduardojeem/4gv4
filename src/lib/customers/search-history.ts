export function searchHistoryKey(organizationId:string,userId:string):string {
  return 'customer-search-history:v2:'+encodeURIComponent(organizationId)+':'+encodeURIComponent(userId)
}
export function readSearchHistory(storage:Pick<Storage,'getItem'>,key:string):string[] {
  try {
    const raw=storage.getItem(key)
    const value=raw?JSON.parse(raw):[]
    return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string' && item.trim().length>0 && item.length<=120).slice(0,8):[]
  } catch { return [] }
}
export function saveSearchHistory(storage:Pick<Storage,'setItem'>,key:string,terms:string[]) {
  try { storage.setItem(key,JSON.stringify(terms.map(term=>term.trim().slice(0,120)).filter(Boolean).slice(0,8))) } catch { /* Search remains usable without browser storage. */ }
}
