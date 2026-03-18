import React, { useEffect, useRef, useState } from 'react';
import { Category, Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';
import CategoryModal from './CategoryModal';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import ToolModal from './ToolModal';

export default function Sidebar() {
  const { data, selectedCategoryId, selectCategory, searchQuery, setSearch } = useApp();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newToolPreset, setNewToolPreset] = useState<Partial<Tool> | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'area' | 'category';
    category?: Category;
  } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  if (!data) return null;

  const { categories, tools } = data;

  useEffect(() => () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
  }, []);

  const getCount = (catId: string) => {
    if (catId === 'all') return tools.length;
    return tools.filter(t => t.categoryId === catId).length;
  };

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  const recentTools = [...tools]
    .filter(t => t.lastUsed)
    .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
    .slice(0, 5);

  const openAddCategory = () => {
    setEditingCategory(null);
    setShowCategoryModal(true);
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowCategoryModal(true);
  };

  const scheduleHoverSelect = (categoryId: string) => {
    if (contextMenu) return;
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      selectCategory(categoryId);
    }, 150);
  };

  const clearHoverSelect = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const areaMenuItems: ContextMenuItem[] = [
    { label: '添加分类', icon: '+', onClick: openAddCategory },
    {
      label: '新建工具到当前分类',
      icon: '🔧',
      onClick: () => setNewToolPreset({ categoryId: selectedCategoryId === 'all' ? 'misc' : selectedCategoryId }),
    },
    { divider: true, label: 'divider' },
    { label: '切换到全部工具', icon: '📚', onClick: () => selectCategory('all') },
  ];

  const categoryMenuItems = (category: Category): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        label: `切换到 ${category.name}`,
        icon: category.icon,
        onClick: () => selectCategory(category.id),
      },
      {
        label: '新建工具到此分类',
        icon: '+',
        onClick: () => setNewToolPreset({ categoryId: category.id === 'all' ? 'misc' : category.id }),
      },
    ];

    if (category.id !== 'all') {
      items.push(
        { divider: true, label: 'divider' },
        { label: '编辑分类', icon: '✏️', onClick: () => openEditCategory(category) }
      );
    }

    return items;
  };

  return (
    <div style={{
      width: 220,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 13,
            opacity: 0.5,
          }}>🔍</span>
          <input
            className="input"
            placeholder="搜索工具..."
            value={searchQuery}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, fontSize: 13 }}
          />
        </div>
      </div>

      {/* Categories */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}
        onContextMenu={event => {
          event.preventDefault();
          const target = event.target as HTMLElement;
          if (target.closest('[data-category-item="true"]')) return;
          clearHoverSelect();
          setContextMenu({ x: event.clientX, y: event.clientY, type: 'area' });
        }}
      >
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-muted)',
          padding: '8px 8px 4px',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}>分类</div>

        {sorted.map(cat => (
          <CategoryItem
            key={cat.id}
            category={cat}
            count={getCount(cat.id)}
            selected={selectedCategoryId === cat.id}
            onClick={() => selectCategory(cat.id)}
            onHover={() => scheduleHoverSelect(cat.id)}
            onHoverEnd={clearHoverSelect}
            onEdit={cat.id !== 'all' ? () => {
              openEditCategory(cat);
            } : undefined}
            onContextMenu={(event) => {
              event.preventDefault();
              clearHoverSelect();
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                type: 'category',
                category: cat,
              });
            }}
          />
        ))}

        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4, fontSize: 12 }}
          onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
        >
          + 添加分类
        </button>

        {/* Recent */}
        {recentTools.length > 0 && (
          <>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              padding: '16px 8px 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}>最近使用</div>

            {recentTools.map(tool => (
              <div
                key={tool.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  overflow: 'hidden',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => {
                  selectCategory(tool.categoryId);
                }}
              >
                <span style={{ fontSize: 14 }}>{getToolTypeIcon(tool.type)}</span>
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>{tool.name}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      {newToolPreset && (
        <ToolModal
          initialValues={newToolPreset}
          onClose={() => setNewToolPreset(null)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={
            contextMenu.type === 'category' && contextMenu.category
              ? categoryMenuItems(contextMenu.category)
              : areaMenuItems
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function CategoryItem({
  category,
  count,
  selected,
  onClick,
  onHover,
  onHoverEnd,
  onEdit,
  onContextMenu,
}: {
  category: Category;
  count: number;
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onEdit?: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      data-category-item="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 8px',
        borderRadius: 8,
        cursor: 'pointer',
        background: selected ? 'var(--accent-color)' : hover ? 'var(--bg-tertiary)' : 'transparent',
        color: selected ? '#fff' : 'var(--text-primary)',
        fontSize: 13,
        fontWeight: selected ? 600 : 400,
        transition: 'background 0.1s',
        position: 'relative',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => {
        setHover(true);
        onHover();
      }}
      onMouseLeave={() => {
        setHover(false);
        onHoverEnd();
      }}
    >
      <span style={{ fontSize: 15 }}>{category.icon}</span>
      <span style={{ flex: 1 }}>{category.name}</span>
      <span style={{
        fontSize: 11,
        opacity: 0.7,
        background: selected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
        padding: '1px 6px',
        borderRadius: 10,
        minWidth: 20,
        textAlign: 'center',
      }}>{count}</span>
      {onEdit && hover && !selected && (
        <span
          style={{ fontSize: 13, opacity: 0.6, position: 'absolute', right: 6 }}
          onClick={e => { e.stopPropagation(); onEdit(); }}
          title="编辑分类"
        >✏️</span>
      )}
    </div>
  );
}

function getToolTypeIcon(type: string): string {
  const map: Record<string, string> = {
    jar: '☕',
    python: '🐍',
    shell: '💻',
    executable: '⚡',
    app: '📱',
    batch: '📜',
    url: '🌐',
  };
  return map[type] ?? '🔧';
}
