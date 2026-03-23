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
import { execFileSync } from 'child_process';
import {
  AppData,
  BackupEntry,
  BackupResult,
  BackupSettings,
  DeleteBackupResult,
  Tool,
  Category,
  AppSettings,
  ClearAllDataResult,
  ImportInstalledAppsResult,
  RestoreBackupResult,
} from '../shared/types';
import { loadData, saveData, createId, sanitizeSettings, createBackup, createDefaultData, sanitizeData, sanitizeCategories, isBuiltInCategoryId, getDefaultBackupDirectory } from './store';
import { launchTool, openInTerminal, showInFinder } from './launcher';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let appData: AppData;
let backupTimer: NodeJS.Timeout | null = null;
const APP_DISPLAY_NAME = 'ToolBox';
const APP_IMPORT_ROOTS = [
  '/Applications',
  path.join(app.getPath('home'), 'Applications'),
  '/System/Applications',
  '/System/Applications/Utilities',
];

const APP_CATEGORY_FALLBACKS: Record<string, string> = {
  'public.app-category.developer-tools': 'daily-dev',
  'public.app-category.utilities': 'daily-system',
  'public.app-category.productivity': 'daily-work',
  'public.app-category.business': 'daily-work',
  'public.app-category.finance': 'daily-work',
  'public.app-category.graphics-design': 'daily-work',
  'public.app-category.photography': 'daily-work',
  'public.app-category.social-networking': 'daily-work',
  'public.app-category.news': 'misc-temp',
  'public.app-category.reference': 'misc-temp',
  'public.app-category.education': 'misc-temp',
  'public.app-category.entertainment': 'misc-temp',
  'public.app-category.games': 'misc-temp',
  'public.app-category.music': 'misc-temp',
  'public.app-category.video': 'misc-temp',
  'public.app-category.lifestyle': 'misc-temp',
  'public.app-category.travel': 'misc-temp',
  'public.app-category.weather': 'misc-temp',
};

interface ImportedAppCandidate {
  name: string;
  path: string;
  bundleId?: string;
  categoryType?: string;
  icon?: string;
  fallbackCategoryId: string;
}

interface AiCategoryPlan {
  categories: Array<{
    name: string;
    icon?: string;
    children: Array<{
      name: string;
      icon?: string;
      apps: string[];
    }>;
  }>;
}

function logAiImport(step: string, detail?: unknown): void {
  if (detail === undefined) {
    console.log(`[AI导入] ${step}`);
    return;
  }
  console.log(`[AI导入] ${step}`, detail);
}

function sanitizeCategoryName(name: string | undefined): string {
  if (typeof name !== 'string') return '';
  return name
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCategoryKey(name: string | undefined): string {
  return sanitizeCategoryName(name)
    .toLocaleLowerCase('zh-CN')
    .replace(/[()[\]{}<>《》【】「」『』、,，.。:：;；/\\|+_-]/g, '')
    .replace(/\s+/g, '');
}

function readPlistJson(plistPath: string): Record<string, unknown> | null {
  try {
    const raw = execFileSync('plutil', ['-convert', 'json', '-o', '-', plistPath], {
      encoding: 'utf8',
    });
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveBundlePaths(appPath: string): Array<{ bundlePath: string; plistPath: string; resourcesDir: string }> {
  const candidates = [
    {
      bundlePath: appPath,
      plistPath: path.join(appPath, 'Contents', 'Info.plist'),
      resourcesDir: path.join(appPath, 'Contents', 'Resources'),
    },
    {
      bundlePath: appPath,
      plistPath: path.join(appPath, 'Info.plist'),
      resourcesDir: appPath,
    },
    {
      bundlePath: path.join(appPath, 'Wrapper', 'Runner.app'),
      plistPath: path.join(appPath, 'Wrapper', 'Runner.app', 'Info.plist'),
      resourcesDir: path.join(appPath, 'Wrapper', 'Runner.app'),
    },
  ];

  return candidates.filter(candidate => fs.existsSync(candidate.plistPath));
}

function extractBundleIconNames(plist: Record<string, unknown>): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  const pushName = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return;
    const trimmed = value.trim();
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    names.push(trimmed);
  };

  const pushNames = (values: unknown) => {
    if (!Array.isArray(values)) return;
    for (const item of values) {
      pushName(item);
    }
  };

  const collectFromIconDictionary = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const iconDictionary = value as Record<string, unknown>;
    pushNames(iconDictionary.CFBundleIconFiles);
    pushName(iconDictionary.CFBundleIconName);
  };

  collectFromIconDictionary((plist.CFBundleIcons as Record<string, unknown> | undefined)?.CFBundlePrimaryIcon);
  collectFromIconDictionary((plist['CFBundleIcons~ipad'] as Record<string, unknown> | undefined)?.CFBundlePrimaryIcon);
  pushNames(plist.CFBundleIconFiles);
  pushName(plist.CFBundleIconFile);
  pushName(plist.CFBundleIconName);

  return names;
}

function resolveIconCandidates(resourcesDir: string, iconName: string): string[] {
  const normalizedName = iconName.replace(/\.(icns|png)$/i, '');
  const exactCandidates = [
    iconName,
    `${iconName}.icns`,
    `${iconName}.png`,
    `${normalizedName}.icns`,
    `${normalizedName}.png`,
  ];

  const discovered = new Set<string>();
  for (const candidate of exactCandidates) {
    const fullPath = path.join(resourcesDir, candidate);
    if (fs.existsSync(fullPath)) {
      discovered.add(fullPath);
    }
  }

  const lowerIconName = normalizedName.toLowerCase();
  const specificVariantPattern = new RegExp(`^${lowerIconName}(?:@\\dx|~ipad)?\\.(?:png|icns)$`, 'i');
  const fuzzyMatches = fs.readdirSync(resourcesDir)
    .filter(name => specificVariantPattern.test(name))
    .sort((a, b) => b.localeCompare(a, 'zh-CN'));

  for (const match of fuzzyMatches) {
    discovered.add(path.join(resourcesDir, match));
  }

  return Array.from(discovered);
}

function pickPreferredIconFile(paths: string[]): string | null {
  if (paths.length === 0) return null;

  const scored = paths
    .map(filePath => {
      const fileName = path.basename(filePath).toLowerCase();
      let score = 0;
      if (fileName.endsWith('.icns')) score += 1000;
      if (/@3x/.test(fileName)) score += 300;
      else if (/@2x/.test(fileName)) score += 200;
      if (/83_5|1024|512|256|180|167|152|120|76|60/.test(fileName)) score += 100;
      if (/appicon/.test(fileName)) score += 50;
      return { filePath, score };
    })
    .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath, 'zh-CN'));

  return scored[0]?.filePath ?? null;
}

function resolveBundleIconPath(appPath: string): string | null {
  const bundleCandidates = resolveBundlePaths(appPath);

  for (const bundle of bundleCandidates) {
    const plist = readPlistJson(bundle.plistPath);
    if (!plist || !fs.existsSync(bundle.resourcesDir)) continue;

    const iconNames = extractBundleIconNames(plist);
    const iconPaths = iconNames.flatMap(iconName => resolveIconCandidates(bundle.resourcesDir, iconName));
    const preferred = pickPreferredIconFile(iconPaths);
    if (preferred) return preferred;

    const icnsFiles = fs.readdirSync(bundle.resourcesDir)
      .filter(name => name.endsWith('.icns'))
      .sort();
    if (icnsFiles.length > 0) return path.join(bundle.resourcesDir, icnsFiles[0]);
  }

  return null;
}

function resolveLargestIconsetPng(iconsetDir: string): string | null {
  const pngFiles = fs.readdirSync(iconsetDir)
    .filter(name => name.endsWith('.png'))
    .map(name => {
      const match = name.match(/icon_(\d+)x(\d+)(@2x)?\.png$/);
      const width = match ? Number(match[1]) * (match[3] ? 2 : 1) : 0;
      return { name, width };
    })
    .sort((a, b) => b.width - a.width);

  return pngFiles.length > 0 ? path.join(iconsetDir, pngFiles[0].name) : null;
}

function convertIcnsToDataUrl(iconPath: string): string | null {
  const tempDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'launchbox-icon-'));

  try {
    const iconsetDir = `${tempDir}.iconset`;
    execFileSync('iconutil', ['--convert', 'iconset', iconPath, '--output', iconsetDir], {
      stdio: 'ignore',
    });

    const pngPath = resolveLargestIconsetPng(iconsetDir);
    if (!pngPath || !fs.existsSync(pngPath)) return null;

    return loadImageDataUrl(pngPath);
  } catch {
    return null;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(`${tempDir}.iconset`, { recursive: true, force: true });
  }
}

function getSystemAppIconDataUrl(appPath: string): string | null {
  const tempPath = path.join(app.getPath('temp'), `launchbox-system-icon-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
  const swiftSource = `
import AppKit
import Foundation

let targetPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]
let image = NSWorkspace.shared.icon(forFile: targetPath)
image.size = NSSize(width: 1024, height: 1024)

guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
  fputs("failed\\n", stderr)
  exit(1)
}

try pngData.write(to: URL(fileURLWithPath: outputPath))
`;

  try {
    execFileSync('swift', ['-e', swiftSource, appPath, tempPath], {
      stdio: 'ignore',
    });
    if (!fs.existsSync(tempPath)) return null;
    return loadImageDataUrl(tempPath);
  } catch {
    return null;
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function getBundleIconDataUrl(filePath: string): string | null {
  const systemIcon = getSystemAppIconDataUrl(filePath);
  if (systemIcon) return systemIcon;

  const iconPath = resolveBundleIconPath(filePath);
  if (!iconPath) return null;

  if (iconPath.endsWith('.icns')) {
    const converted = convertIcnsToDataUrl(iconPath);
    if (converted) return converted;
  }

  return loadImageDataUrl(iconPath);
}

function loadImageDataUrl(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;

  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  if (mimeTypes[extension]) {
    let sourcePath = filePath;

    // iOS 包装应用里常见的 CgBI PNG 浏览器无法直接显示，先转成标准 PNG。
    if (extension === '.png') {
      const header = fs.readFileSync(filePath).subarray(0, 16);
      const isCgbiPng = header.includes(Buffer.from('CgBI'));
      if (isCgbiPng) {
        const tempPath = path.join(app.getPath('temp'), `launchbox-icon-${Date.now()}.png`);
        try {
          execFileSync('sips', ['-s', 'format', 'png', filePath, '--out', tempPath], {
            stdio: 'ignore',
          });
          if (fs.existsSync(tempPath)) {
            sourcePath = tempPath;
          }
        } catch {
          sourcePath = filePath;
        }
      }
    }

    try {
      const fileBuffer = fs.readFileSync(sourcePath);
      return `data:${mimeTypes[extension]};base64,${fileBuffer.toString('base64')}`;
    } finally {
      if (sourcePath !== filePath) {
        fs.rmSync(sourcePath, { force: true });
      }
    }
  }

  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) return null;

  return image.resize({ width: 256, height: 256 }).toDataURL();
}

async function getSafeFileIcon(filePath: string): Promise<string | null> {
  if (filePath.endsWith('.app')) {
    return getBundleIconDataUrl(filePath);
  }

  const icon = await app.getFileIcon(filePath, { size: 'large' });
  return icon.isEmpty() ? null : icon.toDataURL();
}

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

function safeRealpath(targetPath: string): string {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return targetPath;
  }
}

function collectAppBundlePaths(rootDir: string, maxDepth = 3): string[] {
  if (!fs.existsSync(rootDir)) return [];

  const discovered: string[] = [];
  const queue: Array<{ dir: string; depth: number }> = [{ dir: rootDir, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    let entries: fs.Dirent[] = [];

    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current.dir, entry.name);
      if (entry.name.endsWith('.app')) {
        discovered.push(fullPath);
        continue;
      }

      if (entry.isDirectory() && current.depth < maxDepth) {
        queue.push({ dir: fullPath, depth: current.depth + 1 });
      }
    }
  }

  return discovered;
}

function getBundleString(plist: Record<string, unknown> | null, key: string): string | undefined {
  const value = plist?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveImportedAppName(appPath: string, plist: Record<string, unknown> | null): string {
  return (
    getBundleString(plist, 'CFBundleDisplayName')
    ?? getBundleString(plist, 'CFBundleName')
    ?? path.basename(appPath, '.app')
  );
}

function matchAppTokens(tokens: string, needles: string[]): boolean {
  return needles.some(needle => tokens.includes(needle));
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function resolveOpenAiEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

function resolveClaudeEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/v1/messages')
    ? normalized
    : normalized.endsWith('/messages')
      ? normalized
      : `${normalized}/v1/messages`;
}

async function classifyAppsWithAi(apps: ImportedAppCandidate[]): Promise<AiCategoryPlan | null> {
  if (!appData.settings.ai.enabled || apps.length === 0) {
    logAiImport('跳过 AI 分类', {
      enabled: appData.settings.ai.enabled,
      appCount: apps.length,
      reason: 'AI 未启用或应用数量为 0',
    });
    return null;
  }

  const ai = appData.settings.ai;
  if (!ai.apiKey.trim() || !ai.model.trim()) {
    logAiImport('跳过 AI 分类', {
      provider: ai.provider,
      hasApiKey: Boolean(ai.apiKey.trim()),
      hasModel: Boolean(ai.model.trim()),
      reason: '缺少 API Key 或模型名',
    });
    return null;
  }

  logAiImport('开始 AI 分类', {
    provider: ai.provider,
    baseUrl: ai.baseUrl,
    model: ai.model,
    forceOverwrite: ai.forceOverwrite,
    appCount: apps.length,
  });

  const userPrompt = [
    ai.prompt.trim(),
    '',
    '应用列表如下，请严格输出 JSON，不要输出解释：',
    JSON.stringify(apps.map(appItem => ({
      name: appItem.name,
      path: appItem.path,
      bundleId: appItem.bundleId ?? '',
      categoryType: appItem.categoryType ?? '',
      fallbackCategoryId: appItem.fallbackCategoryId,
    })), null, 2),
  ].join('\n');

  logAiImport('分类提示词预览', ai.prompt.trim().slice(0, 300));

  try {
    if (ai.provider === 'claude') {
      logAiImport('请求 Claude 接口', resolveClaudeEndpoint(ai.baseUrl));
      const response = await fetch(resolveClaudeEndpoint(ai.baseUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ai.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: ai.model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      logAiImport('Claude 响应状态', response.status);
      if (!response.ok) throw new Error(`Claude API ${response.status}`);
      const payload = await response.json() as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const text = payload.content?.map(item => item.text ?? '').join('\n') ?? '';
      const rawJson = extractJsonObject(text);
      logAiImport('Claude 原始返回预览', text.slice(0, 600));
      if (!rawJson) {
        logAiImport('Claude 返回中未提取到 JSON');
        return null;
      }
      const plan = JSON.parse(rawJson) as AiCategoryPlan;
      logAiImport('Claude JSON 解析成功', {
        topCategoryCount: plan.categories?.length ?? 0,
      });
      return plan;
    }

    logAiImport('请求 OpenAI 兼容接口', resolveOpenAiEndpoint(ai.baseUrl));
    const response = await fetch(resolveOpenAiEndpoint(ai.baseUrl), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        temperature: 0.2,
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    logAiImport('OpenAI 兼容响应状态', response.status);
    if (!response.ok) throw new Error(`OpenAI API ${response.status}`);
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content ?? '';
    const rawJson = extractJsonObject(text);
    logAiImport('OpenAI 原始返回预览', text.slice(0, 600));
    if (!rawJson) {
      logAiImport('OpenAI 返回中未提取到 JSON');
      return null;
    }
    const plan = JSON.parse(rawJson) as AiCategoryPlan;
    logAiImport('OpenAI JSON 解析成功', {
      topCategoryCount: plan.categories?.length ?? 0,
    });
    return plan;
  } catch (error) {
    console.error('[AI导入] AI 分类失败:', error);
    return null;
  }
}

function resolveImportedAppCategory(appPath: string, plist: Record<string, unknown> | null): string {
  const appName = resolveImportedAppName(appPath, plist).toLowerCase();
  const bundleId = (getBundleString(plist, 'CFBundleIdentifier') ?? '').toLowerCase();
  const tokens = `${appName} ${bundleId} ${appPath.toLowerCase()}`;
  const appCategoryType = getBundleString(plist, 'LSApplicationCategoryType');

  if (matchAppTokens(tokens, ['chrome', 'firefox', 'safari', 'edge', 'brave', 'arc', 'orion', 'vivaldi'])) {
    return 'daily-browser';
  }

  if (matchAppTokens(tokens, ['chatgpt', 'claude', 'deepseek', 'kimi', 'yuanbao', 'poe', 'ollama'])) {
    return 'misc-temp';
  }

  if (matchAppTokens(tokens, ['android studio', 'genymotion', 'simulator', 'emulator'])) {
    return 'android-sim';
  }

  if (matchAppTokens(tokens, ['adb', 'scrcpy', 'jadx', 'apktool', 'hopper', 'ghidra', 'ida', 'charles', 'burp', 'wireshark'])) {
    if (matchAppTokens(tokens, ['adb', 'scrcpy'])) return 'android-debug';
    if (matchAppTokens(tokens, ['jadx', 'apktool'])) return 'android-apk';
    if (matchAppTokens(tokens, ['hopper', 'ghidra', 'ida'])) return 'reverse-native';
    if (matchAppTokens(tokens, ['wireshark'])) return 'reverse-packet';
    if (matchAppTokens(tokens, ['burp', 'charles'])) return 'pentest-web';
  }

  return appCategoryType && APP_CATEGORY_FALLBACKS[appCategoryType]
    ? APP_CATEGORY_FALLBACKS[appCategoryType]
    : 'misc-temp';
}

function findCategoryByName(name: string, parentId?: string): Category | undefined {
  const normalizedName = normalizeCategoryKey(name);
  if (!normalizedName) return undefined;
  return appData.categories.find(category =>
    (category.parentId ?? undefined) === parentId
    && normalizeCategoryKey(category.name) === normalizedName
  );
}

function ensureCategory(name: string, icon: string, parentId?: string): Category {
  const normalizedName = sanitizeCategoryName(name);
  if (!normalizedName) {
    throw new Error('分类名称为空，无法创建分类');
  }

  const existed = findCategoryByName(normalizedName, parentId);
  if (existed) return existed;

  const nextCategory: Category = {
    id: createId(),
    name: normalizedName,
    icon,
    order: appData.categories.length,
    parentId,
  };
  appData.categories.push(nextCategory);
  return nextCategory;
}

function pruneEmptyBuiltInCategories(): void {
  const usedCategoryIds = new Set(appData.tools.map(tool => tool.categoryId));
  let changed = true;

  while (changed) {
    changed = false;
    const removableIds = appData.categories
      .filter(category => category.id !== 'all' && isBuiltInCategoryId(category.id))
      .filter(category => {
        if (usedCategoryIds.has(category.id)) return false;
        return !appData.categories.some(item => item.parentId === category.id);
      })
      .map(category => category.id);

    if (removableIds.length > 0) {
      changed = true;
      appData.categories = appData.categories.filter(category => !removableIds.includes(category.id));
    }
  }

  appData.categories = appData.categories.map((category, index) => ({
    ...category,
    order: index,
  }));
}

function dedupeCategories(): void {
  const categoryByKey = new Map<string, Category>();
  const mergedIds = new Map<string, string>();

  for (const category of appData.categories) {
    const key = `${category.parentId ?? 'root'}::${normalizeCategoryKey(category.name)}`;
    if (!normalizeCategoryKey(category.name)) continue;

    const existed = categoryByKey.get(key);
    if (!existed) {
      categoryByKey.set(key, category);
      continue;
    }

    mergedIds.set(category.id, existed.id);
  }

  if (mergedIds.size === 0) return;

  appData.tools = appData.tools.map(tool => (
    mergedIds.has(tool.categoryId)
      ? { ...tool, categoryId: mergedIds.get(tool.categoryId)! }
      : tool
  ));

  appData.categories = appData.categories
    .filter(category => !mergedIds.has(category.id))
    .map(category => (
      mergedIds.has(category.parentId ?? '')
        ? { ...category, parentId: mergedIds.get(category.parentId!) }
        : category
    ))
    .map((category, index) => ({ ...category, order: index }));
}

async function importInstalledApps(): Promise<ImportInstalledAppsResult> {
  logAiImport('开始导入已安装 App', {
    forceOverwrite: appData.settings.ai.forceOverwrite,
    aiEnabled: appData.settings.ai.enabled,
  });

  if (appData.settings.ai.forceOverwrite) {
    try {
      runBackup();
      logAiImport('强制覆盖前已创建备份');
    } catch (error) {
      console.error('[AI导入] 强制覆盖前备份失败:', error);
    }

    appData.tools = [];
    appData.categories = sanitizeCategories(undefined);
    logAiImport('已清空现有工具并重置分类');
  }

  const existingPaths = new Set(appData.tools.map(tool => safeRealpath(tool.path)));
  const discoveredPaths = new Set<string>();
  const importedCandidates: ImportedAppCandidate[] = [];
  let added = 0;
  let skipped = 0;

  for (const rootDir of APP_IMPORT_ROOTS) {
    for (const appPath of collectAppBundlePaths(rootDir)) {
      const realPath = safeRealpath(appPath);
      if (discoveredPaths.has(realPath)) continue;
      discoveredPaths.add(realPath);

      if (existingPaths.has(realPath)) {
        skipped += 1;
        continue;
      }

      const infoPlistPath = path.join(realPath, 'Contents', 'Info.plist');
      const plist = fs.existsSync(infoPlistPath) ? readPlistJson(infoPlistPath) : null;
      importedCandidates.push({
        name: resolveImportedAppName(realPath, plist),
        path: realPath,
        bundleId: getBundleString(plist, 'CFBundleIdentifier'),
        categoryType: getBundleString(plist, 'LSApplicationCategoryType'),
        icon: getBundleIconDataUrl(realPath) ?? undefined,
        fallbackCategoryId: resolveImportedAppCategory(realPath, plist),
      });
    }
  }

  logAiImport('扫描完成', {
    roots: APP_IMPORT_ROOTS,
    discovered: discoveredPaths.size,
    importedCandidates: importedCandidates.length,
    skipped,
  });

  const aiPlan = await classifyAppsWithAi(importedCandidates);
  const assignedAppPaths = new Set<string>();

  if (aiPlan?.categories?.length) {
    logAiImport('开始按 AI 结果创建分类', {
      topCategoryCount: aiPlan.categories.length,
    });
    for (const topCategoryPlan of aiPlan.categories) {
      const topCategoryName = sanitizeCategoryName(topCategoryPlan?.name);
      if (!topCategoryName) {
        logAiImport('跳过空总分类', topCategoryPlan);
        continue;
      }
      const topCategory = ensureCategory(topCategoryName, topCategoryPlan.icon?.trim() || '📁');

      for (const childPlan of topCategoryPlan.children ?? []) {
        const childCategoryName = sanitizeCategoryName(childPlan?.name);
        if (!childCategoryName) {
          logAiImport('跳过空副分类', {
            parent: topCategoryName,
            child: childPlan,
          });
          continue;
        }
        const useParentCategory = normalizeCategoryKey(childCategoryName) === normalizeCategoryKey(topCategoryName);
        if (useParentCategory) {
          logAiImport('跳过与总分类重复的副分类', {
            parent: topCategoryName,
            child: childCategoryName,
          });
        }
        const childCategory = useParentCategory
          ? topCategory
          : ensureCategory(childCategoryName, childPlan.icon?.trim() || '🗂️', topCategory.id);

        for (const appName of childPlan.apps ?? []) {
          const matchedApp = importedCandidates.find(candidate =>
            !assignedAppPaths.has(candidate.path)
            && candidate.name === appName
          );
          if (!matchedApp) continue;

          appData.tools.push({
            id: createId(),
            name: matchedApp.name,
            description: '',
            type: 'app',
            path: matchedApp.path,
            args: '',
            workingDirectory: path.dirname(matchedApp.path),
            categoryId: childCategory.id,
            icon: matchedApp.icon,
            iconSource: matchedApp.icon ? 'default' : undefined,
            useCount: 0,
            createdAt: Date.now(),
          });
          assignedAppPaths.add(matchedApp.path);
          existingPaths.add(matchedApp.path);
          added += 1;
        }
      }
    }
  } else {
    logAiImport('未获得 AI 分类结果，回退到默认规则导入');
  }

  for (const appItem of importedCandidates) {
    if (assignedAppPaths.has(appItem.path) || existingPaths.has(appItem.path)) continue;

    appData.tools.push({
      id: createId(),
      name: appItem.name,
      description: '',
      type: 'app',
      path: appItem.path,
      args: '',
      workingDirectory: path.dirname(appItem.path),
      categoryId: appItem.fallbackCategoryId,
      icon: appItem.icon,
      iconSource: appItem.icon ? 'default' : undefined,
      useCount: 0,
      createdAt: Date.now(),
    });
    existingPaths.add(appItem.path);
    added += 1;
  }

  if (appData.settings.ai.forceOverwrite) {
    dedupeCategories();
    pruneEmptyBuiltInCategories();
    logAiImport('已清理重复分类和空的默认分类');
  }

  saveData(appData);
  logAiImport('导入完成', {
    added,
    skipped,
    totalTools: appData.tools.length,
    totalCategories: appData.categories.length,
  });
  return {
    tools: appData.tools,
    categories: appData.categories,
    added,
    skipped,
  };
}

function createWindow(): void {
  const { windowBounds } = appData.settings;

  mainWindow = new BrowserWindow({
    width: windowBounds?.width ?? 1200,
    height: windowBounds?.height ?? 750,
    x: windowBounds?.x,
    y: windowBounds?.y,
    minWidth: 560,
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

function parseClock(value: string): { hours: number; minutes: number } {
  const [hoursText = '0', minutesText = '0'] = value.split(':');
  return {
    hours: Number.parseInt(hoursText, 10) || 0,
    minutes: Number.parseInt(minutesText, 10) || 0,
  };
}

function resolveLastScheduledDaily(now: Date, clock: string): number {
  const { hours, minutes } = parseClock(clock);
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);
  if (scheduled.getTime() > now.getTime()) {
    scheduled.setDate(scheduled.getDate() - 1);
  }
  return scheduled.getTime();
}

function resolveLastScheduledWeekly(now: Date, day: number, clock: string): number {
  const { hours, minutes } = parseClock(clock);
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);
  const diff = (scheduled.getDay() - day + 7) % 7;
  scheduled.setDate(scheduled.getDate() - diff);
  if (scheduled.getTime() > now.getTime()) {
    scheduled.setDate(scheduled.getDate() - 7);
  }
  return scheduled.getTime();
}

function shouldRunAutoBackup(settings: BackupSettings, now = Date.now()): boolean {
  if (!settings.enabled) return false;

  const lastBackupAt = typeof settings.lastBackupAt === 'number' ? settings.lastBackupAt : 0;

  if (settings.mode === 'interval') {
    if (!lastBackupAt) return true;
    return now - lastBackupAt >= settings.intervalHours * 60 * 60 * 1000;
  }

  const currentDate = new Date(now);
  const scheduledAt = settings.mode === 'weekly'
    ? resolveLastScheduledWeekly(currentDate, settings.weeklyDay, settings.weeklyTime)
    : resolveLastScheduledDaily(currentDate, settings.dailyTime);

  return scheduledAt > 0 && lastBackupAt < scheduledAt;
}

function resolveBackupDirectory(preferredDirectory?: string): string {
  return preferredDirectory?.trim() || appData.settings.backup.directory || getDefaultBackupDirectory();
}

function listBackupsInDirectory(preferredDirectory?: string): BackupEntry[] {
  const directory = resolveBackupDirectory(preferredDirectory);
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => {
      const fullPath = path.join(directory, entry.name);
      const stats = fs.statSync(fullPath);
      return {
        path: fullPath,
        fileName: entry.name,
        createdAt: stats.mtimeMs,
        size: stats.size,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt || a.fileName.localeCompare(b.fileName, 'zh-CN'));
}

function pruneOldBackups(preferredDirectory?: string): void {
  const keepCount = Math.max(1, appData.settings.backup.keepCount || 10);
  const backups = listBackupsInDirectory(preferredDirectory);
  const staleBackups = backups.slice(keepCount);

  for (const backup of staleBackups) {
    try {
      fs.rmSync(backup.path, { force: true });
    } catch (error) {
      console.error('Failed to remove stale backup:', backup.path, error);
    }
  }
}

function deleteBackupFile(backupPath: string): DeleteBackupResult {
  if (typeof backupPath !== 'string' || !backupPath.trim()) {
    throw new Error('未选择备份文件');
  }
  if (!fs.existsSync(backupPath)) {
    throw new Error('备份文件不存在');
  }

  fs.rmSync(backupPath, { force: true });
  return { deletedPath: backupPath };
}

function runBackup(preferredDirectory?: string): BackupResult {
  const result = createBackup(appData, preferredDirectory);
  pruneOldBackups(preferredDirectory);
  appData.settings.backup = {
    ...appData.settings.backup,
    directory: preferredDirectory?.trim() || appData.settings.backup.directory,
    lastBackupAt: result.createdAt,
  };
  saveData(appData);
  return result;
}

function checkAutoBackup(): void {
  try {
    if (shouldRunAutoBackup(appData.settings.backup)) {
      runBackup();
    }
  } catch (error) {
    console.error('Failed to run scheduled backup:', error);
  }
}

function restoreBackupFromFile(backupPath: string): RestoreBackupResult {
  const raw = fs.readFileSync(backupPath, 'utf-8');
  if (!raw.trim()) {
    throw new Error('备份文件为空');
  }

  let backup: BackupResult | undefined;
  try {
    backup = runBackup();
  } catch (error) {
    console.error('Failed to back up current data before restore:', error);
  }

  const parsed = JSON.parse(raw) as Partial<AppData>;
  const restoredData = sanitizeData(parsed);
  appData = restoredData;
  saveData(appData);
  resetBackupScheduler();

  return {
    data: appData,
    restoredFrom: backupPath,
    backup,
  };
}

function resetBackupScheduler(): void {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }

  checkAutoBackup();
  backupTimer = setInterval(checkAutoBackup, 60 * 1000);
}

function createTray(): void {
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-icon.png');
  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  trayIcon.setTemplateImage(true);

  tray = new Tray(trayIcon);
  tray.setToolTip(APP_DISPLAY_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `显示 ${APP_DISPLAY_NAME}`,
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: '设置',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send('open-settings');
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
    resetBackupScheduler();

    if (process.platform === 'darwin' || process.platform === 'win32') {
      try {
        app.setLoginItemSettings({
          openAtLogin: appData.settings.startAtLogin,
        });
      } catch (error) {
        console.warn('Failed to update login item settings:', error);
      }
    }

    return appData.settings;
  });

  ipcMain.handle('create-backup', (_event, preferredDirectory?: string) => {
    return runBackup(preferredDirectory);
  });

  ipcMain.handle('list-backups', (_event, preferredDirectory?: string): BackupEntry[] => {
    return listBackupsInDirectory(preferredDirectory);
  });

  ipcMain.handle('delete-backup', (_event, backupPath: string): DeleteBackupResult => {
    return deleteBackupFile(backupPath);
  });

  ipcMain.handle('clear-all-data', (): ClearAllDataResult => {
    let backup: BackupResult | undefined;

    try {
      backup = runBackup();
    } catch (error) {
      console.error('Failed to create backup before clearing data:', error);
    }

    const nextData = createDefaultData();
    appData = nextData;
    saveData(appData);
    resetBackupScheduler();

    return {
      data: appData,
      backup,
    };
  });

  ipcMain.handle('restore-backup', (_event, backupPath: string): RestoreBackupResult => {
    if (typeof backupPath !== 'string' || !backupPath.trim()) {
      throw new Error('未选择备份文件');
    }
    if (!fs.existsSync(backupPath)) {
      throw new Error('备份文件不存在');
    }

    return restoreBackupFromFile(backupPath);
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
      return await getSafeFileIcon(filePath);
    } catch {
      return null;
    }
  });

  ipcMain.handle('import-installed-apps', () => {
    try {
      return importInstalledApps();
    } catch (error) {
      console.error('Failed to import installed apps:', error);
      return {
        tools: appData.tools,
        categories: appData.categories,
        added: 0,
        skipped: 0,
      } satisfies ImportInstalledAppsResult;
    }
  });

  ipcMain.handle('load-image-data-url', (_event, filePath: string) => {
    try {
      return loadImageDataUrl(filePath);
    } catch {
      return null;
    }
  });

  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('native-theme-changed', nativeTheme.shouldUseDarkColors);
  });
}

app.whenReady().then(() => {
  app.setName(APP_DISPLAY_NAME);
  appData = loadData();
  setupIPC();
  resetBackupScheduler();
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
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
  saveWindowBounds();
});
