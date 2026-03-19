import React, { useMemo, useState } from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';
import ContextMenu, { ContextMenuItem } from './ContextMenu';
import ToolCard from './ToolCard';
import ToolModal from './ToolModal';
import AppLibraryModal from './AppLibraryModal';

type SortKey = 'name' | 'lastUsed' | 'useCount' | 'createdAt';

const BATCH_COLORS = [
  '#4f8ef7', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#3498db', '#e67e22', '#e91e63', '#00bcd4',
];

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function scoreSearch(queryText: string, ...fields: Array<string | undefined>): number {
  if (!queryText) return 1;

  const tokens = queryText.split(/\s+/).filter(Boolean);
  const haystacks = fields
    .filter((field): field is string => Boolean(field))
    .map(field => normalizeSearch(field));

  let score = 0;

  for (const token of tokens) {
    let tokenScore = 0;

    for (const haystack of haystacks) {
      if (haystack === token) tokenScore = Math.max(tokenScore, 120);
      else if (haystack.startsWith(token)) tokenScore = Math.max(tokenScore, 90);
      else if (haystack.includes(token)) tokenScore = Math.max(tokenScore, 60);
      else {
        const compactHaystack = haystack.replace(/[\s\-_/]+/g, '');
        const compactToken = token.replace(/[\s\-_/]+/g, '');
        if (compactToken && compactHaystack.includes(compactToken)) tokenScore = Math.max(tokenScore, 35);
      }
    }

    if (tokenScore === 0) return 0;
    score += tokenScore;
  }

  return score;
}

export default function MainContent() {
  const {
    data,
    selectedCategoryId,
    searchQuery,
    launchTool,
    deleteTools,
    moveToolsToCategory,
    updateToolsColor,
    saveTool,
    showToast,
    expandImportItems,
    selectDirectory,
  } = useApp();
  const [editingTool, setEditingTool] = useState<Tool | null | undefined>(undefined);
  const [newToolPreset, setNewToolPreset] = useState<Partial<Tool> | null>(null);
  const [showAppLibrary, setShowAppLibrary] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [lastSelectedToolId, setLastSelectedToolId] = useState<string | null>(null);
  const [moveTargetCategoryId, setMoveTargetCategoryId] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

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
    const queryText = normalizeSearch(searchQuery);

    if (selectedCategoryId !== 'all') {
      tools = tools.filter(t => t.categoryId === selectedCategoryId);
    }

    const scoredTools = tools
      .map(tool => ({
        tool,
        score: scoreSearch(queryText, tool.name, tool.description, tool.path, tool.type),
      }))
      .filter(entry => entry.score > 0);

    return scoredTools.sort((a, b) => {
      if (queryText && a.score !== b.score) return b.score - a.score;

      let val = 0;
      switch (sortKey) {
        case 'name':
          val = a.tool.name.localeCompare(b.tool.name, 'zh-CN');
          break;
        case 'lastUsed':
          val = (b.tool.lastUsed ?? 0) - (a.tool.lastUsed ?? 0);
          break;
        case 'useCount':
          val = b.tool.useCount - a.tool.useCount;
          break;
        case 'createdAt':
          val = b.tool.createdAt - a.tool.createdAt;
          break;
      }
      return sortAsc ? val : -val;
    }).map(entry => entry.tool);
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
      label: '从应用库添加',
      icon: '📚',
      onClick: () => setShowAppLibrary(true),
    },
    {
      label: '导入目录',
      icon: '📂',
      onClick: () => { void importDirectory(); },
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

  const inferToolType = (filePath: string): Tool['type'] => {
    if (filePath.endsWith('.app')) return 'app';
    if (filePath.endsWith('.jar')) return 'jar';
    if (filePath.endsWith('.py')) return 'python';
    if (filePath.endsWith('.sh') || filePath.endsWith('.bash') || filePath.endsWith('.zsh')) return 'shell';
    if (filePath.endsWith('.bat') || filePath.endsWith('.cmd')) return 'batch';
    return 'executable';
  };

  const inferToolName = (value: string): string => {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const url = new URL(value);
        return url.hostname.replace(/^www\./, '');
      } catch {
        return value;
      }
    }
    const base = value.split('/').pop() ?? value;
    return base.replace(/\.[^.]+$/, '');
  };

  const importDroppedFiles = async (items: string[]) => {
    const categoryId = selectedCategoryId === 'all' ? 'misc' : selectedCategoryId;
    const existingKeys = new Set(data.tools.map(tool => `${tool.type}:${tool.path}`));
    let skipped = 0;
    let imported = 0;
    const localPaths = items.filter(item => !/^https?:\/\//i.test(item));
    const expandedPaths = localPaths.length > 0 ? await expandImportItems(localPaths) : [];
    const expandedUrls = items.filter(item => /^https?:\/\//i.test(item));
    const resolvedItems = Array.from(new Set([...expandedPaths, ...expandedUrls]));

    for (const item of resolvedItems) {
      const type = item.startsWith('http://') || item.startsWith('https://')
        ? 'url'
        : inferToolType(item);
      const key = `${type}:${item}`;

      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }

      await saveTool({
        id: '',
        name: inferToolName(item),
        description: '',
        type,
        path: item,
        args: '',
        categoryId,
        color: type === 'app' ? '#007aff' : '#4f8ef7',
        useCount: 0,
        createdAt: Date.now(),
      });
      existingKeys.add(key);
      imported += 1;
    }

    if (skipped > 0) {
      showToast('info', `已跳过 ${skipped} 个重复条目`);
    }

    if (imported > 0) {
      showToast('success', `已导入 ${imported} 个条目`);
    }
  };

  const importDirectory = async () => {
    const directory = await selectDirectory();
    if (!directory) return;
    await importDroppedFiles([directory]);
  };

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onClick={event => {
        const target = event.target as HTMLElement;
        if (target.closest('[data-tool-card="true"]') || target.closest('.context-menu')) return;
        if (selectedToolIds.length > 0) clearSelection();
      }}
      onDragEnter={event => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={event => {
        event.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={event => {
        event.preventDefault();
        const target = event.currentTarget as HTMLDivElement;
        const related = event.relatedTarget as Node | null;
        if (!related || !target.contains(related)) {
          setIsDragging(false);
        }
      }}
      onDrop={event => {
        event.preventDefault();
        setIsDragging(false);

        const filePaths = Array.from(event.dataTransfer.files)
          .map(file => (file as File & { path?: string }).path)
          .filter((value): value is string => Boolean(value));
        const urlList = event.dataTransfer.getData('text/uri-list')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        const plainText = event.dataTransfer.getData('text/plain').trim();
        const droppedUrls = plainText && /^https?:\/\//i.test(plainText) ? [plainText] : [];
        const imports = Array.from(new Set([...filePaths, ...urlList.filter(item => !item.startsWith('file://')), ...droppedUrls]));

        if (imports.length > 0) {
          void importDroppedFiles(imports);
        }
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

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <div style={{ fontSize: 42 }}>📥</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>拖到这里即可导入</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              支持 App、目录、脚本、可执行文件和网址
            </div>
          </div>
        </div>
      )}

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

      {showAppLibrary && (
        <AppLibraryModal
          defaultCategoryId={selectedCategoryId === 'all' ? 'misc' : selectedCategoryId}
          onClose={() => setShowAppLibrary(false)}
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
