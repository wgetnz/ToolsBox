import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { AppData, BackupEntry, BackupResult, ClearAllDataResult, DeleteBackupResult, RestoreBackupResult, Tool, Category, AppSettings, ImportInstalledAppsResult } from '../../shared/types';

declare global {
  interface Window {
    launchbox: {
      getData: () => Promise<AppData>;
      saveTool: (tool: Tool) => Promise<Tool[]>;
      deleteTool: (toolId: string) => Promise<Tool[]>;
      saveCategory: (category: Category) => Promise<Category[]>;
      deleteCategory: (categoryId: string) => Promise<{ categories: Category[]; tools: Tool[] }>;
      saveSettings: (settings: AppSettings) => Promise<AppSettings>;
      createBackup: (preferredDirectory?: string) => Promise<BackupResult>;
      listBackups: (preferredDirectory?: string) => Promise<BackupEntry[]>;
      deleteBackup: (backupPath: string) => Promise<DeleteBackupResult>;
      clearAllData: () => Promise<ClearAllDataResult>;
      restoreBackup: (backupPath: string) => Promise<RestoreBackupResult>;
      launchTool: (toolId: string) => Promise<{ success: boolean; error?: string }>;
      selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
      selectDirectory: () => Promise<string | null>;
      openInTerminal: (dirPath: string) => Promise<void>;
      showInFinder: (filePath: string) => Promise<void>;
      windowControl: (action: 'minimize' | 'maximize' | 'close') => Promise<void>;
      getFileIcon: (filePath: string) => Promise<string | null>;
      importInstalledApps: () => Promise<ImportInstalledAppsResult>;
      loadImageDataUrl: (filePath: string) => Promise<string | null>;
      onNativeThemeChanged: (cb: (isDark: boolean) => void) => () => void;
      onOpenSettingsRequested: (cb: () => void) => () => void;
    };
  }
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  data: AppData | null;
  loading: boolean;
  selectedCategoryId: string;
  searchQuery: string;
  searchScope: 'all' | 'current';
  viewMode: 'grid' | 'list';
  toasts: Toast[];
}

type Action =
  | { type: 'SET_DATA'; payload: AppData }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_TOOLS'; payload: Tool[] }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'SET_SETTINGS'; payload: AppSettings }
  | { type: 'SELECT_CATEGORY'; payload: string }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_SEARCH_SCOPE'; payload: 'all' | 'current' }
  | { type: 'SET_VIEW_MODE'; payload: 'grid' | 'list' }
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, data: action.payload, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_TOOLS':
      return { ...state, data: state.data ? { ...state.data, tools: action.payload } : state.data };
    case 'SET_CATEGORIES':
      return { ...state, data: state.data ? { ...state.data, categories: action.payload } : state.data };
    case 'SET_SETTINGS':
      return { ...state, data: state.data ? { ...state.data, settings: action.payload } : state.data };
    case 'SELECT_CATEGORY':
      return { ...state, selectedCategoryId: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.payload };
    case 'SET_SEARCH_SCOPE':
      return { ...state, searchScope: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(toast => toast.id !== action.payload) };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  saveTool: (tool: Tool) => Promise<void>;
  deleteTool: (toolId: string) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  saveCategorySilent: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  saveSettingsSilent: (settings: AppSettings) => Promise<void>;
  createBackup: (preferredDirectory?: string) => Promise<BackupResult>;
  listBackups: (preferredDirectory?: string) => Promise<BackupEntry[]>;
  deleteBackup: (backupPath: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  restoreBackup: (backupPath: string) => Promise<void>;
  launchTool: (toolId: string) => Promise<void>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  selectDirectory: () => Promise<string | null>;
  openInTerminal: (dirPath: string) => Promise<void>;
  showInFinder: (filePath: string) => Promise<void>;
  importInstalledApps: () => Promise<void>;
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void;
  selectCategory: (id: string) => void;
  setSearch: (q: string) => void;
  setSearchScope: (scope: 'all' | 'current') => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastIdCounter = 0;

function getInitialCategoryId(data: AppData): string {
  const firstTopCategory = data.categories
    .filter(category => !category.parentId && category.id !== 'all')
    .sort((a, b) => a.order - b.order)[0];
  return firstTopCategory?.id ?? 'all';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    data: null,
    loading: true,
    selectedCategoryId: '',
    searchQuery: '',
    searchScope: 'all',
    viewMode: 'grid',
    toasts: [],
  });

  useEffect(() => {
    window.launchbox.getData().then(data => {
      dispatch({ type: 'SET_DATA', payload: data });
      dispatch({ type: 'SELECT_CATEGORY', payload: getInitialCategoryId(data) });
      if (data.settings.viewMode) {
        dispatch({ type: 'SET_VIEW_MODE', payload: data.settings.viewMode });
      }
      dispatch({ type: 'SET_SEARCH_SCOPE', payload: data.settings.searchScope ?? 'all' });
    });
  }, []);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = String(++toastIdCounter);
    dispatch({ type: 'ADD_TOAST', payload: { id, type, message } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 3000);
  }, []);

  const saveTool = useCallback(async (tool: Tool) => {
    const tools = await window.launchbox.saveTool(tool);
    dispatch({ type: 'SET_TOOLS', payload: tools });
    showToast('success', `工具 "${tool.name}" 已保存`);
  }, [showToast]);

  const deleteTool = useCallback(async (toolId: string) => {
    const tools = await window.launchbox.deleteTool(toolId);
    dispatch({ type: 'SET_TOOLS', payload: tools });
    showToast('success', '工具已删除');
  }, [showToast]);

  const saveCategory = useCallback(async (category: Category) => {
    const categories = await window.launchbox.saveCategory(category);
    dispatch({ type: 'SET_CATEGORIES', payload: categories });
    showToast('success', '分类已保存');
  }, [showToast]);

  const saveCategorySilent = useCallback(async (category: Category) => {
    const categories = await window.launchbox.saveCategory(category);
    dispatch({ type: 'SET_CATEGORIES', payload: categories });
  }, []);

  const deleteCategory = useCallback(async (categoryId: string) => {
    const result = await window.launchbox.deleteCategory(categoryId);
    dispatch({ type: 'SET_CATEGORIES', payload: result.categories });
    dispatch({ type: 'SET_TOOLS', payload: result.tools });
    dispatch({
      type: 'SELECT_CATEGORY',
      payload: getInitialCategoryId({
        categories: result.categories,
        tools: result.tools,
        settings: state.data?.settings ?? {
          theme: 'system',
          fontSize: 'medium',
          cardSize: 'medium',
          viewMode: 'grid',
          searchScope: 'all',
          sidebarWidth: 220,
          hoverSwitchCategories: true,
          javaEnvs: [],
          pythonEnvs: [],
          ai: {
            enabled: true,
            forceOverwrite: false,
            provider: 'openai',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: '',
            prompt: '',
          },
          backup: {
            enabled: false,
            directory: '',
            keepCount: 10,
            mode: 'interval',
            intervalHours: 24,
            dailyTime: '03:00',
            weeklyDay: 0,
            weeklyTime: '03:00',
          },
          startAtLogin: false,
          minimizeToTray: true,
        },
      }),
    });
    showToast('success', '分类已删除');
  }, [showToast, state.data?.settings]);

  const saveSettings = useCallback(async (settings: AppSettings) => {
    const saved = await window.launchbox.saveSettings(settings);
    dispatch({ type: 'SET_SETTINGS', payload: saved });
    showToast('success', '设置已保存');
  }, [showToast]);

  const saveSettingsSilent = useCallback(async (settings: AppSettings) => {
    const saved = await window.launchbox.saveSettings(settings);
    dispatch({ type: 'SET_SETTINGS', payload: saved });
  }, []);

  const launchTool = useCallback(async (toolId: string) => {
    const result = await window.launchbox.launchTool(toolId);
    if (result.success) {
      const tool = state.data?.tools.find(item => item.id === toolId);
      showToast('success', `已启动 ${tool?.name ?? '工具'}`);
      const data = await window.launchbox.getData();
      dispatch({ type: 'SET_DATA', payload: data });
    } else {
      showToast('error', `启动失败: ${result.error}`);
    }
  }, [showToast, state.data]);

  const selectFile = useCallback(
    (filters?: { name: string; extensions: string[] }[]) => window.launchbox.selectFile(filters),
    []
  );

  const selectDirectory = useCallback(() => window.launchbox.selectDirectory(), []);
  const openInTerminal = useCallback((dirPath: string) => window.launchbox.openInTerminal(dirPath), []);
  const showInFinder = useCallback((filePath: string) => window.launchbox.showInFinder(filePath), []);

  const importInstalledApps = useCallback(async () => {
    const result = await window.launchbox.importInstalledApps();
    dispatch({ type: 'SET_CATEGORIES', payload: result.categories });
    dispatch({ type: 'SET_TOOLS', payload: result.tools });
    showToast('success', `已导入 ${result.added} 个 App，跳过 ${result.skipped} 个已有条目`);
  }, [showToast]);

  const createBackup = useCallback(async (preferredDirectory?: string) => {
    const result = await window.launchbox.createBackup(preferredDirectory);
    const data = await window.launchbox.getData();
    dispatch({ type: 'SET_DATA', payload: data });
    showToast('success', `备份已创建: ${result.path.split('/').pop() ?? 'backup.json'}`);
    return result;
  }, [showToast]);

  const listBackups = useCallback((preferredDirectory?: string) => {
    return window.launchbox.listBackups(preferredDirectory);
  }, []);

  const deleteBackup = useCallback(async (backupPath: string) => {
    await window.launchbox.deleteBackup(backupPath);
    showToast('success', `备份已删除: ${backupPath.split('/').pop() ?? 'backup.json'}`);
  }, [showToast]);

  const clearAllData = useCallback(async () => {
    const result = await window.launchbox.clearAllData();
    dispatch({ type: 'SET_DATA', payload: result.data });
    dispatch({ type: 'SELECT_CATEGORY', payload: getInitialCategoryId(result.data) });
    dispatch({ type: 'SET_VIEW_MODE', payload: result.data.settings.viewMode });
    dispatch({ type: 'SET_SEARCH', payload: '' });
    showToast('success', result.backup ? '数据已清空，清空前备份已完成' : '数据已清空');
  }, [showToast]);

  const restoreBackup = useCallback(async (backupPath: string) => {
    const result = await window.launchbox.restoreBackup(backupPath);
    dispatch({ type: 'SET_DATA', payload: result.data });
    dispatch({ type: 'SELECT_CATEGORY', payload: getInitialCategoryId(result.data) });
    dispatch({ type: 'SET_VIEW_MODE', payload: result.data.settings.viewMode });
    dispatch({ type: 'SET_SEARCH', payload: '' });
    showToast('success', result.backup ? '备份已恢复，恢复前数据已自动备份' : '备份已恢复');
  }, [showToast]);

  const windowControl = useCallback((action: 'minimize' | 'maximize' | 'close') => {
    window.launchbox.windowControl(action);
  }, []);

  const selectCategory = useCallback((id: string) => {
    dispatch({ type: 'SELECT_CATEGORY', payload: id });
  }, []);

  const setSearch = useCallback((q: string) => {
    dispatch({ type: 'SET_SEARCH', payload: q });
  }, []);

  const setSearchScope = useCallback((scope: 'all' | 'current') => {
    dispatch({ type: 'SET_SEARCH_SCOPE', payload: scope });
  }, []);

  const setViewMode = useCallback((mode: 'grid' | 'list') => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      saveTool,
      deleteTool,
      saveCategory,
      saveCategorySilent,
      deleteCategory,
      saveSettings,
      saveSettingsSilent,
      createBackup,
      listBackups,
      deleteBackup,
      clearAllData,
      restoreBackup,
      launchTool,
      selectFile,
      selectDirectory,
      openInTerminal,
      showInFinder,
      importInstalledApps,
      windowControl,
      selectCategory,
      setSearch,
      setSearchScope,
      setViewMode,
      showToast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
