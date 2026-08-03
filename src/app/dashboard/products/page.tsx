/**
 * Modern Products Dashboard Page
 * Redesigned products management interface
 */

"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Plus, RefreshCw, Warehouse, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProductsSupabase } from "@/hooks/useProductsSupabase";
import { useProductsDashboard } from "@/hooks/useProductsDashboard";
import { ProductModal } from "@/components/dashboard/product-modal";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import type { Product } from "@/types/product-unified";
import {
  MetricsGrid,
  SearchAndActionsBar,
  QuickFiltersBar,
  FilterPanel,
  ProductGrid,
  ProductTable,
  BulkActionsToolbar,
  AlertsBanner,
  ProductQuickViewModal,
  ImportProductsModal,
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
} from "@/lib/products-dashboard-utils";
import type { DashboardMetrics } from "@/types/products-dashboard";
import type { QuickFilterCounts } from "@/components/dashboard/products-modern/QuickFiltersBar";
import type { Database } from "@/lib/supabase/types";
import { PlanLimitBanner } from "@/components/subscription/PlanLimitBanner";
import { useBranch } from "@/contexts/branch-context";
type Json = Database["public"]["Tables"]["products"]["Row"]["dimensions"];

export default function ProductsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const { selectedBranch } = useBranch();
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
  });

  const [isPending, startTransition] = useTransition();
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [serverSearch, setServerSearch] = useState("");
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [showGuide, setShowGuide] = useState(true);
  const canCreateProducts =
    hasPermission("products.create") ||
    hasPermission("products.create") ||
    hasPermission("products.manage");

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
    active_products: dashboardStats?.activeProducts ?? metrics.active_products,
    low_stock_count: dashboardStats?.lowStockCount ?? metrics.low_stock_count,
    out_of_stock_count: dashboardStats?.outOfStockCount ?? metrics.out_of_stock_count,
    inventory_value: dashboardStats?.totalStockValue ?? metrics.inventory_value,
  }), [dashboardStats, metrics]);

  const globalQuickFilterCounts = useMemo<QuickFilterCounts | undefined>(() => {
    if (!dashboardStats) return undefined;
    return {
      all: dashboardStats.totalProducts,
      low_stock: dashboardStats.lowStockCount,
      out_of_stock: dashboardStats.outOfStockCount,
      active: dashboardStats.activeProducts,
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
      filters.quick_filter === "active" ? true : undefined;

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
    };
  }, [filters, serverSearch]);

  const mappedServerSort = useMemo(() => {
    const fieldMap: Record<string, "name" | "sku" | "price" | "stock" | "created_at"> = {
      name: "name",
      sku: "sku",
      sale_price: "price",
      stock_quantity: "stock",
      created_at: "created_at",
      updated_at: "created_at",
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
        prev.isActive === next.isActive
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

    const result = await deleteProduct(productToDelete.id);
    if (result.success) {
      toast.success("Producto eliminado");
      clearSelection();
    } else {
      toast.error(result.error || "Error al eliminar");
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
      sku: `DUP-${product.sku}-${Math.floor(Math.random() * 1000)}`,
      name: `${product.name} (Copia)`,
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

  // Handle visibility toggle
  const handleToggleActive = async (product: Product, newValue: boolean) => {
    const updatePayload: any = { is_active: newValue }
    if (newValue && (product as any).visibility === 'hidden') {
      updatePayload.visibility = 'public'
    }
    const result = await updateProduct(product.id, updatePayload);
    if (result.success) {
      toast.success(newValue ? `"${product.name}" ahora es visible en el catálogo` : `"${product.name}" ocultado del catálogo`);
    } else {
      toast.error(result.error || 'Error al actualizar visibilidad');
      throw new Error(result.error); // lets the card revert optimistic state
    }
  };

  // Handle import
  const handleImportProducts = async (rows: Array<{ name: string; sku?: string; description?: string; brand?: string; category?: string; purchase_price?: number; sale_price: number; stock_quantity?: number; min_stock?: number; barcode?: string; unit_measure?: string }>) => {
    if (!canCreateProducts) {
      toast.error("No tienes permisos para importar productos");
      return {
        success: 0,
        failed: rows.length,
        errors: [{ row: 1, error: "Sin permisos para crear productos" }],
      };
    }

    let success = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const result = await createProduct({
          name: row.name,
          sku: row.sku || `IMP-${Date.now()}-${i}`,
          description: row.description || '',
          brand: row.brand || null,
          category_id: categories.find((category) =>
            category.name?.trim().toLowerCase() === row.category?.trim().toLowerCase()
          )?.id || null,
          purchase_price: row.purchase_price || 0,
          sale_price: row.sale_price,
          stock_quantity: row.stock_quantity || 0,
          min_stock: row.min_stock || 0,
          is_active: true,
          barcode: row.barcode || null,
          unit_measure: row.unit_measure || 'unidad',
        } as any);

        if (result.success) {
          success++;
        } else {
          failed++;
          errors.push({ row: i + 2, error: result.error || 'Error desconocido' });
        }
      } catch (err) {
        failed++;
        errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Error' });
      }
    }

    // Refresh after import
    await refreshData();
    return { success, failed, errors };
  };

  // Handle export
  const handleExport = async () => {
    const result = await exportToCSV(mappedServerFilters);
    if (result.success) {
      toast.success(`${totalProducts} productos exportados`);
    } else {
      toast.error(result.error || "No hay productos para exportar");
    }
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
    metric: "all" | "low_stock" | "out_of_stock" | "value",
  ) => {
    switch (metric) {
      case "all":
        handleQuickFilter("all");
        toast.info(`Mostrando todos los productos (${totalProducts})`);
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
        toast.info("Mostrando todos los productos para analizar valor total");
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4 sm:p-6 lg:p-8 transition-colors duration-300">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <PlanLimitBanner resource="products" reloadSignal={totalProducts} />
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 dark:from-white dark:via-gray-200 dark:to-gray-400 bg-clip-text text-transparent">
              Gestión de Productos
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Dashboard moderno y funcional
            </p>
          </div>

          {canCreateProducts && (
            <Button
              size="lg"
              onClick={() => setCreateModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 transition-all duration-200 cursor-pointer"
            >
              <Plus className="h-5 w-5 mr-2" />
              Nuevo Producto
            </Button>
          )}
        </div>

        {/* Alerts Banner */}
        <AlertsBanner
          alerts={normalizedAlerts as any}
          onAlertClick={handleAlertClick}
          onDismissAlert={handleDismissAlert}
        />

        <Alert className="border-border bg-muted/30">
          <Warehouse className="h-4 w-4" />
          <AlertTitle>
            {selectedBranch ? `Inventario de ${selectedBranch.name}` : "Inventario general"}
          </AlertTitle>
          <AlertDescription>
            Nombre, SKU, imagenes y precios se comparten entre todas las sucursales. Las existencias, movimientos y alertas corresponden {selectedBranch ? "solamente a la sucursal seleccionada" : "al inventario general"}.
          </AlertDescription>
        </Alert>

        {/* Guía de funcionamiento de catálogo de productos */}
        {showGuide && (
          <Card className="relative bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-100/50 dark:border-blue-950/20 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="absolute right-3 top-3 z-10 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-colors"
              title="Ocultar guía permanentemente durante esta sesión"
            >
              <X className="h-4 w-4" />
            </button>
            <details className="group">
              <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3 pr-10">
                <div className="text-md font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Info className="h-4.5 w-4.5" /> ¿Cómo funciona el Catálogo de Productos?
                </div>
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 select-none">
                  <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
                  <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
                </div>
              </summary>
              <CardContent className="pt-0 pb-5 text-xs">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                    <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                      <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">1</Badge>
                      Ficha y Precios
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Registra la información clave de cada ítem: código SKU, descripción y costos de compra/venta. Esta información alimenta automáticamente la facturación en el POS y los repuestos en soporte técnico.
                    </p>
                  </div>
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</Badge>
                      Stock y Alertas
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Configura los mínimos recomendados y ajusta las existencias de la sucursal seleccionada. Las alertas se calculan sobre ese inventario, no sobre el stock de otras sedes.
                    </p>
                  </div>
                  <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</Badge>
                      Acciones Masivas
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Selecciona múltiples artículos para realizar importaciones o exportaciones mediante plantillas CSV, así como habilitar, deshabilitar o duplicar productos de manera ágil.
                    </p>
                  </div>
                </div>
              </CardContent>
            </details>
          </Card>
        )}
        {/* Search and Actions Bar */}
        <SearchAndActionsBar
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          isFilterPanelOpen={isFilterPanelOpen}
          onToggleFilters={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={handleRefresh}
          onExport={handleExport}
          onExportPdf={handleExportPdf}
          onImport={canCreateProducts ? () => setImportModalOpen(true) : undefined}
          isLoading={loading || isPending}
        />

        {/* Quick Filters Bar */}
        <QuickFiltersBar
          products={products}
          counts={globalQuickFilterCounts}
          activeFilter={filters.quick_filter}
          onFilterClick={handleQuickFilter}
        />

        {/* Filter Panel (Collapsible) */}
        {isFilterPanelOpen && (
          <Card className="border-0 shadow-md">
            <div className="p-6">
              <FilterPanel
                isOpen={isFilterPanelOpen}
                products={products}
                categories={categories}
                suppliers={suppliers}
                filters={filters}
                onFiltersChange={handleFilterChange}
                onClearFilters={clearFilters}
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
            {viewMode === "grid" ? (
              <ProductGrid
                products={paginatedProducts}
                selectedProductIds={selectedProductIds}
                onProductSelect={handleSelectProduct}
                onProductEdit={handleProductEdit}
                onProductDelete={handleProductDelete}
                onProductDuplicate={handleProductDuplicate}
                onProductViewDetails={handleProductViewDetails}
                onProductToggleActive={handleToggleActive}
                loading={loading || isPending}
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
                loading={loading || isPending}
                viewMode={viewMode === "compact" ? "compact" : "table"}
              />
            )}

            {/* Pagination */}
            {!loading && displayedProducts.length > 0 && (
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
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar{" "}
              <span className="font-semibold">"{productToDelete?.name}"</span>?
              <br className="my-2" />
              Esta acción no se puede deshacer y eliminará permanentemente el
              producto de la base de datos.
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
