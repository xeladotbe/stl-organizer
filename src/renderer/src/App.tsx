import { useEffect } from 'react'
import { Tabs } from 'radix-ui'
import { useLibraryStore, type LibraryView } from './store/useLibraryStore'
import { FileList } from './components/FileList'
import { DuplicatesView } from './components/DuplicatesView'
import { DetailPane } from './components/DetailPane'

function App(): React.JSX.Element {
  const init = useLibraryStore((state) => state.init)
  const view = useLibraryStore((state) => state.view)
  const setView = useLibraryStore((state) => state.setView)
  const duplicateGroupCount = useLibraryStore(
    (state) => new Set(state.duplicates.map((file) => file.content_hash)).size
  )

  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="flex h-full bg-neutral-950 text-neutral-100">
      <Tabs.Root
        value={view}
        onValueChange={(next) => setView(next as LibraryView)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between gap-1 border-b border-neutral-800 px-4 pt-2">
          <Tabs.List className="flex gap-1">
            <Tabs.Trigger
              value="all"
              className="rounded-t px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-300 data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100"
            >
              All files
            </Tabs.Trigger>
            <Tabs.Trigger
              value="duplicates"
              className="rounded-t px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-300 data-[state=active]:bg-neutral-900 data-[state=active]:text-neutral-100"
            >
              Duplicates{duplicateGroupCount > 0 ? ` (${duplicateGroupCount})` : ''}
            </Tabs.Trigger>
          </Tabs.List>
          <button
            onClick={() => window.api.app.openFoldersWindow()}
            aria-label="Manage watched folders"
            title="Manage watched folders"
            className="mb-1 rounded px-2 py-1 text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
          >
            ⚙️
          </button>
        </div>
        {view === 'all' ? <FileList /> : <DuplicatesView />}
      </Tabs.Root>
      <DetailPane />
    </div>
  )
}

export default App
