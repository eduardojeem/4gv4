'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, RefreshCw, User, X } from 'lucide-react'

interface TechnicianFiltersProps {
    searchTerm: string
    setSearchTerm: (term: string) => void
    showMyRepairsOnly: boolean
    setShowMyRepairsOnly: (show: boolean) => void
    onRefresh: () => void
    isLoading: boolean
}

export function TechnicianFilters({
    searchTerm,
    setSearchTerm,
    showMyRepairsOnly,
    setShowMyRepairsOnly,
    onRefresh,
    isLoading
}: TechnicianFiltersProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por ID, dispositivo, problema..."
                        className="pl-9 pr-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setSearchTerm('')}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    {/* My Repairs Toggle */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent transition-colors">
                        <Switch
                            id="my-repairs"
                            checked={showMyRepairsOnly}
                            onCheckedChange={setShowMyRepairsOnly}
                        />
                        <Label
                            htmlFor="my-repairs"
                            className="flex items-center gap-2 cursor-pointer text-sm font-medium"
                        >
                            <User className="h-4 w-4 text-primary" />
                            Mis Reparaciones
                            {showMyRepairsOnly && (
                                <Badge variant="secondary" className="ml-1">
                                    Activo
                                </Badge>
                            )}
                        </Label>
                    </div>

                    {/* Refresh Button */}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onRefresh}
                        disabled={isLoading}
                        title="Actualizar"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>
        </div>
    )
}
