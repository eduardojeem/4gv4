'use client'

// Motion wrapper component to centralize framer-motion imports
// This prevents import issues and provides consistent motion behavior

export { 
    motion, 
    AnimatePresence,
    type Variants,
    type Transition,
    type MotionProps 
} from 'framer-motion'

// Common animation variants
export const fadeInUp: import('framer-motion').Variants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
}

export const fadeIn: import('framer-motion').Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
}

export const scaleIn: import('framer-motion').Variants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 }
}

export const slideInFromRight: import('framer-motion').Variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
}

export const slideInFromLeft: import('framer-motion').Variants = {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
}

// Common transition presets
export const springTransition: import('framer-motion').Transition = {
    type: "spring",
    stiffness: 300,
    damping: 30
}

export const smoothTransition: import('framer-motion').Transition = {
    duration: 0.3,
    ease: "easeInOut"
}