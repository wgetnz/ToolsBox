import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { AppData, Tool, Category, AppSettings, AppLibraryEntry } from '../shared/types';
import { loadData, saveData, createId } from './store';
import { launchTool, openInTerminal, showInFinder } from './launcher';
import { expandImportItems } from './imports';
import { createToolShortcut } from './shortcuts';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appData: AppData;
const GLOBAL_QUICK_LAUNCHER_ACCELERATOR = 'CommandOrControl+Shift+K';

function resolveAppBundlePath(appPath: string): string {
  const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
  if (fs.existsSync(infoPlistPath)) return appPath;

  const wrapperDir = path.join(appPath, 'Wrapper');
  if (!fs.existsSync(wrapperDir)) return appPath;

  try {
    const nestedApp = fs.readdirSync(wrapperDir).find(entry => {
      if (!entry.endsWith('.app')) return false;
      return fs.existsSync(path.join(wrapperDir, entry, 'Info.plist'));
    });
    return nestedApp ? path.join(wrapperDir, nestedApp) : appPath;
  } catch {
    return appPath;
  }
}

function readBundleInfo(bundlePath: string): Record<string, unknown> | null {
  try {
    const plistPath = path.join(bundlePath, 'Contents', 'Info.plist');
    const wrapperPlistPath = path.join(bundlePath, 'Info.plist');
    const targetPlistPath = fs.existsSync(plistPath) ? plistPath : wrapperPlistPath;
    if (!fs.existsSync(targetPlistPath)) return null;
    const output = execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', targetPlistPath], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getIconCacheDir(): string {
  return path.join(app.getPath('userData'), 'icon-cache');
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cacheFileNameForApp(appPath: string): string {
  return Buffer.from(appPath).toString('base64').replace(/[\/+=]/g, '_');
}

function readImageAsDataUrl(imagePath: string): string | undefined {
  try {
    const buffer = fs.readFileSync(imagePath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}

function candidateIconNames(bundleInfo: Record<string, unknown>): string[] {
  const candidates = new Set<string>();
  const pushValue = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) candidates.add(value.trim());
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (typeof item === 'string' && item.trim()) candidates.add(item.trim());
      });
    }
  };

  pushValue(bundleInfo.CFBundleIconFile);
  pushValue(bundleInfo.CFBundleIconName);
  pushValue(bundleInfo.CFBundleIconFiles);

  const primaryIcon = bundleInfo.CFBundleIcons;
  if (primaryIcon && typeof primaryIcon === 'object' && 'CFBundlePrimaryIcon' in primaryIcon) {
    const primary = (primaryIcon as Record<string, unknown>).CFBundlePrimaryIcon;
    if (primary && typeof primary === 'object') {
      pushValue((primary as Record<string, unknown>).CFBundleIconFiles);
      pushValue((primary as Record<string, unknown>).CFBundleIconName);
    }
  }

  return Array.from(candidates);
}

function getResourcesDir(bundlePath: string): string {
  const contentsResources = path.join(bundlePath, 'Contents', 'Resources');
  if (fs.existsSync(contentsResources)) return contentsResources;
  return bundlePath;
}

function resolveIcnsPath(bundlePath: string): string | null {
  const resourcesDir = getResourcesDir(bundlePath);
  if (!fs.existsSync(resourcesDir)) return null;

  const bundleInfo = readBundleInfo(bundlePath);
  const names = bundleInfo ? candidateIconNames(bundleInfo) : [];

  for (const name of names) {
    const fileName = name.endsWith('.icns') ? name : `${name}.icns`;
    const iconPath = path.join(resourcesDir, fileName);
    if (fs.existsSync(iconPath)) return iconPath;
  }

  try {
    const fallback = fs.readdirSync(resourcesDir).find(file => file.endsWith('.icns'));
    return fallback ? path.join(resourcesDir, fallback) : null;
  } catch {
    return null;
  }
}

function extractIconFromAssetsCar(bundlePath: string, cacheKeyPath: string, bundleInfo: Record<string, unknown> | null): string | null {
  const resourcesDir = getResourcesDir(bundlePath);
  const assetsCarPath = path.join(resourcesDir, 'Assets.car');
  if (!fs.existsSync(assetsCarPath)) return null;

  const iconNames = bundleInfo ? candidateIconNames(bundleInfo) : [];
  if (iconNames.length === 0) return null;

  const cacheDir = getIconCacheDir();
  ensureDir(cacheDir);
  const outputPath = path.join(cacheDir, `${cacheFileNameForApp(cacheKeyPath)}.car.icns`);

  try {
    for (const iconName of iconNames) {
      execFileSync('/usr/bin/iconutil', ['-c', 'icns', assetsCarPath, iconName, '-o', outputPath], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      if (fs.existsSync(outputPath)) return outputPath;
    }
    return null;
  } catch {
    for (const iconName of iconNames.slice(1)) {
      try {
        execFileSync('/usr/bin/iconutil', ['-c', 'icns', assetsCarPath, iconName, '-o', outputPath], {
          stdio: ['ignore', 'ignore', 'ignore'],
        });
        if (fs.existsSync(outputPath)) return outputPath;
      } catch {
        continue;
      }
    }
    return fs.existsSync(outputPath) ? outputPath : null;
  }
}

function convertIcnsToPng(appPath: string, icnsPath: string): string | null {
  const cacheDir = getIconCacheDir();
  ensureDir(cacheDir);

  const outputPath = path.join(cacheDir, `${cacheFileNameForApp(appPath)}.png`);

  try {
    const sourceStat = fs.statSync(icnsPath);
    const cachedStat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;

    if (!cachedStat || cachedStat.mtimeMs < sourceStat.mtimeMs) {
      execFileSync('/usr/bin/sips', ['-s', 'format', 'png', icnsPath, '--out', outputPath], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    }

    return fs.existsSync(outputPath) ? outputPath : null;
  } catch {
    return null;
  }
}

function loadAppBundleIcon(appPath: string): string | undefined {
  try {
    const bundlePath = resolveAppBundlePath(appPath);
    const bundleInfo = readBundleInfo(bundlePath);
    const icnsPath = resolveIcnsPath(bundlePath) ?? extractIconFromAssetsCar(bundlePath, appPath, bundleInfo);
    if (!icnsPath) return undefined;
    const pngPath = convertIcnsToPng(appPath, icnsPath);
    if (!pngPath) return undefined;
    return readImageAsDataUrl(pngPath);
  } catch {
    return undefined;
  }
}

function resolveToolIcon(tool: Tool): Tool {
  if (tool.type !== 'app' || !tool.path) return tool;
  const icon = loadAppBundleIcon(tool.path);
  return icon ? { ...tool, icon } : tool;
}

function ensureToolIcons(tools: Tool[]): Tool[] {
  let changed = false;

  const resolved = tools.map(tool => {
    if (tool.type !== 'app' || !tool.path) return tool;
    const nextTool = resolveToolIcon(tool);
    if (nextTool.icon !== tool.icon) changed = true;
    return nextTool;
  });

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
    '/System/Applications',
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

function getAppLibrarySource(appPath: string): 'system' | 'user' {
  return appPath.startsWith('/System/Applications') ? 'system' : 'user';
}

async function getAppLibrary(): Promise<AppLibraryEntry[]> {
  if (process.platform !== 'darwin') return [];

  const apps = scanMacApps();
  return apps.map(appPath => ({
    id: appPath,
    name: path.basename(appPath, '.app'),
    path: appPath,
    icon: loadAppBundleIcon(appPath),
    source: getAppLibrarySource(appPath),
  }));
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

function syncGlobalQuickLauncherShortcut(): void {
  globalShortcut.unregister(GLOBAL_QUICK_LAUNCHER_ACCELERATOR);

  if (!appData.settings.enableGlobalQuickLauncher) return;

  const registered = globalShortcut.register(GLOBAL_QUICK_LAUNCHER_ACCELERATOR, () => {
    openQuickLauncher();
  });

  if (!registered) {
    console.warn(`Failed to register global shortcut: ${GLOBAL_QUICK_LAUNCHER_ACCELERATOR}`);
  }
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
      accelerator: 'CmdOrCtrl+Shift+K',
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
    tools: ensureToolIcons(appData.tools),
  }));
  ipcMain.handle('get-app-library', async () => getAppLibrary());

  ipcMain.handle('save-tool', async (_event, tool: Tool) => {
    const resolvedTool = resolveToolIcon(tool);
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

    syncGlobalQuickLauncherShortcut();

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

  ipcMain.handle('expand-import-items', async (_event, items: string[]) => {
    return expandImportItems(items);
  });

  ipcMain.handle('open-in-terminal', (_event, dirPath: string) => {
    openInTerminal(dirPath);
  });

  ipcMain.handle('show-in-finder', (_event, filePath: string) => {
    showInFinder(filePath);
  });

  ipcMain.handle('create-tool-shortcut', (_event, toolId: string) => {
    const tool = appData.tools.find(item => item.id === toolId);
    if (!tool) {
      return { success: false, error: 'Tool not found' };
    }

    try {
      const shortcutPath = createToolShortcut(tool, appData.settings, app.getPath('desktop'));
      showInFinder(shortcutPath);
      return { success: true, path: shortcutPath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
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
  syncGlobalQuickLauncherShortcut();

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
  globalShortcut.unregisterAll();
  saveWindowBounds();
});
