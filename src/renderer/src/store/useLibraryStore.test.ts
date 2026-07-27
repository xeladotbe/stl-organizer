import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLibraryStore } from './useLibraryStore';

// Most of this file only exercises the synchronous, DB/IPC-free selection actions - anything
// that calls window.api needs a real Electron preload bridge, which isn't available here. Where
// an action's behavior specifically depends on *how* it calls window.api (e.g. the pickHdri/
// clearHdri tests below, or the concurrent-refetch tests further down), window.api is stubbed
// with plain async functions instead.
beforeEach(() => {
  useLibraryStore.setState({
    selection: null,
    selectedFileIds: new Set(),
    selectionAnchorId: null
  });
});

describe('selectFile', () => {
  it('sets the selection and collapses the multi-selection to just that file', () => {
    useLibraryStore.setState({ selectedFileIds: new Set([1, 2, 3]) });

    useLibraryStore.getState().selectFile(5);

    const state = useLibraryStore.getState();
    expect(state.selection).toEqual({ type: 'file', id: 5 });
    expect(state.selectedFileIds).toEqual(new Set([5]));
    expect(state.selectionAnchorId).toBe(5);
  });

  it('closes the detail pane without touching an in-progress multi-selection when passed null', () => {
    useLibraryStore.setState({
      selection: { type: 'file', id: 5 },
      selectedFileIds: new Set([1, 2, 3]),
      selectionAnchorId: 1
    });

    useLibraryStore.getState().selectFile(null);

    const state = useLibraryStore.getState();
    expect(state.selection).toBeNull();
    expect(state.selectedFileIds).toEqual(new Set([1, 2, 3]));
    expect(state.selectionAnchorId).toBe(1);
  });
});

describe('collapseSelectionTo', () => {
  it('collapses the multi-selection to just the given file, like selectFile', () => {
    useLibraryStore.setState({ selectedFileIds: new Set([1, 2, 3]) });

    useLibraryStore.getState().collapseSelectionTo(5);

    const state = useLibraryStore.getState();
    expect(state.selectedFileIds).toEqual(new Set([5]));
    expect(state.selectionAnchorId).toBe(5);
  });

  it('does not touch `selection` - right-click must not open the detail pane', () => {
    useLibraryStore.setState({ selection: { type: 'file', id: 1 } });

    useLibraryStore.getState().collapseSelectionTo(5);

    expect(useLibraryStore.getState().selection).toEqual({ type: 'file', id: 1 });
  });

  it('leaves the detail pane closed when nothing was open before', () => {
    useLibraryStore.getState().collapseSelectionTo(5);

    expect(useLibraryStore.getState().selection).toBeNull();
  });
});

describe('toggleFileSelection', () => {
  it('adds a file to the selection and sets it as the anchor', () => {
    useLibraryStore.getState().toggleFileSelection(5);

    const state = useLibraryStore.getState();
    expect(state.selectedFileIds).toEqual(new Set([5]));
    expect(state.selectionAnchorId).toBe(5);
  });

  it('removes an already-selected file', () => {
    useLibraryStore.setState({ selectedFileIds: new Set([1, 5]) });

    useLibraryStore.getState().toggleFileSelection(5);

    expect(useLibraryStore.getState().selectedFileIds).toEqual(new Set([1]));
  });
});

describe('selectFileRange', () => {
  const orderedIds = [1, 2, 3, 4, 5];

  it('selects the contiguous range from the anchor to the target', () => {
    useLibraryStore.setState({ selectionAnchorId: 2 });

    useLibraryStore.getState().selectFileRange(orderedIds, 4);

    expect(useLibraryStore.getState().selectedFileIds).toEqual(new Set([2, 3, 4]));
  });

  it('keeps the anchor unchanged so repeated shift-clicks extend from the same start', () => {
    useLibraryStore.setState({ selectionAnchorId: 4 });

    useLibraryStore.getState().selectFileRange(orderedIds, 1);

    expect(useLibraryStore.getState().selectionAnchorId).toBe(4);
    expect(useLibraryStore.getState().selectedFileIds).toEqual(new Set([1, 2, 3, 4]));
  });
});

describe('clearFileSelection', () => {
  it('clears the multi-selection and anchor without touching `selection`', () => {
    useLibraryStore.setState({
      selection: { type: 'file', id: 1 },
      selectedFileIds: new Set([1, 2]),
      selectionAnchorId: 1
    });

    useLibraryStore.getState().clearFileSelection();

    const state = useLibraryStore.getState();
    expect(state.selectedFileIds).toEqual(new Set());
    expect(state.selectionAnchorId).toBeNull();
    expect(state.selection).toEqual({ type: 'file', id: 1 });
  });
});

describe('addSearchToken', () => {
  beforeEach(() => {
    useLibraryStore.setState({ searchQuery: '', view: 'duplicates' });
  });

  it('appends a tag/category token to the search field and switches to the "all" view', () => {
    useLibraryStore.getState().addSearchToken('tag:Bracket');

    const state = useLibraryStore.getState();
    expect(state.searchQuery).toBe('tag:Bracket');
    expect(state.view).toBe('all');
  });

  it('appends to whatever the user already typed rather than replacing it', () => {
    useLibraryStore.setState({ searchQuery: 'spacer', view: 'all' });

    useLibraryStore.getState().addSearchToken('category:Vases');

    expect(useLibraryStore.getState().searchQuery).toBe('spacer category:Vases');
  });

  it('does not duplicate a token that is already present', () => {
    useLibraryStore.setState({ searchQuery: 'tag:Bracket', view: 'all' });

    useLibraryStore.getState().addSearchToken('tag:Bracket');

    expect(useLibraryStore.getState().searchQuery).toBe('tag:Bracket');
  });
});

const HDRI_STORAGE_KEY = 'stl-organizer:hdriPath';

describe('pickHdri / clearHdri', () => {
  const originalApi = window.api;

  beforeEach(() => {
    localStorage.removeItem(HDRI_STORAGE_KEY);
    useLibraryStore.setState({ hdriPath: null });
  });

  afterEach(() => {
    window.api = originalApi;
  });

  it('stores the picked path in state and localStorage', async () => {
    window.api = {
      app: { pickHdriFile: async () => 'C:\\hdris\\studio.hdr' }
    } as typeof window.api;

    await useLibraryStore.getState().pickHdri();

    expect(useLibraryStore.getState().hdriPath).toBe('C:\\hdris\\studio.hdr');
    expect(localStorage.getItem(HDRI_STORAGE_KEY)).toBe('C:\\hdris\\studio.hdr');
  });

  it('leaves the current HDRI untouched when the picker is canceled', async () => {
    useLibraryStore.setState({ hdriPath: 'C:\\hdris\\existing.hdr' });
    localStorage.setItem(HDRI_STORAGE_KEY, 'C:\\hdris\\existing.hdr');
    window.api = { app: { pickHdriFile: async () => null } } as typeof window.api;

    await useLibraryStore.getState().pickHdri();

    expect(useLibraryStore.getState().hdriPath).toBe('C:\\hdris\\existing.hdr');
  });

  it('clears the path from state and localStorage', () => {
    useLibraryStore.setState({ hdriPath: 'C:\\hdris\\studio.hdr' });
    localStorage.setItem(HDRI_STORAGE_KEY, 'C:\\hdris\\studio.hdr');

    useLibraryStore.getState().clearHdri();

    expect(useLibraryStore.getState().hdriPath).toBeNull();
    expect(localStorage.getItem(HDRI_STORAGE_KEY)).toBeNull();
  });
});

// Regression tests for issue #46 (vercel-react-best-practices audit): actions like `moveToTrash`
// and `removeFolder` used to `await` each post-mutation refetch one at a time even though the
// refetches don't depend on each other or on one another's results - purely serializing IPC
// round trips. Fixed by firing the independent refetches via `Promise.all` instead.
//
// Proven here by controlling exactly when each mocked list call resolves: if the store still
// awaited them sequentially, a later mock wouldn't be invoked until an earlier one's promise
// resolved - these tests would hang (and time out) waiting for a call that never happens, since
// none of the deferred promises are resolved until after the assertions run.
describe('independent refetches after a mutation run concurrently', () => {
  const originalApi = window.api;

  afterEach(() => {
    window.api = originalApi;
  });

  function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it('moveToTrash refetches files and duplicates concurrently', async () => {
    const files = deferred<never[]>();
    const duplicates = deferred<never[]>();
    const filesList = vi.fn(() => files.promise);
    const duplicatesList = vi.fn(() => duplicates.promise);

    window.api = {
      files: { moveToTrash: async () => {}, list: filesList },
      duplicates: { list: duplicatesList }
    } as unknown as typeof window.api;

    const done = useLibraryStore.getState().moveToTrash(1);

    // Flush pending microtasks so the store gets as far as it can without either mock resolving.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(filesList).toHaveBeenCalledTimes(1);
    expect(duplicatesList).toHaveBeenCalledTimes(1);

    files.resolve([]);
    duplicates.resolve([]);
    await done;
  });

  it('removeFolder refetches folders, files, and duplicates concurrently', async () => {
    const folders = deferred<never[]>();
    const files = deferred<never[]>();
    const duplicates = deferred<never[]>();
    const foldersList = vi.fn(() => folders.promise);
    const filesList = vi.fn(() => files.promise);
    const duplicatesList = vi.fn(() => duplicates.promise);

    window.api = {
      folders: { remove: async () => {}, list: foldersList },
      files: { list: filesList },
      duplicates: { list: duplicatesList }
    } as unknown as typeof window.api;

    const done = useLibraryStore.getState().removeFolder(1);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(foldersList).toHaveBeenCalledTimes(1);
    expect(filesList).toHaveBeenCalledTimes(1);
    expect(duplicatesList).toHaveBeenCalledTimes(1);

    folders.resolve([]);
    files.resolve([]);
    duplicates.resolve([]);
    await done;
  });
});
