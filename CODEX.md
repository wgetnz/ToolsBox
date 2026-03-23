# LaunchBox — Codex 协作指南

> 这是一份活文档，记录项目的背景、架构决策、当前状态和修改规范，供 Codex 在每次任务开始前阅读。

---

## 一、项目背景

### 来源

这个项目起源于 **Lily**，一个 Windows .NET 工具启动器，用于管理和一键启动渗透测试工具（jar、python 脚本、shell、可执行文件、URL 等）。

Lily 的数据结构是三层：`mainType → TabData → ItemData`，有 DSkin 皮肤系统、UAC 提权、批处理、.lnk 快捷方式、全局热键等大量 Windows 专有能力。

**ToolsBox（即这个项目）** 是 Lily 的 macOS 重生版：

- 平台：**仅 macOS**，不考虑 Windows/Linux
- 技术栈：**Electron 41 + React 19 + TypeScript 5 + Webpack**
- 定位：本地工具启动器，面向安全研究人员
- 设计参考：Rolan（macOS 启动器），但不机械照搬

### 迁移已完成的部分

以下 Windows 特性已被**永久删除**，不要在任何地方复原：

- `batch` 工具类型（.bat/.cmd）→ 用 `shell` 覆盖
- `Built` 类型（关机/重启/注册表等系统操作）
- `Control` 类型（.msc 控制面板）
- `lnkFile` 类型（.lnk 快捷方式）
- `IsAdmin` / UAC 提权
- 全局热键注册（ShortcutKeys）
- DSkin 皮肤系统 → 改为跟随 macOS 系统深/浅色模式

---

## 二、技术架构

### 目录结构

```
src/
  main/           # Electron 主进程
    index.ts      # 应用入口、BrowserWindow、IPC 注册、Tray
    store.ts      # JSON 文件持久化（~/Library/Application Support/launchbox/）
    launcher.ts   # macOS 专用工具启动逻辑
    preload.ts    # contextBridge，暴露 window.launchbox API
  renderer/       # React 渲染进程
    App.tsx       # 根组件，主题系统
    store/
      AppContext.tsx   # 全局状态（useReducer + Context）
    components/
      TitleBar.tsx
      Sidebar.tsx      # 两级分类树 + 宽度拖拽
      MainContent.tsx  # 工具网格/列表
      ToolCard.tsx     # 卡片（网格模式）
      ToolModal.tsx    # 新增/编辑工具弹窗
      CategoryModal.tsx
      SettingsPanel.tsx
      Toast.tsx
  styles/
    global.css    # macOS 设计系统，CSS 变量驱动
  shared/
    types.ts      # 所有共享类型
scripts/
  import-lily.mjs  # Lily data.json → ToolsBox AppData 一次性迁移脚本
tests/
  launcher.test.js
  store.test.js
docs/
  ROADMAP.md
notes/            # 工作日志，不影响代码
```

### IPC 通信模式

渲染进程**只能通过** `window.launchbox.*` 访问主进程，所有 API 在 `preload.ts` 中通过 `contextBridge.exposeInMainWorld('launchbox', api)` 暴露。

禁止在渲染进程中直接 `require('electron')` 或 `require('child_process')`。

```typescript
// 渲染进程调用示例
const tools = await window.launchbox.saveTool(tool);
const icon = await window.launchbox.getFileIcon('/Applications/Finder.app');
const cleanup = window.launchbox.onNativeThemeChanged((isDark) => { ... });
return cleanup; // useEffect 返回取消监听
```

### 数据存储

- 文件位置：`~/Library/Application Support/launchbox/launchbox-data.json`
- 格式：`AppData = { tools: Tool[], categories: Category[], settings: AppSettings }`
- 加载时自动 sanitize（`store.ts` 中 `sanitizeSettings` / `sanitizeTools`），损坏时自动备份并用默认值
- 默认分类（安全工具场景）：`all / recon / exploit / intranet / web / misc`

---

## 三、数据模型（当前最新版）

```typescript
// src/shared/types.ts

export type ToolType = 'jar' | 'python' | 'shell' | 'executable' | 'app' | 'url';
// 注意：batch 已永久删除

export interface Tool {
  id: string;
  name: string;
  description: string;
  type: ToolType;
  path: string;          // 文件路径 或 URL
  args: string;          // 启动参数（支持引号和转义，用 parseArgs() 解析）
  workingDirectory?: string; // 工作目录（app/url 类型无效，ToolModal 中隐藏）
  categoryId: string;
  javaEnvId?: string;
  pythonEnvId?: string;
  icon?: string;         // base64 data URL，拖入 .app 时自动提取
  accentColor?: string;  // hex 颜色标签（如 #0a84ff），卡片左侧色条
  lastUsed?: number;
  useCount: number;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  order: number;
  parentId?: string;   // 空 = 顶级，有值 = 子分类（最多两级）
  collapsed?: boolean; // 侧边栏折叠状态，持久化到数据层
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'; // system = 跟随 macOS
  fontSize: 'small' | 'medium' | 'large';
  cardSize: 'small' | 'medium' | 'large';
  viewMode: 'grid' | 'list';
  sidebarWidth: number;                // 180~360，默认 220
  hoverSwitchCategories: boolean;      // 悬停自动切换分类
  javaEnvs: JavaEnv[];
  pythonEnvs: PythonEnv[];
  startAtLogin: boolean;
  minimizeToTray: boolean;
  windowBounds?: { x: number; y: number; width: number; height: number };
}
```

---

## 四、启动逻辑（launcher.ts）

### 各类型启动命令

| 类型 | 命令 | cwd | 备注 |
|------|------|-----|------|
| `app` | `open /path/to/App.app [--args ...]` | 无 | macOS Gatekeeper 兼容 |
| `executable` | 直接执行 binary | 有 | 需要 `chmod +x` |
| `shell` | `/bin/bash script.sh [args]` | 有 | 不需要 chmod +x |
| `jar` | `java -jar xxx.jar [args]` | 有 | Java 路径从 javaEnvs 取 |
| `python` | `python3 script.py [args]` | 有 | Python 路径从 pythonEnvs 取 |
| `url` | `open "https://..."` | 无 | 无协议头自动补 `https://` |

### 参数解析

启动参数统一用 `parseArgs(tool.args)` 解析，支持：
- 引号包裹（单引号和双引号）
- 反斜杠转义
- 空格分隔

```typescript
parseArgs('-Xmx2g --config "path with spaces"')
// → ['-Xmx2g', '--config', 'path with spaces']
```

### 安全实践（已落地）

- `openInTerminal`：通过 `spawn('osascript', ['-'])` + stdin 传脚本，避免 shell 注入
- `showInFinder`：`execFile('open', ['-R', filePath])`，不拼接 shell 命令
- 所有子进程用 `spawn` / `execFile`，不用 `exec`（后者走 shell，有注入风险）

---

## 五、主窗口配置

```typescript
// src/main/index.ts
mainWindow = new BrowserWindow({
  titleBarStyle: 'hiddenInset',        // macOS 原生 traffic light 按钮
  trafficLightPosition: { x: 16, y: 16 },
  vibrancy: 'under-window',            // 磨砂玻璃
  visualEffectState: 'active',         // 失焦不变暗
  frame: false,
  // 不设 backgroundColor，配合 vibrancy
});
```

TitleBar 组件需给 traffic light 留 **80px 左边距**（`paddingLeft: 80`）。

---

## 六、主题系统

- 三档：`light` / `dark` / `system`
- `system` 模式：初始值用 `window.matchMedia('(prefers-color-scheme: dark)')`，后续变化通过主进程 `nativeTheme.on('updated')` → IPC `native-theme-changed` 推送到渲染层
- 应用方式：切换 `document.body.className = 'dark'` 或 `'light'`
- CSS 变量在 `global.css` 中定义（`body.dark` / `body.light`）

Tray 图标：`setTemplateImage(true)`，macOS 自动适配深浅色菜单栏。

---

## 七、CSS 设计系统

所有颜色通过 CSS 变量，禁止硬编码颜色值：

```css
/* 主要变量 */
--bg-primary        /* 主背景 */
--bg-secondary      /* 卡片/侧边栏背景 */
--bg-tertiary       /* hover 背景 */
--bg-glass          /* 毛玻璃背景 */
--bg-input          /* 输入框背景 */
--text-primary
--text-secondary
--text-muted
--border-color
--accent-color      /* macOS 蓝：深色 #0a84ff，浅色 #007aff */
--shadow-sm / md / lg
--radius-sm(6) / md(10) / lg(14)
```

常用 CSS 类：`.tool-card`、`.tool-card-accent`、`.tool-row`、`.sidebar-item`、`.sidebar-group-header`、`.type-badge`、`.glass`、`.input`、`.btn`、`.btn-primary`、`.btn-ghost`、`.btn-danger`、`.context-menu`、`.context-menu-item`、`.modal`、`.modal-overlay`

---

## 八、全局状态（AppContext）

```typescript
// 从 useApp() 可以获取：
const {
  data,                    // AppData | null
  loading,
  selectedCategoryId,      // 当前选中分类
  searchQuery,
  viewMode,                // 'grid' | 'list'
  toasts,

  // 方法
  saveTool, deleteTool,
  saveCategory, deleteCategory,
  saveCategorySilent,      // 保存分类但不弹 Toast（用于折叠状态等高频同步）
  saveSettings,            // 保存并弹 Toast
  saveSettingsSilent,      // 保存但不弹 Toast（用于频繁触发：拖拽宽度、视图切换）
  launchTool,
  selectFile, selectDirectory,
  openInTerminal, showInFinder,
  windowControl,
  selectCategory,
  setSearch,
  setViewMode,
  showToast,
} = useApp();
```

**规则**：侧边栏宽度拖拽、视图模式切换，必须用 `saveSettingsSilent`，不能用 `saveSettings`（否则每次拖动都弹 Toast）。

---

## 九、分类系统

Lily 的双轴导航已在本项目落地：

- **主分栏**：顶级分类（`parentId` 为空），对应 Lily 的 mainType
- **副分栏**：当前主分栏下的子分类（`parentId = 顶级id`），对应 Lily 的 TabData

**当前导航结构：**
- `MainContent` 顶部：主分栏 Tab 栏（`lily-top-tab`），点击切换当前主分栏
- `Sidebar` 左侧：
  - 处于"全部"视图时：显示主分栏入口列表
  - 选中某主分栏时：显示该分栏的副分栏列表（含"全部"子项）
- 侧边栏 section 标题用 `.lily-sidebar-section-title` CSS 类

规则：
- 最多两级，不支持三级
- 工具的 `categoryId` 可指向主分栏或副分栏
- 选中主分栏时，过滤该分栏及其所有子分类的工具（BFS Set）
- 删除主分栏时，递归删除所有后代分类，相关工具移至 `misc`
- `all` 是内置特殊分类，不可删除/编辑
- 分类折叠状态（`collapsed`）持久化到数据层，使用 `saveCategorySilent` 静默保存

**lily- 前缀 CSS 类（已在 global.css 定义）：**
- `.lily-sidebar-section-title` — 侧边栏分区标题
- `.lily-top-tab` — 顶部主分栏 Tab 按钮
- `.lily-tool-card-body` — 工具卡片内容区
- `.lily-tool-icon-wrap` — 图标容器
- `.lily-tool-name` — 卡片名称
- `.lily-tool-description` — 卡片描述（仅 large 尺寸显示）
- `.lily-launch-button` — 悬停启动按钮
- `.lily-titlebar-button` — 标题栏操作按钮
- `.sidebar-disclosure` — 分类折叠展开按钮

---

## 十、已知问题 / 待修复

当前没有新的阻断级已知问题。

以下历史问题已在当前分支修复完成：

1. **父分类选中逻辑**：`MainContent` 现在会在选中顶级分类时，连同其全部后代分类一起过滤工具
2. **ToolModal 分类下拉**：当前下拉只展示真正的叶子分类；编辑历史数据时，如果原分类已不是叶子，也会临时补入当前值，避免表单丢值
3. **侧边栏宽度恢复**：`Sidebar` 已在数据加载后同步 `sidebarWidth`，重启后会恢复已保存宽度
4. **分类折叠持久化**：折叠/展开状态已静默写回分类数据，不再弹保存提示

---

## 十一、修改规范

### 必须遵守

- **不要** 引入任何 Windows 专有逻辑（batch、UAC、.lnk、.exe 检测等）
- **不要** 在渲染进程直接 `require` Node.js 模块，所有 native 能力通过 `window.launchbox.*` IPC
- **不要** 硬编码颜色，必须用 CSS 变量
- **不要** 在频繁触发的操作（拖拽、滚动）中调用会弹 Toast 的 `saveSettings`，用 `saveSettingsSilent`
- **不要** 用 `exec()` 拼接 shell 命令，用 `execFile()` 或 `spawn()`
- **不要** 修改 `src/shared/types.ts` 中 `IpcChannel` 但不同步更新 `preload.ts` 和 `index.ts`

### 推荐做法

- 新增 IPC 通道：`types.ts` → `index.ts`（`ipcMain.handle`）→ `preload.ts`（`api.*`）→ `AppContext.tsx`（`window.launchbox.*`）
- 新增 UI 组件：用 CSS 类而非内联 style，颜色用变量
- 新增设置项：`types.ts` → `store.ts`（`defaultSettings` + `sanitizeSettings`）→ `SettingsPanel.tsx` → `AppContext.tsx`（如需状态驱动）
- 修改分类逻辑：同步检查 `Sidebar.tsx`、`CategoryModal.tsx`、`MainContent.tsx`、`index.ts`（`delete-category` IPC）

### 测试

```bash
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint
npm test             # Jest（tests/ 目录）
npm run build        # 全量构建
npm run pack         # 打包 macOS .app（ad-hoc 签名）
```

---

## 十二、当前进展（2026-03-23）

已完成：
- Lily → ToolsBox macOS 迁移主干（数据模型、启动逻辑、UI、CSS 设计系统）
- 两级分类树（主分栏/副分栏双轴导航，对齐 Lily 结构）
- 顶部主分栏 Tab 栏 + 侧边栏副分栏联动
- 拖拽侧边栏宽度、网格/列表视图切换
- 侧边栏悬停切换分类（`hoverSwitchCategories` 设置项控制）
- 系统主题跟随（light/dark/system）
- 拖放文件自动识别类型 + 提取 .app 图标
- 参数解析升级（`parseArgs`，支持引号/转义）
- 数据加载时自动 sanitize + 损坏备份
- 分类折叠状态持久化（`saveCategorySilent`）
- 工具卡片紧凑化，lily- 前缀 CSS 类体系建立
- 测试：`launcher.test.js`、`store.test.js`
- CI 检查：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 全部通过

待处理（优先级从高到低）：
1. 继续向 Lily 视觉语言收敛（右键菜单、编辑弹窗分栏、更多交互细节）
2. `docs/ROADMAP.md` 中已规划但未完全落地的 Phase 1-5 后续能力
3. Electron 原生交互的持续手工回归（托盘、窗口关闭行为、主题切换、文件拖放）

---

## 十三、提交规范

遵循 Conventional Commits：

```
feat: 新增功能
fix: 修复 bug
refactor: 重构（不改变行为）
docs: 文档
test: 测试
chore: 构建/工具链
```

每次修改后：
1. 更新 `docs/ROADMAP.md` 对应状态
2. 在 `notes/` 中记录本次变更要点（文件名格式：`YYYY-MM-DD-描述.md`）
