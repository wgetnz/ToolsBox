import React, { useState } from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';
import ContextMenu, { ContextMenuItem } from './ContextMenu';

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

interface Props {
  tool: Tool;
  size: 'small' | 'medium' | 'large';
  onEdit: (tool: Tool) => void;
  selected?: boolean;
  onSelect?: (event: React.MouseEvent, tool: Tool) => void;
  onRequestContextMenu?: (event: React.MouseEvent, tool: Tool) => boolean | void;
}

export default function ToolCard({
  tool,
  size,
  onEdit,
  selected = false,
  onSelect,
  onRequestContextMenu,
}: Props) {
  const { launchTool, deleteTool, openInTerminal, showInFinder, createToolShortcut } = useApp();
  const [hover, setHover] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [iconFailed, setIconFailed] = useState(false);

  const accentColor = tool.color || TYPE_COLORS[tool.type] || '#4f8ef7';
  const hasCustomIcon = Boolean(tool.icon) && !iconFailed;
  const isCompact = size === 'small';

  const dims = {
    small: { width: 106, height: 88, iconSize: 22, nameFontSize: 11 },
    medium: { width: 180, height: 140, iconSize: 36, nameFontSize: 14 },
    large: { width: 220, height: 170, iconSize: 44, nameFontSize: 15 },
  }[size];
  const iconSize = dims.iconSize;

  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (launching) return;
    setLaunching(true);
    await launchTool(tool.id);
    setLaunching(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const handled = onRequestContextMenu?.(e, tool);
    if (handled) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);
  const menuItems: ContextMenuItem[] = [
    { label: '启动', icon: '▶', onClick: () => launchTool(tool.id) },
    { label: '编辑', icon: '✏️', onClick: () => onEdit(tool) },
  ];

  if (tool.type !== 'url' && tool.type !== 'app') {
    menuItems.push(
      { label: '在终端中打开', icon: '💻', onClick: () => openInTerminal(tool.path) },
      { label: '在访达中显示', icon: '📁', onClick: () => showInFinder(tool.path) }
    );
  }

  menuItems.push(
    { label: '创建桌面快捷方式', icon: '🔗', onClick: () => createToolShortcut(tool.id) },
    { divider: true, label: 'divider-shortcut' },
    { label: '删除', icon: '🗑️', danger: true, onClick: () => deleteTool(tool.id) }
  );

  return (
    <>
      <div
        data-tool-card="true"
        style={{
          width: dims.width,
          height: dims.height,
          background: selected ? `${accentColor}18` : hover ? 'var(--bg-card-hover)' : 'var(--bg-card)',
          borderRadius: isCompact ? 10 : 14,
          border: `1px solid ${
            selected ? accentColor : hover ? accentColor + '60' : 'var(--border-color)'
          }`,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isCompact ? 6 : 8,
          padding: isCompact ? '8px 6px' : 12,
          position: 'relative',
          transition: 'all 0.15s ease',
          boxShadow: selected
            ? `0 10px 28px ${accentColor}26`
            : hover ? `0 8px 24px ${accentColor}20` : 'none',
          transform: hover && !isCompact ? 'translateY(-2px)' : 'none',
          overflow: 'hidden',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={event => onSelect?.(event, tool)}
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
          borderRadius: `${isCompact ? 10 : 14}px ${isCompact ? 10 : 14}px 0 0`,
        }} />

        {/* Type badge */}
        {!isCompact && (
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
        )}

        {selected && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: isCompact ? 14 : 18,
            height: isCompact ? 14 : 18,
            borderRadius: 999,
            background: accentColor,
            color: '#fff',
            fontSize: isCompact ? 9 : 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 0 2px ${accentColor}20`,
          }}>
            ✓
          </div>
        )}

        {/* Icon */}
        <div style={{
          width: isCompact ? iconSize + 8 : iconSize + 16,
          height: isCompact ? iconSize + 8 : iconSize + 16,
          background: accentColor + '18',
          borderRadius: isCompact ? 10 : 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: iconSize,
          transition: 'transform 0.15s',
          transform: hover ? 'scale(1.05)' : 'scale(1)',
          overflow: 'hidden',
        }}>
          {hasCustomIcon ? (
            <img
              src={tool.icon}
              alt={tool.name}
              onError={() => setIconFailed(true)}
              style={{
                width: isCompact ? iconSize + 2 : iconSize + 6,
                height: isCompact ? iconSize + 2 : iconSize + 6,
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
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: isCompact ? 'normal' : 'nowrap',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: isCompact ? 2 : 1,
          WebkitBoxOrient: 'vertical',
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
        {hover && !isCompact && (
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
        {tool.useCount > 0 && !isCompact && (
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
          items={menuItems}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
}
