import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppData, Tool, Category, AppSettings, AppLibraryEntry } from '../shared/types';
import { loadData, saveData, createId } from './store';
import { launchTool, openInTerminal, showInFinder } from './launcher';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appData: AppData;

async function resolveToolIcon(tool: Tool): Promise<Tool> {
  if (tool.type !== 'app' || !tool.path) return tool;

  try {
    if (!fs.existsSync(tool.path)) return tool;
    const icon = await app.getFileIcon(tool.path, { size: 'large' });
    const dataUrl = icon.toDataURL();
    if (!dataUrl) return tool;
    return { ...tool, icon: dataUrl };
  } catch {
    return tool;
  }
}

async function getAppIconDataUrl(filePath: string): Promise<string | undefined> {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    const dataUrl = icon.toDataURL();
    return dataUrl || undefined;
  } catch {
    return undefined;
  }
}

async function ensureToolIcons(tools: Tool[]): Promise<Tool[]> {
  let changed = false;

  const resolved = await Promise.all(
    tools.map(async tool => {
      if (tool.type !== 'app' || tool.icon || !tool.path) return tool;
      const nextTool = await resolveToolIcon(tool);
      if (nextTool.icon && nextTool.icon !== tool.icon) changed = true;
      return nextTool;
    })
  );

  if (changed) {
    appData.tools = resolved;
    saveData(appData);
  }

  return resolved;
}

function scanMacApps(): string[] {
  const homeDir = app.getPath('home');
  const roots = [
    '/Applications',
    path.join(homeDir, 'Applications'),
  ];
  const discovered = new Set<string>();

  const walk = (dirPath: string, depth: number): void => {
    if (!fs.existsSync(dirPath) || depth > 2) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.name.endsWith('.app')) {
        discovered.add(fullPath);
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      }
    }
  };

  roots.forEach(root => walk(root, 0));
  return Array.from(discovered).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

async function getAppLibrary(): Promise<AppLibraryEntry[]> {
  if (process.platform !== 'darwin') return [];

  const apps = scanMacApps();
  const entries = await Promise.all(
    apps.map(async appPath => ({
      id: appPath,
      name: path.basename(appPath, '.app'),
      path: appPath,
      icon: await getAppIconDataUrl(appPath),
    }))
  );

  return entries;
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
    backgroundColor: '#1a1a2e',
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

function showMainWindow(): void {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function openQuickLauncher(): void {
  showMainWindow();
  mainWindow?.webContents.send('open-quick-launcher');
}

function createTray(): void {
  // Try to load icon from assets
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-icon.png');
  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(trayIcon);
  tray.setToolTip('LaunchBox');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示 LaunchBox',
      click: () => {
        showMainWindow();
      },
    },
    {
      label: '打开快速启动器',
      click: () => {
        openQuickLauncher();
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
      showMainWindow();
    }
  });
}

// IPC handlers
function setupIPC(): void {
  ipcMain.handle('get-data', async () => ({
    ...appData,
    tools: await ensureToolIcons(appData.tools),
  }));
  ipcMain.handle('get-app-library', async () => getAppLibrary());

  ipcMain.handle('save-tool', async (_event, tool: Tool) => {
    const resolvedTool = await resolveToolIcon(tool);

    if (!tool.id) {
      resolvedTool.id = createId();
      resolvedTool.createdAt = Date.now();
      resolvedTool.useCount = 0;
      appData.tools.push(resolvedTool);
    } else {
      const idx = appData.tools.findIndex(t => t.id === resolvedTool.id);
      if (idx >= 0) {
        appData.tools[idx] = resolvedTool;
      } else {
        appData.tools.push(resolvedTool);
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

  ipcMain.handle('delete-tools', (_event, toolIds: string[]) => {
    const removeSet = new Set(toolIds);
    appData.tools = appData.tools.filter(t => !removeSet.has(t.id));
    saveData(appData);
    return appData.tools;
  });

  ipcMain.handle('save-category', (_event, category: Category) => {
    // Don't allow editing built-in "all" category
    if (!category.id || category.id === 'all') return appData.categories;

    const idx = appData.categories.findIndex(c => c.id === category.id);
    if (idx >= 0) {
      appData.categories[idx] = category;
    } else {
      category.id = createId();
      appData.categories.push(category);
    }
    saveData(appData);
    return appData.categories;
  });

  ipcMain.handle('delete-category', (_event, categoryId: string) => {
    if (categoryId === 'all') return appData.categories;
    appData.categories = appData.categories.filter(c => c.id !== categoryId);
    // Move tools from deleted category to 'misc'
    appData.tools = appData.tools.map(t =>
      t.categoryId === categoryId ? { ...t, categoryId: 'misc' } : t
    );
    saveData(appData);
    return { categories: appData.categories, tools: appData.tools };
  });

  ipcMain.handle('move-tools-to-category', (_event, toolIds: string[], categoryId: string) => {
    const moveSet = new Set(toolIds);
    appData.tools = appData.tools.map(tool =>
      moveSet.has(tool.id) ? { ...tool, categoryId } : tool
    );
    saveData(appData);
    return appData.tools;
  });

  ipcMain.handle('update-tools-color', (_event, toolIds: string[], color: string) => {
    const updateSet = new Set(toolIds);
    appData.tools = appData.tools.map(tool =>
      updateSet.has(tool.id) ? { ...tool, color } : tool
    );
    saveData(appData);
    return appData.tools;
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
      showMainWindow();
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
