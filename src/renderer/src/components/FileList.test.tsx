import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FileRow } from '@shared/types';
import { FileList } from './FileList';
import { useLibraryStore } from '../store/useLibraryStore';

// FileTable/FileGrid rely on @tanstack/react-virtual, which needs real browser layout jsdom
// doesn't provide (see CLAUDE.md's Testing section) - stub them out so this test can focus on
// the search bar itself without chasing brittle virtualization behavior.
vi.mock('./FileTable', () => ({
  FileTable: (): React.JSX.Element => <div data-testid="file-table" />
}));
vi.mock('./FileGrid', () => ({
  FileGrid: (): React.JSX.Element => <div data-testid="file-grid" />
}));

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
};

describe('FileList search field', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      files: [file],
      filesLoading: false,
      tags: [],
      categories: [],
      groups: [],
      fileTagIds: new Map()
    });
  });

  it('does not show a clear button when the search field is empty', () => {
    render(<FileList />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('shows a clear button once text is entered, and clicking it empties the field', async () => {
    const user = userEvent.setup();
    render(<FileList />);
    const input = screen.getByPlaceholderText('Search files…');

    await user.type(input, 'vase');
    expect(input).toHaveValue('vase');

    const clearButton = screen.getByLabelText('Clear search');
    await user.click(clearButton);

    expect(input).toHaveValue('');
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });
});

describe('FileList file count', () => {
  it('shows singular "file" when there is exactly one file', () => {
    useLibraryStore.setState({
      files: [file],
      filesLoading: false,
      tags: [],
      categories: [],
      groups: [],
      fileTagIds: new Map()
    });

    render(<FileList />);
    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('shows plural "files" when there are multiple files', () => {
    const file2 = { ...file, id: 2, filename: 'cup.stl', path: 'C:/models/cup.stl' };
    useLibraryStore.setState({
      files: [file, file2],
      filesLoading: false,
      tags: [],
      categories: [],
      groups: [],
      fileTagIds: new Map()
    });

    render(<FileList />);
    expect(screen.getByText('2 files')).toBeInTheDocument();
  });

  it('shows count of matching files when search filters results', async () => {
    const file2 = { ...file, id: 2, filename: 'cup.stl', path: 'C:/models/cup.stl' };
    useLibraryStore.setState({
      files: [file, file2],
      filesLoading: false,
      tags: [],
      categories: [],
      groups: [],
      fileTagIds: new Map()
    });

    const user = userEvent.setup();
    render(<FileList />);

    // Initially shows 2 files
    expect(screen.getByText('2 files')).toBeInTheDocument();

    // After searching for "vase", only 1 file matches
    const input = screen.getByPlaceholderText('Search files…');
    await user.type(input, 'vase');

    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('hides count during loading state when library is empty', () => {
    useLibraryStore.setState({
      files: [],
      filesLoading: true,
      tags: [],
      categories: [],
      groups: [],
      fileTagIds: new Map()
    });

    render(<FileList />);
    expect(screen.queryByText(/^[\d]+ files?$/)).not.toBeInTheDocument();
  });

  it('shows count even when library has files, even if no files are visible from search', async () => {
    const file2 = { ...file, id: 2, filename: 'cup.stl', path: 'C:/models/cup.stl' };
    useLibraryStore.setState({
      files: [file, file2],
      filesLoading: false,
      tags: [],
      categories: [],
      groups: [],
      fileTagIds: new Map()
    });

    const user = userEvent.setup();
    render(<FileList />);

    const input = screen.getByPlaceholderText('Search files…');
    await user.type(input, 'nonexistent');

    // Should show 0 files since no matches
    expect(screen.getByText('0 files')).toBeInTheDocument();
  });
});
