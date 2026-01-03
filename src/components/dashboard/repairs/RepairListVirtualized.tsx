'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { RepairRow } from './RepairRow';
import { Repair, RepairStatus } from '@/types/repairs';
import {
    Table, TableBody, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

interface RepairListVirtualizedProps {
  repairs: Repair[];
  onEdit: (repair: Repair) => void;
  onView?: (repair: Repair) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: RepairStatus) => void;
}

export function RepairListVirtualized({
  repairs,
  onEdit,
  onView,
  onDelete,
  onStatusChange,
}: RepairListVirtualizedProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: repairs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73, // Altura estimada de cada fila (ajustada)
    overscan: 5, // Renderizar 5 items extra arriba y abajo para scroll suave
  });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px' }}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Dispositivo</TableHead>
              <TableHead className="hidden md:table-cell">Problema</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell">Prioridad</TableHead>
              <TableHead className="hidden xl:table-cell">Técnico</TableHead>
              <TableHead className="hidden sm:table-cell">Creado</TableHead>
              <TableHead className="hidden sm:table-cell w-[80px]">Fotos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const repair = repairs[virtualRow.index];
              return (
                <div
                  key={repair.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <RepairRow
                    repair={repair}
                    onEdit={onEdit}
                    onView={onView}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                  />
                </div>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
