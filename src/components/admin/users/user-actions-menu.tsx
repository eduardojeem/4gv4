'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  UserCheck,
  Shield,
  Mail,
  History
} from 'lucide-react'
import { SupabaseUser } from '@/hooks/use-users-optimized'
import { useAuth } from '@/contexts/auth-context'

interface UserActionsMenuProps {
  user: SupabaseUser
  onView: (user: SupabaseUser) => void
  onEdit: (user: SupabaseUser) => void
  onDelete: (user: SupabaseUser) => void
  onReactivate?: (user: SupabaseUser) => void
  onViewActivity?: (user: SupabaseUser) => void
}

export function UserActionsMenu({
  user,
  onView,
  onEdit,
  onDelete,
  onReactivate,
  onViewActivity
}: UserActionsMenuProps) {
  const { user: currentUser } = useAuth()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const isSelf = currentUser?.id === user.id
  const isInactive = user.status === 'inactive'

  const handleDelete = () => {
    setShowDeleteDialog(true)
    setIsOpen(false)
  }

  const handleReactivate = () => {
    setShowReactivateDialog(true)
    setIsOpen(false)
  }

  const confirmDelete = () => {
    onDelete(user)
    setShowDeleteDialog(false)
  }

  const confirmReactivate = () => {
    if (onReactivate) {
      onReactivate(user)
    }
    setShowReactivateDialog(false)
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 data-[state=open]:bg-muted"
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => { onView(user); setIsOpen(false) }}>
            <Eye className="mr-2 h-4 w-4" />
            Ver Detalles
          </DropdownMenuItem>
          
          {onViewActivity && (
            <DropdownMenuItem onClick={() => { onViewActivity(user); setIsOpen(false) }}>
              <History className="mr-2 h-4 w-4" />
              Ver Actividad
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => { onEdit(user); setIsOpen(false) }}
            disabled={isSelf && user.role === 'admin'}
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          
          {user.role === 'admin' && !isSelf && (
            <DropdownMenuItem disabled>
              <Shield className="mr-2 h-4 w-4" />
              Cambiar Rol
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem disabled>
            <Mail className="mr-2 h-4 w-4" />
            Enviar Email
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {isInactive && onReactivate ? (
            <DropdownMenuItem 
              onClick={handleReactivate}
              className="text-green-600 focus:text-green-600 dark:text-green-400"
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Reactivar Usuario
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              onClick={handleDelete}
              disabled={isSelf}
              className="text-red-600 focus:text-red-600 dark:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isSelf ? 'No puedes eliminarte' : 'Desactivar'}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará a <strong>{user.name}</strong> como inactivo.
              El usuario no podrá acceder al sistema hasta que sea reactivado.
              {user.role === 'admin' && (
                <span className="block mt-2 text-orange-600 dark:text-orange-400 font-medium">
                  ⚠️ Este usuario es administrador. Asegúrate de que haya otros administradores activos.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Desactivar Usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Confirmation Dialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción reactivará a <strong>{user.name}</strong> y le permitirá
              acceder nuevamente al sistema con sus permisos anteriores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReactivate}
              className="bg-green-600 hover:bg-green-700 focus:ring-green-600"
            >
              Reactivar Usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
