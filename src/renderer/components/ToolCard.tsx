import React, { useState, useRef } from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';

const TYPE_LABELS: Record<string, string> = {
  jar: 'JAR',
  python: 'Python',
  shell: 'Shell',
  executable: 'EXE',
  app: 'App',
  batch: 'BAT',
  url: 'URL',
};

const TYPE_ICONS: Record<string, string> = {
  jar: '☕',
  python: '🐍',
  shell: '💻',
  executable: '⚡',
  app: '📱',
  batch: '📜',
  url: '🌐',
};

const TYPE_COLORS: Record<string, string> = {
  jar: '#f89820',
  python: '#3776ab',
  shell: '#4eaa25',
  executable: '#e74c3c',
  app: '#007aff',
  batch: '#9b59b6',
  url: '#1abc9c',
};

const CARD_COLORS = [
  '#4f8ef7', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#3498db', '#e67e22', '#e91e63', '#00bcd4',
];

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

  const accentColor = tool.color || TYPE_COLORS[tool.type] || '#4f8ef7';
  const hasCustomIcon = Boolean(tool.icon);

  const dims = {
    small: { width: 140, height: 110, iconSize: 28, nameFontSize: 12 },
    medium: { width: 180, height: 140, iconSize: 36, nameFontSize: 14 },
    large: { width: 220, height: 170, iconSize: 44, nameFontSize: 15 },
  }[size];

  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (launching) return;
    setLaunching(true);
    await launchTool(tool.id);
    setLaunching(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <>
      <div
        ref={cardRef}
        data-tool-card="true"
        style={{
          width: dims.width,
          height: dims.height,
          background: hover ? 'var(--bg-card-hover)' : 'var(--bg-card)',
          borderRadius: 14,
          border: `1px solid ${hover ? accentColor + '60' : 'var(--border-color)'}`,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 12,
          position: 'relative',
          transition: 'all 0.15s ease',
          boxShadow: hover ? `0 8px 24px ${accentColor}20` : 'none',
          transform: hover ? 'translateY(-2px)' : 'none',
          overflow: 'hidden',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDoubleClick={handleLaunch}
        onContextMenu={handleContextMenu}
      >
        {/* Top accent strip */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentColor,
          borderRadius: '14px 14px 0 0',
        }} />

        {/* Type badge */}
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: accentColor + '22',
          color: accentColor,
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 6,
          letterSpacing: '0.3px',
        }}>
          {TYPE_LABELS[tool.type]}
        </div>

        {/* Icon */}
        <div style={{
          width: dims.iconSize + 16,
          height: dims.iconSize + 16,
          background: accentColor + '18',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: dims.iconSize,
          transition: 'transform 0.15s',
          transform: hover ? 'scale(1.05)' : 'scale(1)',
          overflow: 'hidden',
        }}>
          {hasCustomIcon ? (
            <img
              src={tool.icon}
              alt={tool.name}
              style={{
                width: dims.iconSize + 6,
                height: dims.iconSize + 6,
                objectFit: 'contain',
              }}
            />
          ) : (
            TYPE_ICONS[tool.type]
          )}
        </div>

        {/* Name */}
        <div style={{
          fontSize: dims.nameFontSize,
          fontWeight: 600,
          color: 'var(--text-primary)',
          textAlign: 'center',
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>
          {tool.name}
        </div>

        {/* Description */}
        {tool.description && size !== 'small' && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {tool.description}
          </div>
        )}

        {/* Launch button overlay on hover */}
        {hover && (
          <button
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 28,
              height: 28,
              background: accentColor,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              transition: 'all 0.1s',
            }}
            onClick={handleLaunch}
            title="启动"
          >
            {launching ? '⏳' : '▶'}
          </button>
        )}

        {/* Use count */}
        {tool.useCount > 0 && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: 10,
            fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            {tool.useCount}次
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tool={tool}
          onClose={closeContextMenu}
          onEdit={() => { closeContextMenu(); onEdit(tool); }}
          onLaunch={() => { closeContextMenu(); launchTool(tool.id); }}
          onDelete={() => { closeContextMenu(); deleteTool(tool.id); }}
          onOpenTerminal={() => { closeContextMenu(); openInTerminal(tool.path); }}
          onShowInFinder={() => { closeContextMenu(); showInFinder(tool.path); }}
        />
      )}
    </>
  );
}

function ContextMenu({
  x, y, tool, onClose, onEdit, onLaunch, onDelete, onOpenTerminal, onShowInFinder,
}: {
  x: number; y: number; tool: Tool;
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

  const menuHeight = 240;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  return (
    <div
      className="context-menu"
      style={{ left: x, top: adjustedY }}
      onClick={e => e.stopPropagation()}
    >
      <div className="context-menu-item" onClick={onLaunch}>
        <span>▶</span> 启动
      </div>
      <div className="context-menu-item" onClick={onEdit}>
        <span>✏️</span> 编辑
      </div>
      {tool.type !== 'url' && tool.type !== 'app' && (
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
