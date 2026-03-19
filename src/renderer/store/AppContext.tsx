import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { AppData, Tool, Category, AppSettings, AppLibraryEntry } from '../../shared/types';

declare global {
  interface Window {
    launchbox: {
      getData: () => Promise<AppData>;
      getAppLibrary: () => Promise<AppLibraryEntry[]>;
      saveTool: (tool: Tool) => Promise<Tool[]>;
      deleteTool: (toolId: string) => Promise<Tool[]>;
      deleteTools: (toolIds: string[]) => Promise<Tool[]>;
      saveCategory: (category: Category) => Promise<Category[]>;
      deleteCategory: (categoryId: string) => Promise<{ categories: Category[]; tools: Tool[] }>;
      moveToolsToCategory: (toolIds: string[], categoryId: string) => Promise<Tool[]>;
      updateToolsColor: (toolIds: string[], color: string) => Promise<Tool[]>;
      saveSettings: (settings: AppSettings) => Promise<AppSettings>;
      launchTool: (toolId: string) => Promise<{ success: boolean; error?: string }>;
      selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
      selectDirectory: () => Promise<string | null>;
      expandImportItems: (items: string[]) => Promise<string[]>;
      openInTerminal: (dirPath: string) => Promise<void>;
      showInFinder: (filePath: string) => Promise<void>;
      createToolShortcut: (toolId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      windowControl: (action: 'minimize' | 'maximize' | 'close') => Promise<void>;
      onOpenQuickLauncher: (callback: () => void) => () => void;
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
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  saveTool: (tool: Tool) => Promise<void>;
  getAppLibrary: () => Promise<AppLibraryEntry[]>;
  deleteTool: (toolId: string) => Promise<void>;
  deleteTools: (toolIds: string[]) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  moveToolsToCategory: (toolIds: string[], categoryId: string) => Promise<void>;
  updateToolsColor: (toolIds: string[], color: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  launchTool: (toolId: string) => Promise<void>;
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  selectDirectory: () => Promise<string | null>;
  expandImportItems: (items: string[]) => Promise<string[]>;
  openInTerminal: (dirPath: string) => Promise<void>;
  showInFinder: (filePath: string) => Promise<void>;
  createToolShortcut: (toolId: string) => Promise<void>;
  windowControl: (action: 'minimize' | 'maximize' | 'close') => void;
  selectCategory: (id: string) => void;
  setSearch: (q: string) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let toastIdCounter = 0;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    data: null,
    loading: true,
    selectedCategoryId: 'all',
    searchQuery: '',
    toasts: [],
  });

  useEffect(() => {
    window.launchbox.getData().then(data => {
      dispatch({ type: 'SET_DATA', payload: data });
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

  const getAppLibrary = useCallback(() => window.launchbox.getAppLibrary(), []);

  const deleteTool = useCallback(async (toolId: string) => {
    const tools = await window.launchbox.deleteTool(toolId);
    dispatch({ type: 'SET_TOOLS', payload: tools });
    showToast('success', '工具已删除');
  }, [showToast]);

  const deleteTools = useCallback(async (toolIds: string[]) => {
    if (toolIds.length === 0) return;
    const tools = await window.launchbox.deleteTools(toolIds);
    dispatch({ type: 'SET_TOOLS', payload: tools });
    showToast('success', `已删除 ${toolIds.length} 个工具`);
  }, [showToast]);

  const saveCategory = useCallback(async (category: Category) => {
    const categories = await window.launchbox.saveCategory(category);
    dispatch({ type: 'SET_CATEGORIES', payload: categories });
    showToast('success', '分类已保存');
  }, [showToast]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    const result = await window.launchbox.deleteCategory(categoryId);
    dispatch({ type: 'SET_CATEGORIES', payload: result.categories });
    dispatch({ type: 'SET_TOOLS', payload: result.tools });
    dispatch({ type: 'SELECT_CATEGORY', payload: 'all' });
    showToast('success', '分类已删除');
  }, [showToast]);

  const moveToolsToCategory = useCallback(async (toolIds: string[], categoryId: string) => {
    if (toolIds.length === 0) return;
    const tools = await window.launchbox.moveToolsToCategory(toolIds, categoryId);
    dispatch({ type: 'SET_TOOLS', payload: tools });
    showToast('success', `已移动 ${toolIds.length} 个工具`);
  }, [showToast]);

  const updateToolsColor = useCallback(async (toolIds: string[], color: string) => {
    if (toolIds.length === 0) return;
    const tools = await window.launchbox.updateToolsColor(toolIds, color);
    dispatch({ type: 'SET_TOOLS', payload: tools });
    showToast('success', `已更新 ${toolIds.length} 个工具的颜色`);
  }, [showToast]);

  const saveSettings = useCallback(async (settings: AppSettings) => {
    const saved = await window.launchbox.saveSettings(settings);
    dispatch({ type: 'SET_SETTINGS', payload: saved });
    showToast('success', '设置已保存');
  }, [showToast]);

  const launchTool = useCallback(async (toolId: string) => {
    const result = await window.launchbox.launchTool(toolId);
    if (result.success) {
      const tool = state.data?.tools.find(t => t.id === toolId);
      showToast('success', `已启动 ${tool?.name ?? '工具'}`);
      // Refresh data to update usage stats
      const data = await window.launchbox.getData();
      dispatch({ type: 'SET_DATA', payload: data });
    } else {
      showToast('error', `启动失败: ${result.error}`);
    }
  }, [state.data, showToast]);

  const selectFile = useCallback(
    (filters?: { name: string; extensions: string[] }[]) => window.launchbox.selectFile(filters),
    []
  );

  const selectDirectory = useCallback(() => window.launchbox.selectDirectory(), []);
  const expandImportItems = useCallback((items: string[]) => window.launchbox.expandImportItems(items), []);
  const openInTerminal = useCallback((p: string) => window.launchbox.openInTerminal(p), []);
  const showInFinder = useCallback((p: string) => window.launchbox.showInFinder(p), []);
  const createToolShortcut = useCallback(async (toolId: string) => {
    const result = await window.launchbox.createToolShortcut(toolId);
    if (result.success) {
      const tool = state.data?.tools.find(item => item.id === toolId);
      showToast('success', `已为 ${tool?.name ?? '工具'} 创建桌面快捷方式`);
      return;
    }
    showToast('error', `创建快捷方式失败: ${result.error}`);
  }, [showToast, state.data]);

  const windowControl = useCallback((action: 'minimize' | 'maximize' | 'close') => {
    window.launchbox.windowControl(action);
  }, []);

  const selectCategory = useCallback((id: string) => {
    dispatch({ type: 'SELECT_CATEGORY', payload: id });
  }, []);

  const setSearch = useCallback((q: string) => {
    dispatch({ type: 'SET_SEARCH', payload: q });
  }, []);

  return (
    <AppContext.Provider value={{
      ...state,
      saveTool,
      getAppLibrary,
      deleteTool,
      deleteTools,
      saveCategory,
      deleteCategory,
      moveToolsToCategory,
      updateToolsColor,
      saveSettings,
      launchTool,
      selectFile,
      selectDirectory,
      expandImportItems,
      openInTerminal,
      showInFinder,
      createToolShortcut,
      windowControl,
      selectCategory,
      setSearch,
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
