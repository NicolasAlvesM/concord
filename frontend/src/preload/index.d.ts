import { ElectronAPI } from '@electron-toolkit/preload'

export interface ScreenSourceInfo {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
  displayId: string
}

export interface ScreenPickerApi {
  onShow(cb: () => void): () => void
  listSources(): Promise<ScreenSourceInfo[]>
  select(sourceId: string): void
  cancel(): void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api?: { screenPicker: ScreenPickerApi }
  }
}
