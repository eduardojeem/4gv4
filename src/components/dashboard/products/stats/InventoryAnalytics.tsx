import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InventoryAnalyticsProps {
  className?: string;
}

const InventoryAnalytics: React.FC<InventoryAnalyticsProps> = ({ className = '' }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Análisis de Inventario</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Componente de análisis de inventario en desarrollo</p>
      </CardContent>
    </Card>
  );
};

export default InventoryAnalytics;