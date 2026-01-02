'use client'

// Stub para framer-motion - optimizado para bundle size
import React from 'react'

// Crear componentes motion básicos sin framer-motion
const createMotionComponent = (tag: string) => {
  return React.forwardRef<HTMLElement, any>(({ children, initial, animate, exit, variants, transition, whileHover, whileTap, drag, dragConstraints, onDragEnd, layout, layoutId, style, className, onClick, onMouseEnter, onMouseLeave, ...props }, ref) => {
    // Crear el elemento HTML correspondiente
    const Component = tag as any;
    
    return (
      <Component
        ref={ref}
        className={className}
        style={style}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        {...props}
      >
        {children}
      </Component>
    );
  });
};

// Crear componentes motion para los elementos más comunes
export const motion = {
  div: createMotionComponent('div'),
  span: createMotionComponent('span'),
  p: createMotionComponent('p'),
  h1: createMotionComponent('h1'),
  h2: createMotionComponent('h2'),
  h3: createMotionComponent('h3'),
  h4: createMotionComponent('h4'),
  h5: createMotionComponent('h5'),
  h6: createMotionComponent('h6'),
  button: createMotionComponent('button'),
  a: createMotionComponent('a'),
  img: createMotionComponent('img'),
  ul: createMotionComponent('ul'),
  li: createMotionComponent('li'),
  section: createMotionComponent('section'),
  article: createMotionComponent('article'),
  header: createMotionComponent('header'),
  footer: createMotionComponent('footer'),
  nav: createMotionComponent('nav'),
  main: createMotionComponent('main'),
  aside: createMotionComponent('aside'),
  form: createMotionComponent('form'),
  input: createMotionComponent('input'),
  textarea: createMotionComponent('textarea'),
  select: createMotionComponent('select'),
  label: createMotionComponent('label'),
  table: createMotionComponent('table'),
  thead: createMotionComponent('thead'),
  tbody: createMotionComponent('tbody'),
  tr: createMotionComponent('tr'),
  td: createMotionComponent('td'),
  th: createMotionComponent('th'),
};

// AnimatePresence stub - simplemente renderiza los children
export const AnimatePresence: React.FC<{ children?: React.ReactNode; mode?: string; initial?: boolean }> = ({ children }) => {
  return <>{children}</>;
};

// Common animation variants (stubs - no animation)
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
}

export const slideIn = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 20, opacity: 0 }
}

export const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.9, opacity: 0 }
}