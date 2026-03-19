import React from 'react';

interface Props {
  onOpenSettings: () => void;
  onAddTool: () => void;
  onOpenAppLibrary: () => void;
}

export default function TitleBar({ onOpenSettings, onAddTool, onOpenAppLibrary }: Props) {
  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div style={{
      height: 52,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px 0 80px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      flexShrink: 0,
      gap: 12,
      ...dragStyle,
    }}>
      {/* App name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>🚀</span>
        <span style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.3px',
        }}>LaunchBox</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        ...noDragStyle,
      }}>
        <button
          className="btn btn-primary"
          onClick={onAddTool}
          style={{ fontSize: 12, padding: '6px 14px' }}
        >
          <span>+</span> 添加工具
        </button>
        <button
          className="btn btn-secondary"
          onClick={onOpenAppLibrary}
          style={{ fontSize: 12, padding: '6px 14px' }}
        >
          <span>📚</span> 应用库
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onOpenSettings}
          title="设置"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}
