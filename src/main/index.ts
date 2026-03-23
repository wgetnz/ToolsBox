import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  nativeTheme,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppData, Tool, Category, AppSettings } from '../shared/types';
import { loadData, saveData, createId } from './store';
import { launchTool, openInTerminal, showInFinder } from './launcher';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appData: AppData;

function createWindow(): void {
  const { windowBounds } = appData.settings;

  mainWindow = new BrowserWindow({
    width: windowBounds?.width ?? 1200,
    height: windowBounds?.height ?? 750,
    x: windowBounds?.x,
    y: windowBounds?.y,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window',        // macOS 磨砂玻璃效果
    visualEffectState: 'active',     // 失焦时不变暗
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  const rendererPath = path.join(app.getAppPath(), 'dist', 'renderer', 'index.html');
  mainWindow.loadFile(rendererPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (appData.settings.minimizeToTray && tray) {
      event.preventDefault();
      mainWindow?.hide();
    } else {
      saveWindowBounds();
    }
  });

  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);
}

function saveWindowBounds(): void {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  appData.settings.windowBounds = bounds;
  saveData(appData);
}

function createTray(): void {
  // Try to load icon from assets
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-icon.png');
  let trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();
  trayIcon.setTemplateImage(true);  // macOS 菜单栏 template image（自动适配深/浅色）

  tray = new Tray(trayIcon);
  tray.setToolTip('LaunchBox');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 LaunchBox',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        saveWindowBounds();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// IPC handlers
function setupIPC(): void {
  ipcMain.handle('get-data', () => appData);

  ipcMain.handle('save-tool', (_event, tool: Tool) => {
    if (!tool.id) {
      tool.id = createId();
      tool.createdAt = Date.now();
      tool.useCount = 0;
      appData.tools.push(tool);
    } else {
      const idx = appData.tools.findIndex(t => t.id === tool.id);
      if (idx >= 0) {
        appData.tools[idx] = tool;
      } else {
        appData.tools.push(tool);
      }
    }
    saveData(appData);
    return appData.tools;
  });

  ipcMain.handle('delete-tool', (_event, toolId: string) => {
    appData.tools = appData.tools.filter(t => t.id !== toolId);
    saveData(appData);
    return appData.tools;
  });

  ipcMain.handle('save-category', (_event, category: Category) => {
    // 不允许编辑内置 'all' 分类
    if (category.id === 'all') return appData.categories;

    if (!category.id) {
      // 新建分类
      category.id = createId();
      appData.categories.push(category);
    } else {
      // 更新已有分类
      const idx = appData.categories.findIndex(c => c.id === category.id);
      if (idx >= 0) {
        appData.categories[idx] = category;
      } else {
        appData.categories.push(category);
      }
    }
    saveData(appData);
    return appData.categories;
  });

  ipcMain.handle('delete-category', (_event, categoryId: string) => {
    if (categoryId === 'all') return appData.categories;

    // 同时删除所有子分类
    const childIds = appData.categories
      .filter(c => c.parentId === categoryId)
      .map(c => c.id);
    const toDelete = new Set([categoryId, ...childIds]);

    appData.categories = appData.categories.filter(c => !toDelete.has(c.id));

    // 将被删分类下的工具移至 misc
    appData.tools = appData.tools.map(t =>
      toDelete.has(t.categoryId) ? { ...t, categoryId: 'misc' } : t
    );
    saveData(appData);
    return { categories: appData.categories, tools: appData.tools };
  });

  ipcMain.handle('save-settings', (_event, settings: AppSettings) => {
    appData.settings = { ...appData.settings, ...settings };
    saveData(appData);

    // Handle login item
    if (process.platform === 'darwin' || process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: appData.settings.startAtLogin,
      });
    }

    return appData.settings;
  });

  ipcMain.handle('launch-tool', async (_event, toolId: string) => {
    const tool = appData.tools.find(t => t.id === toolId);
    if (!tool) return { success: false, error: 'Tool not found' };

    try {
      await launchTool(tool, appData.settings);
      // Update usage stats
      tool.lastUsed = Date.now();
      tool.useCount = (tool.useCount || 0) + 1;
      saveData(appData);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('select-file', async (_event, filters?: Electron.FileFilter[]) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('open-in-terminal', (_event, dirPath: string) => {
    openInTerminal(dirPath);
  });

  ipcMain.handle('show-in-finder', (_event, filePath: string) => {
    showInFinder(filePath);
  });

  ipcMain.handle('window-state', (_event, action: string) => {
    if (!mainWindow) return;
    switch (action) {
      case 'minimize': mainWindow.minimize(); break;
      case 'maximize':
        mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
        break;
      case 'close':
        if (appData.settings.minimizeToTray && tray) {
          mainWindow.hide();
        } else {
          saveWindowBounds();
          mainWindow.close();
        }
        break;
    }
  });

  // 提取文件图标（.app、可执行文件等），返回 base64 data URL
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
    mainWindow?.webContents.send('native-theme-changed', nativeTheme.shouldUseDarkColors);
  });
}

app.whenReady().then(() => {
  appData = loadData();
  setupIPC();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  saveWindowBounds();
});
