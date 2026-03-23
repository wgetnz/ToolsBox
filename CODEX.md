# ToolBox — Codex 协作指南

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
- 当前内置分类（可继续调整）：`常用工具 / 渗透工具 / 反编译 / 安卓 / 其他工具`，以及各自的二级子分类

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

## 三点五、近期对话暴露出的禁止事项

以下规则是这次连续返工后补充的硬约束，后续修改时必须遵守，不要再犯：

### 1. 先改用户明确指出的区域，不要擅自扩散

- 用户点名要改哪个区域，就只改那个区域
- 不要把「顶部布局问题」顺手改成「卡片样式问题」
- 不要把「搜索位置问题」顺手改成「整页风格重做」
- 如果需要连带调整，必须先说明影响范围

### 2. 不要擅自脑补交互

- 用户已经给了截图、箭头、红框时，以截图为准，不要自行发挥
- 用户说“平级放一起”，就要理解为同一层级同一横栏，不要再造额外占位区
- 用户说“移到右上角”，就是真的移过去，不是还留在原工具栏里
- 用户说“默认行为”，要按正常使用顺序做，不能反着来

### 3. 不能为了补丁快而做视觉假修复

- 禁止用负 margin、占位空白、假对齐去糊布局
- 优先调整真实结构，再调样式
- 遇到“左上空一块”“内容错层”这类问题，应先检查组件层级，而不是只改 padding

### 4. 搜索、分类、导入这类核心逻辑不能串线

- 搜索逻辑不能破坏正常分类浏览
- 未输入搜索词时，必须严格按当前分类显示
- 只有在明确搜索且范围为“全部分类”时，才允许全局搜索
- AI 导入、默认规则导入、分类展示是三条独立链路，修改一条时不要污染另一条

### 5. AI 分类只做分类引擎，不预设结果

- AI 的职责是生成总分类和副分类，不是提前塞固定的 “AI” 总分类
- 总分类要少、稳定、常见、高频优先靠前
- 副分类可以更细，但不能重复、不能和父分类同名、不能出现空分类
- 导入后必须做名称清洗、去重、空分类过滤

### 6. 图标和类型判断遵循真实数据，不要拍脑袋兜底

- `.app` 必须优先识别为 `app`，不能因为旧逻辑存成 `executable`
- macOS `.app` 图标不能再走有崩溃历史的 `getFileIcon`
- 默认图标兜底只能在确实拿不到真实图标时使用，不能覆盖真实 app 图标

### 7. 每次改动前先确认“问题属于结构、样式还是数据”

- 结构问题：先改组件层级和 DOM 组织
- 样式问题：只改 spacing / 对齐 / 圆角 / 颜色等视觉层
- 数据问题：只改 store / sanitize / IPC / 状态流
- 不要三类问题混着一把改

### 8. 改完必须自查三件事

- 是否准确命中了用户指出的区域
- 是否引入了不相关的视觉或交互变化
- 是否影响了已有主流程（分类浏览、搜索、导入、备份、设置）

如果用户情绪明显是在指出“你改偏了”，后续必须先收窄范围，优先做最小修复，不要继续扩散修改。

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

当前分类导航采用“顶部大分类 + 左侧小分类”的两级结构：

- **主分栏**：顶级分类（`parentId` 为空）
- **副分栏**：当前主分栏下的子分类（`parentId = 顶级分类 id`）

**当前导航结构（严格分离，cd030b1 后）：**
- `MainContent` 顶部：**仅**主分栏 Tab 栏（`lily-top-tab`），点击/悬停切换当前主分栏
- `Sidebar` 左侧：**仅**副分栏列表，显示当前激活主分栏的子分类
  - 无主分栏激活（选中 all）时：显示"先从顶部选择一个大分类"提示
  - **Sidebar 不展示任何主分类入口**（这是设计约束，不得回退）
- 侧边栏 section 标题用 `.lily-sidebar-section-title` CSS 类

规则：
- 最多两级，不支持三级
- 工具的 `categoryId` 通常指向具体的小分类；导入和历史数据也允许直接挂到顶级分类
- 选中主分栏时，过滤该分栏及其所有子分类的工具（BFS Set）
- 删除主分栏时，递归删除所有后代分类，相关工具移至 `misc`
- `all` 是内置特殊分类，不可删除/编辑
- 分类折叠（`collapsed`）已从 Sidebar 移除，`saveCategorySilent` 不再由 Sidebar 调用
- 工具内容区只展示当前分类命中的工具；只有在明确搜索时，才按“全部分类 / 当前分类”范围切换

**lily- 前缀 CSS 类（已在 global.css 定义）：**
- `.lily-sidebar-section-title` — 侧边栏分区标题
- `.lily-top-tab` — 顶部主分栏 Tab 按钮
- `.lily-tool-card-body` — 工具卡片内容区
- `.lily-tool-icon-wrap` — 图标容器
- `.lily-tool-name` — 卡片名称
- `.lily-tool-description` — 卡片描述（仅 large 尺寸显示）
- `.lily-launch-button` — 悬停启动按钮
- `.lily-titlebar-button` — 标题栏操作按钮
- `.sidebar-disclosure` — 分类折叠展开按钮（当前 Sidebar 未使用，保留定义）
---

## 十、已知问题 / 待修复

当前没有新的阻断级已知问题。

以下历史问题已在当前分支修复完成：

1. **父分类选中逻辑**：`MainContent` 现在会在选中顶级分类时，连同其全部后代分类一起过滤工具
2. **ToolModal 分类下拉**：当前下拉只展示真正的叶子分类；编辑历史数据时，如果原分类已不是叶子，也会临时补入当前值，避免表单丢值
3. **侧边栏宽度恢复**：`Sidebar` 已在数据加载后同步 `sidebarWidth`，重启后会恢复已保存宽度
4. **分类折叠持久化**：折叠/展开状态已静默写回分类数据，不再弹保存提示
5. **主/副分栏严格分离**（`cd030b1`）：Sidebar 仅展示副分栏，主分栏 Tab 仅在顶部，两者完全隔离

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
- 顶部主分栏 Tab 栏 + 侧边栏副分栏联动（严格分离，`cd030b1`）
- 顶部主分栏 Tab 支持悬停切换（与侧边栏悬停行为一致，`hoverSwitchCategories` 控制）
- 侧边栏移除最近使用区块、折叠逻辑和主分类入口（当前 Sidebar 纯副分栏）
- 搜索支持“全部分类 / 当前分类”范围切换并记忆
- AI 导入支持创建总分类和副分类、强制覆盖、终端日志输出
- 设置页支持备份列表、恢复、删除单个备份、自动备份和保留数量
- 拖拽侧边栏宽度、网格/列表视图切换
- 系统主题跟随（light/dark/system）
- 拖放文件自动识别类型 + 提取 .app 图标
- 参数解析升级（`parseArgs`，支持引号/转义）
- 数据加载时自动 sanitize + 损坏备份
- 工具卡片紧凑化，lily- 前缀 CSS 类体系建立
- 测试：`launcher.test.js`、`store.test.js`
- CI 检查：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 全部通过

待处理（优先级从高到低）：
1. 继续收敛 AI 导入后的分类质量（重复分类、近义合并、排序稳定性）
2. 继续完善备份恢复体验（如预览、批量管理）
3. `docs/ROADMAP.md` 中已规划但未完全落地的后续能力

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
