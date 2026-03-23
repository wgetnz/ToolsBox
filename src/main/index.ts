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
import { loadData, saveData, createId, sanitizeSettings } from './store';
import { launchTool, openInTerminal, showInFinder } from './launcher';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appData: AppData;

function resolveParentCategoryId(category: Category): string | undefined {
  const parentId = typeof category.parentId === 'string' && category.parentId.trim()
    ? category.parentId
    : undefined;

  if (!parentId || parentId === category.id || parentId === 'all') return undefined;

  const parent = appData.categories.find(item => item.id === parentId);
  if (!parent || parent.parentId) return undefined;
  return parentId;
}

function collectCategoryDescendants(categoryId: string): Set<string> {
  const descendants = new Set<string>([categoryId]);
  const queue = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const category of appData.categories) {
      if (category.parentId === currentId && !descendants.has(category.id)) {
        descendants.add(category.id);
        queue.push(category.id);
      }
    }
  }

  return descendants;
}

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
    vibrancy: 'under-window',
    visualEffectState: 'active',
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

  mainWindow.on('close', event => {
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
  appData.settings.windowBounds = mainWindow.getBounds();
  saveData(appData);
}

function createTray(): void {
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-icon.png');
  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  trayIcon.setTemplateImage(true);

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

function setupIPC(): void {
  ipcMain.handle('get-data', () => appData);

  ipcMain.handle('save-tool', (_event, tool: Tool) => {
    if (!tool.id) {
      tool.id = createId();
      tool.createdAt = Date.now();
      tool.useCount = 0;
      appData.tools.push(tool);
    } else {
      const index = appData.tools.findIndex(item => item.id === tool.id);
      if (index >= 0) {
        appData.tools[index] = tool;
      } else {
        appData.tools.push(tool);
      }
    }

    saveData(appData);
    return appData.tools;
  });

  ipcMain.handle('delete-tool', (_event, toolId: string) => {
    appData.tools = appData.tools.filter(tool => tool.id !== toolId);
    saveData(appData);
    return appData.tools;
  });

  ipcMain.handle('save-category', (_event, category: Category) => {
    if (category.id === 'all') return appData.categories;

    const nextCategory: Category = {
      ...category,
      parentId: resolveParentCategoryId(category),
      collapsed: typeof category.collapsed === 'boolean' ? category.collapsed : undefined,
    };

    if (!category.id) {
      nextCategory.id = createId();
      appData.categories.push(nextCategory);
    } else {
      const index = appData.categories.findIndex(item => item.id === category.id);
      if (index >= 0) {
        appData.categories[index] = nextCategory;
      } else {
        appData.categories.push(nextCategory);
      }
    }

    saveData(appData);
    return appData.categories;
  });

  ipcMain.handle('delete-category', (_event, categoryId: string) => {
    if (categoryId === 'all') return { categories: appData.categories, tools: appData.tools };

    const toDelete = collectCategoryDescendants(categoryId);

    appData.categories = appData.categories.filter(category => !toDelete.has(category.id));
    appData.tools = appData.tools.map(tool =>
      toDelete.has(tool.categoryId) ? { ...tool, categoryId: 'misc' } : tool
    );

    saveData(appData);
    return { categories: appData.categories, tools: appData.tools };
  });

  ipcMain.handle('save-settings', (_event, settings: AppSettings) => {
    appData.settings = sanitizeSettings({ ...appData.settings, ...settings });
    saveData(appData);

    if (process.platform === 'darwin' || process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: appData.settings.startAtLogin,
      });
    }

    return appData.settings;
  });

  ipcMain.handle('launch-tool', async (_event, toolId: string) => {
    const tool = appData.tools.find(item => item.id === toolId);
    if (!tool) return { success: false, error: 'Tool not found' };

    try {
      await launchTool(tool, appData.settings);
      tool.lastUsed = Date.now();
      tool.useCount = (tool.useCount || 0) + 1;
      saveData(appData);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
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
      case 'minimize':
        mainWindow.minimize();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case 'close':
        if (appData.settings.minimizeToTray && tray) {
          mainWindow.hide();
        } else {
          saveWindowBounds();
          mainWindow.close();
        }
        break;
      default:
        break;
    }
  });

  ipcMain.handle('get-file-icon', async (_event, filePath: string) => {
    try {
      const icon = await app.getFileIcon(filePath, { size: 'large' });
      return icon.toDataURL();
    } catch {
      return null;
    }
  });

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
