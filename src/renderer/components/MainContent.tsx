import React, { useMemo, useState } from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import ToolCard from './ToolCard';
import ToolModal from './ToolModal';

type SortKey = 'name' | 'lastUsed' | 'useCount' | 'createdAt';

const BATCH_COLORS = [
  '#4f8ef7', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#3498db', '#e67e22', '#e91e63', '#00bcd4',
];

export default function MainContent() {
  const { data, selectedCategoryId, searchQuery, launchTool, deleteTools, moveToolsToCategory, updateToolsColor } = useApp();
  const [editingTool, setEditingTool] = useState<Tool | null | undefined>(undefined);
  const [newToolPreset, setNewToolPreset] = useState<Partial<Tool> | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [lastSelectedToolId, setLastSelectedToolId] = useState<string | null>(null);
  const [moveTargetCategoryId, setMoveTargetCategoryId] = useState<string>('');

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
  const filteredToolIds = filtered.map(tool => tool.id);
  const selectedSet = new Set(selectedToolIds);
  const selectedTools = filtered.filter(tool => selectedSet.has(tool.id));
  const nonAllCategories = data.categories.filter(category => category.id !== 'all');

  const clearSelection = () => {
    setSelectedToolIds([]);
    setLastSelectedToolId(null);
  };

  const handleSelectTool = (event: React.MouseEvent, tool: Tool) => {
    const isMeta = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;

    if (isShift && lastSelectedToolId) {
      const startIndex = filteredToolIds.indexOf(lastSelectedToolId);
      const endIndex = filteredToolIds.indexOf(tool.id);
      if (startIndex >= 0 && endIndex >= 0) {
        const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const rangeIds = filteredToolIds.slice(from, to + 1);
        setSelectedToolIds(Array.from(new Set([...selectedToolIds, ...rangeIds])));
        return;
      }
    }

    if (isMeta) {
      setSelectedToolIds(current =>
        current.includes(tool.id) ? current.filter(id => id !== tool.id) : [...current, tool.id]
      );
      setLastSelectedToolId(tool.id);
      return;
    }

    setSelectedToolIds([tool.id]);
    setLastSelectedToolId(tool.id);
  };

  const launchSelectedTools = async () => {
    for (const toolId of selectedToolIds) {
      await launchTool(toolId);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedToolIds.length === 0) return;
    if (!confirm(`确认删除选中的 ${selectedToolIds.length} 个工具？`)) return;
    await deleteTools(selectedToolIds);
    clearSelection();
  };

  const handleMoveSelected = async () => {
    if (!moveTargetCategoryId || selectedToolIds.length === 0) return;
    await moveToolsToCategory(selectedToolIds, moveTargetCategoryId);
    clearSelection();
    setMoveTargetCategoryId('');
  };

  const handleRecolorSelected = async (color: string) => {
    await updateToolsColor(selectedToolIds, color);
  };

  const buildBatchContextMenuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      { label: `启动选中项 (${selectedToolIds.length})`, icon: '▶', onClick: () => { void launchSelectedTools(); } },
      { label: '清除选择', icon: '✕', onClick: clearSelection },
      { divider: true, label: 'divider-1' },
    ];

    nonAllCategories.forEach(category => {
      items.push({
        label: `移动到 ${category.name}`,
        icon: category.icon,
        onClick: () => { void moveToolsToCategory(selectedToolIds, category.id).then(clearSelection); },
      });
    });

    items.push(
      { divider: true, label: 'divider-2' },
      { label: '删除选中项', icon: '🗑️', danger: true, onClick: () => { void handleDeleteSelected(); } }
    );

    return items;
  };

  const quickAddItems: ContextMenuItem[] = [
    {
      label: '添加工具',
      icon: '+',
      onClick: () => setNewToolPreset({ categoryId: selectedCategoryId === 'all' ? 'misc' : selectedCategoryId }),
    },
    {
      label: '添加 App',
      icon: '📱',
      onClick: () => setNewToolPreset({
        type: 'app',
        categoryId: selectedCategoryId === 'all' ? 'misc' : selectedCategoryId,
      }),
    },
    {
      label: '添加网址',
      icon: '🌐',
      onClick: () => setNewToolPreset({
        type: 'url',
        categoryId: selectedCategoryId === 'all' ? 'misc' : selectedCategoryId,
      }),
    },
    {
      label: '添加脚本',
      icon: '💻',
      onClick: () => setNewToolPreset({
        type: 'shell',
        categoryId: selectedCategoryId === 'all' ? 'misc' : selectedCategoryId,
      }),
    },
    { divider: true, label: 'divider-quick' },
    {
      label: selectedToolIds.length > 0 ? `清除选择 (${selectedToolIds.length})` : '暂无批量操作',
      icon: '✕',
      disabled: selectedToolIds.length === 0,
      onClick: clearSelection,
    },
  ];

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onClick={event => {
        const target = event.target as HTMLElement;
        if (target.closest('[data-tool-card="true"]') || target.closest('.context-menu')) return;
        if (selectedToolIds.length > 0) clearSelection();
      }}
    >
      {/* Toolbar */}
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

        {/* Sort */}
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
      </div>

      {selectedToolIds.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            已选中 {selectedToolIds.length} 项
          </span>
          <button className="btn btn-secondary" onClick={() => { void launchSelectedTools(); }}>
            ▶ 启动选中项
          </button>
          <select
            className="input"
            value={moveTargetCategoryId}
            onChange={event => setMoveTargetCategoryId(event.target.value)}
            style={{ width: 180 }}
          >
            <option value="">移动到分类...</option>
            {nonAllCategories.map(category => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => { void handleMoveSelected(); }}
            disabled={!moveTargetCategoryId}
          >
            移动
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>批量改色</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BATCH_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => { void handleRecolorSelected(color); }}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: color,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title={`改成 ${color}`}
                />
              ))}
            </div>
          </div>
          <button className="btn btn-danger" onClick={() => { void handleDeleteSelected(); }}>
            删除选中项
          </button>
          <button className="btn btn-ghost" onClick={clearSelection}>
            清除选择
          </button>
        </div>
      )}

      {/* Cards grid */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '20px' }}
        onContextMenu={event => {
          const target = event.target as HTMLElement;
          if (target.closest('[data-tool-card="true"]')) return;
          event.preventDefault();
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            items: selectedToolIds.length > 0 ? buildBatchContextMenuItems() : quickAddItems,
          });
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
                <p>点击右上角"添加工具"来添加你的第一个工具</p>
              </>
            )}
          </div>
        ) : (
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
                selected={selectedSet.has(tool.id)}
                onSelect={handleSelectTool}
                onRequestContextMenu={(event, targetTool) => {
                  const currentIsSelected = selectedSet.has(targetTool.id);
                  if (selectedToolIds.length > 1 && currentIsSelected) {
                    event.preventDefault();
                    setContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      items: buildBatchContextMenuItems(),
                    });
                    return true;
                  }

                  if (selectedToolIds.length > 0 && !currentIsSelected) {
                    setSelectedToolIds([targetTool.id]);
                    setLastSelectedToolId(targetTool.id);
                  }

                  return false;
                }}
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
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
