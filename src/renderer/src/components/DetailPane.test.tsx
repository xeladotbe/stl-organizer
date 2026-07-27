import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FileRow } from '@shared/types';
import { DetailPane } from './DetailPane';
import { useLibraryStore } from '../store/useLibraryStore';

// Mock ModelPreview to avoid rendering the complex 3D component in jsdom
vi.mock('./ModelPreview', () => ({
  ModelPreview: (): React.JSX.Element => <div data-testid="model-preview" />
}));

const testFile: FileRow = {
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

describe('DetailPane', () => {
  beforeEach(() => {
    useLibraryStore.setState({
      selection: { type: 'file', id: 1 },
      files: [testFile],
      filesLoading: false,
      tags: [],
      categories: [],
      groups: [],
      fileTagIds: new Map(),
      selectedFileIds: new Set([1]),
      selectionAnchorId: 1
    });
  });

  it('displays the "Details" header for a single file', () => {
    render(<DetailPane />);
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('shows the model preview section', () => {
    render(<DetailPane />);
    expect(screen.getByTestId('model-preview')).toBeInTheDocument();
  });
});
