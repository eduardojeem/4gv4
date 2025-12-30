import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    ArrowLeft,
    Edit,
    History,
    MoreVertical,
    MessageCircle,
    Phone,
    Mail,
    MapPin,
    Star,
    Shield
} from "lucide-react"
import { Customer } from "@/hooks/use-customer-state"

interface CustomerDetailHeaderProps {
    customer: Customer
    onBack: () => void
    onEdit: () => void
    onViewHistory: () => void
    compact?: boolean
}

export function CustomerDetailHeader({
    customer,
    onBack,
    onEdit,
    onViewHistory,
    compact
}: CustomerDetailHeaderProps) {

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800'
            case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 border-gray-200 dark:border-gray-800'
            case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800'
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 border-gray-200 dark:border-gray-800'
        }
    }

    const getSegmentColor = (segment: string) => {
        switch (segment) {
            case 'vip': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 border-purple-200 dark:border-purple-800'
            case 'premium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            case 'regular': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800'
            case 'wholesale': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800'
            case 'business': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300 border-gray-200 dark:border-gray-800'
        }
    }

    return (
        <div className="space-y-6">
            {/* Navigation Bar */}
            <div className="flex items-center justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="hover:bg-gray-100 dark:hover:bg-gray-800 -ml-2"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a Clientes
                </Button>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onViewHistory}>
                        <History className="h-4 w-4 mr-2" />
                        Historial
                    </Button>
                    <Button variant="default" size="sm" onClick={onEdit} className="bg-blue-600 hover:bg-blue-700">
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Main Header Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                {/* Cover/Banner Area (Optional - currently just a gradient) */}
                <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90 relative">
                    <div className="absolute inset-0 bg-[url('/patterns/grid.svg')] opacity-20"></div>
                </div>

                <div className="px-6 pb-6">
                    <div className="flex flex-col md:flex-row gap-6 items-start -mt-12 relative">
                        {/* Avatar */}
                        <div className="relative">
                            <Avatar className="h-24 w-24 ring-4 ring-white dark:ring-slate-900 shadow-lg bg-white dark:bg-slate-900">
                                <AvatarImage src={customer.avatar || undefined} alt={customer.name} />
                                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700">
                                    {customer.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-white dark:border-slate-900 ${customer.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                                }`} />
                        </div>

                        {/* Customer Info */}
                        <div className="flex-1 pt-14 md:pt-12 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                        {customer.name}
                                        {customer.segment === 'vip' && <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />}
                                    </h1>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Badge variant="outline" className={getStatusColor(customer.status)}>
                                            {customer.status === 'active' ? 'Activo' : customer.status}
                                        </Badge>
                                        <Badge variant="outline" className={getSegmentColor(customer.segment)}>
                                            {customer.segment === 'vip' ? 'VIP' :
                                                customer.segment === 'wholesale' ? 'Mayorista' :
                                                    customer.segment === 'business' ? 'Empresa' : 'Regular'}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Quick Contact Actions */}
                                <div className="flex items-center gap-2">
                                    {customer.phone && (
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Phone className="h-4 w-4 text-gray-500" />
                                            <span className="hidden lg:inline">{customer.phone}</span>
                                        </Button>
                                    )}
                                    {customer.email && (
                                        <Button variant="outline" size="sm" className="gap-2">
                                            <Mail className="h-4 w-4 text-gray-500" />
                                            <span className="hidden lg:inline">Email</span>
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <MessageCircle className="h-4 w-4 text-gray-500" />
                                        <span className="hidden lg:inline">Mensaje</span>
                                    </Button>
                                </div>
                            </div>

                            {/* Address & Details */}
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                                {customer.address && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        {customer.address}
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    ID: {customer.id}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
