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
  const { data, selectedCategoryId, searchQuery, viewMode, setViewMode, saveSettingsSilent, launchTool, selectCategory } = useApp();
  const [editingTool, setEditingTool] = useState<Tool | null | undefined>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(current => !current);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };

  const selectedCategoryIds = useMemo(() => {
    if (!data || selectedCategoryId === 'all') return null;

    const ids = new Set([selectedCategoryId]);
    const queue = [selectedCategoryId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const category of data.categories) {
        if (category.parentId === current && !ids.has(category.id)) {
          ids.add(category.id);
          queue.push(category.id);
        }
      }
    }
    return ids;
  }, [data, selectedCategoryId]);

  const topCategories = useMemo(() => (
    data?.categories
      .filter(category => !category.parentId && category.id !== 'all')
      .sort((a, b) => a.order - b.order) ?? []
  ), [data]);

  const activeTopCategoryId = useMemo(() => {
    if (!data || selectedCategoryId === 'all') return null;
    const selected = data.categories.find(category => category.id === selectedCategoryId);
    if (!selected) return null;
    return selected.parentId ?? selected.id;
  }, [data, selectedCategoryId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let tools = data.tools;

    if (selectedCategoryIds) {
      tools = tools.filter(tool => selectedCategoryIds.has(tool.categoryId));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tools = tools.filter(tool =>
        tool.name.toLowerCase().includes(q) ||
        tool.description?.toLowerCase().includes(q) ||
        tool.type.toLowerCase().includes(q)
      );
    }

    return [...tools].sort((a, b) => {
      let value = 0;
      switch (sortKey) {
        case 'name':
          value = a.name.localeCompare(b.name, 'zh-CN');
          break;
        case 'lastUsed':
          value = (b.lastUsed ?? 0) - (a.lastUsed ?? 0);
          break;
        case 'useCount':
          value = b.useCount - a.useCount;
          break;
        case 'createdAt':
          value = b.createdAt - a.createdAt;
          break;
      }
      return sortAsc ? value : -value;
    });
  }, [data, searchQuery, selectedCategoryIds, sortAsc, sortKey]);

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
    : data.categories.find(category => category.id === selectedCategoryId)?.name ?? '工具';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {topCategories.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '10px 14px 0',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
          overflowX: 'auto',
        }}>
          <button
            className={`top-category-tab lily-top-tab${selectedCategoryId === 'all' ? ' active' : ''}`}
            onClick={() => selectCategory('all')}
          >
            全部工具
          </button>
          {topCategories.map(category => (
            <button
              key={category.id}
              className={`top-category-tab lily-top-tab${activeTopCategoryId === category.id ? ' active' : ''}`}
              onClick={() => selectCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

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

        <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 7, overflow: 'hidden' }}>
          <button
            onClick={() => {
              setViewMode('grid');
              void saveSettingsSilent({ ...data.settings, viewMode: 'grid' });
            }}
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
            onClick={() => {
              setViewMode('list');
              void saveSettingsSilent({ ...data.settings, viewMode: 'list' });
            }}
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
                <p>点击右上角&quot;添加工具&quot;来添加你的第一个工具</p>
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
                onEdit={item => setEditingTool(item)}
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

function ToolRow({ tool, onEdit, onLaunch }: { tool: Tool; onEdit: () => void; onLaunch: () => void }) {
  const { deleteTool, openInTerminal, showInFinder } = useApp();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <div
        className="tool-row"
        style={{ height: 52 }}
        onDoubleClick={onLaunch}
        onContextMenu={event => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        {tool.accentColor && (
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: tool.accentColor,
            flexShrink: 0,
          }} />
        )}

        <div style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 7,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {tool.icon
            ? <img src={tool.icon} width={32} height={32} style={{ objectFit: 'contain' }} />
            : <span style={{ fontSize: 20 }}>{TYPE_ICONS[tool.type] ?? '🔧'}</span>
          }
        </div>

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

function RowContextMenu({
  x, y, tool, onClose, onLaunch, onEdit, onOpenTerminal, onShowInFinder, onDelete,
}: {
  x: number;
  y: number;
  tool: Tool;
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
      onClick={event => event.stopPropagation()}
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
