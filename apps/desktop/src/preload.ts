import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('__cs2Bridge', {
  rpc: (route: string, params: unknown): Promise<unknown> =>
    ipcRenderer.invoke('rpc', route, params),

  on: (channel: string, cb: (msg: unknown) => void): (() => void) => {
    const listener = (_event: unknown, msg: unknown) => cb(msg);
    ipcRenderer.on(`channel:${channel}`, listener);
    return () => ipcRenderer.removeListener(`channel:${channel}`, listener);
  },

  assetUrl: (kind: string, id: string): string =>
    `app://cs2/assets/${kind === 'overlay' ? 'radar' : kind}/${id}`,

  pathForFile: (file: File): string | null => {
    try {
      return webUtils.getPathForFile(file) || null;
    } catch {
      return null;
    }
  },

  pickDemos: (): Promise<string[]> => ipcRenderer.invoke('pick-demos'),

  saveFile: (suggestedName: string, data: ArrayBuffer): Promise<boolean> =>
    ipcRenderer.invoke('save-file', suggestedName, data),
});
