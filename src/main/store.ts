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
  theme: 'system',      // 默认跟随 macOS 系统主题
  fontSize: 'medium',
  cardSize: 'medium',
  viewMode: 'grid',     // 默认网格视图
  sidebarWidth: 220,    // 侧边栏默认宽度
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

function getDataPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'launchbox-data.json');
}

export function loadData(): AppData {
  try {
    const dataPath = getDataPath();
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(raw) as Partial<AppData>;
      return {
        tools: data.tools ?? [],
        categories: data.categories ?? defaultCategories,
        settings: { ...defaultSettings, ...(data.settings ?? {}) },
      };
    }
  } catch (e) {
    console.error('Failed to load data:', e);
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
