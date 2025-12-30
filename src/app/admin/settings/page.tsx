'use client'

import { Suspense } from 'react'
import { SystemConfiguration } from '@/components/admin/system/system-configuration'
import { useAdminDashboard } from '@/hooks/use-admin-dashboard'

export default function SettingsPage() {
    const {
        settings,
        updateSettings,
        performSystemAction,
        isLoading
    } = useAdminDashboard()

    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="p-4">Cargando configuración...</div>}>
                <SystemConfiguration
                    settings={settings}
                    onUpdateSettings={updateSettings}
                    onPerformAction={performSystemAction}
                    isLoading={isLoading}
                />
            </Suspense>
        </div>
    )
}
