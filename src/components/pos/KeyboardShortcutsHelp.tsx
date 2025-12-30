import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Keyboard } from "lucide-react"

interface Shortcut {
    key: string
    description: string
}

interface KeyboardShortcutsHelpProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    shortcuts: Shortcut[]
}

export function KeyboardShortcutsHelp({
    isOpen,
    onOpenChange,
    shortcuts,
}: KeyboardShortcutsHelpProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Keyboard className="h-5 w-5" />
                        Atajos de Teclado
                    </DialogTitle>
                    <DialogDescription>
                        Lista de atajos disponibles para agilizar tu trabajo.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {shortcuts.map((shortcut, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between border-b pb-2 last:border-0"
                        >
                            <span className="text-sm font-medium text-gray-700">
                                {shortcut.description}
                            </span>
                            <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                {shortcut.key}
                            </kbd>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
