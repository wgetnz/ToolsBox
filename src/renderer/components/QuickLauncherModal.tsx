import React from 'react';
import { Tool } from '../../shared/types';
import { useApp } from '../store/AppContext';

type LauncherItem =
  | { id: string; kind: 'action'; title: string; subtitle: string; icon: string; run: () => void; score: number }
  | { id: string; kind: 'tool'; title: string; subtitle: string; icon: string; image?: string; tool: Tool; score: number };

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

  const normalize = (value: string) => value.trim().toLowerCase();

  const scoreText = React.useCallback((queryText: string, ...fields: string[]) => {
    if (!queryText) return 1;

    const tokens = queryText.split(/\s+/).filter(Boolean);
    const haystacks = fields.map(field => normalize(field));
    let score = 0;

    for (const token of tokens) {
      let tokenScore = 0;

      for (const haystack of haystacks) {
        if (!haystack) continue;
        if (haystack === token) tokenScore = Math.max(tokenScore, 120);
        else if (haystack.startsWith(token)) tokenScore = Math.max(tokenScore, 90);
        else if (haystack.includes(token)) tokenScore = Math.max(tokenScore, 60);
        else {
          const compact = haystack.replace(/[\s\-_/]+/g, '');
          const compactToken = token.replace(/[\s\-_/]+/g, '');
          if (compact.includes(compactToken)) tokenScore = Math.max(tokenScore, 35);
        }
      }

      if (tokenScore === 0) return 0;
      score += tokenScore;
    }

    return score;
  }, []);

  const actionItems = React.useMemo<LauncherItem[]>(() => [
    {
      id: 'action-add-tool',
      kind: 'action',
      title: '添加工具',
      subtitle: '新建一个本地工具、脚本或网址',
      icon: '+',
      score: 0,
      run: onAddTool,
    },
    {
      id: 'action-open-library',
      kind: 'action',
      title: '打开应用库',
      subtitle: '从本机应用列表快速加入 LaunchBox',
      icon: '📚',
      score: 0,
      run: onOpenAppLibrary,
    },
    {
      id: 'action-open-settings',
      kind: 'action',
      title: '打开设置',
      subtitle: '调整外观、环境和系统行为',
      icon: '⚙️',
      score: 0,
      run: onOpenSettings,
    },
  ], [onAddTool, onOpenAppLibrary, onOpenSettings]);

  const toolItems = React.useMemo<LauncherItem[]>(() => {
    if (!data) return [];

    const queryText = normalize(query);

    return data.tools.map(tool => {
      const matchScore = scoreText(queryText, tool.name, tool.description, tool.path);
      const recentBoost = tool.lastUsed ? Math.min(tool.useCount * 4 + 20, 80) : Math.min(tool.useCount * 4, 40);
      const totalScore = matchScore + recentBoost;

      return {
      id: tool.id,
      kind: 'tool',
      title: tool.name,
      subtitle: tool.description || tool.path,
      icon: TOOL_TYPE_ICONS[tool.type] ?? '🔧',
      image: tool.icon,
      score: totalScore,
      tool,
      };
    });
  }, [data, query, scoreText]);

  const visibleItems = React.useMemo(() => {
    const q = normalize(query);
    const actions = actionItems
      .map(item => ({
        ...item,
        score: q ? scoreText(q, item.title, item.subtitle) + 10 : 50,
      }))
      .filter(item => item.score > 0);

    const tools = toolItems.filter(item => item.score > 0);

    return [...actions, ...tools]
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.kind !== b.kind) return a.kind === 'tool' ? -1 : 1;
        return a.title.localeCompare(b.title, 'zh-CN');
      })
      .slice(0, 12);
  }, [actionItems, query, scoreText, toolItems]);

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
                <span className="quick-launcher-icon">
                  {item.kind === 'tool' && item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 6 }}
                    />
                  ) : (
                    item.icon
                  )}
                </span>
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
