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
  AlertCircle, 
  CheckCircle2, 
  Info,
  X,
  UserPlus
} from 'lucide-react'
import Link from 'next/link'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

// Schema de validación para persona autorizada
const authorizedPersonSchema = z.object({
  full_name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  document_number: z.string().min(5, 'El número de documento debe ser válido'),
  phone: z.string().optional(),
  relationship: z.string().optional()
})

type AuthorizedPerson = z.infer<typeof authorizedPersonSchema> & { id: string }

export default function AuthorizedPersonsPage() {
  const { user, loading: loadingAuth } = useAuth()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [authorizedPersons, setAuthorizedPersons] = useState<AuthorizedPerson[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    document_number: '',
    phone: '',
    relationship: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Cargar personas autorizadas
  const loadAuthorizedPersons = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('authorized_persons')
        .select('*')
        .eq('profile_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAuthorizedPersons(data || [])
    } catch (error) {
      console.error('Error loading authorized persons:', error)
      toast.error('Error al cargar las personas autorizadas')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    if (!loadingAuth) {
      if (!user) {
        router.push('/login')
      } else {
        loadAuthorizedPersons()
      }
    }
  }, [user, loadingAuth, router, loadAuthorizedPersons])

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Validar con Zod
    try {
      authorizedPersonSchema.parse(formData)
      setErrors({})
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
      }
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('authorized_persons')
        .insert([{
          ...formData,
          profile_id: user.id
        }])
        .select()
        .single()

      if (error) throw error

      toast.success('Persona autorizada agregada correctamente')
      setAuthorizedPersons([data, ...authorizedPersons])
      setIsAdding(false)
      setFormData({ full_name: '', document_number: '', phone: '', relationship: '' })
    } catch (error) {
      console.error('Error adding authorized person:', error)
      toast.error('No se pudo agregar a la persona autorizada')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePerson = async (id: string) => {
    try {
      const { error } = await supabase
        .from('authorized_persons')
        .delete()
        .eq('id', id)
        .eq('profile_id', user?.id)

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex flex-col">
      {/* Background Blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] right-[10%] w-72 h-72 bg-blue-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[10%] left-[10%] w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <main className="container max-w-4xl py-12 px-4 relative z-10 pt-24 lg:pt-32 flex-1">
        <div className="mb-8">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 group hover:bg-white/50 dark:hover:bg-slate-900/50 backdrop-blur-sm">
            <Link href="/perfil">
              <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Volver al perfil
            </Link>
          </Button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                Personas Autorizadas
              </h1>
              <p className="text-muted-foreground mt-2 font-medium">
                Gestiona quiénes pueden retirar tus equipos en tu nombre.
              </p>
            </div>
            {!isAdding && (
              <Button 
                onClick={() => setIsAdding(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-6 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
              >
                <Plus className="mr-2 h-5 w-5" />
                Nueva Autorización
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-8">
          {/* Add Form Section */}
          <AnimatePresence>
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                className="overflow-hidden"
              >
                <Card className="border-none shadow-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/20">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Agregar Persona Autorizada</CardTitle>
                      <CardDescription>Completa los datos de la persona que autorizas.</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setIsAdding(false)} className="rounded-full">
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
                          className={cn("h-11 rounded-xl", errors.full_name && "border-red-500")}
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
                          className={cn("h-11 rounded-xl", errors.document_number && "border-red-500")}
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
                          className="h-11 rounded-xl"
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
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-3 pt-2">
                      <Button type="button" variant="ghost" onClick={() => setIsAdding(false)} className="rounded-xl">
                        Cancelar
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={submitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-6 shadow-md"
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
                className="text-center py-20 px-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-3xl border border-dashed border-slate-300 dark:border-slate-700"
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
                      <Card className="group border-none shadow-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md hover:shadow-2xl transition-all duration-300 hover:scale-[1.01] border border-white/10">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                                <User className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">
                                  {person.full_name}
                                </h3>
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
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeletePerson(person.id)}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
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
            className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 flex gap-4 items-start"
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

function Save() {
  return <Plus className="h-5 w-5" />
}
