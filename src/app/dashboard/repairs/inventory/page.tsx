"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useProductsSupabase } from "@/hooks/useProductsSupabase";
import { useRepairs } from "@/hooks/use-repairs";
import { useProductRealTimeSync } from "@/hooks/useRealTimeSync";
import { suggestReservations, inferComponentType } from "@/services/inventory-repair-sync";
import type { Product } from "@/types/product-unified";
import type { Database } from '@/lib/supabase/types'
type Json = Database['public']['Tables']['products']['Row']['dimensions']
import { ProductStock } from "@/services/inventory-repair-sync";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Plus, 
  Wrench, 
  Package, 
  AlertTriangle, 
  FileDown,
  RefreshCw,
  Pencil,
  Trash2,
  MoreHorizontal,
  History,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function InventoryPage() {
  const router = useRouter();
  const { 
    products, 
    categories, 
    updateStock, 
    refreshData: refresh, 
    createProduct,
    updateProduct,
    deleteProduct,
    getAllMovements,
    createCategory
  } = useProductsSupabase();
  
  const { repairs: repairsList } = useRepairs();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estados para filtros
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  // Estado para gestión de servicios
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    id: "",
    name: "",
    price: "",
    wholesalePrice: "",
    cost: "",
    description: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para edición
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Estado para eliminación
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Estado para movimientos
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);



  // Sincronización en tiempo real
  const onProductUpdate = useCallback(() => {
    refresh();
  }, [refresh]);

  const onStockUpdate = useCallback(() => {
    refresh();
  }, [refresh]);

  useProductRealTimeSync(onProductUpdate, onStockUpdate);
  useEffect(() => {
    if (activeTab === "movements") {
      setIsLoadingMovements(true);
      getAllMovements(50).then(res => {
        if (res.success) {
          setMovements(res.data);
        }
        setIsLoadingMovements(false);
      });
    }
  }, [activeTab, getAllMovements]);

  // Identificar categoría de Servicios
  const serviceCategoryId = useMemo(() => {
    return categories.find(c => c.name.toLowerCase().includes('servicio') || c.name.toLowerCase().includes('mano de obra'))?.id;
  }, [categories]);

  // Separar productos (repuestos) de servicios
  const servicesList = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      const isServiceCategory = serviceCategoryId && p.category_id === serviceCategoryId;
      const nameIndicatesService = p.name.toLowerCase().startsWith('reparación') || p.name.toLowerCase().startsWith('servicio') || p.name.toLowerCase().includes('mano de obra');
      return isServiceCategory || nameIndicatesService;
    });
  }, [products, serviceCategoryId]);

  const inventoryList = useMemo(() => {
    if (!products) return [];
    const serviceIds = new Set(servicesList.map(s => s.id));
    return products.filter(p => !serviceIds.has(p.id));
  }, [products, servicesList]);

  // Filtrado general
  const filteredInventory = useMemo(() => {
    return inventoryList.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter;
      
      let matchesStock = true;
      if (stockFilter === "low") matchesStock = (p.stock_quantity || 0) <= (p.min_stock || 5);
      if (stockFilter === "out") matchesStock = (p.stock_quantity || 0) === 0;
      if (stockFilter === "in") matchesStock = (p.stock_quantity || 0) > 0;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [inventoryList, searchTerm, categoryFilter, stockFilter]);

  const filteredServices = useMemo(() => {
    return servicesList.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [servicesList, searchTerm]);

  // Manejo de servicios (Crear/Editar)
  const handleSeedServices = async () => {
    setIsSubmitting(true);
    try {
      let targetCategoryId = serviceCategoryId;
      // Si no existe categoría de servicios, crearla
      if (!targetCategoryId) {
        const catRes = await createCategory("Servicios", "Categoría para mano de obra y reparaciones");
        if (catRes.success && catRes.data) {
          targetCategoryId = catRes.data.id;
        } else {
          throw new Error("No se pudo crear la categoría de Servicios");
        }
      }

      const services = [
        { name: 'Cambio Pantalla iPhone 13', price: 120, wholesale: 100, cost: 60, sku: 'SRV-IP13-SCR' },
        { name: 'Cambio Batería iPhone 11', price: 45, wholesale: 35, cost: 15, sku: 'SRV-IP11-BAT' },
        { name: 'Limpieza General', price: 25, wholesale: 15, cost: 0, sku: 'SRV-GEN-CLN' },
        { name: 'Diagnóstico Avanzado', price: 30, wholesale: 20, cost: 0, sku: 'SRV-DIAG-ADV' },
        { name: 'Reparación Placa iPhone 11', price: 80, wholesale: 60, cost: 10, sku: 'SRV-IP11-MB' }
      ];

      let count = 0;
      for (const s of services) {
        // Verificar si ya existe por SKU (simple check en lista actual)
        const exists = servicesList.some(ex => ex.sku === s.sku);
        if (!exists) {
          await createProduct({
            name: s.name,
            description: "Servicio predefinido",
            sale_price: s.price,
            wholesale_price: s.wholesale,
            purchase_price: s.cost,
            category_id: targetCategoryId,
            stock_quantity: 9999,
            min_stock: 0,
            sku: s.sku,
            is_active: true,
            unit_measure: 'servicio'
          });
          count++;
        }
      }
      
      if (count > 0) {
        toast.success(`${count} servicios de ejemplo creados`);
        refresh();
      } else {
        toast.info("Los servicios de ejemplo ya existen");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al crear servicios de ejemplo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveService = async () => {
    if (!serviceForm.name || !serviceForm.price) {
      toast.error("Por favor completa el nombre y precio del servicio");
      return;
    }

    setIsSubmitting(true);
    try {
      let targetCategoryId = serviceCategoryId;

      // Si no existe categoría de servicios, crearla
      if (!targetCategoryId) {
        const catRes = await createCategory("Servicios", "Categoría para mano de obra y reparaciones");
        if (catRes.success && catRes.data) {
          targetCategoryId = catRes.data.id;
        } else {
          throw new Error("No se pudo crear la categoría de Servicios");
        }
      }

      const productData = {
        name: serviceForm.name,
        description: serviceForm.description,
        sale_price: parseFloat(serviceForm.price),
        wholesale_price: serviceForm.wholesalePrice ? parseFloat(serviceForm.wholesalePrice) : null,
        purchase_price: serviceForm.cost ? parseFloat(serviceForm.cost) : 0,
        category_id: targetCategoryId,
        is_active: true,
        unit_measure: 'servicio'
      };

      let result;
      if (serviceForm.id) {
        // Editar - Convertir a formato compatible con Supabase
        const supabaseData: Database['public']['Tables']['products']['Update'] = {
          ...productData
        }
        result = await updateProduct(serviceForm.id, supabaseData);
      } else {
        // Crear
        result = await createProduct({
          ...productData,
          stock_quantity: 9999,
          min_stock: 0,
          sku: `SRV-${Date.now().toString().slice(-6)}`,
        });
      }

      if (result.success) {
        toast.success(serviceForm.id ? "Servicio actualizado" : "Servicio creado");
        setIsServiceDialogOpen(false);
        setServiceForm({ id: "", name: "", price: "", wholesalePrice: "", cost: "", description: "" });
        refresh();
      } else {
        toast.error("Error: " + result.error);
      }
    } catch (error) {
      console.error(error);
      toast.error("Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditServiceClick = (service: Product) => {
    setServiceForm({
      id: service.id,
      name: service.name,
      price: String(service.sale_price),
      wholesalePrice: service.wholesale_price ? String(service.wholesale_price) : "",
      cost: String(service.purchase_price),
      description: service.description || ""
    });
    setIsServiceDialogOpen(true);
  };

  // Manejo de eliminación
  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    
    setIsSubmitting(true);
    const result = await deleteProduct(productToDelete.id);
    setIsSubmitting(false);
    
    if (result.success) {
      toast.success("Elemento eliminado correctamente");
      setIsDeleteDialogOpen(false);
      setProductToDelete(null);
      refresh();
    } else {
      toast.error("Error al eliminar: " + result.error);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Reporte de Inventario", 14, 16);
    const rows = filteredInventory.map(p => [p.name, p.sku || '', p.stock_quantity ?? 0, `$${p.sale_price}`]);
    autoTable(doc, { head: [["Producto", "SKU", "Stock", "Precio"]], body: rows });
    doc.save(`inventario_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF generado");
  };

  return (
    <div className="space-y-6 p-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Button variant="ghost" className="mb-2 pl-0 hover:pl-2 transition-all" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Inventario y Servicios</h1>
          <p className="text-muted-foreground">Gestiona repuestos, servicios y movimientos de stock.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refresh()} size="icon">
            <span className="sr-only">Actualizar</span>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* Estadísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor del Inventario</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${inventoryList.reduce((acc, p) => acc + ((p.stock_quantity || 0) * (p.purchase_price || 0)), 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {inventoryList.length} productos físicos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Activos</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{servicesList.length}</div>
            <p className="text-xs text-muted-foreground">
              Catálogo de reparaciones
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas de Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inventoryList.filter(p => (p.stock_quantity || 0) <= (p.min_stock || 5)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Productos con stock bajo
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="overview">Repuestos</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
        </TabsList>

        {/* TAB REPUESTOS */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <CardTitle>Inventario de Repuestos</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar repuesto..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Estado Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="in">En Stock</SelectItem>
                      <SelectItem value="low">Bajo Stock</SelectItem>
                      <SelectItem value="out">Agotado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Precio Venta</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No se encontraron repuestos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInventory.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{product.name}</span>
                              <span className="text-xs text-muted-foreground">{product.sku}</span>
                            </div>
                          </TableCell>
                          <TableCell>{product.category?.name || "Sin categoría"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {product.stock_quantity}
                              {(product.stock_quantity || 0) <= (product.min_stock || 5) && (
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>${product.sale_price?.toFixed(2)}</TableCell>
                          <TableCell>{product.supplier?.name || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={(product.stock_quantity || 0) > 0 ? "outline" : "destructive"}>
                              {(product.stock_quantity || 0) > 0 ? "En Stock" : "Agotado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Abrir menú</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => {
                                  // Aquí iría la lógica para editar repuesto completo
                                  // Por ahora usaremos el diálogo de servicio simplificado o uno nuevo
                                  // TODO: Implementar diálogo de edición completo para productos
                                  toast.info("Edición completa de productos próximamente");
                                }}>
                                  <Pencil className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClick(product)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB SERVICIOS */}
        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <CardTitle>Catálogo de Servicios</CardTitle>
                  <CardDescription>Precios de mano de obra y reparaciones estándar</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar servicio..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Dialog open={isServiceDialogOpen} onOpenChange={(open) => {
                    setIsServiceDialogOpen(open);
                    if (!open) setServiceForm({ id: "", name: "", price: "", wholesalePrice: "", cost: "", description: "" });
                  }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Servicio
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{serviceForm.id ? "Editar Servicio" : "Agregar Nuevo Servicio"}</DialogTitle>
                        <DialogDescription>
                          {serviceForm.id ? "Modifica los detalles del servicio." : "Crea un nuevo servicio de reparación para usar en órdenes de trabajo."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="name">Nombre del Servicio</Label>
                          <Input
                            id="name"
                            placeholder="Ej: Cambio Pantalla iPhone 13"
                            value={serviceForm.name}
                            onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="price">Precio Cliente ($)</Label>
                            <Input
                              id="price"
                              type="number"
                              placeholder="0.00"
                              value={serviceForm.price}
                              onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="wholesalePrice">Precio Mayorista ($)</Label>
                            <Input
                              id="wholesalePrice"
                              type="number"
                              placeholder="0.00"
                              value={serviceForm.wholesalePrice}
                              onChange={(e) => setServiceForm({ ...serviceForm, wholesalePrice: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="cost">Costo Estimado ($)</Label>
                            <Input
                              id="cost"
                              type="number"
                              placeholder="0.00"
                              value={serviceForm.cost}
                              onChange={(e) => setServiceForm({ ...serviceForm, cost: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="description">Descripción / Notas</Label>
                          <Input
                            id="description"
                            placeholder="Detalles adicionales..."
                            value={serviceForm.description}
                            onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveService} disabled={isSubmitting}>
                          {isSubmitting ? "Guardando..." : "Guardar Servicio"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Costo Base</TableHead>
                      <TableHead>Precio Cliente</TableHead>
                      <TableHead>Precio Mayorista</TableHead>
                      <TableHead className="text-right">Margen</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <p>No hay servicios registrados.</p>
                            <Button variant="outline" size="sm" onClick={handleSeedServices} disabled={isSubmitting}>
                              {isSubmitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                              Generar Servicios de Ejemplo
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredServices.map((service) => {
                        const margin = (service.sale_price || 0) - (service.purchase_price || 0);
                        const marginPercent = service.sale_price ? (margin / service.sale_price) * 100 : 0;
                        
                        return (
                          <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.name}</TableCell>
                            <TableCell>{service.description || "-"}</TableCell>
                            <TableCell>${service.purchase_price?.toFixed(2)}</TableCell>
                            <TableCell className="font-bold">${service.sale_price?.toFixed(2)}</TableCell>
                            <TableCell>${service.wholesale_price?.toFixed(2) || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">
                                {marginPercent.toFixed(0)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEditServiceClick(service)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteClick(service)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB MOVIMIENTOS */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Movimientos Recientes</CardTitle>
                  <CardDescription>Historial de entradas y salidas de inventario</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setIsLoadingMovements(true);
                  getAllMovements(50).then(res => {
                    if (res.success) setMovements(res.data);
                    setIsLoadingMovements(false);
                  });
                }}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMovements ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Stock Final</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {isLoadingMovements ? "Cargando movimientos..." : "No hay movimientos registrados recientes."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell className="text-sm">
                            {new Date(mov.created_at).toLocaleDateString()} {new Date(mov.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </TableCell>
                          <TableCell className="font-medium">
                            {mov.product?.name || "Producto Eliminado"}
                            {mov.product?.sku && <span className="text-xs text-muted-foreground block">{mov.product.sku}</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={mov.movement_type === 'in' ? 'default' : (mov.movement_type === 'out' ? 'destructive' : 'secondary')}>
                              {mov.movement_type === 'in' ? 'Entrada' : (mov.movement_type === 'out' ? 'Salida' : mov.movement_type)}
                            </Badge>
                          </TableCell>
                          <TableCell className={mov.quantity > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                            {mov.quantity > 0 ? "+" : ""}{mov.quantity}
                          </TableCell>
                          <TableCell>{mov.new_stock}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={mov.reason}>
                            {mov.reason || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el producto/servicio 
              <span className="font-bold text-foreground"> {productToDelete?.name} </span>
              de la base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}