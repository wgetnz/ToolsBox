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

export type AiProviderType = 'openai' | 'claude';

export interface AiSettings {
  enabled: boolean;
  forceOverwrite: boolean;
  provider: AiProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
}

export type BackupMode = 'interval' | 'daily' | 'weekly';

export interface BackupSettings {
  enabled: boolean;
  directory: string;
  keepCount: number;
  mode: BackupMode;
  intervalHours: number;
  dailyTime: string;
  weeklyDay: number;
  weeklyTime: string;
  lastBackupAt?: number;
}

export interface BackupEntry {
  path: string;
  fileName: string;
  createdAt: number;
  size: number;
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
  iconSource?: 'default' | 'custom';
  customOrder?: number;
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
  searchScope: 'all' | 'current';
  sidebarWidth: number;
  hoverSwitchCategories: boolean;
  javaEnvs: JavaEnv[];
  pythonEnvs: PythonEnv[];
  ai: AiSettings;
  backup: BackupSettings;
  startAtLogin: boolean;
  minimizeToTray: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number };
}

export interface AppData {
  tools: Tool[];
  categories: Category[];
  settings: AppSettings;
}

export interface ImportInstalledAppsResult {
  tools: Tool[];
  categories: Category[];
  added: number;
  skipped: number;
}

export interface BackupResult {
  path: string;
  createdAt: number;
}

export interface ClearAllDataResult {
  data: AppData;
  backup?: BackupResult;
}

export interface RestoreBackupResult {
  data: AppData;
  restoredFrom: string;
  backup?: BackupResult;
}

export interface DeleteBackupResult {
  deletedPath: string;
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
  | 'import-installed-apps'
  | 'load-image-data-url'
  | 'create-backup'
  | 'list-backups'
  | 'delete-backup'
  | 'clear-all-data'
  | 'restore-backup'
  | 'native-theme-changed';
