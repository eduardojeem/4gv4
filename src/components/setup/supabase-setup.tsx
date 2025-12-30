'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Database, 
  Shield, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  ExternalLink,
  Settings,
  Key,
  FileText,
  Code
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const SETUP_STEPS = [
  {
    id: 'database',
    title: 'Configurar Base de Datos',
    description: 'Ejecutar el script SQL en Supabase',
    icon: Database,
    status: 'pending'
  },
  {
    id: 'auth',
    title: 'Configurar Autenticación',
    description: 'Habilitar proveedores de autenticación',
    icon: Shield,
    status: 'pending'
  },
  {
    id: 'rls',
    title: 'Configurar Row Level Security',
    description: 'Aplicar políticas de seguridad',
    icon: Key,
    status: 'pending'
  },
  {
    id: 'users',
    title: 'Crear Usuario Administrador',
    description: 'Asignar rol de super_admin',
    icon: Users,
    status: 'pending'
  }
]

const SQL_SCRIPT = `-- Script de configuración completo disponible en:
-- src/lib/supabase/setup.sql

-- Pasos principales:
-- 1. Crear tablas (profiles, user_roles, user_permissions, audit_log)
-- 2. Configurar funciones auxiliares (get_user_role, has_permission)
-- 3. Habilitar RLS en todas las tablas
-- 4. Crear políticas de seguridad
-- 5. Configurar triggers de auditoría`

const ENV_VARIABLES = `# Variables de entorno necesarias en .env.local

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key`

export default function SupabaseSetup() {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const { toast } = useToast()

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copiado',
        description: `${label} copiado al portapapeles`
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar al portapapeles',
        variant: 'destructive'
      })
    }
  }

  const markStepCompleted = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps([...completedSteps, stepId])
      toast({
        title: 'Paso completado',
        description: `${SETUP_STEPS.find(s => s.id === stepId)?.title} marcado como completado`
      })
    }
  }

  const isStepCompleted = (stepId: string) => completedSteps.includes(stepId)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configuración de Supabase con RLS
          </CardTitle>
          <CardDescription>
            Guía paso a paso para implementar el sistema de roles y permisos con Row Level Security
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Progreso de Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SETUP_STEPS.map((step, index) => {
              const Icon = step.icon
              const completed = isStepCompleted(step.id)
              
              return (
                <div
                  key={step.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    completed 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-5 w-5 ${completed ? 'text-green-600' : 'text-gray-500'}`} />
                    {completed && <CheckCircle className="h-4 w-4 text-green-600" />}
                  </div>
                  <h3 className="font-medium text-sm">{step.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                  <Button
                    size="sm"
                    variant={completed ? "secondary" : "outline"}
                    className="mt-2 w-full"
                    onClick={() => markStepCompleted(step.id)}
                  >
                    {completed ? 'Completado' : 'Marcar como completado'}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Paso 1: Script SQL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            1. Ejecutar Script SQL en Supabase
          </CardTitle>
          <CardDescription>
            Copia y ejecuta el script completo en el SQL Editor de tu proyecto Supabase
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              El script completo está disponible en <code>src/lib/supabase/setup.sql</code>
            </AlertDescription>
          </Alert>

          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Vista previa del script:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(SQL_SCRIPT, 'Script SQL')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">{SQL_SCRIPT}</pre>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Supabase Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => markStepCompleted('database')}
            >
              Marcar como completado
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Paso 2: Variables de Entorno */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            2. Configurar Variables de Entorno
          </CardTitle>
          <CardDescription>
            Agrega estas variables a tu archivo .env.local
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Variables de entorno:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(ENV_VARIABLES, 'Variables de entorno')}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">{ENV_VARIABLES}</pre>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Obtén estas claves desde la configuración de tu proyecto en Supabase Dashboard → Settings → API
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Paso 3: Configurar Autenticación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            3. Configurar Autenticación
          </CardTitle>
          <CardDescription>
            Habilita los proveedores de autenticación necesarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Email/Password</h4>
              <p className="text-sm text-gray-600 mb-3">
                Autenticación básica con email y contraseña
              </p>
              <Badge variant="outline">Recomendado</Badge>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Proveedores OAuth</h4>
              <p className="text-sm text-gray-600 mb-3">
                Google, GitHub, etc. (opcional)
              </p>
              <Badge variant="secondary">Opcional</Badge>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Ve a Authentication → Settings en tu Supabase Dashboard para configurar los proveedores
            </AlertDescription>
          </Alert>

          <Button
            variant="outline"
            onClick={() => markStepCompleted('auth')}
          >
            Marcar como completado
          </Button>
        </CardContent>
      </Card>

      {/* Paso 4: Crear Usuario Admin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            4. Crear Usuario Administrador
          </CardTitle>
          <CardDescription>
            Crea el primer usuario y asígnale el rol de super_admin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Pasos:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Registra el primer usuario a través de tu aplicación</li>
                <li>Copia el UUID del usuario desde Authentication → Users</li>
                <li>Ejecuta el siguiente SQL en Supabase:</li>
              </ol>
            </div>

            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">SQL para asignar super_admin:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(
                    `UPDATE user_roles SET role = 'super_admin' WHERE user_id = 'YOUR_USER_UUID';`,
                    'SQL de super_admin'
                  )}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>
              <pre className="text-xs text-gray-700">
                {`UPDATE user_roles SET role = 'super_admin' WHERE user_id = 'YOUR_USER_UUID';`}
              </pre>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => markStepCompleted('users')}
          >
            Marcar como completado
          </Button>
        </CardContent>
      </Card>

      {/* Resumen */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de la Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold">
              {completedSteps.length}/{SETUP_STEPS.length}
            </div>
            <div>
              <p className="font-medium">Pasos completados</p>
              <p className="text-sm text-gray-500">
                {completedSteps.length === SETUP_STEPS.length 
                  ? '¡Configuración completa!' 
                  : `${SETUP_STEPS.length - completedSteps.length} pasos restantes`
                }
              </p>
            </div>
          </div>

          {completedSteps.length === SETUP_STEPS.length && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                ¡Excelente! Tu sistema de roles y permisos con RLS está configurado correctamente.
                Ahora puedes usar el AuthProvider en tu aplicación.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}