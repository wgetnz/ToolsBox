import React from 'react';
import { AppLibraryEntry, Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';

interface Props {
  defaultCategoryId: string;
  onClose: () => void;
}

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

export default function AppLibraryModal({ defaultCategoryId, onClose }: Props) {
  const { data, getAppLibrary, saveTool, showToast } = useApp();
  const [entries, setEntries] = React.useState<AppLibraryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [categoryId, setCategoryId] = React.useState(defaultCategoryId);
  const [addingIds, setAddingIds] = React.useState<string[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);

  const refreshLibrary = React.useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    const library = await getAppLibrary();
    setEntries(library);
    setLoading(false);
    setRefreshing(false);
  }, [getAppLibrary]);

  React.useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  React.useEffect(() => {
    setCategoryId(defaultCategoryId);
  }, [defaultCategoryId]);

  if (!data) return null;

  const categories = data.categories.filter(category => category.id !== 'all');
  const existingAppPaths = new Set(
    data.tools.filter(tool => tool.type === 'app').map(tool => tool.path)
  );
  const filtered = React.useMemo(() => {
    const queryText = normalizeSearch(query);
    return entries
      .map(entry => ({
        entry,
        score: scoreSearch(queryText, entry.name, entry.path, entry.source === 'system' ? '系统' : '本地'),
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => {
        if (queryText && a.score !== b.score) return b.score - a.score;
        if (a.entry.source !== b.entry.source) return a.entry.source === 'user' ? -1 : 1;
        return a.entry.name.localeCompare(b.entry.name, 'zh-CN');
      })
      .map(item => item.entry);
  }, [entries, query]);

  const addApp = async (entry: AppLibraryEntry) => {
    if (existingAppPaths.has(entry.path)) {
      showToast('info', `"${entry.name}" 已经在 LaunchBox 中`);
      return;
    }

    setAddingIds(current => [...current, entry.id]);

    const tool: Tool = {
      id: '',
      name: entry.name,
      description: '',
      type: 'app',
      path: entry.path,
      args: '',
      categoryId,
      icon: entry.icon,
      color: '#007aff',
      useCount: 0,
      createdAt: Date.now(),
    };

    await saveTool(tool);
    setAddingIds(current => current.filter(id => id !== entry.id));
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 760, height: 620 }} onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">应用库</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ paddingBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px auto', gap: 12 }}>
            <input
              className="input"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索本机 App..."
            />
            <select
              className="input"
              value={categoryId}
              onChange={event => setCategoryId(event.target.value)}
            >
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => { void refreshLibrary(); }}
              disabled={refreshing}
            >
              {refreshing ? '刷新中...' : '刷新'}
            </button>
          </div>

          {loading ? (
            <div className="empty-state" style={{ minHeight: 320 }}>
              <div className="empty-icon">📚</div>
              <p>正在扫描本机应用...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 320 }}>
              <div className="empty-icon">📭</div>
              <p>没有找到匹配的 App</p>
            </div>
          ) : (
            <div className="app-library-grid">
              {filtered.map(entry => {
                const adding = addingIds.includes(entry.id);
                return (
                  <div key={entry.id} className="app-library-card">
                    <div className="app-library-icon">
                      {entry.icon ? <img src={entry.icon} alt={entry.name} /> : <span>📱</span>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div className="app-library-name" style={{ marginBottom: 0 }}>{entry.name}</div>
                        <span className={`app-library-badge ${entry.source === 'system' ? 'system' : 'user'}`}>
                          {entry.source === 'system' ? '系统' : '本地'}
                        </span>
                      </div>
                      <div className="app-library-path">{entry.path}</div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { void addApp(entry); }}
                      disabled={adding || existingAppPaths.has(entry.path)}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {adding ? '添加中...' : existingAppPaths.has(entry.path) ? '已添加' : '添加'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
