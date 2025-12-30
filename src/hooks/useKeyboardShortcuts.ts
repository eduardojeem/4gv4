import { useEffect } from 'react'

type KeyCombo = {
    key: string
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    action: () => void
    description: string
}

export function useKeyboardShortcuts(shortcuts: KeyCombo[]) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Ignore if inside an input or textarea (unless it's a function key like F1-F12)
            const target = event.target as HTMLElement
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
            const isFunctionKey = event.key.startsWith('F') || event.key === 'Escape'

            if (isInput && !isFunctionKey) return

            for (const shortcut of shortcuts) {
                if (
                    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
                    !!event.ctrlKey === !!shortcut.ctrl &&
                    !!event.altKey === !!shortcut.alt &&
                    !!event.shiftKey === !!shortcut.shift
                ) {
                    event.preventDefault()
                    shortcut.action()
                    return
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [shortcuts])
}
