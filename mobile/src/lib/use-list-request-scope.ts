import { useLayoutEffect, useState } from 'react';
import { createListRequestScope } from './list-request-scope';
export function useListRequestScope(key: string) {
 const [scope] = useState(createListRequestScope);
 useLayoutEffect(() => { scope.invalidate(); return () => scope.invalidate(); }, [key, scope]);
 return scope;
}
