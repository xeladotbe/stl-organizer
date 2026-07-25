import { useEffect } from 'react'
import { useLibraryStore } from './store/useLibraryStore'
import { FolderSidebar } from './components/FolderSidebar'
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
      <FolderSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex gap-1 border-b border-neutral-800 px-4 pt-2">
          <button
            onClick={() => setView('all')}
            className={`rounded-t px-3 py-1.5 text-sm ${
              view === 'all'
                ? 'bg-neutral-900 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            All files
          </button>
          <button
            onClick={() => setView('duplicates')}
            className={`rounded-t px-3 py-1.5 text-sm ${
              view === 'duplicates'
                ? 'bg-neutral-900 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Duplicates{duplicateGroupCount > 0 ? ` (${duplicateGroupCount})` : ''}
          </button>
        </div>
        {view === 'all' ? <FileList /> : <DuplicatesView />}
      </div>
      <DetailPane />
    </div>
  )
}

export default App
