import React from 'react';
import { AppLibraryEntry, Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';

interface Props {
  defaultCategoryId: string;
  onClose: () => void;
}

export default function AppLibraryModal({ defaultCategoryId, onClose }: Props) {
  const { data, getAppLibrary, saveTool } = useApp();
  const [entries, setEntries] = React.useState<AppLibraryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState('');
  const [categoryId, setCategoryId] = React.useState(defaultCategoryId);
  const [addingIds, setAddingIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    void (async () => {
      setLoading(true);
      const library = await getAppLibrary();
      setEntries(library);
      setLoading(false);
    })();
  }, [getAppLibrary]);

  React.useEffect(() => {
    setCategoryId(defaultCategoryId);
  }, [defaultCategoryId]);

  if (!data) return null;

  const categories = data.categories.filter(category => category.id !== 'all');
  const filtered = entries.filter(entry =>
    !query.trim() || entry.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const addApp = async (entry: AppLibraryEntry) => {
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
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
                      <div className="app-library-name">{entry.name}</div>
                      <div className="app-library-path">{entry.path}</div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { void addApp(entry); }}
                      disabled={adding}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {adding ? '添加中...' : '添加'}
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
