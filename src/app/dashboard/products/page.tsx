/**
 * Modern Products Dashboard Page
 * Redesigned products management interface
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Plus, RefreshCw, Warehouse, X, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProductsSupabase } from "@/hooks/useProductsSupabase";
import { useProductsDashboard } from "@/hooks/useProductsDashboard";
import { ProductModal } from "@/components/dashboard/product-modal";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import type { Product } from "@/types/product-unified";
import { SectionGuideButton } from "@/components/dashboard/common/SectionGuideButton";
import {
  PrintLabelsDialog,
  type LabelDialogProduct,
} from "@/components/dashboard/products/labels/PrintLabelsDialog";
import { duplicatedFields } from "@/lib/products/duplicate";
import { PRODUCTS_GUIDE } from "@/components/dashboard/common/section-guides-data";
import {
  exportCatalogToExcel,
  exportCatalogToCSV,
  type ImportProductRow,
} from "@/lib/products/import-export-utils";
import {
  SearchAndActionsBar,
  QuickFiltersBar,
  FilterPanel,
  ProductGrid,
  ProductTable,
  ProductSectionGroup,
  BulkActionsToolbar,
  ProductQuickViewModal,
  ImportProductsModal,
  ProductSummaryOverview,
} from "@/components/dashboard/products-modern";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pagination } from "@/components/ui/pagination";
import {
  exportProductsToInventoryCSV,
  downloadCSV,
  isServiceLikeProduct,
} from "@/lib/products-dashboard-utils";
import type { DashboardMetrics, GroupByMode } from "@/types/products-dashboard";
import type { QuickFilterCounts } from "@/components/dashboard/products-modern/QuickFiltersBar";
import type { Database } from "@/lib/supabase/types";
import { PlanLimitBanner } from "@/components/subscription/PlanLimitBanner";
import { useBranch } from "@/contexts/branch-context";
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext';
import {
  PRODUCT_VIEW_PREFERENCES_KEY,
  loadProductViewPreferences,
  saveProductViewPreferences,
  clearProductViewPreferences,
  describeProductViewPreferences,
  type ProductViewPreferences,
} from "@/lib/products/product-view-preferences";
type Json = Database["public"]["Tables"]["products"]["Row"]["dimensions"];

/**
 * Alcance configurable de la sección:
 * Por defecto abre con todo el catálogo ({}).
 * (El alcance anterior de solo productos físicos activos era { catalog_kind: "part", is_active: true }).
 */
const PRODUCTS_SECTION_SCOPE = {} as const;

export default function ProductsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const { selectedBranch } = useBranch();
  const [showBranchNotice, setShowBranchNotice] = useState(true);

  // Group by mode (desglose por secciones) y modo de maximizar espacio
  const [groupBy, setGroupBy] = useState<GroupByMode>("none");
  const [hasCustomPreferences, setHasCustomPreferences] = useState(false);
  const preferencesLoadedRef = useRef(false);
  // Servicios: se ofrecen si la organizacion tiene el modulo o ya cargo
  // servicios. Sin ninguna de las dos, «Solo Servicios», «Por tipo» y
  // «0 servicios» eran ruido en un catalogo que no los usa.
  const { effectiveModules } = useSubscriptionStatus();
  const hasServicesModule = effectiveModules.includes("services");
  // Resumen del Catálogo: activable / expandible a demanda desde la barra
  const [showSummary, setShowSummary] = useState(false);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  // Permissions check
  const canViewCost = hasPermission('cost_prices.read')
  const canCreateProducts = hasPermission('products.create') || hasPermission('products.manage')
  const canEditProducts = hasPermission('products.update') || hasPermission('products.manage')
  const canDeleteProducts = hasPermission('products.delete') || hasPermission('products.manage')

  const {
    products,
    categories,
    brands,
    suppliers,
    alerts,
    loading,
    error: productsError,
    dashboardStats,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshData,
    exportToCSV,
    exportToPDF,
    setFilters: setServerFilters,
    setSort: setServerSort,
    setPagination: setServerPagination,
    totalProducts,
    resultTruncated,
  } = useProductsSupabase();

  const {
    displayedProducts,
    paginatedProducts, // Products for current page
    metrics,
    viewMode,
    setViewMode,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    totalItems,
    searchQuery,
    filters,
    sortConfig,
    selectedProductIds,
    setSelectedProductIds,
    isFilterPanelOpen,
    setIsFilterPanelOpen,
    handleSearch,
    handleFilterChange,
    handleQuickFilter,
    handleSort,
    handleSelectProduct,
    clearFilters,
    clearSelection,
  } = useProductsDashboard({
    products,
    categories,
    suppliers,
    alerts,
    serverPaginated: true,
    serverTotalItems: totalProducts,
    initialFilters: PRODUCTS_SECTION_SCOPE,
  });

  const [isPending, startTransition] = useTransition();

  // La grilla reemplazaba toda la lista por esqueletos en CADA recarga, no solo
  // en la primera: cualquier refresco hacia desaparecer los productos y volver a
  // pintarlos, que es lo que se siente como "se actualiza solo". El esqueleto
  // queda para cuando no hay nada que mostrar todavia; con datos en pantalla la
  // recarga es silenciosa y solo se avisa con un indicador chico.
  const isFirstLoad = (loading || isPending) && products.length === 0;
  const isRefreshing = (loading || isPending) && products.length > 0;
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const initialUrlApplied = useRef(false);

  useEffect(() => {
    if (initialUrlApplied.current || typeof window === "undefined") return;
    initialUrlApplied.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") {
      setCreateModalOpen(true);
    }
    if (params.get("filter") === "low_stock") {
      handleQuickFilter("low_stock");
    }
  }, [handleQuickFilter]);

  // Cargar preferencias guardadas del usuario (desglose continuo, filtro productos, etc.)
  useEffect(() => {
    if (typeof window === "undefined" || preferencesLoadedRef.current) return;
    preferencesLoadedRef.current = true;

    try {
      const raw = localStorage.getItem(PRODUCT_VIEW_PREFERENCES_KEY);
      if (!raw) return;

      const prefs = loadProductViewPreferences();
      setHasCustomPreferences(true);

      if (prefs.groupBy) {
        setGroupBy(prefs.groupBy);
      }
      if (prefs.viewMode) {
        setViewMode(prefs.viewMode);
      }
      if (prefs.itemsPerPage) {
        setItemsPerPage(prefs.itemsPerPage);
      }
      if (typeof prefs.isMaximizedSpace === "boolean") {
        setShowSummary(!prefs.isMaximizedSpace);
      }

      // Aplicar filtro de alcance guardado si no viene parámetro explícito en la URL
      const params = new URLSearchParams(window.location.search);
      if (!params.get("filter")) {
        if (prefs.defaultScope === "all") {
          handleQuickFilter("all");
        } else if (prefs.defaultScope === "services") {
          handleQuickFilter("services");
        } else if (prefs.defaultScope === "products") {
          handleFilterChange({ catalog_kind: "part", is_active: true });
        }
      }
    } catch (e) {
      console.warn("Error applying product view preferences:", e);
    }
  }, [handleQuickFilter, handleFilterChange, setViewMode, setItemsPerPage]);

  const handleSavePreferences = useCallback(() => {
    let defaultScope: ProductViewPreferences["defaultScope"] = "products";
    if (!filters.catalog_kind) {
      defaultScope = "all";
    } else if (filters.catalog_kind === "service") {
      defaultScope = "services";
    } else {
      defaultScope = "products";
    }

    const currentPrefs: ProductViewPreferences = {
      defaultScope,
      groupBy,
      viewMode,
      itemsPerPage,
      isMaximizedSpace: !showSummary,
    };

    saveProductViewPreferences(currentPrefs);
    setHasCustomPreferences(true);

    const desc = describeProductViewPreferences(currentPrefs);
    toast.success("Configuración de vista guardada", {
      description: `Se aplicará automáticamente: ${desc}`,
      duration: 5000,
    });
  }, [filters.catalog_kind, groupBy, viewMode, itemsPerPage, showSummary]);

  const handleResetPreferences = useCallback(() => {
    clearProductViewPreferences();
    setHasCustomPreferences(false);
    setGroupBy("none");
    setViewMode("table");
    setItemsPerPage(20);
    setShowSummary(false);
    setIsSummaryExpanded(true);
    handleQuickFilter("all");

    toast.info("Configuración restablecida", {
      description:
        "Se restauró la vista inicial del sistema (Todo el catálogo, Sin desglose / Lista continua, Vista tabla).",
    });
  }, [handleQuickFilter, setViewMode, setItemsPerPage]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [serverSearch, setServerSearch] = useState("");
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  // Null: nadie pidio etiquetas. Con contenido: los productos a etiquetar,
  // sean los seleccionados o uno solo desde la vista rapida.
  const [labelsTarget, setLabelsTarget] = useState<LabelDialogProduct[] | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  const normalizedAlerts = useMemo(() => {
    return alerts
      .map(alert => ({
        ...alert,
        type: alert.type || (alert as any).alert_type || 'other'
      }))
      .filter(alert => !dismissedAlertIds.includes(alert.id));
  }, [alerts, dismissedAlertIds]);

  // Métricas y contadores GLOBALES (todo el catálogo), no solo la página visible.
  // Se usa dashboardStats cuando está disponible; si no, se cae a las métricas
  // calculadas sobre la vista actual para no quedar en blanco.
  const globalMetrics = useMemo<DashboardMetrics>(() => ({
    total_products: dashboardStats?.totalProducts ?? metrics.total_products,
    physical_products_count: dashboardStats?.physicalProductsCount ?? metrics.physical_products_count,
    services_count: dashboardStats?.servicesCount ?? metrics.services_count,
    active_products: dashboardStats?.activeProducts ?? metrics.active_products,
    low_stock_count: dashboardStats?.lowStockCount ?? metrics.low_stock_count,
    out_of_stock_count: dashboardStats?.outOfStockCount ?? metrics.out_of_stock_count,
    inventory_value: dashboardStats?.totalStockValue ?? metrics.inventory_value,
  }), [dashboardStats, metrics]);

  // Lo que hay en la pagina actual, para el desglose de arriba de la tabla.
  const serviciosEnPantalla = useMemo(
    () => paginatedProducts.filter(isServiceLikeProduct).length,
    [paginatedProducts],
  );
  const productosEnPantalla = paginatedProducts.length - serviciosEnPantalla;

  const globalQuickFilterCounts = useMemo<QuickFilterCounts | undefined>(() => {
    if (!dashboardStats) return undefined;
    return {
      all: dashboardStats.totalProducts,
      products: dashboardStats.physicalProductsCount ?? Math.max(0, dashboardStats.totalProducts - (dashboardStats.servicesCount ?? 0)),
      services: dashboardStats.servicesCount ?? 0,
      low_stock: dashboardStats.lowStockCount,
      out_of_stock: dashboardStats.outOfStockCount,
      active: dashboardStats.activeProducts,
      inactive: Math.max(0, dashboardStats.totalProducts - dashboardStats.activeProducts),
    };
  }, [dashboardStats]);

  const handleAlertClick = (type: 'out_of_stock' | 'low_stock' | 'missing_data') => {
    if (type === 'out_of_stock') {
      handleQuickFilter('out_of_stock');
      toast.info("Mostrando productos agotados");
    } else if (type === 'low_stock') {
      handleQuickFilter('low_stock');
      toast.info("Mostrando productos con bajo stock");
    } else if (type === 'missing_data') {
      toast.info("Por favor revisa la información de tus productos");
    }
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlertIds(prev => [...prev, alertId]);
  };

  const activeAdvancedFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.category_id) count++;
    if (filters.supplier_id) count++;
    if (filters.brand) count++;
    if (filters.item_type && filters.item_type !== 'all') count++;
    if (filters.stock_status) count++;
    if (typeof filters.price_min === 'number') count++;
    if (typeof filters.price_max === 'number') count++;
    return count;
  }, [filters]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setServerSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const mappedServerFilters = useMemo(() => {
    const quickFilterStockStatus =
      filters.quick_filter === "low_stock"
        ? "low_stock"
        : filters.quick_filter === "out_of_stock"
          ? "out_of_stock"
          : undefined;

    const quickFilterIsActive =
      filters.quick_filter === "active"
        ? true
        : filters.quick_filter === "inactive"
          ? false
          : undefined;

    // Productos o servicios lo resuelve el servidor: asi el total y las paginas
    // coinciden con lo que se ve. El alcance de la seccion (`catalog_kind`) es
    // el que manda; el filtro rapido viejo se sigue entendiendo.
    const quickFilterCatalogKind =
      filters.catalog_kind
        ?? (filters.quick_filter === "products"
          ? ("part" as const)
          : filters.quick_filter === "services"
            ? ("service" as const)
            : undefined);

    return {
      search: serverSearch || "",
      category: filters.category_id || "",
      supplier: filters.supplier_id || "",
      brand: filters.brand || "",
      stockStatus:
        quickFilterStockStatus ||
        (filters.stock_status as
          | "all"
          | "in_stock"
          | "low_stock"
          | "out_of_stock"
          | undefined) ||
        "all",
      priceMin: filters.price_min,
      priceMax: filters.price_max,
      isActive:
        quickFilterIsActive !== undefined
          ? quickFilterIsActive
          : filters.is_active,
      catalogKind: quickFilterCatalogKind,
      deviceBrand: filters.device_brand || "",
      deviceModel: filters.device_model || "",
    };
  }, [filters, serverSearch]);

  const mappedServerSort = useMemo(() => {
    const fieldMap: Record<string, "name" | "sku" | "price" | "stock" | "created_at" | "device"> = {
      name: "name",
      sku: "sku",
      sale_price: "price",
      stock_quantity: "stock",
      created_at: "created_at",
      updated_at: "created_at",
      // Marca y modelo del celular: agrupa los repuestos del mismo teléfono.
      device_model: "device",
    };

    return {
      field: fieldMap[sortConfig.field] || "name",
      direction: sortConfig.direction,
    } as const;
  }, [sortConfig]);

  useEffect(() => {
    setServerFilters((prev) => {
      const next = mappedServerFilters;
      if (
        prev.search === next.search &&
        prev.category === next.category &&
        prev.supplier === next.supplier &&
        prev.brand === next.brand &&
        prev.stockStatus === next.stockStatus &&
        prev.priceMin === next.priceMin &&
        prev.priceMax === next.priceMax &&
        prev.isActive === next.isActive &&
        // Sin comparar el tipo, pasar de «productos» a «servicios» (que no
        // cambia ningun otro campo) no llegaba nunca al servidor.
        prev.catalogKind === next.catalogKind &&
        prev.deviceBrand === next.deviceBrand &&
        prev.deviceModel === next.deviceModel
      ) {
        return prev;
      }
      return next;
    });
  }, [mappedServerFilters, setServerFilters]);

  useEffect(() => {
    setServerSort((prev) => {
      if (
        prev.field === mappedServerSort.field &&
        prev.direction === mappedServerSort.direction
      ) {
        return prev;
      }
      return mappedServerSort;
    });
  }, [mappedServerSort, setServerSort]);

  useEffect(() => {
    setServerPagination((prev) => {
      if (prev.page === currentPage && prev.limit === itemsPerPage) return prev;
      return { page: currentPage, limit: itemsPerPage };
    });
  }, [currentPage, itemsPerPage, setServerPagination]);

  const handleSelectAllOnPage = (selected: boolean) => {
    const pageIds = paginatedProducts.map((product) => product.id);

    if (selected) {
      setSelectedProductIds(
        Array.from(new Set([...selectedProductIds, ...pageIds])),
      );
      return;
    }

    setSelectedProductIds(
      selectedProductIds.filter((id) => !pageIds.includes(id)),
    );
  };

  // Handle product actions
  const handleProductEdit = (product: Product) => {
    setEditingProduct(product);
  };

  const handleProductDelete = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    const targetProduct = productToDelete;

    const result = await deleteProduct(targetProduct.id);
    if (result.success) {
      toast.success(`"${targetProduct.name}" eliminado exitosamente`);
      clearSelection();
    } else {
      if (result.code === 'PRODUCT_HAS_TRANSACTIONS' || result.status === 409) {
        toast.warning(`No se puede eliminar "${targetProduct.name}"`, {
          description: "Tiene ventas o reparaciones registradas. Podés desactivarlo para que no figure en catálogo ni ventas.",
          duration: 10000,
          action: {
            label: "Desactivar",
            onClick: async () => {
              const res = await updateProduct(targetProduct.id, { is_active: false, visibility: 'hidden' });
              if (res.success) {
                toast.success(`"${targetProduct.name}" se desactivó y ocultó del catálogo.`);
                void refreshData();
              } else {
                toast.error(res.error || 'Error al desactivar el producto');
              }
            },
          },
        });
      } else {
        toast.error(result.error || "Error al eliminar el producto", { duration: 6000 });
      }
    }
    setDeleteDialogOpen(false);
    setProductToDelete(null);
  };

  const handleProductDuplicate = async (product: Product) => {
    if (!canCreateProducts) {
      toast.error("No tienes permisos para crear productos");
      return;
    }

    // Exclude system fields and relations that shouldn't be duplicated

    const { id, created_at, updated_at, category, supplier, ...rest } =
      product as any;

    const parseDimensions = (value: unknown): Json => {
      if (typeof value !== "string") return value as Json;
      try {
        return JSON.parse(value) as Json;
      } catch {
        return null as Json;
      }
    };

    const duplicatedData = {
      ...rest,
      // El codigo, el nombre y el stock de la copia: sin encadenar prefijos,
      // sin arrastrar el codigo de barras del original y con el stock en cero.
      ...duplicatedFields(product),
      dimensions: parseDimensions(product.dimensions),
    };

    const result = await createProduct(duplicatedData);
    if (result.success) {
      toast.success("Producto duplicado");
    } else {
      toast.error(result.error || "Error al duplicar");
    }
  };

  // Click on a product opens a quick-view modal instead of navigating away.
  const handleProductViewDetails = (product: Product) => {
    setQuickViewProduct(product);
  };

  // Explicit "see full detail" navigates to the dedicated product page.
  const handleViewFullDetails = (product: Product) => {
    setQuickViewProduct(null);
    router.push(`/dashboard/products/${product.id}`);
  };

  // Handle visibility toggle (Catálogo Público vs Oculto)
  const handleToggleActive = async (product: Product, newValue: boolean) => {
    const nextVisibility = newValue ? 'public' : 'hidden';
    const updatePayload: any = {
      visibility: nextVisibility,
      ...(newValue && !product.is_active ? { is_active: true } : {}),
    };
    const result = await updateProduct(product.id, updatePayload);
    if (result.success) {
      toast.success(
        newValue
          ? `"${product.name}" ahora es visible en el catálogo público`
          : `"${product.name}" ocultado del catálogo (sigue activo en inventario)`
      );
    } else {
      toast.error(result.error || 'Error al actualizar visibilidad');
      throw new Error(result.error); // lets the card revert optimistic state
    }
  };

  // Handle product operational active toggle (Activo / Inactivo en inventario y ventas)
  const handleToggleProductActiveState = async (product: Product, newActiveState: boolean) => {
    const result = await updateProduct(product.id, {
      is_active: newActiveState,
    } as any);

    if (result.success) {
      toast.success(
        newActiveState
          ? `"${product.name}" ha sido activado exitosamente`
          : `"${product.name}" ha sido desactivado`
      );
      setQuickViewProduct((prev) =>
        prev && prev.id === product.id ? { ...prev, is_active: newActiveState } : prev
      );
    } else {
      toast.error(result.error || 'Error al cambiar estado del producto');
      throw new Error(result.error);
    }
  };

  // Handle import
  // Handle import with Excel/CSV parsing and update-existing support
  const handleImportProducts = async (
    rows: ImportProductRow[],
    options?: { updateExisting?: boolean; onProgress?: (current: number, total: number) => void }
  ) => {
    if (!canCreateProducts) {
      toast.error("No tienes permisos para importar productos");
      return {
        success: 0,
        updated: 0,
        failed: rows.length,
        errors: [{ row: 1, error: "Sin permisos para crear productos" }],
      };
    }

    let success = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Map de productos existentes por SKU y por código de barras para lookup rápido
    const existingBySku = new Map<string, Product>();
    const existingByBarcode = new Map<string, Product>();
    for (const p of products) {
      if (p.sku) existingBySku.set(p.sku.toLowerCase().trim(), p);
      if (p.barcode) existingByBarcode.set(p.barcode.trim(), p);
    }

    // Pre-cargar productos existentes desde la base de datos para TODOS los SKUs y códigos del archivo
    // Esto evita que productos de otras páginas o inactivos no se encuentren al buscar en memoria.
    const supabase = createClient();
    const skusToSearch = Array.from(new Set(rows.map((r) => r.sku?.trim()).filter(Boolean))) as string[];
    const barcodesToSearch = Array.from(new Set(rows.map((r) => r.barcode?.trim()).filter(Boolean))) as string[];

    if (skusToSearch.length > 0) {
      try {
        const { data: matchedBySku } = await supabase
          .from('products')
          .select('id, name, sku, barcode')
          .in('sku', skusToSearch);
        if (matchedBySku) {
          for (const p of matchedBySku) {
            if (p.sku) existingBySku.set(p.sku.toLowerCase().trim(), p as any);
            if (p.barcode) existingByBarcode.set(p.barcode.trim(), p as any);
          }
        }
      } catch (e) {
        console.error('Error pre-matching SKUs for import:', e);
      }
    }

    if (barcodesToSearch.length > 0) {
      try {
        const { data: matchedByBarcode } = await supabase
          .from('products')
          .select('id, name, sku, barcode')
          .in('barcode', barcodesToSearch);
        if (matchedByBarcode) {
          for (const p of matchedByBarcode) {
            if (p.sku) existingBySku.set(p.sku.toLowerCase().trim(), p as any);
            if (p.barcode) existingByBarcode.set(p.barcode.trim(), p as any);
          }
        }
      } catch (e) {
        console.error('Error pre-matching barcodes for import:', e);
      }
    }

    // Map de categorías normalizadas sin importar mayúsculas/tildes
    const categoryMap = new Map<string, string>();
    for (const cat of categories) {
      if (cat.name) {
        const norm = cat.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        categoryMap.set(norm, cat.id);
      }
    }

    // Map de proveedores normalizados
    const supplierMap = new Map<string, string>();
    for (const sup of suppliers) {
      if (sup.name) {
        const norm = sup.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        supplierMap.set(norm, sup.id);
      }
    }

    const total = rows.length;
    for (let i = 0; i < total; i++) {
      const row = rows[i];
      options?.onProgress?.(i + 1, total);

      try {
        const skuKey = row.sku?.toLowerCase().trim() || '';
        const barcodeKey = row.barcode?.trim() || '';

        const existing = options?.updateExisting
          ? (skuKey ? existingBySku.get(skuKey) : null) || (barcodeKey ? existingByBarcode.get(barcodeKey) : null)
          : null;

        const categoryNorm = row.category
          ? row.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
          : '';
        const categoryId = categoryMap.get(categoryNorm) || null;

        const supplierNorm = row.supplier
          ? row.supplier.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
          : '';
        const supplierId = supplierMap.get(supplierNorm) || null;

        const updatePayload: any = {
          sale_price: row.sale_price,
          ...(row.purchase_price !== undefined ? { purchase_price: row.purchase_price } : {}),
          stock_quantity: row.stock_quantity,
          ...(row.description ? { description: row.description } : {}),
          ...(row.brand ? { brand: row.brand } : {}),
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(supplierId ? { supplier_id: supplierId } : {}),
          ...(row.is_active !== undefined ? { is_active: row.is_active } : {}),
        };

        if (existing) {
          // Modo actualizar existente
          const updateRes = await updateProduct(existing.id, updatePayload);
          if (updateRes.success) {
            updated++;
          } else {
            failed++;
            errors.push({ row: row.rawRowIndex || i + 2, error: updateRes.error || 'Error al actualizar' });
          }
        } else {
          // Modo crear nuevo
          const createPayload: any = {
            name: row.name,
            sku: row.sku || `IMP-${Date.now()}-${i + 1}`,
            description: row.description || '',
            brand: row.brand || null,
            category_id: categoryId,
            supplier_id: supplierId,
            purchase_price: row.purchase_price || 0,
            sale_price: row.sale_price,
            stock_quantity: row.stock_quantity || 0,
            min_stock: row.min_stock || 0,
            is_active: row.is_active !== undefined ? row.is_active : true,
            barcode: row.barcode || null,
            unit_measure: row.unit_measure || 'unidad',
          };
          const createRes = await createProduct(createPayload);
          if (createRes.success) {
            success++;
          } else if (createRes.conflictProductId && options?.updateExisting) {
            // Si chocó contra un producto existente en base de datos y la opción actualizar está activa, actualizar
            const updateRes = await updateProduct(createRes.conflictProductId, updatePayload);
            if (updateRes.success) {
              updated++;
            } else {
              failed++;
              errors.push({ row: row.rawRowIndex || i + 2, error: updateRes.error || 'Error al actualizar producto existente' });
            }
          } else {
            failed++;
            const errMsg = createRes.code === 'DUPLICATE_CODE' && !options?.updateExisting
              ? `${createRes.error} (Activá la opción "Actualizar si ya existe" para actualizar sus datos)`
              : (createRes.error || 'Error al crear producto');
            errors.push({ row: row.rawRowIndex || i + 2, error: errMsg });
          }
        }
      } catch (err) {
        failed++;
        errors.push({ row: row.rawRowIndex || i + 2, error: err instanceof Error ? err.message : 'Error' });
      }
    }

    // Refresh after import
    await refreshData();
    return { success, updated, failed, errors };
  };

  // Helper para obtener la lista de productos a exportar (seleccionados o vista actual)
  const getProductsForExport = () => {
    if (selectedProductIds.length > 0) {
      return products.filter((p) => selectedProductIds.includes(p.id));
    }
    return displayedProducts.length > 0 ? displayedProducts : products;
  };

  // Handle export to Excel (.xlsx)
  const handleExportExcel = async () => {
    const isSelected = selectedProductIds.length > 0;
    const itemsToExport = getProductsForExport();

    if (itemsToExport.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    try {
      await exportCatalogToExcel(itemsToExport as any, {
        filename: isSelected
          ? `productos_seleccionados_${itemsToExport.length}_${new Date().toISOString().split("T")[0]}`
          : `catalogo_productos_${new Date().toISOString().split("T")[0]}`,
        canViewCost,
        branchName: selectedBranch?.name,
      });
      toast.success(`${itemsToExport.length} productos exportados a Excel (.xlsx)`);
    } catch (e) {
      console.error("Error exporting to Excel:", e);
      toast.error("Error al exportar a Excel");
    }
  };

  // Handle export to CSV (.csv)
  const handleExportCsv = async () => {
    const isSelected = selectedProductIds.length > 0;
    const itemsToExport = getProductsForExport();

    if (itemsToExport.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    try {
      exportCatalogToCSV(itemsToExport as any, {
        filename: isSelected
          ? `productos_seleccionados_${itemsToExport.length}_${new Date().toISOString().split("T")[0]}`
          : `catalogo_productos_${new Date().toISOString().split("T")[0]}`,
        canViewCost,
      });
      toast.success(`${itemsToExport.length} productos exportados a CSV`);
    } catch (e) {
      console.error("Error exporting to CSV:", e);
      toast.error("Error al exportar a CSV");
    }
  };

  // Export principal (por defecto a Excel)
  const handleExport = () => {
    handleExportExcel();
  };

  const handleExportPdf = async () => {
    const result = await exportToPDF(mappedServerFilters);
    if (result.success) {
      toast.success("PDF de productos descargado");
    } else {
      toast.error(result.error || "No hay productos para descargar");
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    await refreshData();
    toast.success("Datos actualizados");
  };

  // Handle bulk operations
  const handleBulkDelete = async () => {
    const selectedProducts = products.filter((p) =>
      selectedProductIds.includes(p.id),
    );
    const settled = await Promise.allSettled(
      selectedProducts.map((product) => deleteProduct(product.id)),
    );
    const successCount = settled.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;
    const errorCount = settled.length - successCount;

    if (successCount > 0) {
      toast.success(
        `${successCount} ${successCount === 1 ? "producto eliminado" : "productos eliminados"}`,
      );
    }
    if (errorCount > 0) {
      toast.error(
        `Error al eliminar ${errorCount} ${errorCount === 1 ? "producto" : "productos"}`,
      );
    }

    clearSelection();
  };

  const handleBulkActivate = async () => {
    const selectedProducts = products.filter((p) =>
      selectedProductIds.includes(p.id),
    );
    const settled = await Promise.allSettled(
      selectedProducts.map((product) =>
        updateProduct(product.id, {
          is_active: true,
        } as Database["public"]["Tables"]["products"]["Update"]),
      ),
    );
    const successCount = settled.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;
    const errorCount = settled.length - successCount;

    if (successCount > 0) {
      toast.success(
        `${successCount} ${successCount === 1 ? "producto activado" : "productos activados"}`,
      );
    }
    if (errorCount > 0) {
      toast.error(
        `Error al activar ${errorCount} ${errorCount === 1 ? "producto" : "productos"}`,
      );
    }

    clearSelection();
  };

  const handleBulkDeactivate = async () => {
    const selectedProducts = products.filter((p) =>
      selectedProductIds.includes(p.id),
    );
    const settled = await Promise.allSettled(
      selectedProducts.map((product) =>
        updateProduct(product.id, {
          is_active: false,
        } as Database["public"]["Tables"]["products"]["Update"]),
      ),
    );
    const successCount = settled.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;
    const errorCount = settled.length - successCount;

    if (successCount > 0) {
      toast.success(
        `${successCount} ${successCount === 1 ? "producto desactivado" : "productos desactivados"}`,
      );
    }
    if (errorCount > 0) {
      toast.error(
        `Error al desactivar ${errorCount} ${errorCount === 1 ? "producto" : "productos"}`,
      );
    }

    clearSelection();
  };

  const toLabelProduct = useCallback(
    (product: Product): LabelDialogProduct => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? null,
      price: product.sale_price ?? null,
      stock: product.stock_quantity ?? null,
    }),
    [],
  );

  const productsForLabels = useMemo(
    () =>
      products
        .filter((product) => selectedProductIds.includes(product.id))
        .map(toLabelProduct),
    [products, selectedProductIds, toLabelProduct],
  );

  const handleBulkExport = () => {
    const selectedProducts = products.filter((p) =>
      selectedProductIds.includes(p.id),
    );
    startTransition(() => {
      const csv = exportProductsToInventoryCSV(selectedProducts);
      if (csv) {
        downloadCSV(
          csv,
          `productos-seleccionados-${new Date().toISOString().split("T")[0]}.csv`,
        );
        toast.success(`${selectedProducts.length} productos exportados`);
      } else {
        toast.error("No hay productos para exportar");
      }
    });
  };

  // Handle metric click
  const handleMetricClick = (
    metric: "all" | "low_stock" | "out_of_stock" | "value" | "products" | "services" | "active",
  ) => {
    switch (metric) {
      case "all":
        handleQuickFilter("all");
        toast.info(`Mostrando todo el catálogo (${globalMetrics.total_products})`);
        break;
      case "products":
        handleQuickFilter("products");
        toast.info("Mostrando solo productos físicos");
        break;
      case "services":
        handleQuickFilter("services");
        toast.info("Mostrando solo servicios profesionales");
        break;
      case "low_stock":
        handleQuickFilter("low_stock");
        toast.info(`Mostrando productos con bajo stock`);
        break;
      case "out_of_stock":
        handleQuickFilter("out_of_stock");
        toast.warning(`Mostrando productos agotados`);
        break;
      case "value":
        handleQuickFilter("all");
        toast.info("Mostrando catálogo completo para analizar valor total");
        break;
      case "active":
        // La tarjeta pide ver los activos, no alternar el filtro: si la
        // pantalla ya abre en activos, tocarla no tiene que apagarlo.
        handleFilterChange({ is_active: true, quick_filter: null });
        toast.info("Mostrando productos activos");
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 dark:bg-gray-950">
      <div className="max-w-[1800px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            {/* El titulo en degradado y la bajada «Dashboard moderno y
                funcional» no decian nada: ahora la bajada cuenta con que
                abre la pantalla, que es lo que hay que saber. */}
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-gray-50">
              Productos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Catálogo e inventario completo. Podés filtrar por productos,
              servicios o alertas con los controles de arriba.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Acceso directo a los predeterminados de productos a credito */}
            <Button
              asChild
              type="button"
              variant="outline"
              size="sm"
              className="h-10 px-3.5 text-xs font-semibold rounded-xl gap-1.5 transition-all shadow-xs border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Configurar los datos predeterminados de cuotas para productos a credito"
            >
              <Link href="/dashboard/products/credit-defaults">
                <Wallet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Configuración de cuotas</span>
              </Link>
            </Button>

            <SectionGuideButton guide={PRODUCTS_GUIDE} />

            {canCreateProducts && (
              <Button
                size="lg"
                onClick={() => setCreateModalOpen(true)}
                className="cursor-pointer bg-blue-600 shadow-xs transition-colors hover:bg-blue-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Nuevo Producto
              </Button>
            )}
          </div>
        </div>

        {/* Barra de contexto: Sucursal activa y Estado del Plan */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {showBranchNotice && (
            <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 text-xs shadow-2xs backdrop-blur-md">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                  <Warehouse className="h-3.5 w-3.5" />
                </div>
                <span className="truncate text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs">
                  <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                    {selectedBranch ? `Inventario: ${selectedBranch.name}` : "Inventario general"}
                  </strong>
                  <span className="text-muted-foreground hidden sm:inline">
                    {" — Las existencias, movimientos y alertas corresponden a la sucursal seleccionada."}
                  </span>
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
                onClick={() => setShowBranchNotice(false)}
                title="Ocultar aviso de sucursal"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <PlanLimitBanner resource="products" reloadSignal={totalProducts} variant="compact" />
        </div>

        {/* Resumen del Catálogo e Inventario (Activable / Desactivable desde la barra) */}
        {showSummary && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <ProductSummaryOverview
              metrics={globalMetrics}
              alerts={normalizedAlerts as any}
              canViewCost={canViewCost}
              showServices={hasServicesModule || (globalMetrics.services_count ?? 0) > 0}
              isExpanded={isSummaryExpanded}
              onToggleExpanded={() => setIsSummaryExpanded((prev) => !prev)}
              onMetricClick={handleMetricClick}
              onAlertClick={handleAlertClick}
              onDismissAlert={handleDismissAlert}
            />
          </div>
        )}

        {/* Search and Actions Bar */}
        <SearchAndActionsBar
          showServices={hasServicesModule || (globalMetrics.services_count ?? 0) > 0}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          isFilterPanelOpen={isFilterPanelOpen}
          onToggleFilters={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
          activeFiltersCount={activeAdvancedFiltersCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          onSaveDefaultGroupBy={handleSavePreferences}
          onSavePreferences={handleSavePreferences}
          onResetPreferences={handleResetPreferences}
          hasSavedPreferences={hasCustomPreferences}
          showSummary={showSummary}
          onToggleSummary={() => setShowSummary((prev) => !prev)}
          onRefresh={handleRefresh}
          onExport={handleExportExcel}
          onExportExcel={handleExportExcel}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          selectedCount={selectedProductIds.length}
          onImport={canCreateProducts ? () => setImportModalOpen(true) : undefined}
          isLoading={loading || isPending}
        />

        {/* Recarga con datos ya en pantalla: se avisa acá en vez de vaciar la
            grilla. `aria-live` porque el cambio es visual y chico. */}
        {isRefreshing && (
          <p
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-live="polite"
          >
            <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
            Actualizando productos…
          </p>
        )}

        {/* Quick Filters Bar */}
        <QuickFiltersBar
          products={products}
          showServices={hasServicesModule || (globalMetrics.services_count ?? 0) > 0}
          counts={globalQuickFilterCounts}
          activeFilter={filters.quick_filter}
          catalogKind={filters.catalog_kind ?? null}
          isActive={filters.is_active ?? null}
          onFilterClick={handleQuickFilter}
        />

        {/* Filter Panel (Collapsible) */}
        {isFilterPanelOpen && (
          <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-4 sm:p-5">
              <FilterPanel
                isOpen={isFilterPanelOpen}
                showServices={hasServicesModule || (globalMetrics.services_count ?? 0) > 0}
                products={products}
                categories={categories}
                suppliers={suppliers}
                filters={filters}
                onFiltersChange={handleFilterChange}
                onClearFilters={clearFilters}
                onClose={() => setIsFilterPanelOpen(false)}
                brandOptions={brands.map((b) => b.name).filter(Boolean)}
                resultCount={totalProducts}
              />
            </div>
          </Card>
        )}

        {/* Products Display */}
        {productsError && products.length === 0 && !loading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No se pudieron cargar los productos</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{productsError}</span>
              <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-0 shadow-md">
          <div className="p-6">
            {/* Cuantos se ven ahora, cuantos matchean los filtros y cuantos hay
                en total. Sin esto no habia forma de saber si la pantalla mostraba
                todo el catalogo o solo una pagina. */}
            {!loading && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {paginatedProducts.length}
                    </span>
                    <span className="text-muted-foreground">
                      {paginatedProducts.length === 1 ? 'ítem en pantalla' : 'ítems en pantalla'}
                    </span>
                    {totalItems > paginatedProducts.length && (
                      <span className="text-muted-foreground">
                        · de <span className="font-semibold text-gray-900 tabular-nums dark:text-gray-100">{totalItems}</span> que coinciden
                      </span>
                    )}
                  </div>

                  {/* El desglose solo cuando hay de los dos: con el alcance en
                      productos, «⚙️ 0 servicios» era un badge que nunca cambiaba. */}
                  {serviciosEnPantalla > 0 && productosEnPantalla > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {productosEnPantalla} productos · {serviciosEnPantalla} servicios
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {/* El total del catalogo sale de las metricas globales, no de la
                      pagina: sirve para notar cuanto esta filtrando la busqueda. */}
                  {globalMetrics.total_products > 0 && (
                    <span className="text-muted-foreground">
                      Catálogo completo:{' '}
                      <span className="font-semibold text-gray-900 tabular-nums dark:text-gray-100">
                        {globalMetrics.total_products}
                      </span>
                    </span>
                  )}
                  {globalMetrics.total_products > totalItems && (
                    <Badge variant="outline" className="text-[11px] font-normal">
                      {globalMetrics.total_products - totalItems} ocultos por los filtros
                    </Badge>
                  )}
                  {totalPages > 1 && (
                    <Badge variant="outline" className="text-[11px] font-normal">
                      Página {currentPage} de {totalPages}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* El filtro de stock se resuelve en memoria sobre un barrido
                acotado. Si se llego al tope, el listado y el total son
                parciales: decirlo es preferible a mostrar un numero incompleto
                como si fuera el definitivo. */}
            {!loading && resultTruncated && (
              <div
                role="status"
                className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
              >
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Resultado parcial
                </p>
                <p className="text-amber-800/90 dark:text-amber-200/80">
                  El filtro por stock revisó solo una parte del catálogo, así que pueden faltar
                  productos y el total no es exacto. Acotá con una categoría, marca o búsqueda para
                  ver el resultado completo.
                </p>
              </div>
            )}

            {groupBy !== "none" ? (
              <ProductSectionGroup
                products={paginatedProducts}
                groupBy={groupBy}
                viewMode={viewMode}
                selectedProductIds={selectedProductIds}
                sortConfig={sortConfig}
                onSort={handleSort}
                onSelectAll={handleSelectAllOnPage}
                onSelect={handleSelectProduct}
                onEdit={handleProductEdit}
                onDelete={handleProductDelete}
                onDuplicate={handleProductDuplicate}
                onViewDetails={handleProductViewDetails}
                onToggleActive={handleToggleActive}
                loading={isFirstLoad}
              />
            ) : viewMode === "grid" ? (
              <ProductGrid
                products={paginatedProducts}
                selectedProductIds={selectedProductIds}
                onProductSelect={handleSelectProduct}
                onProductEdit={handleProductEdit}
                onProductDelete={handleProductDelete}
                onProductDuplicate={handleProductDuplicate}
                onProductViewDetails={handleProductViewDetails}
                onProductToggleActive={handleToggleActive}
                loading={isFirstLoad}
              />
            ) : (
              <ProductTable
                products={paginatedProducts}
                selectedProductIds={selectedProductIds}
                sortConfig={sortConfig}
                onSort={handleSort}
                onSelectAll={handleSelectAllOnPage}
                onSelect={handleSelectProduct}
                onEdit={handleProductEdit}
                onDelete={handleProductDelete}
                onDuplicate={handleProductDuplicate}
                onViewDetails={handleProductViewDetails}
                onToggleActive={handleToggleActive}
                loading={isFirstLoad}
                viewMode={viewMode === "compact" ? "compact" : "table"}
              />
            )}

            {/* Pagination */}
            {!isFirstLoad && displayedProducts.length > 0 && (
              <div className="mt-6 border-t pt-4 border-gray-100 dark:border-gray-800">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalItems}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  itemsPerPageOptions={[10, 20, 50, 100]}
                  showItemsPerPage={true}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Bulk Actions Toolbar */}
        <BulkActionsToolbar
          selectedCount={selectedProductIds.length}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
          onBulkActivate={handleBulkActivate}
          onBulkDeactivate={handleBulkDeactivate}
          onBulkExport={handleBulkExport}
          onBulkPrintLabels={() => setLabelsTarget(productsForLabels)}
        />
      </div>

      {/* Product Modal */}
      {(editingProduct || createModalOpen) && (
        <ProductModal
          isOpen={true}
          onClose={() => {
            setEditingProduct(null);
            setCreateModalOpen(false);
          }}
          product={editingProduct}
          categories={categories as any}
          brands={brands as any}
          suppliers={suppliers as any}
          onCatalogChange={() => refreshData()}
          onSave={async (data) => {
            try {
              if (editingProduct) {
                const result = await updateProduct(editingProduct.id, data as any);
                if (result.success) {
                  // Modal handles success toast and closing
                } else {
                  console.error("Error updating product:", result.error);
                  throw new Error(result.error);
                }
              } else {
                const result = await createProduct(data as any);
                if (result.success) {
                  // Modal handles success toast and closing
                } else {
                  console.error("Error creating product:", result.error);
                  throw new Error(result.error);
                }
              }
            } catch (error: any) {
              // Re-throw to be caught by the modal's internal handling
              throw error;
            }
          }}
        />
      )}

      {/* Etiquetas con codigo de barras de los productos elegidos */}
      <PrintLabelsDialog
        open={labelsTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLabelsTarget(null);
        }}
        products={labelsTarget ?? []}
        onBarcodesGenerated={(assigned) => {
          // El listado tiene el producto sin codigo: hay que traerlo de nuevo.
          if (assigned.length > 0) void refreshData();
        }}
      />

      {/* Quick-view modal */}
      <ProductQuickViewModal
        product={quickViewProduct}
        isOpen={quickViewProduct !== null}
        onClose={() => setQuickViewProduct(null)}
        onEdit={(product) => {
          setQuickViewProduct(null);
          handleProductEdit(product);
        }}
        onViewFullDetails={handleViewFullDetails}
        onPrintLabel={(product) => {
          setQuickViewProduct(null);
          setLabelsTarget([toLabelProduct(product)]);
        }}
        onToggleActive={handleToggleProductActiveState}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-300">
              ¿Estás seguro de que quieres eliminar{" "}
              <span className="font-semibold text-slate-900 dark:text-white">&quot;{productToDelete?.name}&quot;</span>?
              <span className="block mt-2 text-xs text-slate-500 dark:text-slate-400">
                Esta acción es permanente. Si el producto ya cuenta con ventas o reparaciones en el historial, el sistema te ofrecerá desactivarlo para proteger tus registros contables.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Modal */}
      <ImportProductsModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImportProducts}
      />
    </div>
  );
}
