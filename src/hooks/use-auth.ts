// Re-exportar desde el contexto de autenticación
export { 
  useAuth, 
  useRequireAuth, 
  usePermissions,
  AuthProvider,
  type AuthUser,
  type AuthContextType 
} from '@/contexts/auth-context'