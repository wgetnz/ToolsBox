import React, { useState, useEffect, useMemo } from 'react';
import { Tool, ToolType } from '../../shared/types';
import { useApp } from '../store/AppContext';

const TOOL_TYPES: { value: ToolType; label: string; icon: string }[] = [
  { value: 'jar', label: 'JAR 包', icon: '☕' },
  { value: 'python', label: 'Python 脚本', icon: '🐍' },
  { value: 'shell', label: 'Shell 脚本', icon: '💻' },
  { value: 'executable', label: '可执行文件', icon: '⚡' },
  { value: 'app', label: 'macOS App', icon: '📱' },
  { value: 'url', label: 'URL / 网页', icon: '🌐' },
];

const ACCENT_COLORS = [
  '#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#ff375f',
  '#64d2ff', '#ffd60a',
];

interface Props {
  tool?: Tool | null;
  onClose: () => void;
}

function emptyTool(): Partial<Tool> {
  return {
    name: '',
    description: '',
    type: 'executable',
    path: '',
    args: '',
    workingDirectory: '',
    categoryId: 'misc',
    useCount: 0,
    createdAt: Date.now(),
  };
}

function inferType(filePath: string): ToolType {
  if (filePath.endsWith('.app')) return 'app';
  if (filePath.endsWith('.sh') || filePath.endsWith('.bash') || filePath.endsWith('.zsh')) return 'shell';
  if (filePath.endsWith('.jar')) return 'jar';
  if (filePath.endsWith('.py')) return 'python';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return 'url';
  return 'executable';
}

export default function ToolModal({ tool, onClose }: Props) {
  const { data, saveTool, selectFile, selectDirectory } = useApp();
  const [form, setForm] = useState<Partial<Tool>>(tool ? { ...tool } : emptyTool());
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setForm(tool ? { ...tool } : emptyTool());
  }, [tool]);

  const categories = data?.categories;
  const settings = data?.settings;

  const leafCategories = useMemo(() => {
    const resolvedCategories = categories ?? [];
    const parentIds = new Set(resolvedCategories.filter(item => item.parentId).map(item => item.parentId));
    const leaves = resolvedCategories.filter(item => item.id !== 'all' && !parentIds.has(item.id));

    if (form.categoryId && form.categoryId !== 'all' && !leaves.some(item => item.id === form.categoryId)) {
      const currentCategory = resolvedCategories.find(item => item.id === form.categoryId);
      if (currentCategory) return [...leaves, currentCategory];
    }

    return leaves;
  }, [categories, form.categoryId]);

  if (!data || !settings) return null;

  const update = (field: keyof Tool, value: unknown) =>
    setForm(current => ({ ...current, [field]: value }));

  const handleBrowse = async () => {
    let filters: { name: string; extensions: string[] }[] | undefined;
    switch (form.type) {
      case 'jar':
        filters = [{ name: 'JAR Files', extensions: ['jar'] }];
        break;
      case 'python':
        filters = [{ name: 'Python Files', extensions: ['py'] }];
        break;
      case 'shell':
        filters = [{ name: 'Shell Scripts', extensions: ['sh', 'bash', 'zsh'] }];
        break;
      case 'app':
        filters = [{ name: 'Applications', extensions: ['app'] }];
        break;
      default:
        filters = undefined;
    }

    const filePath = await selectFile(filters);
    if (filePath) {
      update('path', filePath);
      if (!form.name) {
        const filename = filePath.split('/').pop() ?? filePath;
        update('name', filename.replace(/\.[^.]+$/, ''));
      }
    }
  };

  const handleBrowseDir = async () => {
    const dir = await selectDirectory();
    if (dir) update('workingDirectory', dir);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const filePath = (event.dataTransfer.files[0] as File & { path?: string })?.path;
    if (!filePath) return;

    const filename = filePath.split('/').pop() ?? filePath;
    const name = filename.replace(/\.app$/, '').replace(/\.[^.]+$/, '');
    const type = inferType(filePath);

    let icon: string | undefined;
    try {
      const result = await window.launchbox.getFileIcon(filePath);
      icon = result ?? undefined;
    } catch {
      icon = undefined;
    }

    setForm(current => ({ ...current, name, path: filePath, type, icon }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return;
    if (!form.path?.trim()) return;
    setSaving(true);
    await saveTool(form as Tool);
    setSaving(false);
    onClose();
  };

  const isEditing = Boolean(tool?.id);
  const showWorkingDir = form.type !== 'url' && form.type !== 'app';

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
                onChange={event => update('path', event.target.value)}
                placeholder={form.type === 'url' ? 'https://...' : '/path/to/tool'}
                style={{ flex: 1 }}
              />
              {form.type !== 'url' && (
                <button className="btn btn-secondary" onClick={handleBrowse}>浏览</button>
              )}
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
