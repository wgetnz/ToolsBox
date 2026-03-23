import { contextBridge, ipcRenderer } from 'electron';
import { Tool, Category, AppSettings } from '../shared/types';

const api = {
  getData: () => ipcRenderer.invoke('get-data'),
  saveTool: (tool: Tool) => ipcRenderer.invoke('save-tool', tool),
  saveToolsOrder: (orderedTools: Array<Pick<Tool, 'id' | 'customOrder'>>) => ipcRenderer.invoke('save-tools-order', orderedTools),
  deleteTool: (toolId: string) => ipcRenderer.invoke('delete-tool', toolId),
  saveCategory: (category: Category) => ipcRenderer.invoke('save-category', category),
  deleteCategory: (categoryId: string) => ipcRenderer.invoke('delete-category', categoryId),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
  createBackup: (preferredDirectory?: string) => ipcRenderer.invoke('create-backup', preferredDirectory),
  listBackups: (preferredDirectory?: string) => ipcRenderer.invoke('list-backups', preferredDirectory),
  deleteBackup: (backupPath: string) => ipcRenderer.invoke('delete-backup', backupPath),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  restoreBackup: (backupPath: string) => ipcRenderer.invoke('restore-backup', backupPath),
  launchTool: (toolId: string) => ipcRenderer.invoke('launch-tool', toolId),
  selectFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('select-file', filters),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openInTerminal: (dirPath: string) => ipcRenderer.invoke('open-in-terminal', dirPath),
  showInFinder: (filePath: string) => ipcRenderer.invoke('show-in-finder', filePath),
  windowControl: (action: 'minimize' | 'maximize' | 'close') =>
    ipcRenderer.invoke('window-state', action),
  getFileIcon: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('get-file-icon', filePath),
  importInstalledApps: () => ipcRenderer.invoke('import-installed-apps'),
  loadImageDataUrl: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('load-image-data-url', filePath),
  onNativeThemeChanged: (cb: (isDark: boolean) => void): (() => void) => {
    const handler = (_event: unknown, isDark: boolean) => cb(isDark);
    ipcRenderer.on('native-theme-changed', handler);
    return () => ipcRenderer.removeListener('native-theme-changed', handler);
  },
  onOpenSettingsRequested: (cb: () => void): (() => void) => {
    const handler = () => cb();
    ipcRenderer.on('open-settings', handler);
    return () => ipcRenderer.removeListener('open-settings', handler);
  },
};

contextBridge.exposeInMainWorld('launchbox', api);
