import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupNameDialog } from './GroupNameDialog'

describe('GroupNameDialog', () => {
  it('shows how many files are being grouped', () => {
    render(<GroupNameDialog count={3} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Group 3 files into a virtual file')).toBeInTheDocument()
  })

  it('confirms with the typed name on Enter', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<GroupNameDialog count={2} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Virtual file name…'), 'Vase{Enter}')
    expect(onConfirm).toHaveBeenCalledWith('Vase')
  })

  it('confirms with the typed name on clicking Create', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<GroupNameDialog count={2} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Virtual file name…'), 'Vase')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(onConfirm).toHaveBeenCalledWith('Vase')
  })

  it('falls back to a default name when nothing was typed', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<GroupNameDialog count={2} onConfirm={onConfirm} onCancel={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(onConfirm).toHaveBeenCalledWith('New virtual file')
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<GroupNameDialog count={2} onConfirm={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
