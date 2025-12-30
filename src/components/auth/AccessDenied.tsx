'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, ArrowLeft, Home, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'

interface AccessDeniedProps {
    title?: string
    message?: string
    className?: string
}

export function AccessDenied({
    title = "Acceso Restringido",
    message = "No tienes los permisos necesarios para acceder a esta sección. Si crees que esto es un error, contacta al administrador.",
    className
}: AccessDeniedProps) {
    const router = useRouter()
    const { user } = useAuth()

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-md"
            >
                <Card className="border-l-4 border-l-red-500 shadow-lg">
                    <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
                        <div className="relative mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
                            <ShieldAlert className="h-10 w-10 text-red-500" />
                            <div className="absolute inset-0 rounded-full animate-ping bg-red-500/10" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                {title}
                            </h2>
                            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                                {message}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 justify-center pt-2">
                            {user && (
                                <Button
                                    onClick={() => router.push('/setup-access')}
                                    className="gap-2 bg-primary hover:bg-primary/90"
                                >
                                    <Settings className="h-4 w-4" />
                                    Configurar Acceso
                                </Button>
                            )}
                            
                            <div className="flex gap-3 justify-center">
                                <Button
                                    variant="outline"
                                    onClick={() => router.back()}
                                    className="gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Volver
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => router.push('/dashboard')}
                                    className="gap-2"
                                >
                                    <Home className="h-4 w-4" />
                                    Inicio
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}
