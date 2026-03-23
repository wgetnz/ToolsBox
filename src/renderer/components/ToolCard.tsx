import React, { useState, useRef } from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';

const TYPE_LABELS: Record<string, string> = {
  jar: 'JAR',
  python: 'Python',
  shell: 'Shell',
  executable: 'EXE',
  app: 'App',
  url: 'URL',
};

const TYPE_ICONS: Record<string, string> = {
  jar: '☕',
  python: '🐍',
  shell: '💻',
  executable: '⚡',
  app: '📱',
  url: '🌐',
};

interface Props {
  tool: Tool;
  size: 'small' | 'medium' | 'large';
  onEdit: (tool: Tool) => void;
}

export default function ToolCard({ tool, size, onEdit }: Props) {
  const { launchTool, deleteTool, openInTerminal, showInFinder } = useApp();
  const [hover, setHover] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const dims = {
    small: { width: 108, height: 96, iconSize: 26, nameFontSize: 11 },
    medium: { width: 124, height: 108, iconSize: 32, nameFontSize: 12 },
    large: { width: 144, height: 124, iconSize: 38, nameFontSize: 13 },
  }[size];

  const handleLaunch = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (launching) return;
    setLaunching(true);
    await launchTool(tool.id);
    setLaunching(false);
  };

  return (
    <>
      <div
        ref={cardRef}
        className="tool-card"
        style={{ width: dims.width, height: dims.height }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDoubleClick={handleLaunch}
        onContextMenu={event => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        {tool.accentColor && (
          <div className="tool-card-accent" style={{ background: tool.accentColor }} />
        )}

        <div className="lily-tool-card-body">
          <div style={{ position: 'absolute', top: 6, right: 6 }}>
            <span className="type-badge">{TYPE_LABELS[tool.type]}</span>
          </div>

          <div
            className="lily-tool-icon-wrap"
            style={{
              width: dims.iconSize + 16,
              height: dims.iconSize + 16,
            }}
          >
            {tool.icon
              ? <img src={tool.icon} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: dims.iconSize }}>{TYPE_ICONS[tool.type] ?? '🔧'}</span>
            }
          </div>

          <div
            className="lily-tool-name"
            style={{
              fontSize: dims.nameFontSize,
            }}
          >
            {tool.name}
          </div>

          {tool.description && size === 'large' && (
            <div className="lily-tool-description">
              {tool.description}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', width: '100%' }}>
            {tool.useCount > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tool.useCount}次</span>
            )}
            {hover && (
              <button
                className="lily-launch-button"
                style={{ background: tool.accentColor || 'var(--accent-color)' }}
                onClick={handleLaunch}
                title="启动"
              >
                {launching ? '⏳' : '▶'}
              </button>
            )}
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tool={tool}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            setContextMenu(null);
            onEdit(tool);
          }}
          onLaunch={() => {
            setContextMenu(null);
            void launchTool(tool.id);
          }}
          onDelete={() => {
            setContextMenu(null);
            void deleteTool(tool.id);
          }}
          onOpenTerminal={() => {
            setContextMenu(null);
            void openInTerminal(tool.path);
          }}
          onShowInFinder={() => {
            setContextMenu(null);
            void showInFinder(tool.path);
          }}
        />
      )}
    </>
  );
}

function ContextMenu({
  x, y, tool, onClose, onEdit, onLaunch, onDelete, onOpenTerminal, onShowInFinder,
}: {
  x: number;
  y: number;
  tool: Tool;
  onClose: () => void;
  onEdit: () => void;
  onLaunch: () => void;
  onDelete: () => void;
  onOpenTerminal: () => void;
  onShowInFinder: () => void;
}) {
  React.useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [onClose]);

  const menuHeight = 220;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  return (
    <div
      className="context-menu glass"
      style={{ left: x, top: adjustedY }}
      onClick={event => event.stopPropagation()}
    >
      <div className="context-menu-item" onClick={onLaunch}>
        <span>▶</span> 启动
      </div>
      <div className="context-menu-item" onClick={onEdit}>
        <span>✏️</span> 编辑
      </div>
      {tool.type !== 'url' && (
        <>
          <div className="context-menu-item" onClick={onOpenTerminal}>
            <span>💻</span> 在终端中打开
          </div>
          <div className="context-menu-item" onClick={onShowInFinder}>
            <span>📁</span> 在访达中显示
          </div>
        </>
      )}
      <div className="context-menu-divider" />
      <div className="context-menu-item danger" onClick={onDelete}>
        <span>🗑️</span> 删除
      </div>
    </div>
  );
}
