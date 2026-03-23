import React, { useState, useCallback, useRef } from 'react';
import { Category } from '../../shared/types';
import { useApp } from '../store/AppContext';
import CategoryModal from './CategoryModal';

export default function Sidebar() {
  const { data, selectedCategoryId, selectCategory, searchQuery, setSearch, saveSettingsSilent } = useApp();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [width, setWidth] = useState<number>(() => data?.settings.sidebarWidth ?? 220);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(220);

  if (!data) return null;

  const { categories, tools, settings } = data;

  const getCount = (catId: string) => {
    if (catId === 'all') return tools.length;
    return tools.filter(t => t.categoryId === catId).length;
  };

  // 顶级分类（无 parentId 且不是 'all'）
  const topCategories = categories
    .filter(c => !c.parentId && c.id !== 'all')
    .sort((a, b) => a.order - b.order);

  // 子分类
  const childrenOf = (parentId: string) =>
    categories
      .filter(c => c.parentId === parentId)
      .sort((a, b) => a.order - b.order);

  const allCat = categories.find(c => c.id === 'all');

  const toggleGroup = (id: string) =>
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const recentTools = [...tools]
    .filter(t => t.lastUsed)
    .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
    .slice(0, 5);

  // 侧边栏宽度拖拽
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const newWidth = Math.max(180, Math.min(360, startWidthRef.current + ev.clientX - startXRef.current));
      setWidth(newWidth);
    };

    const onMouseUp = (ev: MouseEvent) => {
      resizingRef.current = false;
      const newWidth = Math.max(180, Math.min(360, startWidthRef.current + ev.clientX - startXRef.current));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // 持久化侧边栏宽度（静默，不弹 Toast）
      saveSettingsSilent({ ...settings, sidebarWidth: newWidth });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width, settings, saveSettingsSilent]);

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
      {/* 搜索框 */}
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

      {/* 分类树 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-muted)',
          padding: '8px 8px 4px',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}>分类</div>

        {/* 全部工具 — 置顶 */}
        {allCat && (
          <CategoryItem
            category={allCat}
            count={getCount('all')}
            selected={selectedCategoryId === 'all'}
            onClick={() => selectCategory('all')}
          />
        )}

        {/* 顶级分类树 */}
        {topCategories.map(group => {
          const children = childrenOf(group.id);
          const isCollapsed = collapsed[group.id];

          return (
            <div key={group.id}>
              {/* 顶级分类头（点击折叠/展开）*/}
              <div
                className="sidebar-group-header"
                onClick={() => toggleGroup(group.id)}
                style={{ marginTop: 4 }}
              >
                <span style={{
                  fontSize: 10,
                  opacity: 0.6,
                  display: 'inline-block',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}>▼</span>
                <span style={{ fontSize: 14 }}>{group.icon}</span>
                <span style={{ flex: 1 }}>{group.name}</span>
                <span
                  style={{ fontSize: 11, opacity: 0.5 }}
                  onClick={e => { e.stopPropagation(); setEditingCategory(group); setShowCategoryModal(true); }}
                  title="编辑"
                >✏️</span>
              </div>

              {/* 子分类（缩进）*/}
              {!isCollapsed && children.map(child => (
                <CategoryItem
                  key={child.id}
                  category={child}
                  count={getCount(child.id)}
                  selected={selectedCategoryId === child.id}
                  onClick={() => selectCategory(child.id)}
                  onEdit={() => { setEditingCategory(child); setShowCategoryModal(true); }}
                  indent
                />
              ))}

              {/* 若顶级分类本身没有子分类，允许直接选中顶级 */}
              {!isCollapsed && children.length === 0 && (
                <CategoryItem
                  category={group}
                  count={getCount(group.id)}
                  selected={selectedCategoryId === group.id}
                  onClick={() => selectCategory(group.id)}
                  indent
                />
              )}
            </div>
          );
        })}

        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4, fontSize: 12 }}
          onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
        >
          + 添加分类
        </button>

        {/* 最近使用 */}
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
                className="sidebar-item"
                onClick={() => selectCategory(tool.categoryId)}
              >
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

      {/* 拖拽调整宽度的边界线 */}
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
  onEdit,
  indent = false,
}: {
  category: Category;
  count: number;
  selected: boolean;
  onClick: () => void;
  onEdit?: () => void;
  indent?: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className={`sidebar-item${selected ? ' active' : ''}`}
      style={{ paddingLeft: indent ? 22 : 10 }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
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
    url: '🌐',
  };
  return map[type] ?? '🔧';
}
