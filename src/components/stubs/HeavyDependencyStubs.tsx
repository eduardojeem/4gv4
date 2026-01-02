// Stubs para dependencias pesadas removidas temporalmente
// Esto permite que el build funcione sin las dependencias pesadas

// Stub para XLSX
export const XLSX = {
  utils: {
    json_to_sheet: (data: any[]) => ({ data }),
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    book_append_sheet: (wb: any, ws: any, name: string) => {
      wb.SheetNames.push(name);
      wb.Sheets[name] = ws;
    }
  },
  writeFile: (wb: any, filename: string) => {
    console.warn('XLSX export deshabilitado temporalmente para optimización de bundle');
    alert('Función de exportación temporalmente deshabilitada');
  }
};

// Stub para jsPDF
export class jsPDF {
  constructor(options?: any) {
    console.warn('PDF export deshabilitado temporalmente para optimización de bundle');
  }
  
  text(text: string, x: number, y: number) {
    return this;
  }
  
  save(filename: string) {
    console.warn('PDF export deshabilitado temporalmente para optimización de bundle');
    alert('Función de exportación PDF temporalmente deshabilitada');
  }
  
  autoTable(options: any) {
    return this;
  }
}

// Stub para html2canvas
export const html2canvas = (element: HTMLElement, options?: any) => {
  console.warn('html2canvas deshabilitado temporalmente para optimización de bundle');
  return Promise.resolve({
    toDataURL: () => 'data:image/png;base64,',
    width: 800,
    height: 600
  });
};

// Stub para DND Kit
export const DndContext = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

export const useDraggable = (options: any) => ({
  attributes: {},
  listeners: {},
  setNodeRef: () => {},
  transform: null,
  isDragging: false
});

export const useDroppable = (options: any) => ({
  setNodeRef: () => {},
  isOver: false
});

export const DragOverlay = ({ children }: { children?: React.ReactNode }) => {
  return null;
};

export const SortableContext = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

export const useSortable = (options: any) => ({
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