/**
 * POS Header Component - Optimización Fase 4
 * Header separado para reducir el tamaño del componente principal
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggleSimple } from '@/components/ui/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Maximize, 
  Minimize, 
  BarChart3,
  Keyboard,
  Users
} from 'lucide-react';

interface POSHeaderProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onOpenCustomers: () => void;
  onOpenAnalytics: () => void;
  cartItemsCount: number;
  totalAmount: number;
}

export const POSHeader: React.FC<POSHeaderProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onOpenSettings,
  onOpenCustomers,
  onOpenAnalytics,
  cartItemsCount,
  totalAmount
}) => {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">POS Sistema</h1>
        <Badge variant="secondary" className="text-sm">
          {cartItemsCount} items - ${totalAmount.toFixed(2)}
        </Badge>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenCustomers}
          className="hidden md:flex"
        >
          <Users className="h-4 w-4 mr-2" />
          Clientes
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenAnalytics}
          className="hidden lg:flex"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Analytics
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
        >
          <Settings className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </Button>
        
        <ThemeToggleSimple />
      </div>
    </div>
  );
};