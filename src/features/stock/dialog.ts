import { useEffect, useRef } from 'react'

export function useDialogFocus(onClose: () => void, blocked = false) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const blockedRef = useRef(blocked)

  useEffect(() => {
    blockedRef.current = blocked
  }, [blocked])

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = dialogRef.current
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ) ?? [],
      )

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !blockedRef.current) {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusable()
      const first = elements[0]
      const last = elements.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.classList.add('drawer-active')
    document.addEventListener('keydown', handleKeyDown)
    requestAnimationFrame(() => focusable()[0]?.focus())
    return () => {
      document.body.classList.remove('drawer-active')
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  return dialogRef
}
