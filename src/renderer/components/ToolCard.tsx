import React, { useState, useRef } from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';
import { getToolFallbackIcon } from '../utils/toolIcons';

const TYPE_LABELS: Record<string, string> = {
  jar: 'JAR',
  python: 'Python',
  shell: 'Shell',
  executable: 'BIN',
  app: 'App',
  url: 'URL',
};

interface Props {
  tool: Tool;
  size: 'small' | 'medium' | 'large';
  onEdit: (tool: Tool) => void;
}

export default function ToolCard({ tool, size, onEdit }: Props) {
  const { launchTool, deleteTool, openInTerminal, showInFinder } = useApp();
  const [showDetails, setShowDetails] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | null>(null);

  const dims = {
    small: { width: 88, height: 84, iconSize: 24, nameFontSize: 11 },
    medium: { width: 98, height: 92, iconSize: 28, nameFontSize: 12 },
    large: { width: 112, height: 102, iconSize: 32, nameFontSize: 13 },
  }[size];

  const handleLaunch = async () => {
    await launchTool(tool.id);
  };

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setShowDetails(true);
    }, 1000);
  };

  const handleMouseLeave = () => {
    setShowDetails(false);
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        className="tool-card"
        style={{ width: dims.width, height: dims.height }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleLaunch}
        onContextMenu={event => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <div className="lily-tool-card-body">
          <div className={`lily-tool-card-badge${showDetails ? ' visible' : ''}`}>
            <span className="type-badge">{TYPE_LABELS[tool.type]}</span>
          </div>

          <div className="lily-tool-main">
            <div
              className="lily-tool-icon-wrap"
              style={{
                width: dims.iconSize + 16,
                height: dims.iconSize + 16,
              }}
            >
              {tool.icon
                ? <img src={tool.icon} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: dims.iconSize }}>{getToolFallbackIcon(tool)}</span>
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
          </div>

          {tool.description && size === 'large' && (
            <div className="lily-tool-description">
              {tool.description}
            </div>
          )}

          <div className="lily-tool-card-footer">
            <div className={`lily-tool-meta${showDetails ? ' visible' : ''}`}>
              {tool.useCount > 0 ? `${tool.useCount}次使用` : '双击启动'}
            </div>
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
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    window.addEventListener('mousedown', handler);
    return () => {
      window.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const menuHeight = 220;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  return (
    <div
      ref={menuRef}
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
