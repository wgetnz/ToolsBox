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
