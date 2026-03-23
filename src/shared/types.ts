// macOS 支持的工具类型（移除 Windows 专有的 batch）
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
  workingDirectory?: string;   // 工作目录（app/url 类型不生效）
  categoryId: string;
  javaEnvId?: string;
  pythonEnvId?: string;
  icon?: string;               // base64 data URL，拖入 .app 时自动提取
  accentColor?: string;        // 颜色标签 hex（如 #0a84ff）
  lastUsed?: number;
  useCount: number;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  parentId?: string;    // 空 = 顶级分类，有值 = 子分类
  collapsed?: boolean;  // 顶级分类在侧边栏的折叠状态
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';  // system = 跟随 macOS 系统
  fontSize: 'small' | 'medium' | 'large';
  cardSize: 'small' | 'medium' | 'large';
  viewMode: 'grid' | 'list';            // 网格/列表切换
  sidebarWidth: number;                  // 侧边栏宽度，默认 220
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
  | 'get-file-icon'          // 提取文件图标（.app 等）
  | 'native-theme-changed';  // 系统主题变化推送
