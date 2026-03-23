import React, { useState, useEffect } from 'react';
import { useApp } from './store/AppContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import MainContent, { TopCategoryBar } from './components/MainContent';
import ToolModal from './components/ToolModal';
import SettingsPanel from './components/SettingsPanel';
import Toast from './components/Toast';

export default function App() {
  const { data } = useApp();
  const [showAddTool, setShowAddTool] = useState(false);
  const [addToolCategoryId, setAddToolCategoryId] = useState<string | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!data) return;
    const { theme, fontSize } = data.settings;
    const fontSizeMap = { small: '12px', medium: '14px', large: '16px' };
    document.documentElement.style.fontSize = fontSizeMap[fontSize];

    const applyTheme = (isDark: boolean) => {
      document.body.className = isDark ? 'dark' : 'light';
    };

    if (theme === 'system') {
      applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
      return window.launchbox.onNativeThemeChanged(applyTheme);
    }

    applyTheme(theme === 'dark');
    return undefined;
  }, [data?.settings.theme, data?.settings.fontSize, data]);

  useEffect(() => {
    return window.launchbox.onOpenSettingsRequested(() => {
      setShowSettings(true);
    });
  }, []);

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
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopCategoryBar />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Sidebar />
          <MainContent
            onAddTool={categoryId => {
              setAddToolCategoryId(categoryId);
              setShowAddTool(true);
            }}
          />
        </div>
      </div>

      {showAddTool && (
        <ToolModal
          tool={null}
          initialCategoryId={addToolCategoryId}
          onClose={() => {
            setShowAddTool(false);
            setAddToolCategoryId(undefined);
          }}
        />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      <Toast />
    </>
  );
}
