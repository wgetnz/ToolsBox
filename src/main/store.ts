import { AiSettings, AppData, AppSettings, BackupResult, BackupSettings, Category, Tool } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const defaultCategories: Category[] = [
  { id: 'all', name: '全部工具', icon: '🔧', order: 0 },
  { id: 'daily', name: '常用工具', icon: '🧰', order: 1 },
  { id: 'daily-system', name: '系统控制', icon: '🖥️', order: 2, parentId: 'daily' },
  { id: 'daily-work', name: '工作软件', icon: '💼', order: 3, parentId: 'daily' },
  { id: 'daily-browser', name: '浏览器', icon: '🌐', order: 4, parentId: 'daily' },
  { id: 'daily-dev', name: '开发软件', icon: '💻', order: 5, parentId: 'daily' },
  { id: 'pentest', name: '渗透工具', icon: '🛡️', order: 6 },
  { id: 'pentest-info', name: '信息搜集', icon: '🔍', order: 7, parentId: 'pentest' },
  { id: 'pentest-web', name: 'Web 安全', icon: '🕸️', order: 8, parentId: 'pentest' },
  { id: 'pentest-intranet', name: '内网渗透', icon: '🧬', order: 9, parentId: 'pentest' },
  { id: 'pentest-exploit', name: '漏洞利用', icon: '💥', order: 10, parentId: 'pentest' },
  { id: 'reverse', name: '反编译', icon: '🧩', order: 11 },
  { id: 'reverse-java', name: 'Java 逆向', icon: '☕', order: 12, parentId: 'reverse' },
  { id: 'reverse-native', name: 'Native 分析', icon: '⚙️', order: 13, parentId: 'reverse' },
  { id: 'reverse-packet', name: '协议分析', icon: '📡', order: 14, parentId: 'reverse' },
  { id: 'android', name: '安卓', icon: '🤖', order: 15 },
  { id: 'android-apk', name: 'APK 处理', icon: '📦', order: 16, parentId: 'android' },
  { id: 'android-debug', name: '调试桥', icon: '🔌', order: 17, parentId: 'android' },
  { id: 'android-sim', name: '模拟器', icon: '📱', order: 18, parentId: 'android' },
  { id: 'misc', name: '其他工具', icon: '📁', order: 19 },
  { id: 'misc-temp', name: '临时收纳', icon: '🗂️', order: 20, parentId: 'misc' },
];

const builtInCategoryIds = new Set(defaultCategories.map(category => category.id));

const defaultAi: AiSettings = {
  enabled: true,
  forceOverwrite: false,
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: '',
  prompt: '请根据给定的 macOS 应用列表进行两级分类。第一级是总分类，必须是少量、稳定、概括性强的大类，尽量控制在 4 到 8 个，并且把最常见、使用频率最高、最适合作为主导航入口的总分类排在前面。第二级是副分类，可以比总分类更细，用于承接具体用途、技术方向、使用场景或工具类型。请优先合并语义相近、用途重复、只是名字不同的小类，不要生成重复分类、近义分类或过碎的小类。每个应用必须且只能归入一个副分类。分类结果要兼顾常见性、实用性、可读性和长期维护，不要为了凑分类而生造边缘类别。输出严格 JSON，格式为 {"categories":[{"name":"总分类","icon":"图标","children":[{"name":"副分类","icon":"图标","apps":["应用名1","应用名2"]}]}]}，不要输出任何解释性文字。',
};

const legacyAiPrompt = '请根据给定的 macOS 应用列表，先规划总分类，再规划每个总分类下的子分类，并把每个应用分配到一个子分类。请优先生成适合工具导航的分类，不要过细。输出 JSON，格式为 {"categories":[{"name":"总分类","icon":"图标","children":[{"name":"子分类","icon":"图标","apps":["应用名1","应用名2"]}]}]}。';
const previousDefaultAiPrompt = '请根据给定的 macOS 应用列表进行两级分类：第一级是总分类，必须是少量、稳定、概括性强的大类，尽量控制在 4 到 8 个，不要把总分类拆得太细；第二级是副分类，可以比总分类更细，用于承接具体用途、技术方向、使用场景或工具类型。每个应用必须只归入一个副分类。优先保证总分类清晰、副分类实用、结构自然。输出严格 JSON，格式为 {"categories":[{"name":"总分类","icon":"图标","children":[{"name":"副分类","icon":"图标","apps":["应用名1","应用名2"]}]}]}，不要输出任何解释性文字。';

const defaultBackup: BackupSettings = {
  enabled: false,
  directory: '',
  keepCount: 10,
  mode: 'interval',
  intervalHours: 24,
  dailyTime: '03:00',
  weeklyDay: 0,
  weeklyTime: '03:00',
};

const defaultSettings: AppSettings = {
  theme: 'system',
  fontSize: 'medium',
  cardSize: 'medium',
  viewMode: 'grid',
  searchScope: 'all',
  sidebarWidth: 220,
  hoverSwitchCategories: true,
  javaEnvs: [],
  pythonEnvs: [],
  ai: defaultAi,
  backup: defaultBackup,
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
const validSearchScopes = new Set<AppSettings['searchScope']>(['all', 'current']);
const validToolTypes = new Set<Tool['type']>(['jar', 'python', 'shell', 'executable', 'app', 'url']);
const sidebarWidthMin = 72;
const sidebarWidthMax = 520;

function sanitizeCategoryName(name: string | undefined): string {
  if (typeof name !== 'string') return '';
  return name
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToolType(type: Partial<Tool>['type'], toolPath: string): Tool['type'] {
  const trimmedPath = toolPath.trim();
  if (trimmedPath.endsWith('.app')) return 'app';
  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) return 'url';
  if (trimmedPath.endsWith('.sh') || trimmedPath.endsWith('.bash') || trimmedPath.endsWith('.zsh')) return 'shell';
  if (trimmedPath.endsWith('.jar')) return 'jar';
  if (trimmedPath.endsWith('.py')) return 'python';
  return validToolTypes.has(type as Tool['type']) ? type as Tool['type'] : 'executable';
}

function getDataPath(): string {
  return path.join(app.getPath('userData'), 'launchbox-data.json');
}

export function getDefaultBackupDirectory(): string {
  return path.join(app.getPath('userData'), 'backups');
}

export function isBuiltInCategoryId(categoryId: string): boolean {
  return builtInCategoryIds.has(categoryId);
}

function backupCorruptedDataFile(dataPath: string): void {
  const backupPath = `${dataPath}.corrupt-${Date.now()}.bak`;
  fs.copyFileSync(dataPath, backupPath);
}

function sanitizeAiSettings(settings: Partial<AiSettings> | undefined): AiSettings {
  const prompt = typeof settings?.prompt === 'string' && settings.prompt.trim()
    ? settings.prompt === legacyAiPrompt || settings.prompt === previousDefaultAiPrompt
      ? defaultAi.prompt
      : settings.prompt
    : defaultAi.prompt;

  return {
    enabled: typeof settings?.enabled === 'boolean' ? settings.enabled : defaultAi.enabled,
    forceOverwrite: typeof settings?.forceOverwrite === 'boolean' ? settings.forceOverwrite : defaultAi.forceOverwrite,
    provider: settings?.provider === 'claude' ? 'claude' : 'openai',
    apiKey: typeof settings?.apiKey === 'string' ? settings.apiKey : defaultAi.apiKey,
    baseUrl: typeof settings?.baseUrl === 'string' && settings.baseUrl.trim() ? settings.baseUrl.trim() : defaultAi.baseUrl,
    model: typeof settings?.model === 'string' ? settings.model : defaultAi.model,
    prompt,
  };
}

function sanitizeClock(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : fallback;
}

function sanitizeBackupSettings(settings: Partial<BackupSettings> | undefined): BackupSettings {
  const keepCount = typeof settings?.keepCount === 'number'
    ? Math.max(1, Math.min(200, Math.round(settings.keepCount)))
    : defaultBackup.keepCount;
  const intervalHours = typeof settings?.intervalHours === 'number'
    ? Math.max(1, Math.min(720, Math.round(settings.intervalHours)))
    : defaultBackup.intervalHours;
  const weeklyDay = typeof settings?.weeklyDay === 'number'
    ? Math.max(0, Math.min(6, Math.round(settings.weeklyDay)))
    : defaultBackup.weeklyDay;

  return {
    enabled: typeof settings?.enabled === 'boolean' ? settings.enabled : defaultBackup.enabled,
    directory: typeof settings?.directory === 'string' ? settings.directory.trim() : defaultBackup.directory,
    keepCount,
    mode: settings?.mode === 'daily' || settings?.mode === 'weekly' ? settings.mode : defaultBackup.mode,
    intervalHours,
    dailyTime: sanitizeClock(settings?.dailyTime, defaultBackup.dailyTime),
    weeklyDay,
    weeklyTime: sanitizeClock(settings?.weeklyTime, defaultBackup.weeklyTime),
    lastBackupAt: typeof settings?.lastBackupAt === 'number' ? settings.lastBackupAt : undefined,
  };
}

export function sanitizeSettings(settings: Partial<AppSettings> | undefined): AppSettings {
  const legacySettings = settings as Partial<{
    aiImport: Partial<AiSettings>;
    aiProviders: Array<Partial<AiSettings>>;
  }> | undefined;

  const nextSettings: AppSettings = {
    ...defaultSettings,
    ...(settings ?? {}),
    javaEnvs: [],
    pythonEnvs: [],
    ai: { ...defaultAi },
    backup: { ...defaultBackup },
  };

  nextSettings.theme = validThemes.has(nextSettings.theme) ? nextSettings.theme : defaultSettings.theme;
  nextSettings.fontSize = validFontSizes.has(nextSettings.fontSize) ? nextSettings.fontSize : defaultSettings.fontSize;
  nextSettings.cardSize = validCardSizes.has(nextSettings.cardSize) ? nextSettings.cardSize : defaultSettings.cardSize;
  nextSettings.viewMode = validViewModes.has(nextSettings.viewMode) ? nextSettings.viewMode : defaultSettings.viewMode;
  nextSettings.searchScope = validSearchScopes.has(nextSettings.searchScope) ? nextSettings.searchScope : defaultSettings.searchScope;
  nextSettings.sidebarWidth = typeof nextSettings.sidebarWidth === 'number'
    ? Math.max(sidebarWidthMin, Math.min(sidebarWidthMax, Math.round(nextSettings.sidebarWidth)))
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

  nextSettings.ai = sanitizeAiSettings(settings?.ai ?? (
    legacySettings?.aiImport || Array.isArray(legacySettings?.aiProviders)
      ? {
          enabled: legacySettings?.aiImport?.enabled,
          provider: legacySettings?.aiImport?.provider,
          prompt: legacySettings?.aiImport?.prompt,
          apiKey: Array.isArray(legacySettings?.aiProviders)
            ? legacySettings.aiProviders?.find(provider => provider?.provider === (legacySettings?.aiImport?.provider === 'claude' ? 'claude' : 'openai'))?.apiKey
            : undefined,
          baseUrl: Array.isArray(legacySettings?.aiProviders)
            ? legacySettings.aiProviders?.find(provider => provider?.provider === (legacySettings?.aiImport?.provider === 'claude' ? 'claude' : 'openai'))?.baseUrl
            : undefined,
          model: Array.isArray(legacySettings?.aiProviders)
            ? legacySettings.aiProviders?.find(provider => provider?.provider === (legacySettings?.aiImport?.provider === 'claude' ? 'claude' : 'openai'))?.model
            : undefined,
        }
      : undefined
  ));
  nextSettings.backup = sanitizeBackupSettings(settings?.backup);

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
      if (category.id === 'daily-ai' || category.id === 'ai' || category.id === 'ai-clients') continue;

      const base = discovered.get(category.id) ?? {
        id: category.id,
        name: '未命名分类',
        icon: '📦',
        order: discovered.size,
      };

      discovered.set(category.id, {
        id: category.id,
        name: sanitizeCategoryName(category.name) || base.name,
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
        : tool.categoryId === 'daily-ai' || tool.categoryId === 'ai' || tool.categoryId === 'ai-clients'
          ? 'misc-temp'
        : 'misc';
      const normalizedType = normalizeToolType(tool.type, tool.path!);

      const sortOrder = typeof (tool as Partial<{ customOrder: number }>).customOrder === 'number'
        ? (tool as Partial<{ customOrder: number }>).customOrder ?? 0
        : 0;

      return {
        id,
        name: tool.name!.trim(),
        description: typeof tool.description === 'string' ? tool.description : '',
        type: normalizedType,
        path: tool.path!.trim(),
        args: typeof tool.args === 'string' ? tool.args : '',
        workingDirectory: typeof tool.workingDirectory === 'string' && tool.workingDirectory.trim()
          ? tool.workingDirectory.trim()
          : undefined,
        categoryId,
        javaEnvId: typeof tool.javaEnvId === 'string' ? tool.javaEnvId : undefined,
        pythonEnvId: typeof tool.pythonEnvId === 'string' ? tool.pythonEnvId : undefined,
        icon: typeof tool.icon === 'string' && tool.icon.trim() ? tool.icon : undefined,
        iconSource: tool.iconSource === 'custom'
          ? 'custom' as const
          : tool.iconSource === 'default'
            ? 'default' as const
            : (normalizedType === 'app' && typeof tool.icon === 'string' && tool.icon.trim() ? 'default' as const : undefined),
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
      if (!raw.trim()) {
        const initialData = createDefaultData();
        saveData(initialData);
        return initialData;
      }
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

  return createDefaultData();
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

export function createDefaultData(): AppData {
  return {
    ...defaultData,
    tools: [],
    categories: defaultCategories.map(category => ({ ...category })),
    settings: {
      ...defaultSettings,
      ai: { ...defaultAi },
      backup: { ...defaultBackup },
    },
  };
}

function formatBackupTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ];
  const time = [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ];
  return `${parts.join('-')}_${time.join('-')}`;
}

export function createBackup(data: AppData, preferredDirectory?: string): BackupResult {
  const createdAt = Date.now();
  const directory = preferredDirectory?.trim() || data.settings.backup.directory || getDefaultBackupDirectory();
  fs.mkdirSync(directory, { recursive: true });

  const backupPath = path.join(directory, `launchbox-backup-${formatBackupTimestamp(createdAt)}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf-8');

  return {
    path: backupPath,
    createdAt,
  };
}

export function createId(): string {
  return uuidv4();
}
