/**
 * Modern Products Dashboard Page
 * Redesigned products management interface
 */

"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProductsSupabase } from "@/hooks/useProductsSupabase";
import { useProductsDashboard } from "@/hooks/useProductsDashboard";
import { ProductModal } from "@/components/dashboard/product-modal";
import { toast } from "sonner";
import type { Product } from "@/types/product-unified";
import {
  MetricsGrid,
  SearchAndActionsBar,
  QuickFiltersBar,
  FilterPanel,
  ProductGrid,
  ProductTable,
  BulkActionsToolbar,
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
  exportProductsToCSV,
  downloadCSV,
} from "@/lib/products-dashboard-utils";
import type { Database } from "@/lib/supabase/types";
type Json = Database["public"]["Tables"]["products"]["Row"]["dimensions"];

export default function ProductsPage() {
  const router = useRouter();
  const {
    products,
    categories,
    brands,
    suppliers,
    alerts,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshData,
    exportToCSV,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [serverSearch, setServerSearch] = useState("");

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
    // Exclude system fields and relations that shouldn't be duplicated

    const { id, created_at, updated_at, category, supplier, ...rest } =
      product as any;

    const duplicatedData = {
      ...rest,
      sku: `DUP-${product.sku}-${Math.floor(Math.random() * 1000)}`,
      name: `${product.name} (Copia)`,
      dimensions:
        typeof product.dimensions === "string"
          ? JSON.parse(product.dimensions)
          : product.dimensions,
    };

    const result = await createProduct(duplicatedData);
    if (result.success) {
      toast.success("Producto duplicado");
    } else {
      toast.error(result.error || "Error al duplicar");
    }
  };

  const handleProductViewDetails = (product: Product) => {
    router.push(`/dashboard/products/${product.id}`);
  };

  // Handle visibility toggle
  const handleToggleActive = async (product: Product, newValue: boolean) => {
    const result = await updateProduct(product.id, { is_active: newValue } as any);
    if (result.success) {
      toast.success(newValue ? `"${product.name}" ahora es visible en el catálogo` : `"${product.name}" ocultado del catálogo`);
    } else {
      toast.error(result.error || 'Error al actualizar visibilidad');
      throw new Error(result.error); // lets the card revert optimistic state
    }
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
      const csv = exportProductsToCSV(selectedProducts);
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
        toast.info(`Mostrando todos los productos (${products.length})`);
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

          <Button
            size="lg"
            onClick={() => setCreateModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30 transition-all duration-200 cursor-pointer"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuevo Producto
          </Button>
        </div>

        {/* Metrics Grid */}
        <MetricsGrid metrics={metrics} onMetricClick={handleMetricClick} />

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
          isLoading={loading || isPending}
        />

        {/* Quick Filters Bar */}
        <QuickFiltersBar
          products={products}
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
              />
            </div>
          </Card>
        )}

        {/* Products Display */}
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
    </div>
  );
}
