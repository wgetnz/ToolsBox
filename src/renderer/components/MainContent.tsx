import React, { useMemo, useState, useEffect } from 'react';
import { Category, Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';
import ToolCard from './ToolCard';
import ToolModal from './ToolModal';
import CategoryModal from './CategoryModal';
import { getToolFallbackIcon } from '../utils/toolIcons';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type SortKey = 'name' | 'lastUsed' | 'useCount' | 'createdAt';

interface Props {
  onAddTool: (categoryId?: string) => void;
}

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

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/\s+/g, '')
    .trim();
}

export default function MainContent({ onAddTool }: Props) {
  const {
    data,
    selectedCategoryId,
    searchQuery,
    searchScope,
    viewMode,
    setViewMode,
    saveSettingsSilent,
    launchTool,
  } = useApp();
  const [editingTool, setEditingTool] = useState<Tool | null | undefined>(undefined);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [areaMenu, setAreaMenu] = useState<{ x: number; y: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const sortMenuRef = React.useRef<HTMLDivElement | null>(null);
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(current => !current);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };

  const selectedCategoryIds = useMemo(() => {
    if (!data || !selectedCategoryId) return null;

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

  const activeTopCategoryId = useMemo(() => {
    if (!data || !selectedCategoryId) return null;
    const selected = data.categories.find(category => category.id === selectedCategoryId);
    if (!selected) return null;
    return selected.parentId ?? selected.id;
  }, [data, selectedCategoryId]);

  const defaultToolCategoryId = useMemo(() => {
    if (!data || !selectedCategoryId) return undefined;

    const categoriesById = new Map(data.categories.map(category => [category.id, category]));
    const parentIds = new Set(data.categories.filter(category => category.parentId).map(category => category.id ? category.parentId! : ''));
    const isLeaf = (categoryId: string) => !parentIds.has(categoryId);

    if (isLeaf(selectedCategoryId)) return selectedCategoryId;

    const descendants = data.categories
      .filter(category => category.parentId === selectedCategoryId)
      .sort((a, b) => a.order - b.order);

    for (const category of descendants) {
      if (isLeaf(category.id)) return category.id;
    }

    const activeTopCategory = categoriesById.get(activeTopCategoryId ?? '');
    if (activeTopCategory && isLeaf(activeTopCategory.id)) return activeTopCategory.id;

    return undefined;
  }, [activeTopCategoryId, data, selectedCategoryId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let tools = data.tools;
    const categoriesById = new Map(data.categories.map(category => [category.id, category]));

    const shouldLimitToCurrentCategory = !searchQuery.trim() || searchScope === 'current';

    if (shouldLimitToCurrentCategory && selectedCategoryIds) {
      tools = tools.filter(tool => selectedCategoryIds.has(tool.categoryId));
    }

    if (searchQuery.trim()) {
      const q = normalizeSearchText(searchQuery);
      tools = tools.filter(tool =>
        [
          tool.name,
          tool.description ?? '',
          tool.type,
          tool.path,
          categoriesById.get(tool.categoryId)?.name ?? '',
        ].some(value => normalizeSearchText(value).includes(q))
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
  }, [data, searchQuery, searchScope, selectedCategoryIds, sortAsc, sortKey]);

  useEffect(() => {
    if (!showSortMenu) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showSortMenu]);

  useEffect(() => {
    if (!areaMenu) return undefined;

    const close = (event: MouseEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return;
      setAreaMenu(null);
    };
    window.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('mousedown', close);
    };
  }, [areaMenu]);

  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>加载中...</div>
      </div>
    );
  }

  const cardSize = data.settings.cardSize;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          minHeight: 38,
          padding: '0 10px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <div ref={sortMenuRef} style={{ position: 'relative' }}>
          <button
            className={`lily-toolbar-icon${showSortMenu ? ' active' : ''}`}
            onClick={() => setShowSortMenu(current => !current)}
            title="排序选项"
          >
            ⇅
          </button>

          {showSortMenu && (
            <div className="lily-toolbar-menu">
              {([
                ['name', '名称'],
                ['lastUsed', '最近使用'],
                ['useCount', '使用次数'],
                ['createdAt', '添加时间'],
              ] as [SortKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={`lily-toolbar-menu-item${sortKey === key ? ' active' : ''}`}
                  onClick={() => handleSort(key)}
                >
                  <span>{label}</span>
                  {sortKey === key && <span>{sortAsc ? '↑' : '↓'}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => {
              setViewMode('grid');
              void saveSettingsSilent({ ...data.settings, viewMode: 'grid' });
            }}
            className={`lily-toolbar-icon${viewMode === 'grid' ? ' active' : ''}`}
            title="网格视图"
          >⊞</button>
          <button
            onClick={() => {
              setViewMode('list');
              void saveSettingsSilent({ ...data.settings, viewMode: 'list' });
            }}
            className={`lily-toolbar-icon${viewMode === 'list' ? ' active' : ''}`}
            title="列表视图"
          >☰</button>
        </div>
      </div>

      <div
        style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 12px', position: 'relative' }}
        onContextMenu={event => {
          const target = event.target as HTMLElement;
          if (target.closest('.tool-card') || target.closest('.tool-row') || target.closest('.context-menu')) return;
          event.preventDefault();
          setAreaMenu({ x: event.clientX, y: event.clientY });
        }}
      >
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
                <p>在空白区域右键添加你的第一个工具</p>
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: cardSize === 'small' ? 6 : cardSize === 'large' ? 10 : 8,
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

        {areaMenu && (
          <div
            className="context-menu glass"
            ref={contextMenuRef}
            style={{ left: areaMenu.x, top: areaMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <div
              className="context-menu-item"
              onClick={() => {
                setAreaMenu(null);
                onAddTool(defaultToolCategoryId);
              }}
            >
              <span>＋</span> 添加工具
            </div>
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

export function TopCategoryBar() {
  const { data, selectedCategoryId, selectCategory, saveCategorySilent, deleteCategory } = useApp();
  const [editingTopCategory, setEditingTopCategory] = useState<Category | null>(null);
  const [showTopCategoryModal, setShowTopCategoryModal] = useState(false);
  const [topCategoryMenu, setTopCategoryMenu] = useState<{ x: number; y: number } | null>(null);
  const [topCategoryContextMenu, setTopCategoryContextMenu] = useState<{ x: number; y: number; category: Category } | null>(null);
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },
  }));

  const topCategories = useMemo(() => (
    data?.categories
      .filter(category => !category.parentId && category.id !== 'all')
      .sort((a, b) => a.order - b.order) ?? []
  ), [data]);

  const activeTopCategoryId = useMemo(() => {
    if (!data || !selectedCategoryId) return null;
    const selected = data.categories.find(category => category.id === selectedCategoryId);
    if (!selected) return null;
    return selected.parentId ?? selected.id;
  }, [data, selectedCategoryId]);

  useEffect(() => {
    if (!topCategoryMenu && !topCategoryContextMenu) return undefined;

    const close = (event: MouseEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return;
      setTopCategoryMenu(null);
      setTopCategoryContextMenu(null);
    };
    window.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('mousedown', close);
    };
  }, [topCategoryContextMenu, topCategoryMenu]);

  if (!data) return null;

  const scheduleHoverSelect = (categoryId: string) => {
    if (!data.settings.hoverSwitchCategories) return;
    selectCategory(categoryId);
  };

  const clearHoverSelect = () => {};

  const reorderTopCategories = async (orderedTopCategories: Category[]) => {
    const reordered = orderedTopCategories.map((category, index) => ({
      ...category,
      order: index + 1,
    }));

    for (const category of reordered) {
      await saveCategorySilent(category);
    }
  };

  const handleTopCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = topCategories.findIndex(category => category.id === active.id);
    const newIndex = topCategories.findIndex(category => category.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    void reorderTopCategories(arrayMove(topCategories, oldIndex, newIndex));
  };

  return (
    <>
      <div
        className="lily-top-strip"
        onContextMenu={event => {
          const target = event.target as HTMLElement;
          if (target.closest('.lily-top-tab-wrap')) return;
          event.preventDefault();
          event.stopPropagation();
          setTopCategoryMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopCategoryDragEnd}>
          <div className="lily-top-strip-tabs">
            <SortableContext items={topCategories.map(category => category.id)} strategy={horizontalListSortingStrategy}>
              {topCategories.map(category => (
                <SortableTopCategoryTab
                  key={category.id}
                  category={category}
                  active={activeTopCategoryId === category.id}
                  onSelect={() => selectCategory(category.id)}
                  onHoverSelect={() => scheduleHoverSelect(category.id)}
                  onHoverEnd={clearHoverSelect}
                  onContextMenu={(event, targetCategory) => {
                    setTopCategoryContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      category: targetCategory,
                    });
                  }}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>
      </div>

      {topCategoryMenu && (
        <div
          className="context-menu glass"
          ref={contextMenuRef}
          style={{ left: topCategoryMenu.x, top: topCategoryMenu.y }}
          onClick={event => event.stopPropagation()}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              setTopCategoryMenu(null);
              setEditingTopCategory(null);
              setShowTopCategoryModal(true);
            }}
          >
            <span>＋</span> 添加大分类
          </div>
        </div>
      )}

      {topCategoryContextMenu && (
        <div
          className="context-menu glass"
          ref={contextMenuRef}
          style={{ left: topCategoryContextMenu.x, top: topCategoryContextMenu.y }}
          onClick={event => event.stopPropagation()}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              setTopCategoryContextMenu(null);
              setEditingTopCategory(topCategoryContextMenu.category);
              setShowTopCategoryModal(true);
            }}
          >
            <span>✏️</span> 编辑
          </div>
          <div className="context-menu-divider" />
          <div
            className="context-menu-item danger"
            onClick={() => {
              setTopCategoryContextMenu(null);
              void deleteCategory(topCategoryContextMenu.category.id);
            }}
          >
            <span>🗑️</span> 删除
          </div>
        </div>
      )}

      {showTopCategoryModal && (
        <CategoryModal
          category={editingTopCategory}
          onClose={() => setShowTopCategoryModal(false)}
        />
      )}
    </>
  );
}

function SortableTopCategoryTab({
  category,
  active,
  onSelect,
  onHoverSelect,
  onHoverEnd,
  onContextMenu,
}: {
  category: Category;
  active: boolean;
  onSelect: () => void;
  onHoverSelect: () => void;
  onHoverEnd: () => void;
  onContextMenu: (event: React.MouseEvent, category: Category) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });
  const [hover, setHover] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={`lily-top-tab-wrap${hover ? ' hovering' : ''}${isDragging ? ' dragging' : ''}`}
      style={style}
      onContextMenu={event => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(event, category);
      }}
      onMouseEnter={() => {
        setHover(true);
        onHoverSelect();
      }}
      onMouseLeave={() => {
        setHover(false);
        onHoverEnd();
      }}
      {...attributes}
      {...listeners}
    >
      <button
        className={`top-category-tab lily-top-tab${active ? ' active' : ''}`}
        onClick={onSelect}
      >
        {category.name}
      </button>
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
            : <span style={{ fontSize: 20 }}>{getToolFallbackIcon(tool)}</span>
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
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
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
