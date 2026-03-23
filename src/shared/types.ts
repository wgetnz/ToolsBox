// macOS 迁移后的工具类型，移除 Windows 专有 batch
export type ToolType = 'jar' | 'python' | 'shell' | 'executable' | 'app' | 'url';

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
  workingDirectory?: string;
  categoryId: string;
  javaEnvId?: string;
  pythonEnvId?: string;
  icon?: string;
  accentColor?: string;
  lastUsed?: number;
  useCount: number;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  parentId?: string;
  collapsed?: boolean;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  cardSize: 'small' | 'medium' | 'large';
  viewMode: 'grid' | 'list';
  sidebarWidth: number;
  hoverSwitchCategories: boolean;
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

export type IpcChannel =
  | 'launch-tool'
  | 'get-data'
  | 'save-tool'
  | 'delete-tool'
  | 'save-category'
  | 'delete-category'
  | 'save-settings'
  | 'get-settings'
  | 'select-file'
  | 'select-directory'
  | 'open-in-terminal'
  | 'show-in-finder'
  | 'minimize-window'
  | 'maximize-window'
  | 'close-window'
  | 'window-state'
  | 'get-file-icon'
  | 'native-theme-changed';
