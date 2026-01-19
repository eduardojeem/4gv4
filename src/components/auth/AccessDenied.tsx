'use client'

import React from 'react'
import { motion  } from '../ui/motion'
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface AccessDeniedProps {
    className?: string
}

export function AccessDenied({ className }: AccessDeniedProps) {
    const router = useRouter()

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-sm text-center space-y-8"
            >
                <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-950/30 dark:to-red-950/30 blur-xl" />
                    <div className="relative w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50 border border-orange-200/50 dark:border-orange-800/50">
                        <ShieldAlert className="h-10 w-10 text-orange-600 dark:text-orange-400" />
                    </div>
                </div>

                <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                    Acceso Restringido
                </h2>

                <div className="flex gap-3 justify-center">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        className="gap-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver
                    </Button>
                    <Button
                        onClick={() => router.push('/dashboard')}
                        className="gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
                    >
                        <Home className="h-4 w-4" />
                        Inicio
                    </Button>
                </div>
            </motion.div>
        </div>
    )
}
