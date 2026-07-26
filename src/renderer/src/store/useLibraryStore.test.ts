import { beforeEach, describe, expect, it } from 'vitest'
import { useLibraryStore } from './useLibraryStore'

// Only the synchronous, DB/IPC-free selection actions are exercised here - anything that calls
// window.api (loadFiles, moveToTrash, ...) needs a real Electron preload bridge and isn't
// available in this test environment.
beforeEach(() => {
  useLibraryStore.setState({
    selection: null,
    selectedFileIds: new Set(),
    selectionAnchorId: null
  })
})

describe('selectFile', () => {
  it('sets the selection and collapses the multi-selection to just that file', () => {
    useLibraryStore.setState({ selectedFileIds: new Set([1, 2, 3]) })

    useLibraryStore.getState().selectFile(5)

    const state = useLibraryStore.getState()
    expect(state.selection).toEqual({ type: 'file', id: 5 })
    expect(state.selectedFileIds).toEqual(new Set([5]))
    expect(state.selectionAnchorId).toBe(5)
  })

  it('closes the detail pane without touching an in-progress multi-selection when passed null', () => {
    useLibraryStore.setState({
      selection: { type: 'file', id: 5 },
      selectedFileIds: new Set([1, 2, 3]),
      selectionAnchorId: 1
    })

    useLibraryStore.getState().selectFile(null)

    const state = useLibraryStore.getState()
    expect(state.selection).toBeNull()
    expect(state.selectedFileIds).toEqual(new Set([1, 2, 3]))
    expect(state.selectionAnchorId).toBe(1)
  })
})

describe('collapseSelectionTo', () => {
  it('collapses the multi-selection to just the given file, like selectFile', () => {
    useLibraryStore.setState({ selectedFileIds: new Set([1, 2, 3]) })

    useLibraryStore.getState().collapseSelectionTo(5)

    const state = useLibraryStore.getState()
    expect(state.selectedFileIds).toEqual(new Set([5]))
    expect(state.selectionAnchorId).toBe(5)
  })

  it('does not touch `selection` - right-click must not open the detail pane', () => {
    useLibraryStore.setState({ selection: { type: 'file', id: 1 } })

    useLibraryStore.getState().collapseSelectionTo(5)

    expect(useLibraryStore.getState().selection).toEqual({ type: 'file', id: 1 })
  })

  it('leaves the detail pane closed when nothing was open before', () => {
    useLibraryStore.getState().collapseSelectionTo(5)

    expect(useLibraryStore.getState().selection).toBeNull()
  })
})

describe('toggleFileSelection', () => {
  it('adds a file to the selection and sets it as the anchor', () => {
    useLibraryStore.getState().toggleFileSelection(5)

    const state = useLibraryStore.getState()
    expect(state.selectedFileIds).toEqual(new Set([5]))
    expect(state.selectionAnchorId).toBe(5)
  })

  it('removes an already-selected file', () => {
    useLibraryStore.setState({ selectedFileIds: new Set([1, 5]) })

    useLibraryStore.getState().toggleFileSelection(5)

    expect(useLibraryStore.getState().selectedFileIds).toEqual(new Set([1]))
  })
})

describe('selectFileRange', () => {
  const orderedIds = [1, 2, 3, 4, 5]

  it('selects the contiguous range from the anchor to the target', () => {
    useLibraryStore.setState({ selectionAnchorId: 2 })

    useLibraryStore.getState().selectFileRange(orderedIds, 4)

    expect(useLibraryStore.getState().selectedFileIds).toEqual(new Set([2, 3, 4]))
  })

  it('keeps the anchor unchanged so repeated shift-clicks extend from the same start', () => {
    useLibraryStore.setState({ selectionAnchorId: 4 })

    useLibraryStore.getState().selectFileRange(orderedIds, 1)

    expect(useLibraryStore.getState().selectionAnchorId).toBe(4)
    expect(useLibraryStore.getState().selectedFileIds).toEqual(new Set([1, 2, 3, 4]))
  })
})

describe('clearFileSelection', () => {
  it('clears the multi-selection and anchor without touching `selection`', () => {
    useLibraryStore.setState({
      selection: { type: 'file', id: 1 },
      selectedFileIds: new Set([1, 2]),
      selectionAnchorId: 1
    })

    useLibraryStore.getState().clearFileSelection()

    const state = useLibraryStore.getState()
    expect(state.selectedFileIds).toEqual(new Set())
    expect(state.selectionAnchorId).toBeNull()
    expect(state.selection).toEqual({ type: 'file', id: 1 })
  })
})
