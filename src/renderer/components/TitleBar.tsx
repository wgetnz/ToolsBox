import React from 'react';

interface Props {
  onOpenSettings: () => void;
  onAddTool: () => void;
}

export default function TitleBar({ onOpenSettings, onAddTool }: Props) {
  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;
  const isMac = navigator.userAgent.includes('Mac');

  return (
    <div
      className="titlebar-shell"
      style={{
        padding: isMac ? '0 14px 0 86px' : '0 16px',
        ...dragStyle,
      }}
    >
      <div className="titlebar-brand">
        <span className="titlebar-name">ToolBox</span>
        <span className="titlebar-subtitle">工具启动器</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...noDragStyle }}>
        <button
          className="btn lily-titlebar-button lily-titlebar-primary"
          onClick={onAddTool}
        >
          添加工具
        </button>
        <button
          className="btn lily-titlebar-button"
          onClick={onOpenSettings}
          title="设置"
        >
          设置
        </button>
      </div>
    </div>
  );
}
