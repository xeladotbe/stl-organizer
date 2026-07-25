/** File ids currently visible on screen in the renderer — hash/thumbnail sweeps process these first, falling back to background order when none are eligible. */
let priorityFileIds: number[] = []

export function setPriorityFileIds(ids: number[]): void {
  priorityFileIds = ids
}

export function getPriorityFileIds(): number[] {
  return priorityFileIds
}
