import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Category } from '../../shared/types';
import { useApp } from '../store/AppContext';
import CategoryModal from './CategoryModal';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

function getSidebarWidthBounds(viewportWidth: number) {
  const min = Math.max(72, Math.min(140, Math.round(viewportWidth * 0.1)));
  const max = Math.max(220, Math.min(520, Math.round(viewportWidth * 0.38)));
  return { min, max };
}

function getDefaultSidebarWidth(viewportWidth: number) {
  const { min, max } = getSidebarWidthBounds(viewportWidth);
  return Math.max(min, Math.min(max, Math.round(viewportWidth * 0.18)));
}

function clampSidebarWidth(width: number, viewportWidth: number) {
  const { min, max } = getSidebarWidthBounds(viewportWidth);
  return Math.max(min, Math.min(max, Math.round(width)));
}

export default function Sidebar() {
  const { data, selectedCategoryId, selectCategory, saveSettingsSilent, saveCategorySilent, deleteCategory } = useApp();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [sidebarMenu, setSidebarMenu] = useState<{ x: number; y: number } | null>(null);
  const [categoryContextMenu, setCategoryContextMenu] = useState<{ x: number; y: number; category: Category } | null>(null);
  const sidebarMenuRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(() => {
    const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
    return clampSidebarWidth(data?.settings.sidebarWidth ?? getDefaultSidebarWidth(viewportWidth), viewportWidth);
  });
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 4 },
  }));

  const categories = data?.categories;
  const settings = data?.settings;

  useEffect(() => {
    if (!data) return;
    setWidth(clampSidebarWidth(data.settings.sidebarWidth, window.innerWidth));
  }, [data]);

  useEffect(() => {
    const handleResize = () => {
      setWidth(current => clampSidebarWidth(current, window.innerWidth));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!sidebarMenu && !categoryContextMenu) return undefined;

    const close = (event: MouseEvent) => {
      if (sidebarMenuRef.current?.contains(event.target as Node)) return;
      setSidebarMenu(null);
      setCategoryContextMenu(null);
    };
    window.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('mousedown', close);
    };
  }, [categoryContextMenu, sidebarMenu]);

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

  const activeTopCategoryId = useMemo(() => (
    selectedCategoryId
      ? (categories?.find(category => category.id === selectedCategoryId)?.parentId ?? selectedCategoryId)
      : null
  ), [categories, selectedCategoryId]);

  const activeTopCategory = useMemo(() => (
    activeTopCategoryId
      ? categories?.find(category => category.id === activeTopCategoryId) ?? null
      : null
  ), [activeTopCategoryId, categories]);

  const activeSubCategories = useMemo(() => (
    activeTopCategoryId
      ? (categoryChildren.get(activeTopCategoryId) ?? [])
      : []
  ), [activeTopCategoryId, categoryChildren]);

  const startResize = useCallback((event: React.MouseEvent) => {
    if (!settings) return;
    event.preventDefault();
    resizingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const nextWidth = clampSidebarWidth(startWidthRef.current + moveEvent.clientX - startXRef.current, window.innerWidth);
      setWidth(nextWidth);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      resizingRef.current = false;
      const nextWidth = clampSidebarWidth(startWidthRef.current + upEvent.clientX - startXRef.current, window.innerWidth);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      void saveSettingsSilent({ ...settings, sidebarWidth: nextWidth });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [saveSettingsSilent, settings, width]);

  const scheduleHoverSelect = useCallback((categoryId: string) => {
    if (!settings?.hoverSwitchCategories) return;
    selectCategory(categoryId);
  }, [selectCategory, settings?.hoverSwitchCategories]);

  const clearHoverSelect = useCallback(() => {}, []);

  const reorderSubCategories = useCallback(async (orderedSubCategories: Category[]) => {
    if (!activeTopCategoryId) return;
    const parentOrder = activeTopCategory?.order ?? 0;
    for (const [index, category] of orderedSubCategories.entries()) {
      await saveCategorySilent({
        ...category,
        order: parentOrder + index + 1,
      });
    }
  }, [activeTopCategory?.order, activeTopCategoryId, saveCategorySilent]);

  const handleSubCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeSubCategories.findIndex(category => category.id === active.id);
    const newIndex = activeSubCategories.findIndex(category => category.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    void reorderSubCategories(arrayMove(activeSubCategories, oldIndex, newIndex));
  };

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
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '6px 2px' }}
        onContextMenu={event => {
          if (!activeTopCategory) return;
          const target = event.target as HTMLElement;
          if (target.closest('.sidebar-item')) return;
          event.preventDefault();
          event.stopPropagation();
          setSidebarMenu({ x: event.clientX, y: event.clientY });
        }}
      >

        {activeTopCategory && (
          <div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubCategoryDragEnd}>
              <SortableContext items={activeSubCategories.map(category => category.id)} strategy={verticalListSortingStrategy}>
                {activeSubCategories.map(child => (
                  <SortableCategoryItem
                    key={child.id}
                    category={child}
                    selected={selectedCategoryId === child.id}
                    onClick={() => selectCategory(child.id)}
                    onHover={() => scheduleHoverSelect(child.id)}
                    onHoverEnd={clearHoverSelect}
                    onEdit={() => {
                      setEditingCategory(child);
                      setShowCategoryModal(true);
                    }}
                    onContextMenu={(event, targetCategory) => {
                      setCategoryContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        category: targetCategory,
                      });
                    }}
                    indent
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}

        {!activeTopCategory && (
          <div style={{
            padding: '14px 10px',
            color: 'var(--text-muted)',
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            先从顶部选择一个大分类
          </div>
        )}

        {sidebarMenu && activeTopCategory && (
          <div
            className="context-menu glass"
            ref={sidebarMenuRef}
            style={{ left: sidebarMenu.x, top: sidebarMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <div
              className="context-menu-item"
              onClick={() => {
                setSidebarMenu(null);
                setEditingCategory(null);
                setShowCategoryModal(true);
              }}
            >
              <span>＋</span> 添加小分类
            </div>
          </div>
        )}

        {categoryContextMenu && (
          <div
            className="context-menu glass"
            ref={sidebarMenuRef}
            style={{ left: categoryContextMenu.x, top: categoryContextMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <div
              className="context-menu-item"
              onClick={() => {
                setCategoryContextMenu(null);
                setEditingCategory(categoryContextMenu.category);
                setShowCategoryModal(true);
              }}
            >
              <span>✏️</span> 编辑
            </div>
            <div className="context-menu-divider" />
            <div
              className="context-menu-item danger"
              onClick={() => {
                setCategoryContextMenu(null);
                void deleteCategory(categoryContextMenu.category.id);
              }}
            >
              <span>🗑️</span> 删除
            </div>
          </div>
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
          initialParentId={editingCategory ? undefined : activeTopCategory?.id}
          onClose={() => setShowCategoryModal(false)}
        />
      )}
    </div>
  );
}

function CategoryItem({
  setNodeRef,
  listeners,
  attributes,
  category,
  selected,
  onClick,
  onHover,
  onHoverEnd,
  onContextMenu,
  dragging,
  indent = false,
  leadingControl,
}: {
  setNodeRef?: (node: HTMLDivElement | null) => void;
  listeners?: SyntheticListenerMap;
  attributes?: DraggableAttributes;
  category: Category;
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onContextMenu?: (event: React.MouseEvent, category: Category) => void;
  dragging?: boolean;
  indent?: boolean;
  leadingControl?: React.ReactNode;
}) {
  return (
    <div
      ref={setNodeRef}
      className={`sidebar-item${selected ? ' active' : ''}${dragging ? ' dragging' : ''}`}
      style={{ paddingLeft: indent ? 12 : 2, paddingRight: 2 }}
      onClick={onClick}
      onContextMenu={event => {
        if (!onContextMenu) return;
        event.preventDefault();
        event.stopPropagation();
        onContextMenu(event, category);
      }}
      onMouseEnter={onHover}
      onMouseLeave={() => {
        onHoverEnd();
      }}
      {...attributes}
      {...listeners}
    >
      {leadingControl ?? null}
      <span style={{ fontSize: 13 }}>{category.icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {category.name}
      </span>
    </div>
  );
}

function SortableCategoryItem(props: {
  category: Category;
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onEdit?: () => void;
  onContextMenu?: (event: React.MouseEvent, category: Category) => void;
  indent?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.category.id });

  return (
    <div style={{ transform: CSS.Transform.toString(transform), transition }}>
      <CategoryItem
        {...props}
        setNodeRef={setNodeRef}
        attributes={attributes}
        listeners={listeners}
        dragging={isDragging}
      />
    </div>
  );
}
