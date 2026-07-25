import { EventEmitter } from 'events'

/** Shared bus for main-process modules (watcher, hash queue, ...) to notify the IPC layer of library changes. */
class AppEvents extends EventEmitter {}

export const appEvents = new AppEvents()
