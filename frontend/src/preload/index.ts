import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

interface ScreenSourceInfo {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
  displayId: string
}

// Custom APIs for renderer
const api = {
  screenPicker: {
    /** Main avisa que um pedido de getDisplayMedia está aguardando seleção. */
    onShow(cb: () => void): () => void {
      const listener = (): void => cb()
      ipcRenderer.on('screen-picker:show', listener)
      return () => ipcRenderer.removeListener('screen-picker:show', listener)
    },
    listSources(): Promise<ScreenSourceInfo[]> {
      return ipcRenderer.invoke('screen-picker:sources')
    },
    select(sourceId: string): void {
      ipcRenderer.send('screen-picker:select', sourceId)
    },
    cancel(): void {
      ipcRenderer.send('screen-picker:cancel')
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
