import React, { useState, useEffect } from 'react';
import { useApp } from './store/AppContext';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import ToolModal from './components/ToolModal';
import SettingsPanel from './components/SettingsPanel';
import Toast from './components/Toast';
import AppLibraryModal from './components/AppLibraryModal';
import QuickLauncherModal from './components/QuickLauncherModal';

export default function App() {
  const { data } = useApp();
  const [showAddTool, setShowAddTool] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAppLibrary, setShowAppLibrary] = useState(false);
  const [showQuickLauncher, setShowQuickLauncher] = useState(false);

  // Apply theme and settings to document
  useEffect(() => {
    if (!data) return;
    const { theme, fontSize, backgroundColor } = data.settings;

    document.body.className = theme;

    const fontSizeMap = { small: '12px', medium: '14px', large: '16px' };
    document.documentElement.style.fontSize = fontSizeMap[fontSize];

    if (backgroundColor) {
      document.documentElement.style.setProperty('--bg-primary', backgroundColor);
    } else {
      document.documentElement.style.removeProperty('--bg-primary');
    }
  }, [data?.settings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowQuickLauncher(open => !open);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => window.launchbox.onOpenQuickLauncher(() => {
    setShowQuickLauncher(true);
  }), []);

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
        onOpenAppLibrary={() => setShowAppLibrary(true)}
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

      {showAppLibrary && (
        <AppLibraryModal
          defaultCategoryId="misc"
          onClose={() => setShowAppLibrary(false)}
        />
      )}

      {showQuickLauncher && (
        <QuickLauncherModal
          onClose={() => setShowQuickLauncher(false)}
          onAddTool={() => {
            setShowQuickLauncher(false);
            setShowAddTool(true);
          }}
          onOpenSettings={() => {
            setShowQuickLauncher(false);
            setShowSettings(true);
          }}
          onOpenAppLibrary={() => {
            setShowQuickLauncher(false);
            setShowAppLibrary(true);
          }}
        />
      )}

      <Toast />
    </>
  );
}
