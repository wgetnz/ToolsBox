import React from 'react';

interface Props {
  onOpenSettings: () => void;
  onAddTool: () => void;
}

export default function TitleBar({ onOpenSettings, onAddTool }: Props) {
  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;
  const isMac = navigator.userAgent.includes('Mac');
  const macButtonStyle: React.CSSProperties = {
    height: 32,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 600,
    backdropFilter: 'blur(18px)',
  };

  return (
    <div style={{
      height: isMac ? 44 : 52,
      display: 'flex',
      alignItems: 'center',
      padding: isMac ? '0 14px 0 86px' : '0 16px 0 80px',
      background: isMac ? 'rgba(22, 33, 62, 0.72)' : 'var(--bg-secondary)',
      backdropFilter: isMac ? 'blur(24px) saturate(160%)' : undefined,
      borderBottom: '1px solid var(--border-color)',
      flexShrink: 0,
      gap: 12,
      ...dragStyle,
    }}>
      {!isMac && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🚀</span>
          <span style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}>LaunchBox</span>
        </div>
      )}

      {isMac && (
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-muted)',
          letterSpacing: '0.2px',
        }}>
          工具启动器
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...noDragStyle }}>
        <button
          className="btn btn-primary"
          onClick={onAddTool}
          style={isMac ? {
            ...macButtonStyle,
            background: 'linear-gradient(180deg, #5da2ff 0%, #3f86f6 100%)',
            border: '1px solid rgba(126, 178, 255, 0.32)',
            color: '#fff',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
          } : { fontSize: 12, padding: '6px 14px' }}
        >
          <span>+</span> 添加工具
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onOpenSettings}
          title="设置"
          style={isMac ? {
            width: 32,
            height: 32,
            padding: 0,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary)',
            backdropFilter: 'blur(18px)',
          } : undefined}
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}
