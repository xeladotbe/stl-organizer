import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FileRow } from '@shared/types'
import { FileList } from './FileList'
import { useLibraryStore } from '../store/useLibraryStore'

// FileTable/FileGrid rely on @tanstack/react-virtual, which needs real browser layout jsdom
// doesn't provide (see CLAUDE.md's Testing section) - stub them out so this test can focus on
// the search bar itself without chasing brittle virtualization behavior.
vi.mock('./FileTable', () => ({ FileTable: (): React.JSX.Element => <div data-testid="file-table" /> }))
vi.mock('./FileGrid', () => ({ FileGrid: (): React.JSX.Element => <div data-testid="file-grid" /> }))

const file: FileRow = {
  id: 1,
  folder_id: 1,
  path: 'C:/models/vase.stl',
  filename: 'vase.stl',
  ext: 'stl',
  size: 1024,
  mtime_ms: 0,
  content_hash: null,
  hash_status: 'pending',
  thumbnail_path: null,
  thumbnail_status: 'pending',
  category_id: null,
  group_id: null,
  missing: 0,
  created_at: 0,
  updated_at: 0
}

describe('FileList search field', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      files: [file],
      filesLoading: false,
      tags: [],
      categories: [],
      groups: [],
      fileTagIds: new Map()
    })
  })

  it('does not show a clear button when the search field is empty', () => {
    render(<FileList />)
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('shows a clear button once text is entered, and clicking it empties the field', async () => {
    const user = userEvent.setup()
    render(<FileList />)
    const input = screen.getByPlaceholderText('Search files…')

    await user.type(input, 'vase')
    expect(input).toHaveValue('vase')

    const clearButton = screen.getByLabelText('Clear search')
    await user.click(clearButton)

    expect(input).toHaveValue('')
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })
})
