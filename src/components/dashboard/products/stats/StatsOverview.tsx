import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatsOverviewProps {
  className?: string;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ className = '' }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Resumen de Estadísticas</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Componente de resumen de estadísticas en desarrollo</p>
      </CardContent>
    </Card>
  );
};

export default StatsOverview;