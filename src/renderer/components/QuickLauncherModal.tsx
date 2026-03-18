import React from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';

type LauncherItem =
  | { id: string; kind: 'action'; title: string; subtitle: string; icon: string; run: () => void }
  | { id: string; kind: 'tool'; title: string; subtitle: string; icon: string; tool: Tool };

interface Props {
  onClose: () => void;
  onAddTool: () => void;
  onOpenSettings: () => void;
  onOpenAppLibrary: () => void;
}

const TOOL_TYPE_ICONS: Record<string, string> = {
  jar: '☕',
  python: '🐍',
  shell: '💻',
  executable: '⚡',
  app: '📱',
  batch: '📜',
  url: '🌐',
};

export default function QuickLauncherModal({
  onClose,
  onAddTool,
  onOpenSettings,
  onOpenAppLibrary,
}: Props) {
  const { data, launchTool } = useApp();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);

  const actionItems = React.useMemo<LauncherItem[]>(() => [
    {
      id: 'action-add-tool',
      kind: 'action',
      title: '添加工具',
      subtitle: '新建一个本地工具、脚本或网址',
      icon: '+',
      run: onAddTool,
    },
    {
      id: 'action-open-library',
      kind: 'action',
      title: '打开应用库',
      subtitle: '从本机应用列表快速加入 LaunchBox',
      icon: '📚',
      run: onOpenAppLibrary,
    },
    {
      id: 'action-open-settings',
      kind: 'action',
      title: '打开设置',
      subtitle: '调整外观、环境和系统行为',
      icon: '⚙️',
      run: onOpenSettings,
    },
  ], [onAddTool, onOpenAppLibrary, onOpenSettings]);

  const toolItems = React.useMemo<LauncherItem[]>(() => {
    if (!data) return [];

    const sorted = [...data.tools].sort((a, b) => {
      const queryText = query.trim().toLowerCase();
      const aMatches = queryText && a.name.toLowerCase().includes(queryText) ? 1 : 0;
      const bMatches = queryText && b.name.toLowerCase().includes(queryText) ? 1 : 0;

      if (aMatches !== bMatches) return bMatches - aMatches;
      if ((a.lastUsed ?? 0) !== (b.lastUsed ?? 0)) return (b.lastUsed ?? 0) - (a.lastUsed ?? 0);
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    return sorted.map(tool => ({
      id: tool.id,
      kind: 'tool',
      title: tool.name,
      subtitle: tool.description || tool.path,
      icon: TOOL_TYPE_ICONS[tool.type] ?? '🔧',
      tool,
    }));
  }, [data, query]);

  const visibleItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const actions = !q
      ? actionItems
      : actionItems.filter(item =>
          item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
        );

    const tools = toolItems.filter(item =>
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q)
    );

    return [...actions, ...tools].slice(0, 12);
  }, [actionItems, toolItems, query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(index => Math.min(index + 1, Math.max(visibleItems.length - 1, 0)));
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(index => Math.max(index - 1, 0));
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const item = visibleItems[activeIndex];
        if (!item) return;

        if (item.kind === 'action') {
          item.run();
        } else {
          void launchTool(item.tool.id);
        }
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, launchTool, onClose, visibleItems]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="quick-launcher"
        onClick={event => event.stopPropagation()}
      >
        <div className="quick-launcher-header">
          <input
            className="input quick-launcher-input"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索工具或执行动作..."
            autoFocus
          />
        </div>

        <div className="quick-launcher-list">
          {visibleItems.length === 0 ? (
            <div className="empty-state" style={{ minHeight: 180 }}>
              <div className="empty-icon">🔎</div>
              <p>没有找到匹配的工具或动作</p>
            </div>
          ) : (
            visibleItems.map((item, index) => (
              <button
                key={item.id}
                className={`quick-launcher-item${index === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  if (item.kind === 'action') {
                    item.run();
                  } else {
                    void launchTool(item.tool.id);
                  }
                  onClose();
                }}
              >
                <span className="quick-launcher-icon">{item.icon}</span>
                <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                  <span className="quick-launcher-title">{item.title}</span>
                  <span className="quick-launcher-subtitle">{item.subtitle}</span>
                </span>
                <span className="quick-launcher-tag">{item.kind === 'action' ? '动作' : '工具'}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
