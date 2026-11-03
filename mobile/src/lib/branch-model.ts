export type BranchDraft = {
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  manager_name: string;
};
export function branchDraft(
  branch?: Partial<Record<keyof BranchDraft, string | null>>,
): BranchDraft {
  return {
    name: branch?.name ?? '',
    code: branch?.code ?? '',
    address: branch?.address ?? '',
    city: branch?.city ?? '',
    phone: branch?.phone ?? '',
    email: branch?.email ?? '',
    manager_name: branch?.manager_name ?? '',
  };
}
/** Los campos vacíos se envían: omitirlos conservaría el dato viejo en PATCH. */
export function branchPayload(draft: BranchDraft): BranchDraft {
  return Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [
      key,
      key === 'code' ? value.trim().toUpperCase() : value.trim(),
    ]),
  ) as BranchDraft;
}
export function branchDraftIssue(draft: BranchDraft) {
  if (!draft.name.trim()) return 'Ingresá el nombre de la sucursal.';
  if (
    draft.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())
  )
    return 'Revisá el correo de la sucursal.';
  return null;
}
