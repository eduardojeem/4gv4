/** Private data belongs to one authenticated business scope and generation. */
export type PrivateCacheContext = Readonly<{
  userId: string | null;
  organizationId: string | null;
  branchId: string | null;
  permissionFingerprint: string;
  /** Sube con cada transición: las cachés privadas se descartan. */
  epoch: number;
  /**
   * Sube solo cuando se revoca el acceso (401, membresía perdida): lo que se pidió
   * antes ya no vale aunque usuario, comercio y sucursal sean los mismos.
   */
  access: number;
  key: string | null;
}>;
let context: PrivateCacheContext = { userId: null, organizationId: null, branchId: null, permissionFingerprint: '', epoch: 0, access: 0, key: null };
const listeners = new Set<(next: PrivateCacheContext, previous: PrivateCacheContext) => void>();
export const getPrivateCacheContext = () => context;
export const isPrivateCacheContextCurrent = (snapshot: PrivateCacheContext) => snapshot.epoch === context.epoch;

/**
 * ¿La respuesta a un pedido hecho con `snapshot` todavía le pertenece a quien está ahora?
 * Distinto de `isPrivateCacheContextCurrent`: terminar de resolver el comercio, la
 * sucursal o los permisos (de «sin resolver» a un valor) no la invalida, porque el
 * pedido se hizo con la misma identidad. Sí la invalidan otro usuario, otro comercio,
 * otra sucursal o permisos ya conocidos que cambiaron, y una revocación de acceso.
 */
export function isPrivateCacheSnapshotCompatible(snapshot: PrivateCacheContext, current = context) {
  if (snapshot.access !== current.access || snapshot.userId !== current.userId) return false;
  if (snapshot.organizationId !== null && snapshot.organizationId !== current.organizationId) return false;
  if (snapshot.branchId !== null && snapshot.branchId !== current.branchId) return false;
  if (snapshot.permissionFingerprint !== '' && snapshot.permissionFingerprint !== current.permissionFingerprint) return false;
  return true;
}

/**
 * Para datos del comercio que no dependen de la sucursal (por ejemplo, un producto
 * guardado): siguen valiendo mientras sean el mismo usuario, el mismo comercio y no
 * se haya revocado el acceso.
 */
export function isSameOrganizationIdentity(snapshot: PrivateCacheContext, current = context) {
  return snapshot.userId === current.userId
    && snapshot.access === current.access
    && (snapshot.organizationId === null || snapshot.organizationId === current.organizationId);
}

/**
 * Qué hace el panel ante una transición: `reset` (otro usuario u otro comercio: el
 * menú de antes no sirve), `reload` (acceso revocado: hay que confirmarlo con el
 * servidor) o `keep` (se resolvió el comercio o la sucursal, o cambió un permiso).
 */
export function panelTransitionAction(next: PrivateCacheContext, previous: PrivateCacheContext): 'reset' | 'reload' | 'keep' {
  const otherIdentity = next.userId !== previous.userId || (previous.organizationId !== null && next.organizationId !== previous.organizationId);
  if (otherIdentity) return 'reset';
  return next.access !== previous.access ? 'reload' : 'keep';
}

/** Cambió quién usa la app o qué comercio ve (o se le revocó el acceso): hay que descartar lo privado en pantalla. */
export function isPrivateIdentityTransition(next: PrivateCacheContext, previous: PrivateCacheContext) {
  return !isPrivateCacheSnapshotCompatible(previous, next) && !(
    // Resolver por primera vez el comercio no es otra identidad.
    previous.organizationId === null && next.organizationId !== null && previous.userId === next.userId && previous.access === next.access
  );
}

export function subscribePrivateCacheContext(listener: (next: PrivateCacheContext, previous: PrivateCacheContext) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function transition(next: Omit<PrivateCacheContext, 'epoch' | 'key' | 'access'>, revoke = false) {
  const previous = context;
  context = {
    ...next,
    epoch: previous.epoch + 1,
    access: previous.access + (revoke ? 1 : 0),
    key: next.userId && next.organizationId ? JSON.stringify([next.userId, next.organizationId, next.branchId ?? 'server-default', next.permissionFingerprint]) : null,
  };
  for (const listener of listeners) listener(context, previous);
}
export function setPrivateCacheUser(userId: string | null) {
  if (context.userId === userId) return;
  transition({ userId, organizationId: null, branchId: null, permissionFingerprint: '' });
}
export function setPrivateCacheOrganization(organizationId: string, permissionFingerprint = '') {
  if (!context.userId || (context.organizationId === organizationId && context.permissionFingerprint === permissionFingerprint)) return;
  transition({ userId: context.userId, organizationId, permissionFingerprint, branchId: context.organizationId === organizationId ? context.branchId : null });
}
export function setPrivateCacheBranch(branchId: string | null) {
  if (!context.userId || !context.organizationId || context.branchId === branchId) return;
  transition({ userId: context.userId, organizationId: context.organizationId, permissionFingerprint: context.permissionFingerprint, branchId });
}
/** Acceso revocado. Un pedido viejo rechazado no puede revocar un login o comercio más nuevo. */
export function invalidatePrivateCacheContext(snapshot = context) {
  if (!isPrivateCacheSnapshotCompatible(snapshot)) return;
  transition({ userId: context.userId, organizationId: context.organizationId, branchId: context.branchId, permissionFingerprint: context.permissionFingerprint }, true);
}
