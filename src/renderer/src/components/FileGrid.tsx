import { useLibraryStore } from '../store/useLibraryStore'
import { useVisibilityPriority } from '../hooks/useVisibilityPriority'
import { modelThumbnailUrl } from '@shared/modelFileUrl'
import type { FileRow } from '@shared/types'

export function FileGrid({ files }: { files: FileRow[] }): React.JSX.Element {
  const selectedFileId = useLibraryStore((state) => state.selectedFileId)
  const selectFile = useLibraryStore((state) => state.selectFile)
  const duplicateIds = useLibraryStore((state) => state.duplicateIds)
  const registerVisible = useVisibilityPriority()

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 p-4">
      {files.map((file) => (
        <button
          key={file.id}
          ref={registerVisible(file)}
          onClick={() => selectFile(file.id)}
          className={`flex flex-col items-center gap-2 rounded border p-2 text-left ${
            selectedFileId === file.id
              ? 'border-neutral-500 bg-neutral-900'
              : 'border-neutral-800 hover:bg-neutral-900'
          }`}
        >
          <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded bg-neutral-800">
            {file.thumbnail_status === 'done' ? (
              <img src={modelThumbnailUrl(file.id)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-neutral-600">{file.ext.toUpperCase()}</span>
            )}
            {duplicateIds.has(file.id) && (
              <span className="absolute right-1 top-1 rounded bg-amber-900/80 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-200">
                Dup
              </span>
            )}
          </div>
          <span className="line-clamp-2 w-full break-words text-center text-xs text-neutral-300">
            {file.filename}
          </span>
        </button>
      ))}
    </div>
  )
}
