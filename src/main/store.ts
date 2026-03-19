import { AppData, AppSettings, Category, Tool } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

// Use a simple JSON file store since electron-store ESM is tricky
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const defaultCategories: Category[] = [
  { id: 'all', name: '全部工具', icon: '🔧', order: 0 },
  { id: 'recon', name: '信息搜集', icon: '🔍', order: 1 },
  { id: 'exploit', name: '漏洞利用', icon: '💥', order: 2 },
  { id: 'intranet', name: '内网渗透', icon: '🌐', order: 3 },
  { id: 'web', name: 'Web 安全', icon: '🕸️', order: 4 },
  { id: 'misc', name: '其他工具', icon: '📦', order: 5 },
];

const defaultSettings: AppSettings = {
  theme: 'dark',
  fontSize: 'medium',
  cardSize: 'medium',
  javaEnvs: [],
  pythonEnvs: [],
  hoverSwitchCategories: true,
  showRecentTools: true,
  enableGlobalQuickLauncher: true,
  startAtLogin: false,
  minimizeToTray: true,
};

const defaultData: AppData = {
  tools: [],
  categories: defaultCategories,
  settings: defaultSettings,
};

const validThemes = new Set<AppSettings['theme']>(['dark', 'light']);
const validFontSizes = new Set<AppSettings['fontSize']>(['small', 'medium', 'large']);
const validCardSizes = new Set<AppSettings['cardSize']>(['small', 'medium', 'large']);
const validToolTypes = new Set<Tool['type']>(['jar', 'python', 'shell', 'executable', 'app', 'batch', 'url']);

function getDataPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'launchbox-data.json');
}

function backupCorruptedDataFile(dataPath: string): void {
  const backupPath = `${dataPath}.corrupt-${Date.now()}.bak`;
  fs.copyFileSync(dataPath, backupPath);
}

export function sanitizeSettings(settings: Partial<AppSettings> | undefined): AppSettings {
  const nextSettings: AppSettings = {
    ...defaultSettings,
    ...(settings ?? {}),
    javaEnvs: [],
    pythonEnvs: [],
  };

  nextSettings.theme = validThemes.has(nextSettings.theme) ? nextSettings.theme : defaultSettings.theme;
  nextSettings.fontSize = validFontSizes.has(nextSettings.fontSize) ? nextSettings.fontSize : defaultSettings.fontSize;
  nextSettings.cardSize = validCardSizes.has(nextSettings.cardSize) ? nextSettings.cardSize : defaultSettings.cardSize;
  nextSettings.hoverSwitchCategories = typeof nextSettings.hoverSwitchCategories === 'boolean'
    ? nextSettings.hoverSwitchCategories
    : defaultSettings.hoverSwitchCategories;
  nextSettings.showRecentTools = typeof nextSettings.showRecentTools === 'boolean'
    ? nextSettings.showRecentTools
    : defaultSettings.showRecentTools;
  nextSettings.enableGlobalQuickLauncher = typeof nextSettings.enableGlobalQuickLauncher === 'boolean'
    ? nextSettings.enableGlobalQuickLauncher
    : defaultSettings.enableGlobalQuickLauncher;
  nextSettings.startAtLogin = typeof nextSettings.startAtLogin === 'boolean'
    ? nextSettings.startAtLogin
    : defaultSettings.startAtLogin;
  nextSettings.minimizeToTray = typeof nextSettings.minimizeToTray === 'boolean'
    ? nextSettings.minimizeToTray
    : defaultSettings.minimizeToTray;

  nextSettings.javaEnvs = Array.isArray(settings?.javaEnvs)
    ? settings.javaEnvs
      .filter(env => env && typeof env.id === 'string' && typeof env.name === 'string' && typeof env.path === 'string')
      .map(env => ({ id: env.id, name: env.name, path: env.path }))
    : [];

  nextSettings.pythonEnvs = Array.isArray(settings?.pythonEnvs)
    ? settings.pythonEnvs
      .filter(env => env && typeof env.id === 'string' && typeof env.name === 'string' && typeof env.path === 'string')
      .map(env => ({ id: env.id, name: env.name, path: env.path }))
    : [];

  if (
    settings?.windowBounds &&
    typeof settings.windowBounds.width === 'number' &&
    typeof settings.windowBounds.height === 'number'
  ) {
    nextSettings.windowBounds = {
      width: settings.windowBounds.width,
      height: settings.windowBounds.height,
      x: typeof settings.windowBounds.x === 'number' ? settings.windowBounds.x : 0,
      y: typeof settings.windowBounds.y === 'number' ? settings.windowBounds.y : 0,
    };
  } else {
    delete nextSettings.windowBounds;
  }

  return nextSettings;
}

export function sanitizeCategories(categories: Partial<Category>[] | undefined): Category[] {
  const discovered = new Map<string, Category>();

  for (const category of defaultCategories) {
    discovered.set(category.id, { ...category });
  }

  if (Array.isArray(categories)) {
    for (const category of categories) {
      if (!category || typeof category.id !== 'string' || !category.id.trim()) continue;

      const base = discovered.get(category.id) ?? {
        id: category.id,
        name: '未命名分类',
        icon: '📦',
        order: discovered.size,
      };

      discovered.set(category.id, {
        id: category.id,
        name: typeof category.name === 'string' && category.name.trim() ? category.name : base.name,
        icon: typeof category.icon === 'string' && category.icon.trim() ? category.icon : base.icon,
        order: typeof category.order === 'number' ? category.order : base.order,
      });
    }
  }

  return Array.from(discovered.values())
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'))
    .map((category, index) => ({ ...category, order: index }));
}

export function sanitizeTools(tools: Partial<Tool>[] | undefined, categories: Category[]): Tool[] {
  if (!Array.isArray(tools)) return [];

  const categoryIds = new Set(categories.map(category => category.id));
  const seenIds = new Set<string>();

  return tools
    .filter(tool => {
      if (!tool || typeof tool.name !== 'string' || !tool.name.trim()) return false;
      if (typeof tool.path !== 'string' || !tool.path.trim()) return false;
      if (!validToolTypes.has(tool.type as Tool['type'])) return false;
      return true;
    })
    .map(tool => {
      const requestedId = typeof tool.id === 'string' && tool.id.trim() ? tool.id : createId();
      const id = seenIds.has(requestedId) ? createId() : requestedId;
      seenIds.add(id);

      const categoryId = typeof tool.categoryId === 'string' && categoryIds.has(tool.categoryId)
        ? tool.categoryId
        : 'misc';

      return {
        id,
        name: tool.name!.trim(),
        description: typeof tool.description === 'string' ? tool.description : '',
        type: tool.type as Tool['type'],
        path: tool.path!.trim(),
        args: typeof tool.args === 'string' ? tool.args : '',
        categoryId,
        javaEnvId: typeof tool.javaEnvId === 'string' ? tool.javaEnvId : undefined,
        pythonEnvId: typeof tool.pythonEnvId === 'string' ? tool.pythonEnvId : undefined,
        icon: typeof tool.icon === 'string' && tool.icon.trim() ? tool.icon : undefined,
        color: typeof tool.color === 'string' && tool.color.trim() ? tool.color : undefined,
        customOrder: typeof tool.customOrder === 'number' ? tool.customOrder : 0,
        lastUsed: typeof tool.lastUsed === 'number' ? tool.lastUsed : undefined,
        useCount: typeof tool.useCount === 'number' && tool.useCount >= 0 ? tool.useCount : 0,
        createdAt: typeof tool.createdAt === 'number' ? tool.createdAt : Date.now(),
      };
    })
    .sort((a, b) => a.customOrder - b.customOrder || a.createdAt - b.createdAt)
    .map((tool, index) => ({ ...tool, customOrder: index }));
}

export function sanitizeData(data: Partial<AppData>): AppData {
  const categories = sanitizeCategories(data.categories);
  return {
    categories,
    settings: sanitizeSettings(data.settings),
    tools: sanitizeTools(data.tools, categories),
  };
}

export function loadData(): AppData {
  const dataPath = getDataPath();

  try {
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(raw) as Partial<AppData>;
      const sanitized = sanitizeData(data);

      if (JSON.stringify(data) !== JSON.stringify(sanitized)) {
        saveData(sanitized);
      }

      return sanitized;
    }
  } catch (e) {
    console.error('Failed to load data:', e);
    try {
      if (fs.existsSync(dataPath)) {
        backupCorruptedDataFile(dataPath);
        saveData({ ...defaultData, categories: [...defaultCategories] });
      }
    } catch (backupError) {
      console.error('Failed to recover corrupted data file:', backupError);
    }
  }
  return { ...defaultData, categories: [...defaultCategories] };
}

export function saveData(data: AppData): void {
  try {
    const dataPath = getDataPath();
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export function createId(): string {
  return uuidv4();
}
