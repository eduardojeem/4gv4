import { getPrivateCacheContext, isPrivateCacheContextCurrent, type PrivateCacheContext } from './private-cache-context';

/** Start private shelf reads only after the POS server has resolved its branch. */
export function loadPosPrivateCatalog<Product, Category>(branchId: string | undefined, options: {
  loadFrequent: (scope: PrivateCacheContext) => Promise<Product[]>;
  loadCategories: () => Promise<Category[]>;
  onFrequent: (products: Product[]) => void;
  onCategories: (categories: Category[]) => void;
}) {
  const scope = getPrivateCacheContext();
  let active = true;
  const current = () => active && isPrivateCacheContextCurrent(scope);
  if (branchId && scope.branchId === branchId && scope.key) {
    void options.loadFrequent(scope).then(rows => { if (current()) options.onFrequent(rows); })
      .catch(() => { if (current()) options.onFrequent([]); });
    void options.loadCategories().then(rows => { if (current()) options.onCategories(rows); })
      .catch(() => { if (current()) options.onCategories([]); });
  }
  return () => { active = false; };
}
