import React, { useMemo, useState, useEffect } from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';
import ToolCard from './ToolCard';
import ToolModal from './ToolModal';

type SortKey = 'name' | 'lastUsed' | 'useCount' | 'createdAt';

const TYPE_ICONS: Record<string, string> = {
  jar: '☕', python: '🐍', shell: '💻', executable: '⚡', app: '📱', url: '🌐',
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export default function MainContent() {
  const { data, selectedCategoryId, searchQuery, viewMode, setViewMode, saveSettingsSilent, launchTool } = useApp();
  const [editingTool, setEditingTool] = useState<Tool | null | undefined>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(a => !a);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let tools = data.tools;

    if (selectedCategoryId !== 'all') {
      tools = tools.filter(t => t.categoryId === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q)
      );
    }

    return [...tools].sort((a, b) => {
      let val = 0;
      switch (sortKey) {
        case 'name':
          val = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'lastUsed':
          val = (b.lastUsed ?? 0) - (a.lastUsed ?? 0);
          break;
        case 'useCount':
          val = b.useCount - a.useCount;
          break;
        case 'createdAt':
          val = b.createdAt - a.createdAt;
          break;
      }
      return sortAsc ? val : -val;
    });
  }, [data, selectedCategoryId, searchQuery, sortKey, sortAsc]);

  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>加载中...</div>
      </div>
    );
  }

  const cardSize = data.settings.cardSize;

  const categoryName = selectedCategoryId === 'all'
    ? '全部工具'
    : data.categories.find(c => c.id === selectedCategoryId)?.name ?? '工具';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-color)',
        gap: 12,
        flexShrink: 0,
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{categoryName}</span>
          <span style={{
            marginLeft: 8,
            fontSize: 12,
            color: 'var(--text-muted)',
            background: 'var(--bg-tertiary)',
            padding: '2px 8px',
            borderRadius: 10,
          }}>{filtered.length}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* 排序 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>排序:</span>
          {([
            ['name', '名称'],
            ['lastUsed', '最近使用'],
            ['useCount', '使用次数'],
            ['createdAt', '添加时间'],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: sortKey === key ? 'var(--accent-color)' : 'var(--bg-input)',
                color: sortKey === key ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {label}
              {sortKey === key && <span>{sortAsc ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>

        {/* 视图切换（网格 / 列表）*/}
        <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 7, overflow: 'hidden' }}>
          <button
            onClick={() => { setViewMode('grid'); if (data) saveSettingsSilent({ ...data.settings, viewMode: 'grid' }); }}
            style={{
              padding: '4px 10px',
              border: 'none',
              background: viewMode === 'grid' ? 'var(--accent-color)' : 'transparent',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
            }}
            title="网格视图"
          >⊞</button>
          <button
            onClick={() => { setViewMode('list'); if (data) saveSettingsSilent({ ...data.settings, viewMode: 'list' }); }}
            style={{
              padding: '4px 10px',
              border: 'none',
              background: viewMode === 'list' ? 'var(--accent-color)' : 'transparent',
              color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
            }}
            title="列表视图"
          >☰</button>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔧</div>
            {searchQuery ? (
              <>
                <h3>没有找到匹配的工具</h3>
                <p>尝试其他关键词搜索</p>
              </>
            ) : (
              <>
                <h3>暂无工具</h3>
                <p>点击右上角"添加工具"来添加你的第一个工具</p>
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: cardSize === 'small' ? 12 : cardSize === 'large' ? 20 : 16,
          }}>
            {filtered.map(tool => (
              <ToolCard
                key={tool.id}
                tool={tool}
                size={cardSize}
                onEdit={t => setEditingTool(t)}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map(tool => (
              <ToolRow
                key={tool.id}
                tool={tool}
                onEdit={() => setEditingTool(tool)}
                onLaunch={() => launchTool(tool.id)}
              />
            ))}
          </div>
        )}
      </div>

      {editingTool !== undefined && (
        <ToolModal
          tool={editingTool}
          onClose={() => setEditingTool(undefined)}
        />
      )}
    </div>
  );
}

// 列表模式的行组件（高度固定 52px）
function ToolRow({ tool, onEdit, onLaunch }: { tool: Tool; onEdit: () => void; onLaunch: () => void }) {
  const { deleteTool, openInTerminal, showInFinder } = useApp();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <div
        className="tool-row"
        style={{ height: 52 }}
        onDoubleClick={onLaunch}
        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
      >
        {/* 颜色标签点 */}
        {tool.accentColor && (
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: tool.accentColor, flexShrink: 0,
          }} />
        )}

        {/* 图标 */}
        <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 7, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {tool.icon
            ? <img src={tool.icon} width={32} height={32} style={{ objectFit: 'contain' }} />
            : <span style={{ fontSize: 20 }}>{TYPE_ICONS[tool.type] ?? '🔧'}</span>
          }
        </div>

        {/* 名称 + 描述 */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tool.name}
          </div>
          {tool.description && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tool.description}
            </div>
          )}
        </div>

        <span className="type-badge">{tool.type}</span>
        {tool.useCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{tool.useCount}次</span>
        )}
        {tool.lastUsed && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
            {formatRelativeTime(tool.lastUsed)}
          </span>
        )}
      </div>

      {contextMenu && (
        <RowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tool={tool}
          onClose={() => setContextMenu(null)}
          onLaunch={onLaunch}
          onEdit={onEdit}
          onOpenTerminal={() => openInTerminal(tool.path)}
          onShowInFinder={() => showInFinder(tool.path)}
          onDelete={() => deleteTool(tool.id)}
        />
      )}
    </>
  );
}

// ToolRow 专用右键菜单（与 ToolCard.ContextMenu 保持一致，支持点击外部关闭）
function RowContextMenu({
  x, y, tool, onClose, onLaunch, onEdit, onOpenTerminal, onShowInFinder, onDelete,
}: {
  x: number; y: number; tool: Tool;
  onClose: () => void;
  onLaunch: () => void;
  onEdit: () => void;
  onOpenTerminal: () => void;
  onShowInFinder: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
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
      onClick={e => e.stopPropagation()}
    >
      <div className="context-menu-item" onClick={() => { onClose(); onLaunch(); }}>
        <span>▶</span> 启动
      </div>
      <div className="context-menu-item" onClick={() => { onClose(); onEdit(); }}>
        <span>✏️</span> 编辑
      </div>
      {tool.type !== 'url' && (
        <>
          <div className="context-menu-item" onClick={() => { onClose(); onOpenTerminal(); }}>
            <span>💻</span> 在终端中打开
          </div>
          <div className="context-menu-item" onClick={() => { onClose(); onShowInFinder(); }}>
            <span>📁</span> 在访达中显示
          </div>
        </>
      )}
      <div className="context-menu-divider" />
      <div className="context-menu-item danger" onClick={() => { onClose(); onDelete(); }}>
        <span>🗑️</span> 删除
      </div>
    </div>
  );
}
