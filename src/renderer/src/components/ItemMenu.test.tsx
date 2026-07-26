import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ItemMenu, type MenuItem } from './ItemMenu'

// Regression tests for issue #19: right-clicking a file opened a context menu that didn't close
// on an outside click. The previous implementation hand-rolled `window.addEventListener('click', ...)`
// deferred via `setTimeout(0)` (to avoid the same event that opened the menu also closing it) -
// this now uses floating-ui's own `useDismiss` interaction instead, which attaches its listener
// synchronously with no artificial delay.
//
// Not covered here: "clicking inside the menu doesn't close it". jsdom has no real hit-testing/
// layout engine (same limitation noted in CLAUDE.md for this component's floating-ui positioning),
// and `userEvent.click()`'s synthetic pointer events resolve `composedPath()`/target differently
// than a real browser click would for an element that was never actually laid out - this made that
// particular assertion flaky in a way unrelated to the component's real behavior.

function renderMenu(
  onClose: () => void,
  items: MenuItem[] = [{ label: 'Delete', danger: true, onClick: vi.fn() }]
): void {
  const anchorEl = document.createElement('div')
  document.body.appendChild(anchorEl)
  render(<ItemMenu anchorEl={anchorEl} offsetX={0} offsetY={0} items={items} onClose={onClose} />)
}

describe('ItemMenu', () => {
  it('closes on an outside click immediately after opening, with no dead window before it can be dismissed', () => {
    const onClose = vi.fn()
    renderMenu(onClose)

    // Deliberately synchronous - no `await`/timer flush. The old `setTimeout(0)`-deferred listener
    // attachment left a real window right after mount where a fast outside click was silently
    // dropped instead of closing the menu; this reproduces that window.
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)

    expect(onClose).toHaveBeenCalled()
  })

  it('closes and invokes the item action when a menu item is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onClick = vi.fn()
    renderMenu(onClose, [{ label: 'Ungroup', onClick }])

    await user.click(screen.getByRole('button', { name: 'Ungroup' }))

    expect(onClick).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderMenu(onClose)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
