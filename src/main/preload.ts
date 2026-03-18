import { contextBridge, ipcRenderer } from 'electron';
import { Tool, Category, AppSettings } from '../shared/types';

const api = {
  getData: () => ipcRenderer.invoke('get-data'),
  getAppLibrary: () => ipcRenderer.invoke('get-app-library'),
  saveTool: (tool: Tool) => ipcRenderer.invoke('save-tool', tool),
  deleteTool: (toolId: string) => ipcRenderer.invoke('delete-tool', toolId),
  deleteTools: (toolIds: string[]) => ipcRenderer.invoke('delete-tools', toolIds),
  saveCategory: (category: Category) => ipcRenderer.invoke('save-category', category),
  deleteCategory: (categoryId: string) => ipcRenderer.invoke('delete-category', categoryId),
  moveToolsToCategory: (toolIds: string[], categoryId: string) =>
    ipcRenderer.invoke('move-tools-to-category', toolIds, categoryId),
  updateToolsColor: (toolIds: string[], color: string) =>
    ipcRenderer.invoke('update-tools-color', toolIds, color),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
  launchTool: (toolId: string) => ipcRenderer.invoke('launch-tool', toolId),
  selectFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('select-file', filters),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openInTerminal: (dirPath: string) => ipcRenderer.invoke('open-in-terminal', dirPath),
  showInFinder: (filePath: string) => ipcRenderer.invoke('show-in-finder', filePath),
  windowControl: (action: 'minimize' | 'maximize' | 'close') =>
    ipcRenderer.invoke('window-state', action),
};

contextBridge.exposeInMainWorld('launchbox', api);
