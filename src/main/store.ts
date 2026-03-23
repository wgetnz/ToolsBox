import { AppData, AppSettings, Category, Tool } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';
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
  theme: 'system',
  fontSize: 'medium',
  cardSize: 'medium',
  viewMode: 'grid',
  sidebarWidth: 220,
  hoverSwitchCategories: true,
  javaEnvs: [],
  pythonEnvs: [],
  startAtLogin: false,
  minimizeToTray: true,
};

const defaultData: AppData = {
  tools: [],
  categories: defaultCategories,
  settings: defaultSettings,
};

const validThemes = new Set<AppSettings['theme']>(['light', 'dark', 'system']);
const validFontSizes = new Set<AppSettings['fontSize']>(['small', 'medium', 'large']);
const validCardSizes = new Set<AppSettings['cardSize']>(['small', 'medium', 'large']);
const validViewModes = new Set<AppSettings['viewMode']>(['grid', 'list']);
const validToolTypes = new Set<Tool['type']>(['jar', 'python', 'shell', 'executable', 'app', 'url']);

function getDataPath(): string {
  return path.join(app.getPath('userData'), 'launchbox-data.json');
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
  nextSettings.viewMode = validViewModes.has(nextSettings.viewMode) ? nextSettings.viewMode : defaultSettings.viewMode;
  nextSettings.sidebarWidth = typeof nextSettings.sidebarWidth === 'number'
    ? Math.max(180, Math.min(360, Math.round(nextSettings.sidebarWidth)))
    : defaultSettings.sidebarWidth;
  nextSettings.hoverSwitchCategories = typeof nextSettings.hoverSwitchCategories === 'boolean'
    ? nextSettings.hoverSwitchCategories
    : defaultSettings.hoverSwitchCategories;
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
        parentId: typeof category.parentId === 'string' && category.parentId.trim() ? category.parentId : undefined,
        collapsed: typeof category.collapsed === 'boolean' ? category.collapsed : undefined,
      });
    }
  }

  const normalized = Array.from(discovered.values())
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-CN'))
    .map((category, index) => ({ ...category, order: index }));

  const topLevelIds = new Set(
    normalized
      .filter(category => !category.parentId)
      .map(category => category.id)
  );

  return normalized.map(category => {
    if (
      category.parentId &&
      category.parentId !== category.id &&
      topLevelIds.has(category.parentId) &&
      category.id !== 'all'
    ) {
      return category;
    }

    const nextCategory = { ...category };
    delete nextCategory.parentId;
    return nextCategory;
  });
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

      const sortOrder = typeof (tool as Partial<{ customOrder: number }>).customOrder === 'number'
        ? (tool as Partial<{ customOrder: number }>).customOrder ?? 0
        : 0;

      return {
        id,
        name: tool.name!.trim(),
        description: typeof tool.description === 'string' ? tool.description : '',
        type: tool.type as Tool['type'],
        path: tool.path!.trim(),
        args: typeof tool.args === 'string' ? tool.args : '',
        workingDirectory: typeof tool.workingDirectory === 'string' && tool.workingDirectory.trim()
          ? tool.workingDirectory.trim()
          : undefined,
        categoryId,
        javaEnvId: typeof tool.javaEnvId === 'string' ? tool.javaEnvId : undefined,
        pythonEnvId: typeof tool.pythonEnvId === 'string' ? tool.pythonEnvId : undefined,
        icon: typeof tool.icon === 'string' && tool.icon.trim() ? tool.icon : undefined,
        accentColor: typeof tool.accentColor === 'string' && tool.accentColor.trim()
          ? tool.accentColor
          : typeof (tool as Partial<{ color: string }>).color === 'string' && (tool as Partial<{ color: string }>).color?.trim()
            ? (tool as Partial<{ color: string }>).color
            : undefined,
        lastUsed: typeof tool.lastUsed === 'number' ? tool.lastUsed : undefined,
        useCount: typeof tool.useCount === 'number' && tool.useCount >= 0 ? tool.useCount : 0,
        createdAt: typeof tool.createdAt === 'number' ? tool.createdAt : Date.now(),
        __sortOrder: sortOrder,
      };
    })
    .sort((a, b) => a.__sortOrder - b.__sortOrder || a.createdAt - b.createdAt)
    .map(({ __sortOrder, ...tool }) => {
      void __sortOrder;
      return tool;
    });
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
  } catch (error) {
    console.error('Failed to load data:', error);
    if (fs.existsSync(dataPath)) {
      try {
        backupCorruptedDataFile(dataPath);
      } catch (backupError) {
        console.error('Failed to back up corrupted data file:', backupError);
      }
    }
  }

  return {
    ...defaultData,
    categories: [...defaultCategories],
    settings: { ...defaultSettings },
  };
}

export function saveData(data: AppData): void {
  try {
    const dataPath = getDataPath();
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save data:', error);
  }
}

export function createId(): string {
  return uuidv4();
}
