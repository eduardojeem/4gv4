import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductChartsProps {
  className?: string;
}

const ProductCharts: React.FC<ProductChartsProps> = ({ className = '' }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Gráficos de Productos</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Componente de gráficos de productos en desarrollo</p>
      </CardContent>
    </Card>
  );
};

export default ProductCharts;