import { useEffect } from 'react'
import { useFloating, autoUpdate, offset, flip, shift, hide } from '@floating-ui/react'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
}

export function ItemMenu({
  anchorEl,
  offsetX,
  offsetY,
  topPadding = 0,
  items,
  onClose
}: {
  /** The row/card the menu was opened on — tracked live so the menu scrolls with it. */
  anchorEl: HTMLElement
  /** Click position relative to `anchorEl`'s top-left, so the menu opens exactly where clicked. */
  offsetX: number
  offsetY: number
  /** Extra clipping margin from the top of the anchor's scroll container — needed when a sticky
   * header visually covers part of it (the container's own clip rect doesn't know about that). */
  topPadding?: number
  items: MenuItem[]
  onClose: () => void
}): React.JSX.Element {
  const { refs, floatingStyles, middlewareData } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) onClose()
    },
    placement: 'right-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip(), shift({ padding: 8 }), hide({ padding: { top: topPadding } })]
  })

  useEffect(() => {
    // A virtual element: its position is recomputed from the anchor's *live* rect (plus the
    // fixed click offset) every time `autoUpdate` asks for it, so the menu tracks the row as it
    // scrolls — `contextElement` is what lets floating-ui find the real scrolling ancestor to
    // watch and to clip against, since a virtual element has no DOM position of its own.
    refs.setReference({
      getBoundingClientRect: () => {
        const rect = anchorEl.getBoundingClientRect()
        const x = rect.left + offsetX
        const y = rect.top + offsetY
        return { x, y, width: 0, height: 0, top: y, left: x, right: x, bottom: y }
      },
      contextElement: anchorEl
    })
  }, [refs, anchorEl, offsetX, offsetY])

  // Closes automatically once the row scrolls out of its clipping container (past the visible
  // edge, or fully unmounted by the virtualizer) — this is floating-ui's `hide` middleware doing
  // the work that used to be a hand-rolled scroll-position comparison.
  const isHidden = middlewareData.hide?.referenceHidden ?? false
  useEffect(() => {
    if (isHidden) onClose()
  }, [isHidden, onClose])

  useEffect(() => {
    // Deferred so the same click/contextmenu event that opened the menu doesn't also close it.
    const timer = setTimeout(() => {
      window.addEventListener('click', onClose)
      window.addEventListener('contextmenu', onClose)
      window.addEventListener('blur', onClose)
    }, 0)
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', onClose)
      window.removeEventListener('contextmenu', onClose)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div
      // refs.setFloating is floating-ui's documented callback-ref setter, not a `.current` read —
      // the react-hooks/refs rule can't tell those apart for third-party ref-object shapes.
      // eslint-disable-next-line react-hooks/refs
      ref={refs.setFloating}
      style={{ ...floatingStyles, width: 160, zIndex: 50 }}
      className="overflow-hidden rounded border border-neutral-700 bg-neutral-900 py-1 text-sm shadow-lg"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`block w-full px-3 py-1.5 text-left hover:bg-neutral-800 ${
            item.danger ? 'text-red-400' : 'text-neutral-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
