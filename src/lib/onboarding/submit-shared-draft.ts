import type { SharedOnboardingState } from './shared-setup'
export class SharedDraftSaveError extends Error {
  constructor(message:string,public status:number,public code?:string){super(message)}
}
/** Solo se invoca al confirmar el resumen. Conserva el contrato de revisiones existente. */
export async function persistSharedDraft(state:SharedOnboardingState,selectedModules:string[],revision:number,onRevision:(revision:number)=>void){
  const steps=[{step:2,data:state.data},{step:3,data:state.data.primaryBranch},{step:4,data:{selectedModules}}]
  let expectedRevision=revision
  for(const step of steps){
    const response=await fetch('/api/onboarding/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...step,expectedRevision})})
    const result=await response.json().catch(()=>null)
    if(!response.ok)throw new SharedDraftSaveError(result?.error||'No se pudo guardar el borrador. Tus datos se conservan para reintentar.',response.status,result?.code)
    if(!Number.isSafeInteger(result?.revision)||result.revision<0)throw new Error('No se pudo confirmar la revisión guardada. Recargá antes de reintentar.')
    expectedRevision=result.revision
    onRevision(expectedRevision)
  }
  return expectedRevision
}
