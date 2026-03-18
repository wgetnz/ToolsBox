import React, { useMemo, useState } from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';
import ToolCard from './ToolCard';
import ToolModal from './ToolModal';

type SortKey = 'name' | 'lastUsed' | 'useCount' | 'createdAt';

export default function MainContent() {
  const { data, selectedCategoryId, searchQuery, launchTool } = useApp();
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

      {/* Cards grid */}
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
