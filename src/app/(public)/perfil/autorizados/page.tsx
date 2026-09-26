'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { toast } from 'sonner'
import { 
  User, 
  Plus, 
  Trash2, 
  Shield, 
  Phone, 
  IdCard, 
  Users, 
  ArrowLeft, 
  Loader2, 
  Info,
  X,
  Save,
  Pencil,
  Ban,
  BadgeCheck
} from 'lucide-react'
import Link from 'next/link'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { usePublicTenantPrefix } from '@/lib/public/tenant-client'

// Schema de validación para persona autorizada
const authorizedPersonSchema = z.object({
  full_name: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres'),
  document_number: z.string().trim().min(5, 'El número de documento debe ser válido'),
  phone: z.string().trim().optional(),
  relationship: z.string().trim().optional()
})

type AuthorizedPerson = z.infer<typeof authorizedPersonSchema> & { id: string; is_active?: boolean }

export default function AuthorizedPersonsPage() {
  const { user, loading: loadingAuth } = useAuth()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { tenantSlug, tenantPrefix } = usePublicTenantPrefix()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [authorizedPersons, setAuthorizedPersons] = useState<AuthorizedPerson[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [editingPerson, setEditingPerson] = useState<AuthorizedPerson | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    document_number: '',
    phone: '',
    relationship: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Cargar personas autorizadas
  const loadAuthorizedPersons = useCallback(async () => {
    if (!user || !tenantSlug) return
    try {
      const { data: organization, error: organizationError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle()

      if (organizationError || !organization?.id) {
        throw organizationError || new Error('No se pudo identificar la tienda')
      }
      setOrganizationId(organization.id)

      const { data, error } = await supabase
        .from('authorized_persons')
        .select('*')
        .eq('profile_id', user.id)
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAuthorizedPersons(data || [])
    } catch (error) {
      console.error('Error loading authorized persons:', error)
      toast.error('Error al cargar las personas autorizadas')
    } finally {
      setLoading(false)
    }
  }, [user, supabase, tenantSlug])

  useEffect(() => {
    if (!loadingAuth) {
      if (!user) {
        const authorizedPath = tenantPrefix ? `${tenantPrefix}/perfil/autorizados` : '/perfil/autorizados'
        const loginPath = tenantPrefix ? `${tenantPrefix}/cliente/login` : '/login'
        router.push(`${loginPath}?next=${encodeURIComponent(authorizedPath)}`)
      } else if (!tenantSlug) {
        router.replace('/marketplace/perfil')
      } else {
        loadAuthorizedPersons()
      }
    }
  }, [user, loadingAuth, router, loadAuthorizedPersons, tenantPrefix, tenantSlug])

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !organizationId) {
      toast.error('No se pudo identificar la tienda. Volvé a intentarlo desde su perfil.')
      return
    }

    // Validar con Zod
    try {
      authorizedPersonSchema.parse(formData)
      setErrors({})
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.issues.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
      }
      return
    }

    setSubmitting(true)
    try {
      if (editingPerson) {
        // UPDATE EXISTING
        const updatePayload = {
          ...formData,
          updated_at: new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('authorized_persons')
          .update(updatePayload)
          .eq('id', editingPerson.id)
          .eq('profile_id', user.id)
          .eq('organization_id', organizationId)
          .select()
          .single()
        
        if (error) throw error

        toast.success('Autorización actualizada correctamente')
        setAuthorizedPersons(authorizedPersons.map(p => p.id === editingPerson.id ? data : p))
      } else {
        // INSERT NEW
        const insertPayload = {
          ...formData,
          profile_id: user.id,
          organization_id: organizationId,
        }

        const { data, error } = await supabase
          .from('authorized_persons')
          .insert([insertPayload])
          .select()
          .single()

        if (error) throw error

        toast.success('Persona autorizada agregada correctamente')
        setAuthorizedPersons([data, ...authorizedPersons])
      }

      setIsAdding(false)
      setEditingPerson(null)
      setFormData({ full_name: '', document_number: '', phone: '', relationship: '' })
    } catch (error) {
      console.error('Error saving authorized person:', error)
      toast.error('No se pudo guardar la autorización')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditClick = (person: AuthorizedPerson) => {
    setEditingPerson(person)
    setFormData({
      full_name: person.full_name,
      document_number: person.document_number,
      phone: person.phone || '',
      relationship: person.relationship || ''
    })
    setIsAdding(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggleStatus = async (person: AuthorizedPerson) => {
    if (!organizationId) return
    try {
      const newStatus = !person.is_active
      const { data, error } = await supabase
        .from('authorized_persons')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', person.id)
        .eq('profile_id', user?.id)
        .eq('organization_id', organizationId)
        .select()
        .single()

      if (error) throw error

      toast.success(newStatus ? 'Autorización reactivada' : 'Autorización suspendida')
      setAuthorizedPersons(authorizedPersons.map(p => p.id === person.id ? data : p))
    } catch (error) {
      console.error('Error toggling status:', error)
      toast.error('Error al cambiar el estado de la autorización')
    }
  }

  const handleDeletePerson = async (id: string) => {
    if (!organizationId) return
    const person = authorizedPersons.find((item) => item.id === id)
    if (!window.confirm(`¿Eliminar la autorización de ${person?.full_name || 'esta persona'}?`)) return
    try {
      const query = supabase
        .from('authorized_persons')
        .delete()
        .eq('id', id)
        .eq('profile_id', user?.id)
        .eq('organization_id', organizationId)

      const { error } = await query

      if (error) throw error

      toast.success('Autorización eliminada')
      setAuthorizedPersons(authorizedPersons.filter(p => p.id !== id))
    } catch (error) {
      console.error('Error deleting authorized person:', error)
      toast.error('Error al eliminar la autorización')
    }
  }

  if (loadingAuth || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/25">
      <main className="container max-w-4xl flex-1 px-4 pb-12 pt-24 lg:pt-28">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 group">
            <Link href={tenantPrefix ? `${tenantPrefix}/perfil` : '/perfil'}>
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Volver al perfil
            </Link>
          </Button>
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Autorizaciones de esta tienda</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Personas autorizadas
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Elegí quién puede retirar tus equipos en esta tienda presentando su documento.
              </p>
            </div>
            {!isAdding && (
              <Button 
                onClick={() => setIsAdding(true)}
                className="h-10"
              >
                <Plus className="mr-2 h-5 w-5" />
                Agregar persona
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          {/* Add Form Section */}
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="border-border shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>{editingPerson ? 'Editar Persona Autorizada' : 'Agregar Persona Autorizada'}</CardTitle>
                      <CardDescription>{editingPerson ? 'Modifica los datos de la persona.' : 'Completa los datos de la persona que autorizas.'}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Cerrar formulario" onClick={() => { setIsAdding(false); setEditingPerson(null); }}>
                      <X className="h-5 w-5" />
                    </Button>
                  </CardHeader>
                  <form onSubmit={handleAddPerson}>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="full_name" className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-500" />
                          Nombre Completo
                        </Label>
                        <Input 
                          id="full_name"
                          value={formData.full_name}
                          onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                          placeholder="Ej: María Rodríguez"
                          className={cn("h-10", errors.full_name && "border-destructive")}
                        />
                        {errors.full_name && <p className="text-xs text-red-500 font-medium">{errors.full_name}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="document_number" className="flex items-center gap-2">
                          <IdCard className="h-4 w-4 text-blue-500" />
                          C.I. / Documento
                        </Label>
                        <Input 
                          id="document_number"
                          value={formData.document_number}
                          onChange={e => setFormData({ ...formData, document_number: e.target.value })}
                          placeholder="Ej: 1.234.567"
                          className={cn("h-10", errors.document_number && "border-destructive")}
                        />
                        {errors.document_number && <p className="text-xs text-red-500 font-medium">{errors.document_number}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-blue-500" />
                          Teléfono (Opcional)
                        </Label>
                        <Input 
                          id="phone"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+595 9xx xxx xxx"
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="relationship" className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          Parentesco / Relación
                        </Label>
                        <Input 
                          id="relationship"
                          value={formData.relationship}
                          onChange={e => setFormData({ ...formData, relationship: e.target.value })}
                          placeholder="Ej: Hermana, Esposo, Mensajero"
                          className="h-10"
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-3 pt-2">
                      <Button type="button" variant="ghost" onClick={() => { setIsAdding(false); setEditingPerson(null); }}>
                        Cancelar
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={submitting}
                        className="h-10"
                      >
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Autorización
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* List Section */}
          <div className="grid gap-4">
            {authorizedPersons.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-dashed border-border bg-card px-4 py-14 text-center"
              >
                <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sin autorizaciones</h3>
                <p className="text-muted-foreground max-w-xs mx-auto mb-6">
                  No has agregado a ninguna persona autorizada todavía.
                </p>
                <Button onClick={() => setIsAdding(true)} variant="outline" className="rounded-xl border-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar la primera
                </Button>
              </motion.div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {authorizedPersons.map((person, index) => (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={cn("border-border shadow-none transition-colors hover:border-primary/30", person.is_active === false && "bg-muted/60 opacity-75")}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", person.is_active === false ? "bg-slate-300 text-slate-500 dark:bg-slate-700 dark:text-slate-400" : "bg-blue-500/10 text-blue-600")}>
                                <User className="h-6 w-6" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">
                                    {person.full_name}
                                  </h3>
                                  {person.is_active === false && (
                                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/20 dark:text-red-400">
                                      Suspendido
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <IdCard className="h-3.5 w-3.5" />
                                    <span>{person.document_number}</span>
                                  </div>
                                  {person.relationship && (
                                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                                      <Users className="h-3.5 w-3.5" />
                                      <span>{person.relationship}</span>
                                    </div>
                                  )}
                                  {person.phone && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Phone className="h-3.5 w-3.5" />
                                      <span>{person.phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleEditClick(person)}
                                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                                title="Editar"
                                aria-label={`Editar autorización de ${person.full_name}`}
                              >
                                <Pencil className="h-5 w-5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleToggleStatus(person)}
                                className={cn("rounded-xl transition-colors", person.is_active !== false ? "text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20" : "text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20")}
                                title={person.is_active !== false ? "Suspender" : "Activar"}
                                aria-label={`${person.is_active !== false ? 'Suspender' : 'Activar'} autorización de ${person.full_name}`}
                              >
                                {person.is_active !== false ? <Ban className="h-5 w-5" /> : <BadgeCheck className="h-5 w-5" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeletePerson(person.id)}
                                className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                title="Eliminar"
                                aria-label={`Eliminar autorización de ${person.full_name}`}
                              >
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4"
          >
            <Info className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-bold text-blue-900 dark:text-blue-300">Nota importante</h4>
              <p className="text-sm text-blue-800/70 dark:text-blue-400/70 leading-relaxed">
                Las personas autorizadas deberán presentar su documento de identidad original al momento de retirar el equipo. Esta información es confidencial y solo se utiliza para validar la entrega.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
