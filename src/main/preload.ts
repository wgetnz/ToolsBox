import { contextBridge, ipcRenderer } from 'electron';
import { Tool, Category, AppSettings } from '../shared/types';

const api = {
  getData: () => ipcRenderer.invoke('get-data'),
  saveTool: (tool: Tool) => ipcRenderer.invoke('save-tool', tool),
  deleteTool: (toolId: string) => ipcRenderer.invoke('delete-tool', toolId),
  saveCategory: (category: Category) => ipcRenderer.invoke('save-category', category),
  deleteCategory: (categoryId: string) => ipcRenderer.invoke('delete-category', categoryId),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
  launchTool: (toolId: string) => ipcRenderer.invoke('launch-tool', toolId),
  selectFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('select-file', filters),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openInTerminal: (dirPath: string) => ipcRenderer.invoke('open-in-terminal', dirPath),
  showInFinder: (filePath: string) => ipcRenderer.invoke('show-in-finder', filePath),
  windowControl: (action: 'minimize' | 'maximize' | 'close') =>
    ipcRenderer.invoke('window-state', action),

  // 新增：提取文件图标（返回 base64 data URL 或 null）
  getFileIcon: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('get-file-icon', filePath),

  // 新增：监听系统主题变化，返回取消监听的函数
  onNativeThemeChanged: (cb: (isDark: boolean) => void): (() => void) => {
    const handler = (_e: unknown, isDark: boolean) => cb(isDark);
    ipcRenderer.on('native-theme-changed', handler);
    return () => ipcRenderer.removeListener('native-theme-changed', handler);
  },
};

contextBridge.exposeInMainWorld('launchbox', api);
