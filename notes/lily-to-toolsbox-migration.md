# Lily → ToolsBox macOS 迁移

## 目标

将 ToolsBox 从 Windows（Lily 架构）完整迁移到 macOS，删除所有 Windows 专有特性，实现 macOS 原生体验。

## 变更范围

### `src/shared/types.ts`
- 移除 `batch` 工具类型，`ToolType` 现为 `'jar' | 'python' | 'shell' | 'executable' | 'app' | 'url'`
- `Tool` 新增字段：`workingDirectory?: string`、`accentColor?: string`、`icon?: string`（base64 data URL）
- `Category` 新增字段：`parentId?: string`（支持两级分类树）
- `AppSettings.theme` 改为 `'light' | 'dark' | 'system'`
- `AppSettings` 新增：`viewMode: 'grid' | 'list'`、`sidebarWidth: number`
- `IpcChannel` 新增：`get-file-icon`、`native-theme-changed`

### `src/main/store.ts`
- `defaultSettings` 更新：`theme: 'system'`、`viewMode: 'grid'`、`sidebarWidth: 220`
- `loadData()` 用 `{ ...defaultSettings, ...(data.settings ?? {}) }` 合并，保证向后兼容

### `src/main/launcher.ts`
- 完全重写为 macOS 专用，移除所有 Windows 逻辑
- `app` 类型用 `open [path, '--args', ...extraArgs]`
- `url` 类型无协议头时自动补 `https://`
- `openInTerminal`：通过 `spawn('osascript', ['-'])` + stdin 传脚本，用 AppleScript `quoted form of` 处理路径，**避免 shell 注入**
- `showInFinder`：改用 `execFile('open', ['-R', filePath])`，**避免 shell 注入**
- 支持 `workingDirectory` 作为 `cwd` 传给子进程

### `src/main/index.ts`
- 窗口：移除 `backgroundColor`，添加 `vibrancy: 'under-window'`、`visualEffectState: 'active'`（macOS 磨砂玻璃效果）
- Tray 图标：`.resize({ width: 16 })` + `.setTemplateImage(true)`（自动适配深浅色）
- `save-category` IPC **关键修复**：原逻辑 `!category.id` 会跳过新建，导致新分类永远丢失。修复后分离了"新建"（`!category.id`）和"更新"（找到已有记录）两个分支
- `delete-category` 扩展：级联删除子分类，将孤立工具移至 `misc`
- 新增 `get-file-icon` IPC（`app.getFileIcon()` 提取 .app 图标）
- 新增 `nativeTheme.on('updated')` → 推送 `native-theme-changed` 到渲染进程

### `src/main/preload.ts`
- 新增 `getFileIcon(filePath)`
- 新增 `onNativeThemeChanged(cb)` 返回取消监听函数

### `src/renderer/styles/global.css`
- 完全重写为 macOS 设计系统
- 深色默认 `#1c1c1e`，浅色 `#f2f2f7`，强调色 `#0a84ff` / `#007aff`
- SF Pro 字体栈，`backdrop-filter` glass 工具类
- 新增 `.tool-card`、`.tool-card-accent`、`.tool-row`、`.sidebar-item`、`.sidebar-group-header`、`.type-badge`、`.toast-container`

### `src/renderer/App.tsx`
- 主题系统重写，支持 `'system'`：初始值用 `window.matchMedia`，变化用 `onNativeThemeChanged` IPC 回调，`useEffect` 返回取消函数

### `src/renderer/store/AppContext.tsx`
- 新增 `viewMode` 状态 + `SET_VIEW_MODE` action
- 新增 `saveSettingsSilent`（保存不弹 Toast，用于侧边栏宽度拖拽、视图切换等频繁场景）
- 数据加载后同步 `viewMode` 从 `data.settings.viewMode`

### `src/renderer/components/Sidebar.tsx`
- 两级分类树：顶级分类（无 `parentId`）可折叠，子分类缩进显示
- 右边界拖拽调整宽度（`useRef` 跟踪 resize 状态，`saveSettingsSilent` 静默持久化）
- 底部"最近使用"列表（最多 5 条）

### `src/renderer/components/CategoryModal.tsx`
- 新增父分类选择器（下拉，过滤掉 `all`、自身、已有 `parentId` 的分类）

### `src/renderer/components/ToolCard.tsx`
- macOS 风格卡片，使用 CSS 类替代内联 hover
- 左侧 3px accent 色条（`accentColor`）
- 优先显示 `tool.icon`（base64）图片，回退类型 emoji

### `src/renderer/components/MainContent.tsx`
- 网格 / 列表视图切换，视图选择用 `saveSettingsSilent` 静默持久化
- 列表模式 `ToolRow` 组件（52px 固定高）
- `RowContextMenu` 提取为独立组件，`useEffect` 监听外部点击关闭

### `src/renderer/components/ToolModal.tsx`
- 移除 `batch` 类型
- `accentColor` 替换旧 `color` 字段，macOS 8 色调色板
- 新增 `workingDirectory` 字段（app/url 类型隐藏）
- 支持拖放文件自动识别类型并提取系统图标

### `src/renderer/components/SettingsPanel.tsx`
- 主题：三选项（跟随系统 / 深色 / 浅色）
- 新增默认视图切换（网格 / 列表）
- 移除自定义背景色选项

### `scripts/import-lily.mjs`（新增）
- Lily `data.json` → ToolsBox `AppData` 格式迁移脚本
- 跳过 Windows 专有类型（`.exe/.bat/.cmd/Built/Control/lnkFile`）
- `ColorR/G/B` 映射为 hex `accentColor`

## 关键 Bug 修复记录

| 问题 | 位置 | 原因 | 修复 |
|------|------|------|------|
| 新分类永远不保存 | `index.ts` `save-category` | `!category.id` 分支直接 return | 分离新建/更新逻辑 |
| 侧边栏拖拽弹 Toast | `Sidebar.tsx` | 调用了 `saveSettings` | 改用 `saveSettingsSilent` |
| 视图切换弹 Toast | `MainContent.tsx` | 调用了 `saveSettings` | 改用 `saveSettingsSilent` |
| ToolRow 右键菜单无法关闭 | `MainContent.tsx` | 无外部点击监听 | 提取 `RowContextMenu` 加 `useEffect` |
| AppleScript shell 注入 | `launcher.ts` | `exec` 字符串拼接路径 | 改 `spawn osascript -` + stdin |
| showInFinder shell 注入 | `launcher.ts` | `exec` 字符串拼接路径 | 改 `execFile('open', ['-R', path])` |
| useCallback 依赖引用未定义变量 | `Sidebar.tsx` | 依赖数组写了 `saveSettings` | 改为 `saveSettingsSilent` |
