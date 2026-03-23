# ToolsBox macOS 迁移方案

> 目标：将 Lily（Windows .NET 工具启动器）的核心设计迁移到 ToolsBox（Electron + React + TypeScript），
> 仅支持 macOS，UI 符合苹果设计规范（Human Interface Guidelines）。
>
> 基于对 ToolsBox 现有源码的完整分析撰写，所有改动均精确到文件和行为。

---

## 一、Lily 特性取舍（macOS 视角）

### 保留并迁移

| Lily 特性 | 现状（ToolsBox） | 迁移方案 |
|-----------|----------------|---------|
| 两级分类（主分类 + 子Tab） | 单级 Category | Category 新增 `parentId`，Sidebar 改为折叠树 |
| 工作目录（WorkingDirectory） | launcher.ts 未传 cwd | 补充 `workingDirectory` 字段，spawn 时传 cwd |
| 自定义颜色标签（ColorR/G/B） | `color` 字段存在但未用 | 改为 `accentColor`（hex），卡片左侧色条展示 |
| 多布局（IconMode / ListMode） | 仅网格 | 新增列表模式，工具栏切换按钮 |
| 图标提取（IconPath from .app） | icon 字段为手动输入 | IPC `get-file-icon` 拖入 .app 自动提取 |
| 拖拽添加工具 | 无 | ToolModal 支持拖入 .app 文件自动填充 |
| 备注/描述（Remarks） | `description` 字段已有 | 保留，无需改动 |
| 使用计数（RunCount） | `useCount` 已实现 | 保留 |
| 最近使用 | Sidebar 已展示 | 保留，样式优化 |
| 搜索 | 已有 | 保留 |

### 丢弃（Windows 独有，macOS 无对应）

- `Built` 类型（关机/重启/注销/注册表/计算器）→ macOS 无此需求
- `Control` 类型（.msc 控制面板）→ macOS 无
- `lnkFile`（.lnk 快捷方式）→ macOS 无
- `batch` 类型（.bat/.cmd）→ macOS 无（.sh 已有 shell 类型覆盖）
- `IsAdmin`（UAC 提权）→ macOS 机制不同，不迁移
- 全局热键注册（ShortcutKeys）→ 不迁移
- 皮肤系统（DSkin 10套皮肤）→ 改为跟随系统亮/暗模式

---

## 二、数据模型改动（src/shared/types.ts）

### 现有代码（需改动的部分）

```typescript
// 现有 ToolType - 移除 batch
export type ToolType = 'jar' | 'python' | 'shell' | 'executable' | 'app' | 'batch' | 'url';

// 现有 Category - 缺少 parentId
export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
}

// 现有 Tool - 缺少 workingDirectory / accentColor
export interface Tool {
  id: string; name: string; description: string;
  type: ToolType; path: string; args: string;
  categoryId: string; javaEnvId?: string; pythonEnvId?: string;
  icon?: string; color?: string;
  lastUsed?: number; useCount: number; createdAt: number;
}

// 现有 AppSettings - theme 仅 light/dark，缺少 viewMode / sidebarWidth
export interface AppSettings {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  cardSize: 'small' | 'medium' | 'large';
  backgroundColor?: string;
  javaEnvs: JavaEnv[]; pythonEnvs: PythonEnv[];
  startAtLogin: boolean; minimizeToTray: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number };
}

// 现有 IpcChannel - 缺少新频道
export type IpcChannel = 'launch-tool' | 'get-data' | ... ;
```

### 改动后（完整替换）

```typescript
// 移除 batch，仅保留 macOS 有意义的类型
export type ToolType = 'jar' | 'python' | 'shell' | 'executable' | 'app' | 'url';

export interface JavaEnv { id: string; name: string; path: string; }
export interface PythonEnv { id: string; name: string; path: string; }

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  path: string;
  args: string;
  workingDirectory?: string;   // 新增：工作目录
  categoryId: string;
  javaEnvId?: string;
  pythonEnvId?: string;
  icon?: string;               // base64，拖入 .app 时自动提取
  accentColor?: string;        // 新增：颜色标签 hex（替代 color 字段）
  lastUsed?: number;
  useCount: number;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  parentId?: string;    // 新增：空 = 顶级分类，有值 = 子分类
  collapsed?: boolean;  // 新增：顶级分类在侧边栏的折叠状态
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';   // 新增 system
  fontSize: 'small' | 'medium' | 'large';
  cardSize: 'small' | 'medium' | 'large';
  viewMode: 'grid' | 'list';             // 新增：网格/列表
  sidebarWidth: number;                   // 新增：侧边栏宽度，默认 220
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
  | 'launch-tool' | 'get-data' | 'save-tool' | 'delete-tool'
  | 'save-category' | 'delete-category' | 'save-settings'
  | 'select-file' | 'select-directory'
  | 'open-in-terminal' | 'show-in-finder'
  | 'window-state'
  | 'get-file-icon'            // 新增：提取文件图标
  | 'native-theme-changed';    // 新增：系统主题变化推送
```

---

## 三、主进程改动（src/main）

### 3.1 store.ts — 补充 defaults

```typescript
// 修改 defaultSettings，补充新字段
const defaultSettings: AppSettings = {
  theme: 'system',          // 改：跟随系统
  fontSize: 'medium',
  cardSize: 'medium',
  viewMode: 'grid',         // 新增
  sidebarWidth: 220,        // 新增
  javaEnvs: [],
  pythonEnvs: [],
  startAtLogin: false,
  minimizeToTray: true,
};

// loadData() 中 settings merge 时保持兼容
settings: {
  ...defaultSettings,       // 先铺默认值
  ...(data.settings ?? {}), // 再覆盖存量数据
}
```

### 3.2 launcher.ts — 完整 macOS 实现（全量替换）

现有 `buildCommand` 混合了 win/linux 分支。macOS 专版完整实现如下：

```typescript
import { spawn, exec } from 'child_process';
import * as path from 'path';
import { Tool, AppSettings } from '../shared/types';

function buildCommand(
  tool: Tool,
  settings: AppSettings
): { cmd: string; args: string[]; opts: object } {
  // workingDirectory 优先，其次取文件所在目录
  const cwd = tool.workingDirectory
    || (tool.path && !tool.path.startsWith('http') ? path.dirname(tool.path) : undefined);

  const extraArgs = tool.args
    ? tool.args.split(/\s+/).filter(Boolean)
    : [];

  switch (tool.type) {

    // ─── JAR ───────────────────────────────────────────────
    // java -jar /path/to/tool.jar [args]
    // Java 路径从环境配置取，回退到系统 java
    case 'jar': {
      let javaPath = 'java';
      if (tool.javaEnvId) {
        const jenv = settings.javaEnvs.find(j => j.id === tool.javaEnvId);
        if (jenv) javaPath = path.join(jenv.path, 'bin', 'java');
      }
      return {
        cmd: javaPath,
        args: ['-jar', tool.path, ...extraArgs],
        opts: { cwd },
      };
    }

    // ─── Python ────────────────────────────────────────────
    // python3 /path/to/script.py [args]
    // Python 路径从环境配置取，回退到系统 python3
    case 'python': {
      let pythonPath = 'python3';
      if (tool.pythonEnvId) {
        const penv = settings.pythonEnvs.find(p => p.id === tool.pythonEnvId);
        if (penv) pythonPath = path.join(penv.path, 'bin', 'python3');
      }
      return {
        cmd: pythonPath,
        args: [tool.path, ...extraArgs],
        opts: { cwd },
      };
    }

    // ─── Shell 脚本 ─────────────────────────────────────────
    // /bin/bash /path/to/script.sh [args]
    // 注意：脚本需要有执行权限，或通过 bash 解释器调用（无需 chmod +x）
    case 'shell': {
      return {
        cmd: '/bin/bash',
        args: [tool.path, ...extraArgs],
        opts: { cwd },
      };
    }

    // ─── macOS .app 包 ─────────────────────────────────────
    // open /path/to/App.app [--args arg1 arg2]
    // 使用系统 open 命令，macOS 负责找到正确的可执行文件
    // 支持传参：--args 后跟参数（注意：部分 App 不支持命令行参数）
    case 'app': {
      const openArgs = extraArgs.length > 0
        ? [tool.path, '--args', ...extraArgs]
        : [tool.path];
      // cwd 对 open 无意义，.app 内部进程 cwd 由 app 自身决定
      return { cmd: 'open', args: openArgs, opts: {} };
    }

    // ─── Unix 可执行文件（无扩展名的 binary）─────────────────
    // 直接执行，设置 cwd
    case 'executable': {
      return {
        cmd: tool.path,
        args: extraArgs,
        opts: { cwd },
      };
    }

    // ─── URL / 网页 ─────────────────────────────────────────
    // open "https://..." 或 open "file:///path/to/file.html"
    // macOS open 命令会用系统默认浏览器打开 https://
    // 用系统默认应用打开 file:// 路径（html → 浏览器，pdf → Preview 等）
    // 如果 path 不含协议头，自动补 https://
    case 'url': {
      let url = tool.path;
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
        url = 'https://' + url;
      }
      return { cmd: 'open', args: [url], opts: {} };
    }

    default:
      throw new Error(`Unsupported tool type on macOS: ${(tool as any).type}`);
  }
}

export function launchTool(tool: Tool, settings: AppSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const { cmd, args, opts } = buildCommand(tool, settings);
      console.log(`[Launch] ${cmd} ${args.join(' ')}`);

      const proc = spawn(cmd, args, {
        detached: true,
        stdio: 'ignore',
        ...(opts as object),
      });

      proc.on('error', reject);
      proc.unref();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// 在 Terminal.app 中打开指定目录
// 使用 AppleScript 驱动 Terminal.app，避免依赖第三方终端
export function openInTerminal(dirPath: string): void {
  const dir = path.isAbsolute(dirPath) ? dirPath : path.dirname(dirPath);
  // AppleScript：激活 Terminal 并执行 cd
  const script = `
    tell application "Terminal"
      activate
      if (count of windows) = 0 then
        do script "cd '${dir.replace(/'/g, "'\\''")}'"
      else
        do script "cd '${dir.replace(/'/g, "'\\''")}'" in front window
      end if
    end tell
  `;
  exec(`osascript -e '${script.replace(/\n/g, ' ')}'`);
}

// 在 Finder 中显示文件（选中状态）
export function showInFinder(filePath: string): void {
  exec(`open -R "${filePath.replace(/"/g, '\\"')}"`);
}
```

### 3.3 index.ts — 新增 IPC + 主题监听

在 `setupIPC()` 末尾追加，并修改 `createWindow()`：

```typescript
import { nativeTheme } from 'electron';

// setupIPC() 末尾追加：

// 提取文件图标（.app、可执行文件等）
// 返回 base64 data URL，渲染层直接用作 img src
ipcMain.handle('get-file-icon', async (_event, filePath: string) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.toDataURL();
  } catch {
    return null;
  }
});

// 系统主题变化时推送到渲染进程
nativeTheme.on('updated', () => {
  mainWindow?.webContents.send(
    'native-theme-changed',
    nativeTheme.shouldUseDarkColors
  );
});

// createWindow() 中修改 BrowserWindow 配置：
mainWindow = new BrowserWindow({
  width: windowBounds?.width ?? 1200,
  height: windowBounds?.height ?? 750,
  x: windowBounds?.x,
  y: windowBounds?.y,
  minWidth: 800,
  minHeight: 550,
  frame: false,
  titleBarStyle: 'hiddenInset',           // macOS 原生 traffic light 按钮
  trafficLightPosition: { x: 16, y: 16 },
  vibrancy: 'under-window',               // macOS 毛玻璃效果（去掉 backgroundColor）
  visualEffectState: 'active',            // 始终激活毛玻璃，不随焦点变暗
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js'),
  },
  show: false,
});
```

### 3.4 preload.ts — 暴露新 API

```typescript
const api = {
  // ...现有方法全部保留...

  // 新增：提取文件图标
  getFileIcon: (filePath: string) =>
    ipcRenderer.invoke('get-file-icon', filePath),

  // 新增：监听系统主题变化（返回取消监听的函数）
  onNativeThemeChanged: (cb: (isDark: boolean) => void) => {
    const handler = (_e: unknown, isDark: boolean) => cb(isDark);
    ipcRenderer.on('native-theme-changed', handler);
    return () => ipcRenderer.removeListener('native-theme-changed', handler);
  },
};
```

---

## 四、渲染层改动（src/renderer）

### 4.1 CSS 设计系统重写（styles/global.css）

**完整替换**：

```css
/* 字体：San Francisco（macOS 系统字体） */
:root {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text',
               'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  font-size: 14px;
}

/* === 暗色模式（默认） === */
body, body.dark {
  --bg-primary:      #1c1c1e;
  --bg-secondary:    rgba(44, 44, 46, 0.95);
  --bg-tertiary:     rgba(58, 58, 60, 0.8);
  --bg-glass:        rgba(30, 30, 32, 0.75);
  --bg-input:        rgba(255,255,255,0.08);
  --text-primary:    rgba(255,255,255,0.92);
  --text-secondary:  rgba(255,255,255,0.55);
  --text-muted:      rgba(255,255,255,0.28);
  --border-color:    rgba(255,255,255,0.08);
  --border-subtle:   rgba(255,255,255,0.04);
  --accent-color:    #0a84ff;   /* macOS 蓝 */
  --accent-hover:    #409cff;
  --shadow-sm:       0 1px 4px rgba(0,0,0,0.3);
  --shadow-md:       0 4px 16px rgba(0,0,0,0.4);
  --shadow-lg:       0 8px 32px rgba(0,0,0,0.5);
  --radius-sm:       6px;
  --radius-md:       10px;  /* macOS 标准圆角 */
  --radius-lg:       14px;
}

/* === 亮色模式 === */
body.light {
  --bg-primary:      #f2f2f7;
  --bg-secondary:    rgba(255,255,255,0.85);
  --bg-tertiary:     rgba(0,0,0,0.04);
  --bg-glass:        rgba(255,255,255,0.72);
  --bg-input:        rgba(0,0,0,0.06);
  --text-primary:    rgba(0,0,0,0.88);
  --text-secondary:  rgba(0,0,0,0.50);
  --text-muted:      rgba(0,0,0,0.28);
  --border-color:    rgba(0,0,0,0.08);
  --border-subtle:   rgba(0,0,0,0.04);
  --accent-color:    #007aff;
  --accent-hover:    #0066d6;
  --shadow-sm:       0 1px 4px rgba(0,0,0,0.08);
  --shadow-md:       0 4px 16px rgba(0,0,0,0.12);
  --shadow-lg:       0 8px 32px rgba(0,0,0,0.18);
}

/* === 基础重置 === */
* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  height: 100vh;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
}

#root {
  display: flex;
  flex-direction: column;
}

/* === 毛玻璃工具类 === */
.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid var(--border-color);
}

/* === 输入框 === */
.input {
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
}
.input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(10,132,255,0.15);
}

/* === 按钮 === */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.12s, transform 0.1s;
  font-family: inherit;
}
.btn:active { transform: scale(0.97); }
.btn-primary {
  background: var(--accent-color);
  color: #fff;
}
.btn-primary:hover { opacity: 0.88; }
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover { background: var(--bg-tertiary); }
.btn-danger {
  background: transparent;
  color: #ff453a;
}
.btn-danger:hover { background: rgba(255,69,58,0.1); }

/* === 工具卡片 === */
.tool-card {
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s;
  overflow: hidden;
  position: relative;
}
.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: rgba(255,255,255,0.14);
}
.tool-card:active { transform: scale(0.98); }

/* 颜色标签条 */
.tool-card-accent {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
}

/* === 列表行 === */
.tool-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s;
}
.tool-row:hover { background: var(--bg-tertiary); }
.tool-row:active { opacity: 0.7; }

/* === 侧边栏分类条目 === */
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.1s;
  color: var(--text-secondary);
}
.sidebar-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.sidebar-item.active {
  background: var(--accent-color);
  color: #fff;
  font-weight: 500;
}
.sidebar-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.1s;
}
.sidebar-group-header:hover { background: var(--bg-tertiary); }

/* === 右键菜单 === */
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  border-radius: var(--radius-md);
  padding: 4px;
  box-shadow: var(--shadow-lg);
}
.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.08s;
}
.context-menu-item:hover { background: var(--accent-color); color: #fff; }
.context-menu-item.danger { color: #ff453a; }
.context-menu-item.danger:hover { background: #ff453a; color: #fff; }
.context-menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

/* === Modal === */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  width: 520px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-lg);
}

/* === 空状态 === */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--text-muted);
  text-align: center;
}
.empty-icon { font-size: 48px; margin-bottom: 8px; opacity: 0.5; }
.empty-state h3 { font-size: 16px; font-weight: 500; color: var(--text-secondary); }
.empty-state p { font-size: 13px; }

/* === 滚动条（macOS 风格） === */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(128,128,128,0.3);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.5); }

/* === 类型标签徽章 === */
.type-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* === Toast === */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 18px;
  font-size: 13px;
  box-shadow: var(--shadow-md);
  z-index: 9999;
  animation: toast-in 0.2s ease;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

### 4.2 App.tsx — 主题系统改造

**改动**：监听系统主题 + 处理 `system` 主题设置

```typescript
// 替换现有 useEffect
useEffect(() => {
  if (!data) return;
  const { theme, fontSize } = data.settings;

  // 应用字体大小
  const fontSizeMap = { small: '12px', medium: '14px', large: '16px' };
  document.documentElement.style.fontSize = fontSizeMap[fontSize];

  // 应用主题
  const applyTheme = (isDark: boolean) => {
    document.body.className = isDark ? 'dark' : 'light';
  };

  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(isDark);
    // 监听系统主题变化（主进程推送）
    const cleanup = window.launchbox.onNativeThemeChanged(applyTheme);
    return cleanup;
  } else {
    applyTheme(theme === 'dark');
  }
}, [data?.settings.theme, data?.settings.fontSize]);
```

### 4.3 AppContext.tsx — 新增状态

在现有 Context 中追加：

```typescript
// 新增到 Context 类型
viewMode: 'grid' | 'list';
setViewMode: (mode: 'grid' | 'list') => void;

// 新增到 Provider state（从 settings 读取初始值）
const [viewMode, setViewMode] = useState<'grid' | 'list'>(
  data?.settings?.viewMode ?? 'grid'
);
```

### 4.4 Sidebar.tsx — 两级分类树

**完整改动逻辑**：

```
渲染结构：
  1. 搜索框（不变）
  2. 分类树：
     - 过滤出顶级分类（parentId 为空），按 order 排序
     - 每个顶级分类渲染为 GroupHeader（带折叠 chevron）
     - 非折叠时，渲染该顶级分类下的子分类（CategoryItem，带计数）
     - 特殊：id='all' 的"全部工具"始终置顶，单独渲染
  3. 添加分类按钮（+ 新建分类，支持选择父分类）
  4. 最近使用列表（不变）
  5. 侧边栏可拖拽宽度边界线
```

**关键代码结构**：

```typescript
// 分组逻辑
const topCategories = categories
  .filter(c => !c.parentId && c.id !== 'all')
  .sort((a, b) => a.order - b.order);

const childrenOf = (parentId: string) =>
  categories
    .filter(c => c.parentId === parentId)
    .sort((a, b) => a.order - b.order);

// 折叠状态（本地 state，不持久化）
const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

// 点击顶级分类：切换折叠
const toggleGroup = (id: string) =>
  setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

// 点击子分类：过滤工具
// selectCategory(subCategoryId) 不变

// 侧边栏宽度拖拽
const [width, setWidth] = useState(settings.sidebarWidth ?? 220);
// onMouseDown 在分隔线上开始拖拽，mousemove 更新 width，mouseup 保存到 settings
```

**侧边栏 UI 结构**（伪代码）：

```tsx
<div style={{ width }}>

  {/* 全部工具 - 置顶 */}
  <CategoryItem category={allCat} selected={selectedId === 'all'} />

  {/* 顶级分类树 */}
  {topCategories.map(group => (
    <div key={group.id}>
      <GroupHeader
        group={group}
        collapsed={collapsed[group.id]}
        onToggle={() => toggleGroup(group.id)}
        onEdit={() => openEditModal(group)}
      />
      {!collapsed[group.id] && childrenOf(group.id).map(child => (
        <CategoryItem
          key={child.id}
          category={child}
          count={getCount(child.id)}
          selected={selectedId === child.id}
          indent          // 左侧缩进
          onEdit={() => openEditModal(child)}
        />
      ))}
    </div>
  ))}

  {/* 拖拽分隔线 */}
  <div className="sidebar-resize-handle" onMouseDown={startResize} />
</div>
```

### 4.5 MainContent.tsx — 网格/列表切换

**改动**：

1. 从 `useApp()` 获取 `viewMode`
2. 工具栏右侧新增两个图标按钮（grid / list）
3. 渲染区域根据 `viewMode` 切换：

```tsx
{viewMode === 'grid' ? (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: ... }}>
    {filtered.map(tool => <ToolCard key={tool.id} tool={tool} size={cardSize} onEdit={...} />)}
  </div>
) : (
  <div>
    {filtered.map(tool => <ToolRow key={tool.id} tool={tool} onEdit={...} />)}
  </div>
)}
```

**新增 ToolRow 组件**（放在 ToolCard.tsx 或独立文件）：

```tsx
// 列表行：高度固定 52px
// 布局：图标(32px) | 名称+描述 | 类型徽章 | 使用次数 | 最近使用时间
function ToolRow({ tool, onEdit }) {
  return (
    <div className="tool-row" onDoubleClick={() => launchTool(tool.id)} onContextMenu={...}>
      <div style={{ width: 32, height: 32, flexShrink: 0 }}>
        {tool.icon
          ? <img src={tool.icon} width={32} height={32} style={{ borderRadius: 7 }} />
          : <span style={{ fontSize: 20 }}>{getTypeIcon(tool.type)}</span>
        }
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{tool.name}</div>
        {tool.description && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tool.description}
          </div>
        )}
      </div>
      <span className="type-badge">{tool.type}</span>
      {tool.useCount > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tool.useCount}次</span>}
      {tool.lastUsed && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatRelativeTime(tool.lastUsed)}</span>}
    </div>
  );
}
```

### 4.6 ToolCard.tsx — macOS 风格重写

**现有代码问题**：大量 inline style，没有利用 CSS 变量，hover 效果硬编码。

**改动后**：

1. 使用 `className="tool-card"` + CSS 变量，去除 inline hover 逻辑
2. 左侧颜色标签：`tool.accentColor` → `<div className="tool-card-accent" style={{ background: tool.accentColor }} />`
3. 图标：优先渲染 `tool.icon`（base64），回退到类型 emoji
4. 右键菜单替换为原生风格（`className="context-menu glass"`）
5. 双击启动（现有）保留

```tsx
// 卡片结构
<div className="tool-card" onDoubleClick={launch} onContextMenu={openMenu}>
  {tool.accentColor && <div className="tool-card-accent" style={{ background: tool.accentColor }} />}
  <div style={{ padding: '14px 14px 14px 18px' }}>   {/* 左侧留出色条空间 */}
    {/* 图标 */}
    <div style={{ width: iconSize, height: iconSize, marginBottom: 8 }}>
      {tool.icon
        ? <img src={tool.icon} style={{ width: '100%', borderRadius: 8 }} />
        : <span style={{ fontSize: iconSize * 0.6 }}>{getTypeIcon(tool.type)}</span>
      }
    </div>
    {/* 名称 */}
    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{tool.name}</div>
    {/* 描述 */}
    {tool.description && (
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {tool.description}
      </div>
    )}
    {/* 底部：类型 + 使用次数 */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
      <span className="type-badge">{tool.type}</span>
      {tool.useCount > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tool.useCount}次</span>}
    </div>
  </div>
</div>
```

### 4.7 ToolModal.tsx — 新增字段 + 拖拽添加

**新增 UI 元素**：

1. **工作目录**：文件夹选择器（已有 `select-directory` IPC）
2. **颜色标签**：6个色块 + 无色（点选）

```tsx
// 颜色标签 UI
const ACCENT_COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#ff375f'];

<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
  {/* 无色 */}
  <div
    onClick={() => setForm(f => ({ ...f, accentColor: undefined }))}
    style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid var(--border-color)', cursor: 'pointer' }}
  />
  {ACCENT_COLORS.map(c => (
    <div
      key={c}
      onClick={() => setForm(f => ({ ...f, accentColor: c }))}
      style={{
        width: 20, height: 20, borderRadius: '50%',
        background: c, cursor: 'pointer',
        outline: form.accentColor === c ? '2px solid var(--accent-color)' : 'none',
        outlineOffset: 2,
      }}
    />
  ))}
</div>
```

3. **拖入 .app 自动填充**：

```tsx
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  const filePath = e.dataTransfer.files[0]?.path;
  if (!filePath) return;

  // 提取名称（去掉 .app 后缀）
  const name = path.basename(filePath).replace(/\.app$/, '');
  // 推断类型
  const type: ToolType = filePath.endsWith('.app') ? 'app'
    : filePath.endsWith('.sh') ? 'shell'
    : filePath.endsWith('.jar') ? 'jar'
    : filePath.endsWith('.py') ? 'python'
    : 'executable';
  // 提取图标
  const icon = await window.launchbox.getFileIcon(filePath);

  setForm(f => ({ ...f, name, path: filePath, type, icon: icon ?? undefined }));
};

// 在 Modal 根 div 上绑定
<div className="modal-overlay" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
```

### 4.8 CategoryModal.tsx — 支持选择父分类

新增一个 Select 下拉，让用户选择"父分类"（空 = 顶级）：

```tsx
<label>父分类（可选）</label>
<select
  value={form.parentId ?? ''}
  onChange={e => setForm(f => ({ ...f, parentId: e.target.value || undefined }))}
  className="input"
>
  <option value="">— 顶级分类 —</option>
  {topCategories.map(c => (
    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
  ))}
</select>
```

### 4.9 SettingsPanel.tsx — 新增设置项

在现有设置基础上追加：

```
主题：  ○ 跟随系统  ○ 深色  ○ 浅色
默认视图：  ○ 网格  ○ 列表
```

---

## 五、数据导入脚本（scripts/import-lily.mjs）

将 Lily 的 `data.json` 转换为 ToolsBox 格式，用于一次性数据迁移：

```javascript
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { basename, extname } from 'path';

const lilyData = JSON.parse(readFileSync('data.json', 'utf-8'));

const tools = [];
const categories = [];
let order = 0;

for (const mainType of lilyData.mainType) {
  // 顶级分类
  const groupId = randomUUID();
  categories.push({
    id: groupId,
    name: mainType.Name,
    icon: '📁',
    order: order++ * 100,
    parentId: undefined,
  });

  for (const tab of mainType.TabData) {
    // 子分类
    const tabId = randomUUID();
    categories.push({
      id: tabId,
      name: tab.Name,
      icon: '📂',
      order: order++,
      parentId: groupId,
    });

    for (const item of tab.ItemData) {
      // 类型映射（macOS 视角）
      const ext = extname(item.TargetPath).toLowerCase();
      let type;
      if (item.ItemType === 'Built' || item.ItemType === 'Control') continue; // 跳过
      if (item.ItemType === 'lnkFile') continue; // 跳过
      if (ext === '.exe' || ext === '.bat' || ext === '.cmd') continue; // 跳过 Windows
      if (ext === '.app' || item.ItemType === 'exeFile') type = 'app';
      else if (ext === '.jar') type = 'jar';
      else if (ext === '.py') type = 'python';
      else if (ext === '.sh') type = 'shell';
      else if (ext === '.html') type = 'url';
      else if (item.TargetPath.startsWith('http')) type = 'url';
      else continue; // 无法识别的跳过

      tools.push({
        id: randomUUID(),
        name: item.Name,
        description: item.Remarks || '',
        type,
        path: type === 'url' && !item.TargetPath.startsWith('http')
          ? `file://${item.TargetPath}`
          : item.TargetPath,
        args: item.Parameter || '',
        workingDirectory: item.WorkingDirectory || undefined,
        categoryId: tabId,
        accentColor: undefined,
        useCount: item.RunCount || 0,
        lastUsed: undefined,
        createdAt: Date.now(),
      });
    }
  }
}

const output = {
  tools,
  categories: [
    { id: 'all', name: '全部工具', icon: '🔧', order: -1 },
    ...categories,
  ],
  settings: {
    theme: 'system',
    fontSize: 'medium',
    cardSize: 'medium',
    viewMode: 'grid',
    sidebarWidth: 220,
    javaEnvs: [],
    pythonEnvs: [],
    startAtLogin: false,
    minimizeToTray: true,
  },
};

writeFileSync('toolsbox-data.json', JSON.stringify(output, null, 2));
console.log(`导出完成：${tools.length} 个工具，${categories.length} 个分类`);
```

运行方式：
```bash
node scripts/import-lily.mjs
# 生成 toolsbox-data.json
# 复制到 ~/Library/Application Support/launchbox/launchbox-data.json
```

---

## 六、实施顺序

### Phase 1 — 类型与数据层（1天）
1. `src/shared/types.ts` 全量替换
2. `src/main/store.ts` 补充 defaults（viewMode、sidebarWidth、theme:system）
3. `src/main/launcher.ts` 简化为仅 macOS 分支，补充 workingDirectory
4. `src/main/index.ts` 新增 get-file-icon IPC、nativeTheme 监听、vibrancy
5. `src/main/preload.ts` 暴露 getFileIcon、onNativeThemeChanged

### Phase 2 — 设计系统（半天）
6. `src/renderer/styles/global.css` 全量替换为 macOS 设计系统

### Phase 3 — 主题与状态（半天）
7. `src/renderer/App.tsx` 主题监听改造
8. `src/renderer/store/AppContext.tsx` 新增 viewMode

### Phase 4 — 分类体系（1天）
9. `src/renderer/components/Sidebar.tsx` 两级分类树 + 折叠 + 宽度拖拽
10. `src/renderer/components/CategoryModal.tsx` 父分类选择器

### Phase 5 — 工具展示（1天）
11. `src/renderer/components/ToolCard.tsx` macOS 样式 + 颜色标签 + 图标
12. `src/renderer/components/MainContent.tsx` 列表/网格切换 + ToolRow
13. `src/renderer/components/ToolModal.tsx` 工作目录 + 颜色标签 + 拖拽添加

### Phase 6 — 设置与收尾（半天）
14. `src/renderer/components/SettingsPanel.tsx` 新增主题/视图设置
15. `scripts/import-lily.mjs` 数据迁移脚本

**总计：约 5 天**

---

## 七、改动文件汇总

| 文件 | 类型 | 核心改动 |
|------|------|---------|
| `src/shared/types.ts` | 重写 | 移除 batch，新增 parentId/workingDirectory/accentColor/viewMode/sidebarWidth/system theme |
| `src/main/store.ts` | 修改 | defaultSettings 补充新字段 |
| `src/main/launcher.ts` | 修改 | 仅保留 macOS 分支，补充 workingDirectory cwd |
| `src/main/index.ts` | 修改 | get-file-icon IPC，nativeTheme 推送，vibrancy |
| `src/main/preload.ts` | 修改 | 暴露 getFileIcon、onNativeThemeChanged |
| `src/renderer/styles/global.css` | 重写 | macOS 完整设计系统 |
| `src/renderer/App.tsx` | 修改 | system 主题监听 |
| `src/renderer/store/AppContext.tsx` | 修改 | viewMode 状态 |
| `src/renderer/components/Sidebar.tsx` | 重写 | 两级折叠树，可拖拽宽度 |
| `src/renderer/components/CategoryModal.tsx` | 修改 | 父分类选择器 |
| `src/renderer/components/ToolCard.tsx` | 重写 | macOS 样式，颜色标签，图标 |
| `src/renderer/components/MainContent.tsx` | 修改 | 网格/列表切换 |
| `src/renderer/components/ToolModal.tsx` | 修改 | 工作目录，颜色标签，拖拽 .app |
| `src/renderer/components/SettingsPanel.tsx` | 修改 | 主题/视图新选项 |
| `scripts/import-lily.mjs` | 新建 | Lily data.json 一次性迁移脚本 |

---

## 八、macOS 兼容性全面核对

### 8.1 各工具类型启动方式核对

| 类型 | 启动命令 | 注意事项 |
|------|---------|---------|
| `app` | `open /path/to/App.app [--args ...]` | macOS 标准方式，Gatekeeper 兼容；传参需用 `--args`，不是所有 App 都响应命令行参数 |
| `executable` | 直接执行 binary path | 需要文件有执行权限（`chmod +x`）；首次运行会被 Gatekeeper 拦截，用户需在系统偏好设置放行 |
| `shell` | `/bin/bash script.sh` | 不需要 `chmod +x`，bash 直接解释执行；如果脚本用了 `#!/usr/bin/env zsh` 等 shebang，仍建议用 bash 调用（兼容性更好）；注意 macOS 默认 shell 已换为 zsh，脚本语法需兼容 |
| `jar` | `java -jar xxx.jar` | Java 需已安装（JRE/JDK）；如用环境配置，路径格式为 `/Library/Java/JavaVirtualMachines/xxx/Contents/Home` |
| `python` | `python3 script.py` | macOS 13+ 已不预装 python2，python3 需通过 Homebrew/Xcode CLT 安装；路径格式如 `/opt/homebrew/bin/python3` |
| `url`（http/https） | `open "https://..."` | 用系统默认浏览器打开，无需指定浏览器 |
| `url`（file://） | `open "file:///path/to/file.html"` | 用系统默认应用打开：html→浏览器，pdf→Preview，图片→Preview 等 |
| `url`（无协议） | 自动补 `https://` 后 `open` | 方案已处理：`if (!url.startsWith('http...') && !url.startsWith('file://')) url = 'https://' + url` |

### 8.2 工作目录（cwd）行为核对

| 类型 | cwd 是否生效 | 说明 |
|------|------------|------|
| `app` | **否** | `open` 命令不支持 cwd，.app 的工作目录由 app 内部决定，通常是 `~` 或 app bundle 内 |
| `executable` | **是** | spawn 的 cwd 参数直接设置子进程工作目录 |
| `shell` | **是** | bash 继承 cwd |
| `jar` | **是** | java 进程继承 cwd |
| `python` | **是** | python3 进程继承 cwd |
| `url` | **否** | open 命令不需要 cwd |

> `workingDirectory` 对 `app` 和 `url` 类型无意义，ToolModal 中这两种类型的工作目录输入框应隐藏。

### 8.3 图标提取（app.getFileIcon）兼容性

- `.app` 包：直接传路径，返回应用图标（通常 512×512）
- Unix 可执行文件：返回通用系统图标（没有自定义图标时）
- `.sh` / `.py` / `.jar`：返回对应文件类型的系统图标（不是程序图标）
- **限制**：`getFileIcon` 是异步的，且需要文件实际存在

```typescript
// 建议：拖入文件时提取一次，存为 base64 缓存到 tool.icon
// 不要在每次渲染时实时调用
const icon = await window.launchbox.getFileIcon(filePath);
// icon 为 data:image/png;base64,... 或 null（失败时）
```

### 8.4 Terminal 打开（openInTerminal）核对

方案使用 AppleScript 驱动 Terminal.app，覆盖场景：
- 无 Terminal 窗口时：新建窗口并 cd
- 已有 Terminal 窗口时：在前台窗口执行 cd

**边界情况**：
- 用户默认终端是 iTerm2：AppleScript 目标改为 `"iTerm"` 即可，但检测用户终端偏好复杂
- 方案选择：**固定使用 Terminal.app**，简单可靠，不做终端适配。如需 iTerm2 支持，在设置中加"首选终端"选项（Phase 6+ 扩展）

### 8.5 Finder 显示（showInFinder）核对

`open -R "/path/to/file"` 在 macOS 上打开 Finder 并选中目标文件，行为与 Windows `explorer /select` 等价，无兼容问题。

### 8.6 macOS 安全机制影响

| 场景 | 影响 | 解决 |
|------|------|------|
| 首次运行未签名 .app | Gatekeeper 弹框阻止 | 用户在"系统偏好设置→安全与隐私"点击"仍要打开"，一次性放行 |
| 首次运行 Unix executable | 同上 | 同上；或右键→打开 |
| shell 脚本访问磁盘/网络 | 沙盒无影响（Electron 应用非沙盒） | 无需处理 |
| Electron app 本身签名 | 影响分发，不影响开发阶段运行 | 分发时用 electron-builder 配置代码签名 |

### 8.7 窗口 vibrancy 兼容性

`vibrancy: 'under-window'` 在 macOS 10.14+（Mojave）支持，效果为磨砂玻璃。
`visualEffectState: 'active'` 确保失焦时毛玻璃不变暗。

CSS 中 `.glass` 的 `backdrop-filter` 是渲染层的毛玻璃，与 vibrancy 叠加使用时，**需将窗口背景设为透明或半透明**：

```typescript
// index.ts createWindow()
backgroundColor: 'rgba(0,0,0,0)',  // 透明背景（配合 vibrancy）
transparent: true,                  // 如需完全透明窗口边框
```

> **注意**：`transparent: true` 会禁用部分 Electron 窗口功能（如 resize 边框变难点击），权衡后可只用 `vibrancy` 不设 `transparent`。

### 8.8 electron-builder macOS 打包配置

```json
// package.json 中 build 字段
"mac": {
  "category": "public.app-category.developer-tools",
  "icon": "assets/icon.icns",
  "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }],
  "hardenedRuntime": true,         // 公证要求
  "gatekeeperAssess": false,       // 本地开发不验证
  "entitlements": "entitlements.mac.plist",
  "entitlementsInherit": "entitlements.mac.plist"
}
```

`entitlements.mac.plist` 需要包含：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <!-- 如需启动其他应用 -->
  <key>com.apple.security.automation.apple-events</key><true/>
</dict>
</plist>
```

### 8.9 Tray 图标 macOS 适配

macOS Tray 图标需为 template image（黑白，系统自动适配深/浅色）：

```typescript
// index.ts createTray()
const trayIcon = nativeImage
  .createFromPath(path.join(app.getAppPath(), 'assets', 'tray-icon.png'))
  .resize({ width: 16, height: 16 });  // macOS menu bar 标准 16×16
trayIcon.setTemplateImage(true);        // 标记为 template，系统自动变色
```

### 8.10 登录启动（startAtLogin）

现有代码已正确使用 `app.setLoginItemSettings`，macOS 适配无需改动。
`openAtLogin` 在 macOS 上对应"登录项"（System Preferences → Users & Groups → Login Items）。

---
