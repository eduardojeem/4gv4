// Stubs para dependencias pesadas removidas temporalmente
// Esto permite que el build funcione sin las dependencias pesadas

// Tipos para DND Kit
export interface DragStartEvent {
  active: {
    id: string | number;
    data?: Record<string, unknown>;
  };
}

export interface DragOverEvent {
  active: {
    id: string | number;
    data?: Record<string, unknown>;
  };
  over?: {
    id: string | number;
    data?: Record<string, unknown>;
  } | null;
}

export interface DragEndEvent {
  active: {
    id: string | number;
    data?: Record<string, unknown>;
  };
  over?: {
    id: string | number;
    data?: Record<string, unknown>;
  } | null;
}

// Tipos internos para el stub de XLSX
interface XLSXWorksheet {
  data: unknown;
}
interface XLSXWorkbook {
  SheetNames: string[];
  Sheets: Record<string, XLSXWorksheet>;
  Props: Record<string, unknown>;
}

// Stub para XLSX
export const XLSX = {
  utils: {
    json_to_sheet: (data: unknown[]): XLSXWorksheet => ({ data }),
    aoa_to_sheet: (data: unknown[][]): XLSXWorksheet => ({ data }),
    book_new: (): XLSXWorkbook => ({ SheetNames: [], Sheets: {}, Props: {} }),
    book_append_sheet: (wb: XLSXWorkbook, ws: XLSXWorksheet, name: string) => {
      wb.SheetNames.push(name);
      wb.Sheets[name] = ws;
    }
  },
  writeFile: (_wb: XLSXWorkbook, _filename: string) => {
    console.warn('XLSX export deshabilitado temporalmente para optimización de bundle');
    alert('Función de exportación temporalmente deshabilitada');
  }
};

// Tipos internos para jsPDF stub
interface JsPDFOptions {
  orientation?: string;
  unit?: string;
  format?: string;
  [key: string]: unknown;
}
interface AutoTableOptions {
  head?: unknown[][];
  body?: unknown[][];
  [key: string]: unknown;
}

// Stub para jsPDF
export class jsPDF {
  internal = { pageSize: { width: 792, height: 612 } }
  constructor(_options?: JsPDFOptions) {
    console.warn('PDF export deshabilitado temporalmente para optimización de bundle');
  }
  text(_text: string, _x: number, _y: number) { return this }
  save(_filename: string) {
    console.warn('PDF export deshabilitado');
    alert('Función de exportación PDF temporalmente deshabilitada');
  }
  setFontSize(_size: number) { return this }
  setTextColor(_r: number, _g?: number, _b?: number) { return this }
  setDrawColor(_r: number, _g?: number, _b?: number) { return this }
  line(_x1: number, _y1: number, _x2: number, _y2: number) { return this }
  getNumberOfPages() { return 1 }
  autoTable(_options: AutoTableOptions) { return this }
}

// Stub para html2canvas
export const html2canvas = (_element: HTMLElement, _options?: Record<string, unknown>) => {
  console.warn('html2canvas deshabilitado temporalmente para optimización de bundle');
  return Promise.resolve({
    toDataURL: () => 'data:image/png;base64,',
    width: 800,
    height: 600
  });
};

// Tipos internos para DND
interface DraggableOptions {
  id: string | number;
  [key: string]: unknown;
}

// Stub para DND Kit
export const DndContext = ({
  children,
  onDragStart: _onDragStart,
  onDragOver: _onDragOver,
  onDragEnd: _onDragEnd
}: {
  children: React.ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
}) => {
  return <div>{children}</div>;
};

export const useDraggable = (_options: DraggableOptions) => ({
  attributes: {},
  listeners: {},
  setNodeRef: () => {},
  transform: null,
  isDragging: false
});

export const useDroppable = (_options: DraggableOptions) => ({
  setNodeRef: () => {},
  isOver: false
});

export const DragOverlay = ({ children: _children }: { children?: React.ReactNode }) => {
  return null;
};

export const SortableContext = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

export const useSortable = (_options: DraggableOptions) => ({
  attributes: {},
  listeners: {},
  setNodeRef: () => {},
  transform: null,
  transition: null,
  isDragging: false
});

// Función helper para mostrar mensaje de funcionalidad deshabilitada
export const showDisabledFeatureMessage = (featureName: string) => {
  alert(`${featureName} está temporalmente deshabilitado para optimización del bundle. Será restaurado en la próxima versión.`);
};