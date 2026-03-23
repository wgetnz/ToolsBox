import React, { useState, useEffect } from 'react';
import { useApp } from './store/AppContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import ToolModal from './components/ToolModal';
import SettingsPanel from './components/SettingsPanel';
import Toast from './components/Toast';

export default function App() {
  const { data } = useApp();
  const [showAddTool, setShowAddTool] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Apply theme and settings to document
  useEffect(() => {
    if (!data) return;
    const { theme, fontSize } = data.settings;

    const fontSizeMap = { small: '12px', medium: '14px', large: '16px' };
    document.documentElement.style.fontSize = fontSizeMap[fontSize];

    const applyTheme = (isDark: boolean) => {
      document.body.className = isDark ? 'dark' : 'light';
    };

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(isDark);
      // 监听主进程推送的系统主题变化
      const cleanup = window.launchbox.onNativeThemeChanged(applyTheme);
      return cleanup;
    } else {
      applyTheme(theme === 'dark');
    }
  }, [data?.settings.theme, data?.settings.fontSize]);

  if (!data) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        color: 'var(--text-muted)',
      }}>
        <div style={{ fontSize: 40 }}>🚀</div>
        <div style={{ fontSize: 14 }}>启动中...</div>
      </div>
    );
  }

  return (
    <>
      <TitleBar
        onAddTool={() => setShowAddTool(true)}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar />
        <MainContent />
      </div>

      {showAddTool && (
        <ToolModal tool={null} onClose={() => setShowAddTool(false)} />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      <Toast />
    </>
  );
}
