import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Category } from '../../shared/types';
import { useApp } from '../store/AppContext';
import CategoryModal from './CategoryModal';

export default function Sidebar() {
  const { data, selectedCategoryId, selectCategory, searchQuery, setSearch, saveSettingsSilent, saveCategorySilent } = useApp();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [width, setWidth] = useState<number>(() => data?.settings.sidebarWidth ?? 220);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(220);
  const hoverTimerRef = useRef<number | null>(null);

  const categories = data?.categories;
  const tools = data?.tools ?? [];
  const settings = data?.settings;

  useEffect(() => {
    if (!data) return;
    setWidth(data.settings.sidebarWidth);
  }, [data]);

  useEffect(() => () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const initialCollapsed: Record<string, boolean> = {};
    for (const category of categories ?? []) {
      if (!category.parentId && category.collapsed) {
        initialCollapsed[category.id] = true;
      }
    }
    setCollapsed(current => ({ ...initialCollapsed, ...current }));
  }, [categories]);

  const categoryChildren = useMemo(() => {
    const childrenMap = new Map<string, Category[]>();
    for (const category of categories ?? []) {
      if (!category.parentId) continue;
      const current = childrenMap.get(category.parentId) ?? [];
      current.push(category);
      childrenMap.set(category.parentId, current);
    }
    for (const entry of childrenMap.values()) {
      entry.sort((a, b) => a.order - b.order);
    }
    return childrenMap;
  }, [categories]);

  const getCount = (categoryId: string) => {
    if (categoryId === 'all') return tools.length;
    const descendantIds = new Set([categoryId]);
    const queue = [categoryId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const child of categoryChildren.get(currentId) ?? []) {
        if (!descendantIds.has(child.id)) {
          descendantIds.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return tools.filter(tool => descendantIds.has(tool.categoryId)).length;
  };

  const topCategories = categories
    ? categories
      .filter(category => !category.parentId && category.id !== 'all')
      .sort((a, b) => a.order - b.order)
    : [];

  const allCategory = categories?.find(category => category.id === 'all');

  const recentTools = [...tools]
    .filter(tool => tool.lastUsed)
    .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
    .slice(0, 5);

  const startResize = useCallback((event: React.MouseEvent) => {
    if (!settings) return;
    event.preventDefault();
    resizingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const nextWidth = Math.max(180, Math.min(360, startWidthRef.current + moveEvent.clientX - startXRef.current));
      setWidth(nextWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      resizingRef.current = false;
      const nextWidth = Math.max(180, Math.min(360, startWidthRef.current + upEvent.clientX - startXRef.current));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      void saveSettingsSilent({ ...settings, sidebarWidth: nextWidth });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [saveSettingsSilent, settings, width]);

  const toggleGroup = useCallback((category: Category, nextCollapsed: boolean) => {
    setCollapsed(current => ({ ...current, [category.id]: nextCollapsed }));
    void saveCategorySilent({
      ...category,
      collapsed: nextCollapsed,
    });
  }, [saveCategorySilent]);

  const scheduleHoverSelect = useCallback((categoryId: string) => {
    if (!settings?.hoverSwitchCategories) return;
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      selectCategory(categoryId);
    }, 120);
  }, [selectCategory, settings?.hoverSwitchCategories]);

  const clearHoverSelect = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  if (!data || !settings) return null;

  return (
    <div style={{
      width,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'relative',
    }}>
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
            onChange={event => setSearch(event.target.value)}
            style={{ paddingLeft: 30, fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-muted)',
          padding: '8px 8px 4px',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}>分类</div>

        {allCategory && (
          <CategoryItem
            category={allCategory}
            count={getCount('all')}
            selected={selectedCategoryId === 'all'}
            onClick={() => selectCategory('all')}
            onHover={() => scheduleHoverSelect('all')}
            onHoverEnd={clearHoverSelect}
          />
        )}

        {topCategories.map(group => {
          const children = categoryChildren.get(group.id) ?? [];
          const isCollapsed = collapsed[group.id] ?? false;

          return (
            <div key={group.id}>
              <CategoryItem
                category={group}
                count={getCount(group.id)}
                selected={selectedCategoryId === group.id}
                onClick={() => selectCategory(group.id)}
                onHover={() => scheduleHoverSelect(group.id)}
                onHoverEnd={clearHoverSelect}
                onEdit={() => {
                  setEditingCategory(group);
                  setShowCategoryModal(true);
                }}
                leadingControl={children.length > 0 ? (
                  <button
                    className="sidebar-disclosure"
                    onClick={event => {
                      event.stopPropagation();
                      toggleGroup(group, !isCollapsed);
                    }}
                    title={isCollapsed ? '展开' : '折叠'}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                ) : undefined}
              />

              {!isCollapsed && children.map(child => (
                <CategoryItem
                  key={child.id}
                  category={child}
                  count={getCount(child.id)}
                  selected={selectedCategoryId === child.id}
                  onClick={() => selectCategory(child.id)}
                  onHover={() => scheduleHoverSelect(child.id)}
                  onHoverEnd={clearHoverSelect}
                  onEdit={() => {
                    setEditingCategory(child);
                    setShowCategoryModal(true);
                  }}
                  indent
                />
              ))}
            </div>
          );
        })}

        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4, fontSize: 12 }}
          onClick={() => {
            setEditingCategory(null);
            setShowCategoryModal(true);
          }}
        >
          + 添加分类
        </button>

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
              <div key={tool.id} className="sidebar-item" onClick={() => selectCategory(tool.categoryId)}>
                {tool.icon
                  ? <img src={tool.icon} width={16} height={16} style={{ borderRadius: 3, objectFit: 'contain' }} />
                  : <span style={{ fontSize: 14 }}>{getToolTypeIcon(tool.type)}</span>
                }
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                }}>{tool.name}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
        }}
        onMouseDown={startResize}
      />

      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setShowCategoryModal(false)}
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
  indent = false,
  leadingControl,
}: {
  category: Category;
  count: number;
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onEdit?: () => void;
  indent?: boolean;
  leadingControl?: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className={`sidebar-item${selected ? ' active' : ''}`}
      style={{ paddingLeft: indent ? 22 : 10 }}
      onClick={onClick}
      onMouseEnter={() => {
        setHover(true);
        onHover();
      }}
      onMouseLeave={() => {
        setHover(false);
        onHoverEnd();
      }}
    >
      {leadingControl ?? <span style={{ width: 14, flexShrink: 0 }} />}
      <span style={{ fontSize: 14 }}>{category.icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {category.name}
      </span>
      <span style={{
        fontSize: 11,
        opacity: 0.7,
        background: selected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
        padding: '1px 6px',
        borderRadius: 10,
        minWidth: 20,
        textAlign: 'center',
        flexShrink: 0,
      }}>{count}</span>
      {onEdit && hover && !selected && (
        <span
          style={{ fontSize: 12, opacity: 0.6, marginLeft: 4 }}
          onClick={event => {
            event.stopPropagation();
            onEdit();
          }}
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
    url: '🌐',
  };
  return map[type] ?? '🔧';
}
