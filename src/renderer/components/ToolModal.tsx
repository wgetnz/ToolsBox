import React, { useState, useEffect, useMemo } from 'react';
import { Tool, ToolType } from '../../shared/types';
import { useApp } from '../store/AppContext';
import { getToolFallbackIcon } from '../utils/toolIcons';

const TOOL_TYPES: { value: ToolType; label: string; icon: string }[] = [
  { value: 'jar', label: 'JAR 包', icon: '☕' },
  { value: 'python', label: 'Python 脚本', icon: '🐍' },
  { value: 'shell', label: 'Shell 脚本', icon: '💻' },
  { value: 'executable', label: '可执行文件', icon: '⚙️' },
  { value: 'app', label: 'macOS App', icon: '🧩' },
  { value: 'url', label: 'URL / 网页', icon: '🌐' },
];

const ACCENT_COLORS = [
  '#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#ff375f',
  '#64d2ff', '#ffd60a',
];

interface Props {
  tool?: Tool | null;
  initialCategoryId?: string;
  onClose: () => void;
}

function emptyTool(initialCategoryId?: string): Partial<Tool> {
  return {
    name: '',
    description: '',
    type: 'executable',
    path: '',
    args: '',
    workingDirectory: '',
    categoryId: initialCategoryId ?? 'misc',
    useCount: 0,
    createdAt: Date.now(),
  };
}

function inferType(filePath: string): ToolType {
  const trimmedPath = filePath.trim();
  const lowerPath = trimmedPath.toLowerCase();

  if (lowerPath.startsWith('http://') || lowerPath.startsWith('https://')) return 'url';
  if (lowerPath.endsWith('.app')) return 'app';
  if (lowerPath.endsWith('.sh') || lowerPath.endsWith('.bash') || lowerPath.endsWith('.zsh')) return 'shell';
  if (lowerPath.endsWith('.jar')) return 'jar';
  if (lowerPath.endsWith('.py')) return 'python';
  return 'executable';
}

async function resolveToolIcon(filePath: string, type: ToolType): Promise<string | undefined> {
  if (type === 'url' || !filePath.trim()) return undefined;

  try {
    const result = await window.launchbox.getFileIcon(filePath);
    return result ?? undefined;
  } catch {
    return undefined;
  }
}

export default function ToolModal({ tool, initialCategoryId, onClose }: Props) {
  const { data, saveTool, selectFile, selectDirectory } = useApp();
  const [form, setForm] = useState<Partial<Tool>>(tool ? { ...tool } : emptyTool(initialCategoryId));
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [resolvingIcon, setResolvingIcon] = useState(false);

  useEffect(() => {
    setForm(tool ? { ...tool } : emptyTool(initialCategoryId));
  }, [initialCategoryId, tool]);

  const categories = data?.categories;
  const settings = data?.settings;

  const leafCategories = useMemo(() => {
    const resolvedCategories = categories ?? [];
    const parentIds = new Set(resolvedCategories.filter(item => item.parentId).map(item => item.parentId));
    return resolvedCategories.filter(item => item.id !== 'all' && !parentIds.has(item.id));
  }, [categories]);

  useEffect(() => {
    if (!leafCategories.length) return;
    if (form.categoryId && leafCategories.some(item => item.id === form.categoryId)) return;

    const fallbackCategoryId = initialCategoryId && leafCategories.some(item => item.id === initialCategoryId)
      ? initialCategoryId
      : leafCategories[0].id;

    setForm(current => ({ ...current, categoryId: fallbackCategoryId }));
  }, [form.categoryId, initialCategoryId, leafCategories]);

  const update = (field: keyof Tool, value: unknown) =>
    setForm(current => ({ ...current, [field]: value }));

  const updateForm = (updater: (current: Partial<Tool>) => Partial<Tool>) => {
    setForm(current => updater(current));
  };

  const refreshDefaultIcon = async (filePath: string, type: ToolType) => {
    setResolvingIcon(true);
    const icon = await resolveToolIcon(filePath, type);
    updateForm(current => ({ ...current, icon, iconSource: icon ? 'default' : undefined }));
    setResolvingIcon(false);
    return icon;
  };

  useEffect(() => {
    if (form.type !== 'app') return;
    if (!form.path?.trim().endsWith('.app')) return;
    if (form.iconSource === 'custom') return;

    let cancelled = false;

    void (async () => {
      setResolvingIcon(true);
      const icon = await resolveToolIcon(form.path!, 'app');
      if (!cancelled) {
        updateForm(current => {
          if (current.type !== 'app' || current.path !== form.path || current.iconSource === 'custom') {
            return current;
          }
          return { ...current, icon, iconSource: icon ? 'default' : undefined };
        });
        setResolvingIcon(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.iconSource, form.path, form.type]);

  if (!data || !settings) return null;

  const handleBrowse = async () => {
    const filePath = await selectFile();
    if (filePath) {
      const filename = filePath.split('/').pop() ?? filePath;
      const inferredType = inferType(filePath);
      const nextName = form.name?.trim() ? form.name : filename.replace(/\.app$/, '').replace(/\.[^.]+$/, '');
      setResolvingIcon(true);
      const icon = await resolveToolIcon(filePath, inferredType);
      setResolvingIcon(false);

      setForm(current => ({
        ...current,
        path: filePath,
        name: current.name?.trim() ? current.name : nextName,
        type: inferredType,
        icon,
        iconSource: icon ? 'default' : undefined,
      }));
    }
  };

  const handleBrowseDir = async () => {
    const dir = await selectDirectory();
    if (dir) update('workingDirectory', dir);
  };

  const handlePathChange = (value: string) => {
    const inferredType = inferType(value);
    updateForm(current => {
      const nextType = value.trim() ? inferredType : current.type;
      const nextState: Partial<Tool> = {
        ...current,
        path: value,
        type: nextType,
      };

      if (inferredType !== 'app' && current.iconSource !== 'custom') {
        nextState.icon = undefined;
        nextState.iconSource = undefined;
      }

      return nextState;
    });
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const filePath = (event.dataTransfer.files[0] as File & { path?: string })?.path;
    if (!filePath) return;

    const filename = filePath.split('/').pop() ?? filePath;
    const name = filename.replace(/\.app$/, '').replace(/\.[^.]+$/, '');
    const type = inferType(filePath);
    setResolvingIcon(true);
    const icon = await resolveToolIcon(filePath, type);
    setResolvingIcon(false);

    setForm(current => ({ ...current, name, path: filePath, type, icon, iconSource: icon ? 'default' : undefined }));
  };

  const handleBrowseCustomIcon = async () => {
    const imagePath = await selectFile([
      { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'icns'] },
    ]);
    if (!imagePath) return;

    setResolvingIcon(true);
    try {
      const icon = await window.launchbox.loadImageDataUrl(imagePath);
      if (icon) {
        setForm(current => ({ ...current, icon, iconSource: 'custom' }));
      }
    } finally {
      setResolvingIcon(false);
    }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    if (!form.path?.trim()) return;
    setSaving(true);
    let nextIcon = form.icon;
    const inferredType = inferType(form.path);
    let nextIconSource = form.iconSource;
    if ((nextIconSource !== 'custom') && inferredType === 'app') {
      nextIcon = await refreshDefaultIcon(form.path, inferredType);
      nextIconSource = nextIcon ? 'default' : undefined;
    }
    await saveTool({ ...form, type: inferredType, icon: nextIcon, iconSource: nextIconSource } as Tool);
    setSaving(false);
    onClose();
  };

  const isEditing = Boolean(tool?.id);
  const showWorkingDir = form.type !== 'url' && form.type !== 'app';
  const previewType = form.type ?? (form.path ? inferType(form.path) : 'executable');
  const previewIcon = form.icon;
  const previewEmoji = getToolFallbackIcon({
    type: previewType,
    path: form.path,
    name: form.name,
  });

  return (
    <div
      className="overlay"
      onClick={onClose}
      onDrop={handleDrop}
      onDragOver={event => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
    >
      <div
        className="modal"
        style={{ width: 560, outline: dragOver ? '2px dashed var(--accent-color)' : 'none' }}
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">{isEditing ? '编辑工具' : '添加工具'}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {dragOver && (
            <div style={{ textAlign: 'center', color: 'var(--accent-color)', fontSize: 13, padding: '8px 0' }}>
              拖入 .app 或其他文件自动填充
            </div>
          )}

          <div className="form-group">
            <label className="form-label">工具类型</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TOOL_TYPES.map(item => (
                <button
                  key={item.value}
                  onClick={() => update('type', item.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${form.type === item.value ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    background: form.type === item.value ? 'var(--accent-color)' : 'var(--bg-input)',
                    color: form.type === item.value ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'all 0.1s',
                    fontFamily: 'inherit',
                  }}
                >
                  <span>{item.icon}</span> {item.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              选择文件或输入路径后会自动识别类型，当前以路径识别结果为准。
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">工具名称 *</label>
              <input
                className="input"
                value={form.name}
                onChange={event => update('name', event.target.value)}
                placeholder="输入工具名称"
              />
            </div>
            <div className="form-group">
              <label className="form-label">颜色标签</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div
                  onClick={() => update('accentColor', undefined)}
                  title="无颜色"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: '1.5px solid var(--border-color)',
                    cursor: 'pointer',
                    outline: !form.accentColor ? '2px solid var(--accent-color)' : 'none',
                    outlineOffset: 2,
                  }}
                />
                {ACCENT_COLORS.map(color => (
                  <div
                    key={color}
                    onClick={() => update('accentColor', color)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: color,
                      cursor: 'pointer',
                      outline: form.accentColor === color ? '2px solid var(--accent-color)' : 'none',
                      outlineOffset: 2,
                      transition: 'transform 0.1s',
                      transform: form.accentColor === color ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">描述</label>
            <input
              className="input"
              value={form.description}
              onChange={event => update('description', event.target.value)}
              placeholder="简短描述（可选）"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {form.type === 'url' ? 'URL 地址 *' : '文件路径 *'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                value={form.path}
                onChange={event => handlePathChange(event.target.value)}
                placeholder={form.type === 'url' ? 'https://...' : '/path/to/tool'}
                style={{ flex: 1 }}
              />
              {form.type !== 'url' && (
                <button className="btn btn-secondary" onClick={handleBrowse}>浏览</button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">工具图标</label>
            <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {previewIcon
                  ? <img src={previewIcon} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  : <span style={{ fontSize: 32 }}>{previewEmoji}</span>
                }
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => void refreshDefaultIcon(form.path ?? '', previewType)}
                  disabled={!form.path?.trim() || previewType === 'url' || resolvingIcon}
                >
                  {resolvingIcon ? '读取中...' : '使用默认图标'}
                </button>
                <button className="btn btn-secondary" onClick={handleBrowseCustomIcon} disabled={resolvingIcon}>
                  自定义图标
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => updateForm(current => ({ ...current, icon: undefined, iconSource: undefined }))}
                  disabled={!form.icon}
                >
                  清除图标
                </button>
                <div style={{ width: '100%', fontSize: 12, color: 'var(--text-muted)' }}>
                  默认会读取应用本体图标，你也可以手动指定 PNG、JPG、WEBP、GIF 或 ICNS。
                </div>
                <div style={{ width: '100%', fontSize: 12, color: 'var(--text-muted)' }}>
                  当前来源：{form.iconSource === 'custom' ? '自定义图标' : form.iconSource === 'default' ? '应用默认图标' : '未设置'}
                </div>
              </div>
            </div>
          </div>

          {showWorkingDir && (
            <div className="form-group">
              <label className="form-label">工作目录</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  value={form.workingDirectory ?? ''}
                  onChange={event => update('workingDirectory', event.target.value || undefined)}
                  placeholder="留空则使用文件所在目录"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={handleBrowseDir}>选择</button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">启动参数</label>
            <input
              className="input"
              value={form.args}
              onChange={event => update('args', event.target.value)}
              placeholder="例: -Xmx2g / --port 8080"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">分类</label>
              <select
                className="input"
                value={form.categoryId}
                onChange={event => update('categoryId', event.target.value)}
              >
                {leafCategories.map(category => (
                  <option key={category.id} value={category.id}>{category.icon} {category.name}</option>
                ))}
              </select>
            </div>

            {form.type === 'jar' && settings.javaEnvs.length > 0 && (
              <div className="form-group">
                <label className="form-label">Java 环境</label>
                <select
                  className="input"
                  value={form.javaEnvId ?? ''}
                  onChange={event => update('javaEnvId', event.target.value || undefined)}
                >
                  <option value="">使用系统默认</option>
                  {settings.javaEnvs.map(env => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>
            )}

            {form.type === 'python' && settings.pythonEnvs.length > 0 && (
              <div className="form-group">
                <label className="form-label">Python 环境</label>
                <select
                  className="input"
                  value={form.pythonEnvId ?? ''}
                  onChange={event => update('pythonEnvId', event.target.value || undefined)}
                >
                  <option value="">使用系统默认</option>
                  {settings.pythonEnvs.map(env => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
