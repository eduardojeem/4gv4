// Mobile dialogs fill the visible viewport; desktop keeps the centered dialog.
export const cashDialogLayout = 'fixed inset-x-0 top-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[92dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl [&_input]:text-base [&_textarea]:text-base [&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:top-2 [&_[data-slot=dialog-close]]:right-2'
export const cashDialogBody = 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5'
export const cashDialogFooter = 'shrink-0 border-t bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 [&_button]:min-h-11 [&_button]:whitespace-normal'

// Focus the dialog itself, not an input that would immediately open the keyboard.
export function focusCashDialog(event: Event) {
  event.preventDefault()
  if (event.target instanceof HTMLElement) event.target.focus()
}
