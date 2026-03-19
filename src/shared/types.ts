export type ToolType = 'jar' | 'python' | 'shell' | 'executable' | 'app' | 'batch' | 'url';

export interface JavaEnv {
  id: string;
  name: string;
  path: string;
}

export interface PythonEnv {
  id: string;
  name: string;
  path: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  path: string;
  args: string;
  categoryId: string;
  javaEnvId?: string;
  pythonEnvId?: string;
  icon?: string;
  color?: string;
  lastUsed?: number;
  useCount: number;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  cardSize: 'small' | 'medium' | 'large';
  backgroundColor?: string;
  hoverSwitchCategories: boolean;
  showRecentTools: boolean;
  javaEnvs: JavaEnv[];
  pythonEnvs: PythonEnv[];
  startAtLogin: boolean;
  minimizeToTray: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number };
}

export interface AppData {
  tools: Tool[];
  categories: Category[];
  settings: AppSettings;
}

export interface AppLibraryEntry {
  id: string;
  name: string;
  path: string;
  icon?: string;
}

export type IpcChannel =
  | 'launch-tool'
  | 'get-data'
  | 'get-app-library'
  | 'save-tool'
  | 'delete-tool'
  | 'delete-tools'
  | 'save-category'
  | 'delete-category'
  | 'move-tools-to-category'
  | 'update-tools-color'
  | 'save-settings'
  | 'get-settings'
  | 'select-file'
  | 'select-directory'
  | 'open-in-terminal'
  | 'show-in-finder'
  | 'minimize-window'
  | 'maximize-window'
  | 'close-window'
  | 'window-state';
