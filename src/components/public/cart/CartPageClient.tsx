'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { usePublicCart } from '@/hooks/use-public-cart'
import { formatMoney } from '@/components/dashboard/orders/format'
import { resolveProductImageUrl } from '@/lib/images'

export function CartPageClient({
  organizationSlug,
  productsHref,
  trackHref,
}: {
  organizationSlug: string | null
  productsHref: string
  trackHref: string
}) {
  const { toast } = useToast()
  const { items, subtotal, setQuantity, removeItem, clear } = usePublicCart()
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [fulfillmentType, setFulfillmentType] = useState('PICKUP')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return items.length > 0 && customerName.trim() && (customerEmail.trim() || customerPhone.trim())
  }, [customerEmail, customerName, customerPhone, items.length])

  async function submitOrder() {
    if (!canSubmit) {
      toast({
        title: 'Datos incompletos',
        description: 'Completa nombre y al menos email o telefono.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const params = organizationSlug ? `?org=${encodeURIComponent(organizationSlug)}` : ''
      const response = await fetch(`/api/public/orders${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            address: customerAddress,
          },
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          fulfillmentType,
          paymentMethod,
          notes,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'No se pudo crear el pedido.')
      }

      const orderNumber = payload.data.order_number as string
      clear()
      setCreatedOrderNumber(orderNumber)
      toast({ title: 'Pedido creado', description: `Tu numero de pedido es ${orderNumber}.` })
    } catch (error) {
      toast({
        title: 'No se pudo confirmar',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (createdOrderNumber) {
    return (
      <div className="container py-10">
        <Card className="mx-auto max-w-2xl">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-2xl font-bold">Pedido recibido</h1>
            <p className="mt-2 text-muted-foreground">Guardamos tu pedido y el negocio ya puede gestionarlo desde el dashboard.</p>
            <div className="mt-5 rounded-lg border bg-muted/30 px-4 py-3 font-mono text-lg font-semibold">{createdOrderNumber}</div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href={`${trackHref}?orderNumber=${encodeURIComponent(createdOrderNumber)}`}>Rastrear pedido</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={productsHref}>Seguir comprando</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8 md:py-12">
      <Link href={productsHref} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Volver a productos
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Carrito</h1>
            <p className="mt-1 text-muted-foreground">Revisa tus productos y confirma el pedido con tus datos.</p>
          </div>

          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <ShoppingCart className="h-10 w-10 text-muted-foreground" />
                <h2 className="mt-4 font-semibold">Tu carrito esta vacio</h2>
                <p className="mt-1 text-sm text-muted-foreground">Agrega productos desde la tienda de la empresa.</p>
                <Button asChild className="mt-5">
                  <Link href={productsHref}>Ver productos</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const image = resolveProductImageUrl(item.image)
                return (
                  <Card key={item.productId}>
                    <CardContent className="grid gap-4 p-4 sm:grid-cols-[80px_1fr_auto] sm:items-center">
                      <div className="relative h-20 w-20 overflow-hidden rounded-lg border bg-muted">
                        {image ? (
                          <Image src={image} alt={item.name} fill className="object-contain p-2" sizes="80px" unoptimized={image.startsWith('data:') || image === '/placeholder-product.svg'} />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.sku || 'Sin SKU'} - {formatMoney(item.unitPrice)}</p>
                        <div className="mt-3 flex w-fit items-center rounded-lg border">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuantity(item.productId, item.quantity - 1)}>
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="min-w-10 text-center text-sm font-semibold">{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQuantity(item.productId, item.quantity + 1)}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <strong>{formatMoney(item.quantity * item.unitPrice)}</strong>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeItem(item.productId)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Quitar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos del pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefono</Label>
                  <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Entrega</Label>
                <Select value={fulfillmentType} onValueChange={setFulfillmentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PICKUP">Retiro en local</SelectItem>
                    <SelectItem value="DELIVERY">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {fulfillmentType === 'DELIVERY' && (
                <div className="space-y-1.5">
                  <Label>Direccion</Label>
                  <Input value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                    <SelectItem value="CARD">Tarjeta</SelectItem>
                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                    <SelectItem value="DIGITAL_WALLET">Billetera digital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex justify-between text-sm"><span>Productos</span><strong>{items.length}</strong></div>
                <div className="mt-2 flex justify-between border-t pt-3 text-base"><span>Total</span><strong>{formatMoney(subtotal)}</strong></div>
              </div>
              <Button className="w-full" onClick={submitOrder} disabled={loading || items.length === 0}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                Confirmar pedido
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
